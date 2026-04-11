import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasAnyRoleCode } from "@/lib/roleDashboards";
import { getCurrentUserProfileWithRoleCodes } from "@/lib/serverRoleProfile";

type ActionType = "save_logistics" | "save_runsheet" | "save_post_event" | "finalize_attendance";

type GenericRecord = Record<string, unknown>;
type RunsheetItemRecord = {
  id: string;
  time: string;
  task: string;
  notes: string;
  order: number;
  assignee_registration_id: string | null;
  assignee_label: string | null;
};

const EVENT_SELECT_CANDIDATES = [
  "event_id,fest_id,created_by,event_heads,additional_requests,schedule",
  "event_id,fest_id,created_by,additional_requests,schedule",
] as const;

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function asRecord(value: unknown): GenericRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as GenericRecord;
  }

  return {};
}

function parseJsonRecord(value: unknown): GenericRecord {
  if (!value) {
    return {};
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as GenericRecord;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as GenericRecord;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function parseEventHeads(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];

  return raw
    .map((entry) => {
      if (typeof entry === "string") {
        return normalizeLower(entry);
      }

      if (entry && typeof entry === "object") {
        return normalizeLower((entry as GenericRecord).email);
      }

      return "";
    })
    .filter((entry) => entry.length > 0);
}

function isSchemaError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const code = normalizeText(error?.code).toUpperCase();
  const message = normalizeLower(error?.message);

  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("column") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

function sanitizeUrlList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(entry))
      .filter((entry) => entry.length > 0);
  }

  const single = normalizeText(value);
  if (!single) {
    return [];
  }

  return single
    .split(/\n|,/)
    .map((entry) => normalizeText(entry))
    .filter((entry) => entry.length > 0);
}

function sanitizeRunsheetItems(value: unknown): RunsheetItemRecord[] {
  const raw = Array.isArray(value) ? value : [];
  return raw.reduce<RunsheetItemRecord[]>((acc, entry, index) => {
    const row = asRecord(entry);
    const task = normalizeText(row.task || row.activity);
    if (!task) {
      return acc;
    }

    acc.push({
      id: normalizeText(row.id) || `runsheet-${index + 1}`,
      time: normalizeText(row.time),
      task,
      notes: normalizeText(row.notes),
      order: Number.isFinite(toNumber(row.order)) ? toNumber(row.order) : index,
      assignee_registration_id:
        normalizeText(row.assignee_registration_id || row.assigneeRegistrationId) || null,
      assignee_label: normalizeText(row.assignee_label || row.assigneeLabel) || null,
    });

    return acc;
  }, []);
}

function resolveAction(value: unknown): ActionType | null {
  const normalized = normalizeLower(value);

  if (normalized === "save_logistics") return "save_logistics";
  if (normalized === "save_runsheet") return "save_runsheet";
  if (normalized === "save_post_event") return "save_post_event";
  if (normalized === "finalize_attendance") return "finalize_attendance";

  return null;
}

async function buildSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Route handlers cannot mutate response cookies this way.
      },
    },
  });
}

async function fetchEventForUpdate(supabase: any, eventId: string): Promise<GenericRecord | null> {
  for (const selectClause of EVENT_SELECT_CANDIDATES) {
    const { data, error } = await supabase
      .from("events")
      .select(selectClause)
      .eq("event_id", eventId)
      .maybeSingle();

    if (!error) {
      return (data as GenericRecord | null) || null;
    }

    if (!isSchemaError(error)) {
      throw new Error(`Failed to load event: ${error.message}`);
    }
  }

  throw new Error("Event schema is missing required columns for Student Organiser updates.");
}

