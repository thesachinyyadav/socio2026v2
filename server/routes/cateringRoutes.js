import express from "express";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateUser,
  getUserInfo,
  checkRoleExpiration,
  requireMasterAdmin,
} from "../middleware/authMiddleware.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractEmails(contacts) {
  return (contacts || []).map(c => c.email).filter(e => typeof e === "string" && e.trim());
}

function normalizeEmails(emails) {
  return [...new Set((emails || []).map(e => (e || "").trim().toLowerCase()).filter(Boolean))];
}

// Escape LIKE wildcards so emails containing `_` or `%` don't match anything unintended.
function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, c => "\\" + c);
}

// users.caters is an array of { is_catering, catering_id } entries so a single
// email can belong to multiple vendors. Older rows may still hold a single
// object — normalize to array on read.
function catersToArray(caters) {
  if (Array.isArray(caters)) return caters.filter(c => c && c.catering_id);
  if (caters && typeof caters === "object" && caters.catering_id) return [caters];
  return [];
}

function extractCateringIds(caters) {
  return catersToArray(caters)
    .filter(c => c.is_catering && c.catering_id)
    .map(c => c.catering_id);
}

// Find-then-update by primary key. For each email we first SELECT the matching
// user row (case-insensitive), then UPDATE by register_number. This isolates
// every update so ambiguous filters or JSONB quirks cannot drop rows.
// Returns a diagnostic result so callers can surface partial failures.
async function assignCateringRole(emails, catering_id) {
  const unique = normalizeEmails(emails);
  const result = { requested: unique.length, updated: [], notFound: [], errors: [] };
  console.log(`[Caterers] assign → ${unique.length} email(s) for "${catering_id}":`, unique);

  for (const email of unique) {
    try {
      const { data: matches, error: findErr } = await supabase
        .from("users")
        .select("register_number, email, caters")
        .ilike("email", escapeLike(email));

      if (findErr) {
        console.error(`[Caterers]  ✗ lookup ${email}:`, findErr.message, findErr.code || "");
        result.errors.push({ email, stage: "lookup", message: findErr.message, code: findErr.code });
        continue;
      }
      if (!matches?.length) {
        console.warn(`[Caterers]  · ${email}: no user row exists (skipped)`);
        result.notFound.push(email);
        continue;
      }

      for (const match of matches) {
        const existing = catersToArray(match.caters);
        const alreadyAssigned = existing.some(c => c.catering_id === catering_id);
        const nextCaters = alreadyAssigned
          ? existing
          : [...existing, { is_catering: true, catering_id }];

        const { data: updated, error: updErr } = await supabase
          .from("users")
          .update({ caters: nextCaters })
          .eq("register_number", match.register_number)
          .select("register_number, email, caters");

        if (updErr) {
          console.error(`[Caterers]  ✗ update ${match.email}:`, updErr.message, updErr.code || "", updErr.details || "");
          result.errors.push({
            email: match.email,
            register_number: match.register_number,
            stage: "update",
            message: updErr.message,
            code: updErr.code,
            details: updErr.details,
          });
        } else if (!updated?.length) {
          console.warn(`[Caterers]  ! update ${match.email} (reg ${match.register_number}) returned 0 rows — RLS or filter mismatch?`);
          result.errors.push({
            email: match.email,
            register_number: match.register_number,
            stage: "update",
            message: "update returned 0 rows (possible RLS block)",
          });
        } else {
          result.updated.push({ email: match.email, register_number: match.register_number });
          console.log(`[Caterers]  ✓ ${match.email} (reg ${match.register_number}) → caters set to "${catering_id}"`);
        }
      }
    } catch (e) {
      console.error(`[Caterers]  ✗ exception ${email}:`, e?.message || e);
      result.errors.push({ email, stage: "exception", message: e?.message || String(e) });
    }
  }
  console.log(`[Caterers] assign summary: ${result.updated.length}/${result.requested} updated, ${result.notFound.length} notFound, ${result.errors.length} errors`);
  return result;
}

