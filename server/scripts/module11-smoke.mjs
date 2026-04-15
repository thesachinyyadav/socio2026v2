import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const rootDir = path.resolve(process.cwd(), "..");
const envPath = path.join(rootDir, "client", ".env.local");
if (!fs.existsSync(envPath)) {
  throw new Error(`Missing env file: ${envPath}`);
}

dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "").replace(/\/api$/, "");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in client/.env.local");
}
if (!API_BASE) {
  throw new Error("Missing NEXT_PUBLIC_API_URL in client/.env.local");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NOW = Date.now();
const RUN_ID = `smoke-${NOW}`;
const TEST_DOMAIN = "christuniversity.in";
const TEST_PASSWORD = `S0cio!${NOW}Aa#`;
const TEST_CAMPUS = "Central Campus";
const TEST_DEPARTMENT = "Computer Science";
const TEST_SCHOOL = "School of Sciences";
const TEST_IDS = {
  eventHodDean: `EVT-HD-${NOW}`,
  eventCfo: `EVT-CFO-${NOW}`,
  eventAccounts: `EVT-ACC-${NOW}`,
  festHod: `FST-HOD-${NOW}`,
  festDean: `FST-DEAN-${NOW}`,
  festCfo: `FST-CFO-${NOW}`,
  festAccounts: `FST-ACC-${NOW}`,
};

const ROLE_USERS = {
  organizer: {
    email: `organizer-${NOW}@${TEST_DOMAIN}`,
    name: `Organizer ${RUN_ID}`,
    flags: { is_organiser: true },
    university_role: "organizer",
  },
  hod: {
    email: `hod-${NOW}@${TEST_DOMAIN}`,
    name: `HOD ${RUN_ID}`,
    flags: { is_hod: true },
    university_role: "hod",
  },
  dean: {
    email: `dean-${NOW}@${TEST_DOMAIN}`,
    name: `Dean ${RUN_ID}`,
    flags: { is_dean: true },
    university_role: "dean",
  },
  cfo: {
    email: `cfo-${NOW}@${TEST_DOMAIN}`,
    name: `CFO ${RUN_ID}`,
    flags: { is_cfo: true },
    university_role: "cfo",
  },
  accounts: {
    email: `accounts-${NOW}@${TEST_DOMAIN}`,
    name: `Accounts ${RUN_ID}`,
    flags: { is_finance_office: true },
    university_role: "finance_officer",
  },
};

const cleanup = {
  userEmails: new Set(),
  userAuthIds: new Set(),
  eventIds: new Set(),
  festIds: new Set(),
};

let API_PREFIX = "";

function must(condition, message) {
  if (!condition) throw new Error(message);
}

async function sql(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  must(token, "Missing SUPABASE_ACCESS_TOKEN in client/.env.local");
  const res = await fetch(`https://api.supabase.com/v1/projects/${new URL(SUPABASE_URL).hostname.split(".")[0]}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `SQL query failed (${res.status})`);
  }
  return data?.value || [];
}

async function ensureRoleUser(roleKey) {
  const role = ROLE_USERS[roleKey];
  let authId = null;

  const existing = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existing.error) throw existing.error;
  const found = existing.data.users.find((u) => (u.email || "").toLowerCase() === role.email.toLowerCase());

  if (found) {
    authId = found.id;
    await supabase.auth.admin.updateUserById(authId, {
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: role.name },
    });
  } else {
    const created = await supabase.auth.admin.createUser({
      email: role.email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: role.name },
    });
    if (created.error) throw created.error;
    authId = created.data.user?.id || null;
  }

  must(authId, `Unable to provision auth user for ${roleKey}`);

  const userRow = {
    auth_uuid: authId,
    email: role.email,
    name: role.name,
    campus: TEST_CAMPUS,
    department: TEST_DEPARTMENT,
    school: TEST_SCHOOL,
    university_role: role.university_role,
    is_organiser: false,
    is_support: false,
    is_masteradmin: false,
    is_hod: false,
    is_dean: false,
    is_cfo: false,
    is_finance_office: false,
    is_organiser_student: false,
    organization_type: "christ_member",
    ...role.flags,
  };

  const upserted = await supabase
    .from("users")
    .upsert(userRow, { onConflict: "email" })
    .select("id,email,auth_uuid")
    .single();

  if (upserted.error) throw upserted.error;

  cleanup.userEmails.add(role.email.toLowerCase());
  cleanup.userAuthIds.add(authId);

  return { ...role, auth_uuid: authId };
}

async function signIn(email) {
  const client = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error) throw error;
  const token = data.session?.access_token;
  must(token, `Failed to obtain token for ${email}`);
  return token;
}

async function requestAs(token, method, route, body = null) {
  const res = await fetch(`${API_BASE}${API_PREFIX}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  return { status: res.status, ok: res.ok, payload };
}

async function detectApiPrefix() {
  const candidates = ["", "/api"];

  for (const candidate of candidates) {
    try {
      const res = await fetch(`${API_BASE}${candidate}/events`, { method: "GET" });
      if (res.status === 200 || res.status === 401 || res.status === 403) {
        API_PREFIX = candidate;
        return;
      }
    } catch {
      // Ignore and try next candidate.
    }
  }

  // Default to /api in ambiguous cases.
  API_PREFIX = "/api";
}

async function createEventFixture({ eventId, workflowStatus, needsHodDean, needsBudget, organizerEmail, organizerAuthUuid }) {
  const nowIso = new Date().toISOString();
  const eventDate = new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString();

  const row = {
    event_id: eventId,
    auth_uuid: organizerAuthUuid,
    title: `${eventId} Title`,
    description: `Module 11 smoke fixture ${eventId}`,
    event_date: eventDate,
    venue: "Main Auditorium",
    organizing_dept: TEST_DEPARTMENT,
    campus_hosted_at: TEST_CAMPUS,
    organizer_email: organizerEmail,
    created_by: organizerEmail,
    registration_fee: 500,
    claims_applicable: Boolean(needsBudget),
    department_access: [],
    rules: [],
    schedule: [],
    prizes: [],
    custom_fields: [],
    allowed_campuses: [],
    workflow_status: workflowStatus,
    event_context: "standalone",
    needs_hod_dean_approval: Boolean(needsHodDean),
    needs_budget_approval: Boolean(needsBudget),
    workflow_version: 1,
    status: "pending_approval",
    approval_state: "PENDING",
    is_draft: false,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const inserted = await supabase.from("events").insert(row);
  if (inserted.error) throw inserted.error;
  cleanup.eventIds.add(eventId);
}

async function createFestFixture({ festId, workflowStatus, organizerEmail, organizerAuthUuid }) {
  const nowIso = new Date().toISOString();
  const start = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString();
  const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 12).toISOString();

  const row = {
    fest_id: festId,
    auth_uuid: organizerAuthUuid,
    fest_title: `${festId} Title`,
    description: `Module 11 smoke fixture ${festId}`,
    opening_date: start,
    closing_date: end,
    venue: "Campus Ground",
    campus_hosted_at: TEST_CAMPUS,
    organizing_dept: TEST_DEPARTMENT,
    school: TEST_SCHOOL,
    contact_email: organizerEmail,
    created_by: organizerEmail,
    department_access: [],
    event_heads: [],
    timeline: [],
    sponsors: [],
    social_links: [],
    faqs: [],
    custom_fields: [],
    allowed_campuses: [],
    workflow_status: workflowStatus,
    workflow_version: 1,
    status: "pending_approval",
    approval_state: "PENDING",
    is_draft: false,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const inserted = await supabase.from("fests").insert(row);
  if (inserted.error) throw inserted.error;
  cleanup.festIds.add(festId);
}

async function runChecks(tokens) {
  const results = [];

  const checks = [
    {
      role: "HOD",
      key: "hod",
      method: "POST",
      route: `/events/${encodeURIComponent(TEST_IDS.eventHodDean)}/hod-dean-action`,
      body: { hod_action: "approved", hod_notes: "Approved in automated smoke test path." },
      expect: [200],
    },
    {
      role: "Dean",
      key: "dean",
      method: "POST",
      route: `/events/${encodeURIComponent(TEST_IDS.eventHodDean)}/hod-dean-action`,
      body: { dean_action: "approved", dean_notes: "Approved in automated smoke test path." },
      expect: [200],
    },
    {
      role: "CFO",
      key: "cfo",
      method: "POST",
      route: `/events/${encodeURIComponent(TEST_IDS.eventCfo)}/cfo-action`,
      body: { action: "approved", notes: "Approved in automated smoke test path." },
      expect: [200],
    },
    {
      role: "Finance",
      key: "accounts",
      method: "POST",
      route: `/events/${encodeURIComponent(TEST_IDS.eventAccounts)}/accounts-action`,
      body: { action: "approved", notes: "Approved in automated smoke test path." },
      expect: [200],
    },
    {
      role: "HOD (Fest)",
      key: "hod",
      method: "POST",
      route: `/fests/${encodeURIComponent(TEST_IDS.festHod)}/hod-action`,
      body: { action: "approved", notes: "Approved in automated smoke test path." },
      expect: [200],
    },
    {
      role: "Dean (Fest)",
      key: "dean",
      method: "POST",
      route: `/fests/${encodeURIComponent(TEST_IDS.festDean)}/dean-action`,
      body: { action: "approved", notes: "Approved in automated smoke test path." },
      expect: [200],
    },
    {
      role: "CFO (Fest)",
      key: "cfo",
      method: "POST",
      route: `/fests/${encodeURIComponent(TEST_IDS.festCfo)}/cfo-action`,
      body: { action: "approved", notes: "Approved in automated smoke test path." },
      expect: [200],
    },
    {
      role: "Finance (Fest)",
      key: "accounts",
      method: "POST",
      route: `/fests/${encodeURIComponent(TEST_IDS.festAccounts)}/accounts-action`,
      body: { action: "approved", notes: "Approved in automated smoke test path." },
      expect: [200],
    },
    {
      role: "Organizer Context",
      key: "organizer",
      method: "GET",
      route: `/events/${encodeURIComponent(TEST_IDS.eventHodDean)}/context`,
      body: null,
      expect: [200],
    },
  ];

  for (const check of checks) {
    const token = tokens[check.key];
    const response = await requestAs(token, check.method, check.route, check.body);
    results.push({
      ...check,
      status: response.status,
      ok: check.expect.includes(response.status),
      response: response.payload,
    });
  }

  return results;
}

async function cleanupFixtures() {
  try {
    if (cleanup.eventIds.size > 0) {
      const ids = Array.from(cleanup.eventIds).map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
      try {
        await sql(`delete from public.approval_chain_log where entity_type='event' and entity_id in (${ids});`);
      } catch (error) {
        console.warn(`[CLEANUP] Skipping event approval_chain_log cleanup: ${error.message}`);
      }
      await sql(`delete from public.events where event_id in (${ids});`);
    }

    if (cleanup.festIds.size > 0) {
      const ids = Array.from(cleanup.festIds).map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
      try {
        await sql(`delete from public.approval_chain_log where entity_type='fest' and entity_id in (${ids});`);
      } catch (error) {
        console.warn(`[CLEANUP] Skipping fest approval_chain_log cleanup: ${error.message}`);
      }

      try {
        await sql(`delete from public.fest_subheads where fest_id in (${ids});`);
      } catch (error) {
        console.warn(`[CLEANUP] Unable to delete fest_subheads fixtures: ${error.message}`);
      }

      await sql(`delete from public.fests where fest_id in (${ids});`);
    }

    if (cleanup.userEmails.size > 0) {
      const emails = Array.from(cleanup.userEmails).map((e) => `'${e.replace(/'/g, "''")}'`).join(",");
      await sql(`delete from public.users where lower(email) in (${emails});`);
    }

    for (const userId of cleanup.userAuthIds) {
      await supabase.auth.admin.deleteUser(userId);
    }
  } catch (error) {
    console.error("[CLEANUP] Failed:", error.message);
  }
}

async function main() {
  console.log(`[SMOKE] Starting Module 11 live smoke test (${RUN_ID})`);
  const roleUsers = {};
  const tokens = {};

  try {
    await detectApiPrefix();
    console.log(`[SMOKE] Using API prefix: '${API_PREFIX || "<none>"}'`);

    for (const roleKey of Object.keys(ROLE_USERS)) {
      roleUsers[roleKey] = await ensureRoleUser(roleKey);
    }

    for (const roleKey of Object.keys(ROLE_USERS)) {
      tokens[roleKey] = await signIn(ROLE_USERS[roleKey].email);
    }

    await createEventFixture({
      eventId: TEST_IDS.eventHodDean,
      workflowStatus: "pending_hod",
      needsHodDean: true,
      needsBudget: false,
      organizerEmail: ROLE_USERS.organizer.email,
      organizerAuthUuid: roleUsers.organizer.auth_uuid,
    });

    await createEventFixture({
      eventId: TEST_IDS.eventCfo,
      workflowStatus: "pending_cfo",
      needsHodDean: false,
      needsBudget: true,
      organizerEmail: ROLE_USERS.organizer.email,
      organizerAuthUuid: roleUsers.organizer.auth_uuid,
    });

    await createEventFixture({
      eventId: TEST_IDS.eventAccounts,
      workflowStatus: "pending_accounts",
      needsHodDean: false,
      needsBudget: true,
      organizerEmail: ROLE_USERS.organizer.email,
      organizerAuthUuid: roleUsers.organizer.auth_uuid,
    });

    await createFestFixture({
      festId: TEST_IDS.festHod,
      workflowStatus: "pending_hod",
      organizerEmail: ROLE_USERS.organizer.email,
      organizerAuthUuid: roleUsers.organizer.auth_uuid,
    });

    await createFestFixture({
      festId: TEST_IDS.festDean,
      workflowStatus: "pending_dean",
      organizerEmail: ROLE_USERS.organizer.email,
      organizerAuthUuid: roleUsers.organizer.auth_uuid,
    });

    await createFestFixture({
      festId: TEST_IDS.festCfo,
      workflowStatus: "pending_cfo",
      organizerEmail: ROLE_USERS.organizer.email,
      organizerAuthUuid: roleUsers.organizer.auth_uuid,
    });

    await createFestFixture({
      festId: TEST_IDS.festAccounts,
      workflowStatus: "pending_accounts",
      organizerEmail: ROLE_USERS.organizer.email,
      organizerAuthUuid: roleUsers.organizer.auth_uuid,
    });

    const results = await runChecks(tokens);

    const summary = results.map((item) => ({
      role: item.role,
      method: item.method,
      route: item.route,
      status: item.status,
      pass: item.ok,
      error: item.ok ? null : item.response?.error || item.response?.message || null,
    }));

    console.log(JSON.stringify({ runId: RUN_ID, summary }, null, 2));

    const failed = summary.filter((s) => !s.pass);
    if (failed.length > 0) {
      throw new Error(`Smoke test failed for ${failed.length} checks.`);
    }
  } finally {
    await cleanupFixtures();
    console.log(`[SMOKE] Cleanup complete (${RUN_ID})`);
  }
}

main().catch((error) => {
  console.error(`[SMOKE] Failed: ${error.message}`);
  process.exitCode = 1;
});