async function computeAttendanceSummary(supabase: any, eventId: string) {
  const [registrationResult, attendanceResult] = await Promise.all([
    supabase.from("registrations").select("registration_id").eq("event_id", eventId),
    supabase.from("attendance_status").select("status").eq("event_id", eventId),
  ]);

  const total = Array.isArray(registrationResult.data) ? registrationResult.data.length : 0;

  let attended = 0;
  let absent = 0;
  let pending = 0;

  if (Array.isArray(attendanceResult.data)) {
    attendanceResult.data.forEach((row: { status?: string | null }) => {
      const status = normalizeLower(row.status);
      if (status === "attended") {
        attended += 1;
      } else if (status === "absent") {
        absent += 1;
      } else {
        pending += 1;
      }
    });
  }

  const inferredPending = Math.max(total - attended - absent, 0);

  return {
    total,
    attended,
    absent,
    pending: Math.max(pending, inferredPending),
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      {
        error:
          "Supabase environment variables are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 500 }
    );
  }

  const { eventId: rawEventId } = await context.params;
  const eventId = normalizeText(rawEventId);
  if (!eventId) {
    return NextResponse.json({ error: "Event id is required." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const action = resolveAction(body?.action);
  if (!action) {
    return NextResponse.json(
      {
        error:
          "Invalid action. Supported actions: save_logistics, save_runsheet, save_post_event, finalize_attendance.",
      },
      { status: 400 }
    );
  }

  const supabase = await buildSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const userProfile = await getCurrentUserProfileWithRoleCodes(supabase, {
    id: user.id,
    email: user.email,
  });

  if (!userProfile) {
    return NextResponse.json({ error: "Unable to resolve your profile." }, { status: 403 });
  }

  const isMasterAdmin = Boolean(userProfile.is_masteradmin);
  const isStudentOrganiser =
    hasAnyRoleCode(userProfile, ["ORGANIZER_STUDENT"]) ||
    Boolean((userProfile as GenericRecord).is_organiser_student);

  if (!isStudentOrganiser && !isMasterAdmin) {
    return NextResponse.json(
      { error: "Only Student Organisers or Master Admins can update this dashboard." },
      { status: 403 }
    );
  }

  const currentUserEmail =
    normalizeLower(userProfile.email) || normalizeLower(user.email);

  if (!currentUserEmail) {
    return NextResponse.json({ error: "Missing user email context." }, { status: 403 });
  }

  let eventRow: GenericRecord | null = null;

  try {
    eventRow = await fetchEventForUpdate(supabase, eventId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load event context." },
      { status: 500 }
    );
  }

  if (!eventRow) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const festId = normalizeText(eventRow.fest_id);
  if (!festId) {
    return NextResponse.json(
      { error: "This dashboard can only update sub-events linked to a fest." },
      { status: 403 }
    );
  }

  const isCreator = normalizeLower(eventRow.created_by) === currentUserEmail;
  const isEventHead = parseEventHeads(eventRow.event_heads).includes(currentUserEmail);

  if (!isMasterAdmin && !isCreator && !isEventHead) {
    return NextResponse.json(
      { error: "You can only update events you created or where you are listed in event_heads." },
      { status: 403 }
    );
  }

  const payload = asRecord(body?.payload);
  const nowIso = new Date().toISOString();

  const existingAdditionalRequests = parseJsonRecord(eventRow.additional_requests);
  const existingOps = asRecord(existingAdditionalRequests.student_organiser_ops);

  let updatePatch: GenericRecord = {};

  if (action === "save_logistics") {
    const itDetails = normalizeText(payload.itDetails);
    const venueDetails = normalizeText(payload.venueDetails);
    const cateringDetails = normalizeText(payload.cateringDetails);

    const nextOps = {
      ...existingOps,
      logistics_requests: {
        it: {
          details: itDetails,
          status: itDetails ? "submitted" : "pending",
          submitted_at: itDetails ? nowIso : null,
        },
        venue: {
          details: venueDetails,
          status: venueDetails ? "submitted" : "pending",
          submitted_at: venueDetails ? nowIso : null,
        },
        catering: {
          details: cateringDetails,
          status: cateringDetails ? "submitted" : "pending",
          submitted_at: cateringDetails ? nowIso : null,
        },
        step3_bypass: true,
        updated_at: nowIso,
      },
    };

    updatePatch = {
      additional_requests: {
        ...existingAdditionalRequests,
        it: {
          ...asRecord(existingAdditionalRequests.it),
          enabled: Boolean(itDetails),
          description: itDetails,
        },
        venue: {
          ...asRecord(existingAdditionalRequests.venue),
          enabled: Boolean(venueDetails),
          customVenue: venueDetails,
          selectedVenue: "",
        },
        catering: {
          ...asRecord(existingAdditionalRequests.catering),
          enabled: Boolean(cateringDetails),
          description: cateringDetails,
        },
        student_organiser_ops: nextOps,
      },
    };
  }

  if (action === "save_runsheet") {
    const runsheetItems = sanitizeRunsheetItems(payload.runsheetItems);

    const nextOps = {
      ...existingOps,
      runsheet_items: runsheetItems,
      updated_at: nowIso,
    };

    const nextSchedule = runsheetItems.map((item) => ({
      time: normalizeText(item.time),
      activity: normalizeText(item.task),
    }));

    updatePatch = {
      additional_requests: {
        ...existingAdditionalRequests,
        student_organiser_ops: nextOps,
      },
      schedule: nextSchedule,
    };
  }

  if (action === "save_post_event") {
    const photoUrls = sanitizeUrlList(payload.photoUrls);
    const reportUrls = sanitizeUrlList(payload.reportUrls);
    const reportSummary = normalizeText(payload.reportSummary);

    const nextOps = {
      ...existingOps,
      post_event: {
        ...asRecord(existingOps.post_event),
        photo_urls: photoUrls,
        report_urls: reportUrls,
        report_summary: reportSummary,
        updated_at: nowIso,
      },
    };

    updatePatch = {
      additional_requests: {
        ...existingAdditionalRequests,
        student_organiser_ops: nextOps,
      },
    };
  }

  if (action === "finalize_attendance") {
    const serverSummary = await computeAttendanceSummary(supabase, eventId).catch(() => ({
      total: Math.max(0, toNumber(asRecord(payload.attendanceSummary).total)),
      attended: Math.max(0, toNumber(asRecord(payload.attendanceSummary).attended)),
      absent: Math.max(0, toNumber(asRecord(payload.attendanceSummary).absent)),
      pending: Math.max(0, toNumber(asRecord(payload.attendanceSummary).pending)),
    }));

    const nextOps = {
      ...existingOps,
      post_event: {
        ...asRecord(existingOps.post_event),
        attendance_finalized: true,
        attendance_finalized_at: nowIso,
        attendance_finalized_by: currentUserEmail,
        attendance_summary: serverSummary,
      },
    };

    updatePatch = {
      additional_requests: {
        ...existingAdditionalRequests,
        student_organiser_ops: nextOps,
      },
    };
  }

  const { error: updateError } = await supabase
    .from("events")
    .update(updatePatch)
    .eq("event_id", eventId);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update event operations: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    eventId,
    action,
    updatedAt: nowIso,
  });
}