async function revokeCateringRole(emails, catering_id) {
  const unique = normalizeEmails(emails);
  const result = { requested: unique.length, revoked: [], notFound: [], errors: [] };
  if (!unique.length) return result;
  console.log(`[Caterers] revoke ← ${unique.length} email(s) for "${catering_id}":`, unique);

  for (const email of unique) {
    try {
      const { data: matches, error: findErr } = await supabase
        .from("users")
        .select("register_number, email, caters")
        .ilike("email", escapeLike(email));

      if (findErr) {
        console.error(`[Caterers]  ✗ lookup ${email}:`, findErr.message, findErr.code || "");
        result.errors.push({ email, stage: "lookup", message: findErr.message, code: findErr.code });
        continue;
      }
      if (!matches?.length) {
        result.notFound.push(email);
        continue;
      }

      for (const match of matches) {
        const existing = catersToArray(match.caters);
        // Only clear if this user still belongs to THIS vendor
        if (!existing.some(c => c.catering_id === catering_id)) continue;

        const remaining = existing.filter(c => c.catering_id !== catering_id);
        const nextCaters = remaining.length ? remaining : null;

        const { data: updated, error: updErr } = await supabase
          .from("users")
          .update({ caters: nextCaters })
          .eq("register_number", match.register_number)
          .select("register_number");

        if (updErr) {
          console.error(`[Caterers]  ✗ revoke ${match.email}:`, updErr.message, updErr.code || "");
          result.errors.push({
            email: match.email,
            register_number: match.register_number,
            stage: "update",
            message: updErr.message,
            code: updErr.code,
          });
        } else if (!updated?.length) {
          console.warn(`[Caterers]  ! revoke ${match.email} (reg ${match.register_number}) returned 0 rows`);
          result.errors.push({
            email: match.email,
            register_number: match.register_number,
            stage: "update",
            message: "revoke returned 0 rows (possible RLS block)",
          });
        } else {
          result.revoked.push({ email: match.email, register_number: match.register_number });
          console.log(`[Caterers]  ✓ revoke ${match.email} (reg ${match.register_number})`);
        }
      }
    } catch (e) {
      console.error(`[Caterers]  ✗ exception ${email}:`, e?.message || e);
      result.errors.push({ email, stage: "exception", message: e?.message || String(e) });
    }
  }
  console.log(`[Caterers] revoke summary: ${result.revoked.length}/${result.requested} revoked, ${result.errors.length} errors`);
  return result;
}

// ---------------------------------------------------------------------------
// GET /api/caterers/all — masteradmin only
// ---------------------------------------------------------------------------
router.get(
  "/caterers/all",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireMasterAdmin,
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("caters")
        .select("*")
        .order("catering_name", { ascending: true });
      if (error) throw error;
      return res.json(data || []);
    } catch (err) {
      console.error("[Caterers] GET /caterers/all error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/caterers — any authenticated user with an organising-style role
// Returns vendor list so organisers can pick a caterer to book.
// Optional ?campus=<name> filters to vendors serving that campus.
// ---------------------------------------------------------------------------
router.get(
  "/caterers",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const u = req.userInfo || {};
      const hasRole =
        u.is_organiser || u.is_masteradmin || u.is_hod || u.is_dean ||
        u.is_cfo || u.is_accounts_office || u.is_venue_manager ||
        u.is_it_support || u.is_campus_director || u.is_stalls || u.is_support;
      if (!hasRole) {
        return res.status(403).json({ error: "Insufficient role to view caterers" });
      }

      const { data, error } = await supabase
        .from("caters")
        .select("catering_id, catering_name, contact_details, campuses, location")
        .order("catering_name", { ascending: true });
      if (error) throw error;

      let vendors = data || [];
      const campus = (req.query.campus || "").trim();
      if (campus) {
        vendors = vendors.filter(v => {
          const list = Array.isArray(v.campuses) ? v.campuses : [];
          return list.length === 0 || list.includes(campus);
        });
      }

      return res.json(vendors);
    } catch (err) {
      console.error("[Caterers] GET /caterers error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/catering-bookings/mine — bookings the current user has submitted
// ---------------------------------------------------------------------------
router.get(
  "/catering-bookings/mine",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const u = req.userInfo || {};
      if (!u.email) return res.status(401).json({ error: "Unauthenticated" });

      const { data: bookings, error } = await supabase
        .from("cater_bookings")
        .select("*")
        .eq("booked_by", u.email)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const vendorIds = Array.from(new Set((bookings || []).map(b => b.catering_id).filter(Boolean)));
      const eventIds  = Array.from(new Set((bookings || []).filter(b => b.event_fest_type === "event" && b.event_fest_id).map(b => b.event_fest_id)));
      const festIds   = Array.from(new Set((bookings || []).filter(b => b.event_fest_type === "fest"  && b.event_fest_id).map(b => b.event_fest_id)));

      const [vendorsResult, eventsResult, festsResult] = await Promise.all([
        vendorIds.length
          ? supabase.from("caters").select("catering_id, catering_name, location").in("catering_id", vendorIds)
          : Promise.resolve({ data: [] }),
        eventIds.length
          ? supabase.from("events").select("event_id, title, event_date").in("event_id", eventIds)
          : Promise.resolve({ data: [] }),
        festIds.length
          ? supabase.from("fests").select("fest_id, fest_title, opening_date").in("fest_id", festIds)
          : Promise.resolve({ data: [] }),
      ]);

      const vendorsById = new Map((vendorsResult.data || []).map(v => [v.catering_id, v]));
      const eventsById  = new Map((eventsResult.data  || []).map(e => [e.event_id, e]));
      const festsById   = new Map((festsResult.data   || []).map(f => [f.fest_id, f]));

      const enriched = (bookings || []).map(b => ({
        ...b,
        catering_name:     b.catering_id                           ? vendorsById.get(b.catering_id)?.catering_name  || null : null,
        catering_location: b.catering_id                           ? vendorsById.get(b.catering_id)?.location       || null : null,
        event_title:       b.event_fest_type === "event" && b.event_fest_id ? eventsById.get(b.event_fest_id)?.title      || null : null,
        event_date:        b.event_fest_type === "event" && b.event_fest_id ? eventsById.get(b.event_fest_id)?.event_date || null : null,
        fest_title:        b.event_fest_type === "fest"  && b.event_fest_id ? festsById.get(b.event_fest_id)?.fest_title  || null : null,
        fest_opening_date: b.event_fest_type === "fest"  && b.event_fest_id ? festsById.get(b.event_fest_id)?.opening_date|| null : null,
      }));

      return res.json({ bookings: enriched });
    } catch (err) {
      console.error("[Caterers] GET /catering-bookings/mine error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/catering-bookings — organiser creates a booking for a vendor
// Body: { catering_id, event_id?, description?, contact_details? }
// ---------------------------------------------------------------------------
router.post(
  "/catering-bookings",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const u = req.userInfo || {};
      const hasRole =
        u.is_organiser || u.is_masteradmin || u.is_hod || u.is_dean ||
        u.is_cfo || u.is_accounts_office || u.is_venue_manager ||
        u.is_it_support || u.is_campus_director || u.is_stalls || u.is_support;
      if (!hasRole) {
        return res.status(403).json({ error: "Insufficient role to create a catering booking" });
      }

      const { catering_id, event_fest_id, event_fest_type, description, contact_details } = req.body || {};
      if (!catering_id || typeof catering_id !== "string") {
        return res.status(400).json({ error: "catering_id is required" });
      }

      if (event_fest_id && !["event", "fest"].includes(event_fest_type)) {
        return res.status(400).json({ error: "event_fest_type must be 'event' or 'fest' when event_fest_id is provided" });
      }

      const { data: vendor, error: vendorErr } = await supabase
        .from("caters")
        .select("catering_id")
        .eq("catering_id", catering_id)
        .maybeSingle();
      if (vendorErr) throw vendorErr;
      if (!vendor) {
        return res.status(404).json({ error: "Caterer not found" });
      }

      if (event_fest_id && event_fest_type === "event") {
        const { data: ev } = await supabase
          .from("events")
          .select("event_id")
          .eq("event_id", event_fest_id)
          .maybeSingle();
        if (!ev) return res.status(400).json({ error: "Selected event does not exist" });
      }

      if (event_fest_id && event_fest_type === "fest") {
        const { data: ft } = await supabase
          .from("fests")
          .select("fest_id")
          .eq("fest_id", event_fest_id)
          .maybeSingle();
        if (!ft) return res.status(400).json({ error: "Selected fest does not exist" });
      }

      const booking_id = `cb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const { data, error } = await supabase
        .from("cater_bookings")
        .insert({
          booking_id,
          booked_by: u.email,
          description: description?.trim() || null,
          status: "pending",
          event_fest_id: event_fest_id || null,
          event_fest_type: event_fest_id ? event_fest_type : null,
          catering_id,
          contact_details: contact_details || null,
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ booking: data });
    } catch (err) {
      console.error("[Caterers] POST /catering-bookings error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/caterers — masteradmin only
// ---------------------------------------------------------------------------
router.post(
  "/caterers",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireMasterAdmin,
  async (req, res) => {
    try {
      const { catering_name, contact_details, campuses, location } = req.body;
      if (!catering_name || !catering_name.trim()) {
        return res.status(400).json({ error: "catering_name is required" });
      }

      const catering_id = slugify(catering_name);
      if (!catering_id) {
        return res.status(400).json({ error: "catering_name must contain alphanumeric characters" });
      }

      const { data: existing } = await supabase
        .from("caters")
        .select("catering_id")
        .eq("catering_id", catering_id)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: `A caterer with ID "${catering_id}" already exists` });
      }

      const { data, error } = await supabase
        .from("caters")
        .insert({
          catering_id,
          catering_name: catering_name.trim(),
          contact_details: contact_details || [],
          campuses: campuses || [],
          location: location || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Await role assignment so failures surface in logs close to the request
      const role_assignment = await assignCateringRole(extractEmails(contact_details), catering_id);

      return res.status(201).json({ caterer: data, role_assignment });
    } catch (err) {
      if (err?.code === "23505") {
        return res.status(409).json({ error: "A caterer with that name already exists" });
      }
      console.error("[Caterers] POST /caterers error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error", code: err?.code });
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/caterers/:id — masteradmin only
// ---------------------------------------------------------------------------
router.put(
  "/caterers/:id",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireMasterAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { catering_name, contact_details, campuses, location } = req.body;

      const updates = {};
      if (catering_name !== undefined) updates.catering_name = catering_name;
      if (contact_details !== undefined) updates.contact_details = contact_details;
      if (campuses !== undefined) updates.campuses = campuses;
      if (location !== undefined) updates.location = location;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      // Snapshot old emails before overwriting so we can diff
      let oldEmails = [];
      if (contact_details !== undefined) {
        const { data: old } = await supabase
          .from("caters")
          .select("contact_details")
          .eq("catering_id", id)
          .maybeSingle();
        oldEmails = extractEmails(old?.contact_details);
      }

      const { data, error } = await supabase
        .from("caters")
        .update(updates)
        .eq("catering_id", id)
        .select()
        .single();

      if (error) throw error;

      // Sync roles based on contact email diff (case-insensitive) — revoke
      // first, then assign, so emails moving between vendors behave correctly.
      let role_assignment = null;
      let role_revocation = null;
      if (contact_details !== undefined) {
        const oldNorm = normalizeEmails(oldEmails);
        const newNorm = normalizeEmails(extractEmails(contact_details));
        const removed = oldNorm.filter(e => !newNorm.includes(e));
        const added   = newNorm.filter(e => !oldNorm.includes(e));
        console.log(`[Caterers] PUT ${id} diff: old=${JSON.stringify(oldNorm)} new=${JSON.stringify(newNorm)} removed=${JSON.stringify(removed)} added=${JSON.stringify(added)}`);
        role_revocation = await revokeCateringRole(removed, id);
        role_assignment = await assignCateringRole(added, id);
      }

      return res.json({ caterer: data, role_assignment, role_revocation });
    } catch (err) {
      console.error("[Caterers] PUT /caterers/:id error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// Helper middleware — require the authenticated user to be a catering contact
// for at least one vendor. Attaches req.catering_ids (array) so handlers can
// scope to every vendor the user belongs to.
// ---------------------------------------------------------------------------
const requireCatering = (req, res, next) => {
  const ids = extractCateringIds(req.userInfo?.caters);
  if (!ids.length) {
    if (!req.userInfo?.is_masteradmin) {
      return res.status(403).json({ error: "Catering role required" });
    }
  }
  req.catering_ids = ids;
  next();
};

// ---------------------------------------------------------------------------
// GET /api/catering/bookings — catering role
// Returns orders for every vendor the user belongs to (scoped by req.catering_ids),
// newest first. Optional ?catering_id=<id> filters to one vendor (must be in the
// user's allowed set). Enriched with event title/date and vendor name.
// ---------------------------------------------------------------------------
router.get(
  "/catering/bookings",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireCatering,
  async (req, res) => {
    try {
      const allowed = req.catering_ids || [];
      const requested = (req.query.catering_id || "").trim();
      let scopeIds;

      if (requested) {
        if (!req.userInfo?.is_masteradmin && !allowed.includes(requested)) {
          return res.status(403).json({ error: "Not authorized for this caterer" });
        }
        scopeIds = [requested];
      } else {
        scopeIds = allowed;
      }

      if (!scopeIds.length && !req.userInfo?.is_masteradmin) {
        return res.status(400).json({ error: "No catering_id associated with this user" });
      }

      const status = (req.query.status || "").trim();
      let query = supabase
        .from("cater_bookings")
        .select("*", { count: "exact" })
        .in("catering_id", scopeIds);

      if (status) {
        const statuses = status.split(",").map(s => s.trim()).filter(Boolean);
        if (statuses.length) {
          query = query.in("status", statuses);
        }
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: bookings, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Enrich with event/fest title/date and vendor name
      const eventIds  = Array.from(new Set((bookings || []).filter(b => b.event_fest_type === "event" && b.event_fest_id).map(b => b.event_fest_id)));
      const festIds   = Array.from(new Set((bookings || []).filter(b => b.event_fest_type === "fest"  && b.event_fest_id).map(b => b.event_fest_id)));
      const vendorIds = Array.from(new Set((bookings || []).map(b => b.catering_id).filter(Boolean)));

      const [eventsResult, festsResult, vendorsResult] = await Promise.all([
        eventIds.length
          ? supabase.from("events").select("event_id, title, event_date").in("event_id", eventIds)
          : Promise.resolve({ data: [] }),
        festIds.length
          ? supabase.from("fests").select("fest_id, fest_title, opening_date").in("fest_id", festIds)
          : Promise.resolve({ data: [] }),
        vendorIds.length
          ? supabase.from("caters").select("catering_id, catering_name").in("catering_id", vendorIds)
          : Promise.resolve({ data: [] }),
      ]);

      const eventsById  = new Map((eventsResult.data  || []).map(e => [e.event_id, e]));
      const festsById   = new Map((festsResult.data   || []).map(f => [f.fest_id, f]));
      const vendorsById = new Map((vendorsResult.data || []).map(v => [v.catering_id, v]));

      const enriched = (bookings || []).map(b => ({
        ...b,
        event_title:       b.event_fest_type === "event" && b.event_fest_id ? eventsById.get(b.event_fest_id)?.title       || null : null,
        event_date:        b.event_fest_type === "event" && b.event_fest_id ? eventsById.get(b.event_fest_id)?.event_date  || null : null,
        fest_title:        b.event_fest_type === "fest"  && b.event_fest_id ? festsById.get(b.event_fest_id)?.fest_title   || null : null,
        fest_opening_date: b.event_fest_type === "fest"  && b.event_fest_id ? festsById.get(b.event_fest_id)?.opening_date || null : null,
        catering_name:     b.catering_id                                    ? vendorsById.get(b.catering_id)?.catering_name || null : null,
      }));

      // Vendor list for filters
      let vendorsQuery = supabase
        .from("caters")
        .select("catering_id, catering_name");

      return res.json({ 
        catering_ids: allowed, 
        vendors, 
        bookings: enriched,
        pagination: {
          totalItems: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize),
          currentPage: page,
          pageSize
        }
      });
    } catch (err) {
      console.error("[Caterers] GET /catering/bookings error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/catering/bookings/:booking_id/action — catering role
// Body: { action: "accept" | "decline" }
// Scoped to req.catering_id — vendor cannot act on another vendor's orders.
// ---------------------------------------------------------------------------
router.patch(
  "/catering/bookings/:booking_id/action",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireCatering,
  async (req, res) => {
    try {
      const { booking_id } = req.params;
      const { action } = req.body || {};

      if (!["accept", "decline"].includes(action)) {
        return res.status(400).json({ error: "action must be 'accept' or 'decline'" });
      }

      const { data: booking } = await supabase
        .from("cater_bookings")
        .select("catering_id, status")
        .eq("booking_id", booking_id)
        .maybeSingle();

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Authorization: booking must belong to one of this user's caterers (bypass for masteradmin)
      if (!req.userInfo?.is_masteradmin && !req.catering_ids?.includes(booking.catering_id)) {
        return res.status(403).json({ error: "Not authorized for this booking" });
      }

      if (booking.status !== "pending") {
        return res.status(409).json({ error: `Booking is already ${booking.status}` });
      }

      const newStatus = action === "accept" ? "accepted" : "declined";

      const { data, error } = await supabase
        .from("cater_bookings")
        .update({ status: newStatus })
        .eq("booking_id", booking_id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ booking: data });
    } catch (err) {
      console.error("[Caterers] PATCH /catering/bookings/:id/action error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/caterers/:id — masteradmin only
// ---------------------------------------------------------------------------
router.delete(
  "/caterers/:id",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireMasterAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      const { data: caterer } = await supabase
        .from("caters")
        .select("contact_details")
        .eq("catering_id", id)
        .maybeSingle();

      const { error } = await supabase
        .from("caters")
        .delete()
        .eq("catering_id", id);

      if (error) throw error;

      // Revoke roles after successful delete (best-effort)
      const role_revocation = await revokeCateringRole(extractEmails(caterer?.contact_details), id)
        .catch(e => { console.error("[Caterers] DELETE role revoke failed:", e); return null; });

      return res.json({ success: true, role_revocation });
    } catch (err) {
      console.error("[Caterers] DELETE /caterers/:id error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  }
);

export default router;
