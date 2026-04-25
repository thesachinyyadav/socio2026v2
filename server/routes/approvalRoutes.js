import express from "express";
import { queryAll, queryOne, insert, update } from "../config/database.js";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchItemMeta(itemId, type) {
  if (type === "event") {
    return queryOne("events", { where: { event_id: itemId } });
  }
  return queryOne("fests", { where: { fest_id: itemId } });
}


async function setEventOrFestLive(itemId, type) {
  const table = type === "event" ? "events" : "fests";
  const idField = type === "event" ? "event_id" : "fest_id";
  await update(table, { is_draft: false }, { [idField]: itemId });
}

async function sendApprovalNotification(targetEmail, title, message) {
  try {
    await insert("notifications", {
      title,
      message,
      target_email: targetEmail,
      type: "approval",
    });
  } catch (err) {
    console.warn("[Approvals] Notification insert failed (non-critical):", err?.message);
  }
}

function appendActionLog(existingLog, entry) {
  const log = Array.isArray(existingLog) ? existingLog : [];
  return [...log, { ...entry, at: new Date().toISOString() }];
}

// Phase 1 complete = all blocking stages are approved or skipped
function isPhase1Complete(stages) {
  return stages
    .filter((s) => s.blocking)
    .every((s) => s.status === "approved" || s.status === "skipped");
}

// Map role key → user flag field
const ROLE_TO_USER_FLAG = {
  hod:           "is_hod",
  dean:          "is_dean",
  cfo:           "is_cfo",
  accounts:      "is_accounts_office",
  it:            "is_it_support",
  venue:         "is_venue_manager",
  catering:      "is_venue_manager",
  stalls:        "is_stalls",
  miscellaneous: "is_venue_manager",
};

// Build stage object — no pre-assignment; access is determined at queue time by role+dept/school/campus
function makeStageObject(idx, role, label, isBlocking, isUnderFest) {
  const skip = isUnderFest && isBlocking;
  return {
    step:        idx,
    role,
    label,
    status:      skip ? "skipped" : "pending",
    blocking:    isBlocking,
    approved_by: null,
  };
}

// Build the stages array from workflow_config at submission time
async function buildStagesFromWorkflowConfig(itemType, parentFestId) {
  const isUnderFest = itemType === "event" && !!parentFestId;
  const appliesToKey = isUnderFest ? "under_fest_event" : itemType === "fest" ? "fest" : "standalone_event";

  const { data: configs, error } = await supabase
    .from("workflow_config")
    .select("*")
    .eq("enabled", true)
    .contains("applies_to", [appliesToKey])
    .order("order_index", { ascending: true });

  if (error || !configs?.length) {
    console.warn("[Approvals] workflow_config fetch failed, using defaults:", error?.message);
    return buildDefaultStages(isUnderFest);
  }

  const blockingCount = configs.filter(c => c.is_blocking).length;
  const results = [];
  let blockingIdx = 0;
  for (const config of configs) {
    const step = config.is_blocking ? blockingIdx++ : blockingCount;
    results.push(makeStageObject(step, config.step_key, config.step_label, config.is_blocking, isUnderFest));
  }
  return results;
}

// Hardcoded fallback in case workflow_config table is empty
function buildDefaultStages(isUnderFest) {
  const all = [
    { role: "hod",      label: "HOD",             is_blocking: true  },
    { role: "dean",     label: "Dean",             is_blocking: true  },
    { role: "cfo",      label: "CFO/Campus Dir",   is_blocking: true  },
    { role: "accounts", label: "Accounts Office",  is_blocking: true  },
    { role: "it",       label: "IT Support",       is_blocking: false },
    { role: "venue",    label: "Venue",            is_blocking: false },
    { role: "catering", label: "Catering Vendors", is_blocking: false },
    { role: "stalls",   label: "Stalls/Misc",      is_blocking: false },
  ];
  const blockingCount = all.filter(c => c.is_blocking).length;
  let blockingIdx = 0;
  return all.map((cfg) => {
    const step = cfg.is_blocking ? blockingIdx++ : blockingCount;
    return makeStageObject(step, cfg.role, cfg.label, cfg.is_blocking, isUnderFest);
  });
}

// ---------------------------------------------------------------------------
// POST /api/approvals – Submit item for approval
// ---------------------------------------------------------------------------
router.post(
  "/approvals",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { itemId, type, customStages, budgetItems } = req.body;

      if (!itemId || !type || !["event", "fest"].includes(type)) {
        return res.status(400).json({ error: "itemId and type ('event' or 'fest') are required" });
      }

      // Prevent duplicate submission
      const existing = await queryOne("approvals", { where: { event_or_fest_id: itemId, type } });
      if (existing) {
        return res.status(409).json({
          error: "Approval request already exists for this item",
          approvalId: existing.id,
        });
      }

      const item = await fetchItemMeta(itemId, type);
      if (!item) {
        return res.status(404).json({ error: `${type} not found` });
      }

      // Ownership check (creator or masteradmin)
      const createdByEmail =
        typeof item.created_by === "string"
          ? item.created_by
          : item.created_by?.event_creator ?? null;
      const isCreator =
        (item.auth_uuid && item.auth_uuid === req.userId) ||
        (createdByEmail && createdByEmail === req.userInfo.email);
      if (!isCreator && !req.userInfo.is_masteradmin) {
        return res.status(403).json({ error: "Only the creator can submit this item for approval" });
      }

      const orgDept    = item.organizing_dept   || null;
      const orgSchool  = item.organizing_school  || null;
      const orgCampus  = item.campus_hosted_at   || null;
      const parentFestId = item.fest_id          || null;
      const isUnderFest  = type === "event" && !!parentFestId;

      let stages;
      if (customStages && Array.isArray(customStages) && customStages.length > 0) {
        // Only accept blocking stages via customStages; operational stages are attached separately via PATCH /operational
        const blockingOnly = customStages.filter(s => s.blocking !== false);
        stages = blockingOnly.map((s, idx) =>
          makeStageObject(idx, s.role, s.label, true, isUnderFest)
        );
      } else {
        stages = await buildStagesFromWorkflowConfig(type, parentFestId);
      }
      const allBlockingSkipped = stages.filter(s => s.blocking).every(s => s.status === "skipped");

      const nowIso = new Date().toISOString();

      const newRecord = {
        event_or_fest_id:               itemId,
        type,
        parent_fest_id:                 parentFestId,
        organizing_department_snapshot: orgDept,
        organizing_school_snapshot:     orgSchool,
        organizing_campus_snapshot:     orgCampus,
        submitted_by:                   req.userInfo.email,
        stages,
        budget_items:    Array.isArray(budgetItems) ? budgetItems : [],
        went_live_at:    allBlockingSkipped ? nowIso : null,
        action_log:      [],
      };

      const [created] = await insert("approvals", newRecord);

      // Under-fest events go live immediately (all blocking skipped)
      if (allBlockingSkipped && isUnderFest) {
        await setEventOrFestLive(itemId, type);
      }

      console.log(`[Approvals] Created record for ${type} ${itemId} by ${req.userInfo.email}`);
      return res.status(201).json({ approval: created });
    } catch (error) {
      console.error("[Approvals] POST /approvals error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/approvals – List all (masteradmin only)
// ---------------------------------------------------------------------------
router.get(
  "/approvals",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireMasterAdmin,
  async (req, res) => {
    try {
      const { filter, type, page = 1, pageSize = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(pageSize);

      let query = supabase
        .from("approvals")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + parseInt(pageSize) - 1);

      if (type) query = query.eq("type", type);

      if (filter === "blocking_pending") {
        query = query.filter("stages", "cs", JSON.stringify([{ blocking: true, status: "pending" }]));
      } else if (filter === "operational") {
        query = query.not("went_live_at", "is", null);
      } else if (filter === "pending") {
        query = query.is("went_live_at", null);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return res.json({ approvals: data, total: count, page: parseInt(page), pageSize: parseInt(pageSize) });
    } catch (error) {
      console.error("[Approvals] GET /approvals error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// Returns true only if all blocking stages before this stage's step are done
function isPriorBlockingDone(stages, targetStep) {
  return stages
    .filter(s => s.blocking && s.step < targetStep)
    .every(s => s.status === "approved" || s.status === "skipped");
}

// GET /api/approvals/queue – Approver's own queue
// ---------------------------------------------------------------------------
router.get(
  "/approvals/queue",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const user = req.userInfo;
      const results = [];

      console.log(`[Queue] user=${user.email} is_hod=${user.is_hod} dept=${user.department} is_dean=${user.is_dean} school=${user.school} campus=${user.campus}`);

      // Campus match helper — never use .or() with interpolated campus values (breaks on spaces/parens)
      const campusOkJS = (r) =>
        !user.campus || !r.organizing_campus_snapshot || r.organizing_campus_snapshot === user.campus;

      // HOD: all approvals for this department, campus-filtered in JS
      if (user.is_hod && user.department) {
        const { data: rows, error: hodErr } = await supabase
          .from("approvals")
          .select("*")
          .eq("organizing_department_snapshot", user.department)
          .order("created_at", { ascending: true });
        console.log(`[Queue] HOD raw rows=${rows?.length ?? 0} err=${hodErr?.message}`);
        for (const r of (rows || [])) {
          if (!campusOkJS(r)) { console.log(`[Queue] HOD skip campus ${r.organizing_campus_snapshot}`); continue; }
          const hodStage = r.stages?.find(s => s.role === "hod");
          if (hodStage && isPriorBlockingDone(r.stages, hodStage.step)) {
            results.push({ ...r, _queue_role: "hod" });
          } else {
            console.log(`[Queue] HOD skip priorBlocking fail for ${r.event_or_fest_id} hodStep=${hodStage?.step}`);
          }
        }
      }

      // Dean: all approvals for this school, campus-filtered in JS
      if (user.is_dean && user.school) {
        const { data: rows, error: deanErr } = await supabase
          .from("approvals")
          .select("*")
          .eq("organizing_school_snapshot", user.school)
          .order("created_at", { ascending: true });
        console.log(`[Queue] Dean raw rows=${rows?.length ?? 0} err=${deanErr?.message}`);
        for (const r of (rows || [])) {
          if (!campusOkJS(r)) { console.log(`[Queue] Dean skip campus ${r.organizing_campus_snapshot}`); continue; }
          const deanStage = r.stages?.find(s => s.role === "dean");
          if (deanStage && isPriorBlockingDone(r.stages, deanStage.step)) {
            results.push({ ...r, _queue_role: "dean" });
          } else {
            console.log(`[Queue] Dean skip priorBlocking fail for ${r.event_or_fest_id} deanStep=${deanStage?.step}`);
          }
        }
      }

      // CFO: all approvals for this campus (safe .eq() — no string interpolation into filter syntax)
      if (user.is_cfo) {
        let q = supabase
          .from("approvals")
          .select("*")
          .filter("stages", "cs", JSON.stringify([{ role: "cfo" }]))
          .order("created_at", { ascending: true });
        if (user.campus) q = q.eq("organizing_campus_snapshot", user.campus);
        const { data: rows } = await q;
        for (const r of (rows || [])) {
          const cfoStage = r.stages?.find(s => s.role === "cfo");
          if (cfoStage && isPriorBlockingDone(r.stages, cfoStage.step)) {
            results.push({ ...r, _queue_role: "cfo" });
          }
        }
      }

      // Accounts: all approvals for this campus
      if (user.is_accounts_office) {
        let q = supabase
          .from("approvals")
          .select("*")
          .filter("stages", "cs", JSON.stringify([{ role: "accounts" }]))
          .order("created_at", { ascending: true });
        if (user.campus) q = q.eq("organizing_campus_snapshot", user.campus);
        const { data: rows } = await q;
        for (const r of (rows || [])) {
          const accStage = r.stages?.find(s => s.role === "accounts");
          if (accStage && isPriorBlockingDone(r.stages, accStage.step)) {
            results.push({ ...r, _queue_role: "accounts" });
          }
        }
      }

      // Enrich with item title + date
      const enriched = await Promise.all(
        results.map(async (r) => {
          try {
            const item = await fetchItemMeta(r.event_or_fest_id, r.type);
            return {
              ...r,
              item_title: item?.title || item?.fest_title || r.event_or_fest_id,
              item_date:  item?.event_date || item?.opening_date || null,
            };
          } catch {
            return r;
          }
        })
      );

      return res.json({ queue: enriched });
    } catch (error) {
      console.error("[Approvals] GET /approvals/queue error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/approvals/statuses – Batch approval status for multiple items
// Returns { [id]: "pending_approvals" | "live" | "none" } for each requested id
// ---------------------------------------------------------------------------
router.get(
  "/approvals/statuses",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { ids, type } = req.query;
      if (!ids) return res.json({});

      const idList = String(ids).split(",").map(s => s.trim()).filter(Boolean);
      if (!idList.length) return res.json({});

      let query = supabase
        .from("approvals")
        .select("event_or_fest_id, type, stages, went_live_at")
        .in("event_or_fest_id", idList);

      if (type) query = query.eq("type", type);

      const { data, error } = await query;
      if (error) throw error;

      const result = {};
      for (const record of (data || [])) {
        const stages = Array.isArray(record.stages) ? record.stages : [];
        const hasAnyPendingBlocking = stages.some(s => s.blocking && s.status === "pending");
        result[record.event_or_fest_id] = hasAnyPendingBlocking ? "pending_approvals" : "live";
      }
      return res.json(result);
    } catch (error) {
      console.error("[Approvals] GET /approvals/statuses error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/approvals/:itemId – Get approval record (creator or approver)
// ---------------------------------------------------------------------------
router.get(
  "/approvals/:itemId",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { itemId } = req.params;
      const { type } = req.query;
      const user = req.userInfo;

      let record;
      if (type) {
        record = await queryOne("approvals", { where: { event_or_fest_id: itemId, type } });
      } else {
        record =
          (await queryOne("approvals", { where: { event_or_fest_id: itemId, type: "event" } })) ||
          (await queryOne("approvals", { where: { event_or_fest_id: itemId, type: "fest" } }));
      }

      if (!record) {
        return res.status(404).json({ error: "Approval record not found" });
      }

      const isCreator = record.submitted_by === user.email;
      const isRelevantApprover =
        (user.is_hod && record.organizing_department_snapshot === user.department) ||
        (user.is_dean && record.organizing_school_snapshot === user.school) ||
        ((user.is_cfo || user.is_accounts_office) && record.organizing_campus_snapshot === user.campus);
      const canView = isCreator || isRelevantApprover || user.is_masteradmin;

      if (!canView) {
        return res.status(403).json({ error: "Access denied" });
      }

      const item = await fetchItemMeta(itemId, record.type);

      return res.json({
        approval: record,
        item: item
          ? {
              title:            item.title || item.fest_title,
              type:             record.type,
              organizing_dept:  item.organizing_dept,
              organizing_school: item.organizing_school,
              event_date:       item.event_date || item.opening_date,
              created_by:       item.created_by,
            }
          : null,
      });
    } catch (error) {
      console.error("[Approvals] GET /approvals/:itemId error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/approvals/:itemId/workflow – Update stage configuration
// Creator or masteradmin can update stages before any blocking stage is acted on
// ---------------------------------------------------------------------------
router.patch(
  "/approvals/:itemId/workflow",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { itemId } = req.params;
      const { type } = req.query;
      const { customStages, budgetItems } = req.body;
      const user = req.userInfo;

      if (!customStages || !Array.isArray(customStages) || customStages.length === 0) {
        return res.status(400).json({ error: "customStages array is required" });
      }

      let record;
      if (type) {
        record = await queryOne("approvals", { where: { event_or_fest_id: itemId, type } });
      } else {
        record =
          (await queryOne("approvals", { where: { event_or_fest_id: itemId, type: "event" } })) ||
          (await queryOne("approvals", { where: { event_or_fest_id: itemId, type: "fest" } }));
      }
      if (!record) return res.status(404).json({ error: "Approval record not found" });

      const isCreator = record.submitted_by === user.email;
      if (!isCreator && !user.is_masteradmin) {
        return res.status(403).json({ error: "Only the creator or a masteradmin can update the workflow" });
      }

      // Cannot change workflow once any blocking stage has been acted on
      const actedOn = (record.stages || []).some(
        s => s.blocking && (s.status === "approved" || s.status === "rejected")
      );
      if (actedOn) {
        return res.status(409).json({ error: "Workflow cannot be changed after a blocking stage has been acted on" });
      }

      const orgDept   = record.organizing_department_snapshot;
      const orgSchool = record.organizing_school_snapshot;
      const orgCampus = record.organizing_campus_snapshot;

      // Rebuild stages — preserve status of any stage already in the record
      const existingByRole = {};
      for (const s of (record.stages || [])) existingByRole[s.role] = s;

      const newStages = customStages.map((s, idx) => {
        const existing = existingByRole[s.role];
        if (existing) {
          return { ...existing, step: idx, label: s.label, blocking: s.blocking };
        }
        return makeStageObject(idx, s.role, s.label, s.blocking, false);
      });

      const updates = { stages: newStages, updated_at: new Date().toISOString() };
      if (Array.isArray(budgetItems)) updates.budget_items = budgetItems;

      const { data: updated } = await supabase
        .from("approvals")
        .update(updates)
        .eq("id", record.id)
        .select()
        .single();

      return res.json({ approval: updated });
    } catch (error) {
      console.error("[Approvals] PATCH /workflow error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/approvals/:itemId/operational – Attach operational request stages
// Called after the event wizard; merges non-blocking stages with request_data
// ---------------------------------------------------------------------------
router.patch(
  "/approvals/:itemId/operational",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { itemId } = req.params;
      const { operationalStages } = req.body; // [{ role, label, request_data }]
      const user = req.userInfo;

      if (!Array.isArray(operationalStages)) {
        return res.status(400).json({ error: "operationalStages array required" });
      }

      // Find or create the approval record
      let record = await queryOne("approvals", { where: { event_or_fest_id: itemId } });

      const orgDept   = record?.organizing_department_snapshot || null;
      const orgSchool = record?.organizing_school_snapshot     || null;
      const orgCampus = record?.organizing_campus_snapshot     || null;

      // Build new non-blocking stage objects from wizard data
      const existingStages = record?.stages || [];
      const blockingStages = existingStages.filter(s => s.blocking);
      const startIdx = blockingStages.length;

      const newOperational = operationalStages.map((s) => {
        const base = makeStageObject(startIdx, s.role, s.label, false, false);
        return { ...base, request_data: s.request_data || {} };
      });

      const mergedStages = [...blockingStages, ...newOperational];

      if (record) {
        const { data: updated } = await supabase
          .from("approvals")
          .update({ stages: mergedStages, updated_at: new Date().toISOString() })
          .eq("id", record.id)
          .select()
          .single();

        return res.json({ approval: updated });
      }

      // No record yet (under-fest event) — create one with all stages skipped/operational
      const allBlockingSkipped = true;
      const nowIso = new Date().toISOString();
      const item = await fetchItemMeta(itemId, "event");
      const [created] = await insert("approvals", {
        event_or_fest_id:               itemId,
        type:                           "event",
        parent_fest_id:                 item?.fest_id || null,
        organizing_department_snapshot: orgDept || item?.organizing_dept || null,
        organizing_school_snapshot:     orgSchool || item?.organizing_school || null,
        organizing_campus_snapshot:     orgCampus || item?.campus_hosted_at || null,
        submitted_by:                   user.email,
        stages:                         newOperational,
        budget_items:                   [],
        went_live_at:                   nowIso,
        action_log:                     [],
      });
      return res.status(201).json({ approval: created });
    } catch (error) {
      console.error("[Approvals] PATCH /operational error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/approvals/:itemId/action – Approve / Reject a stage
// ---------------------------------------------------------------------------
router.patch(
  "/approvals/:itemId/action",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { itemId } = req.params;
      // Accept step_index (preferred) or step (role string, backward compat)
      const { step_index, step: stepRole, action, note, type } = req.body;

      if (!action || !["approve", "reject"].includes(action)) {
        return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
      }

      const user = req.userInfo;
      const isMasterAdmin = user.is_masteradmin;

      let record;
      if (type) {
        record = await queryOne("approvals", { where: { event_or_fest_id: itemId, type } });
      } else {
        record =
          (await queryOne("approvals", { where: { event_or_fest_id: itemId, type: "event" } })) ||
          (await queryOne("approvals", { where: { event_or_fest_id: itemId, type: "fest" } }));
      }

      if (!record) {
        return res.status(404).json({ error: "Approval record not found" });
      }

      const stages = record.stages;
      if (!Array.isArray(stages) || stages.length === 0) {
        return res.status(500).json({ error: "Approval record has no stages" });
      }

      // Resolve which stage index to act on
      let targetIdx = step_index;
      if (targetIdx === undefined && stepRole) {
        // Backward compat: find first pending stage with this role
        targetIdx = stages.findIndex(s => s.role === stepRole && s.status === "pending");
      }

      if (targetIdx === undefined || targetIdx === null || targetIdx < 0 || targetIdx >= stages.length) {
        return res.status(400).json({ error: "Invalid step_index — stage not found" });
      }

      const targetStage = stages[targetIdx];

      if (targetStage.status !== "pending") {
        return res.status(409).json({ error: `Stage ${targetIdx} (${targetStage.role}) is already ${targetStage.status}` });
      }

      // Sequential blocking check: all preceding blocking stages must be done
      if (targetStage.blocking) {
        const unfinishedBlocker = stages
          .slice(0, targetIdx)
          .find(s => s.blocking && s.status !== "approved" && s.status !== "skipped");
        if (unfinishedBlocker) {
          return res.status(400).json({
            error: `Stage ${unfinishedBlocker.step} (${unfinishedBlocker.label}) must be completed before this step`,
          });
        }
      }

      // Authorization: role+dept/school/campus match OR masteradmin
      const requiredFlag = ROLE_TO_USER_FLAG[targetStage.role];
      const hasRole      = requiredFlag ? !!user[requiredFlag] : false;
      const campusOk     = !record.organizing_campus_snapshot ||
                           (user.campus && user.campus === record.organizing_campus_snapshot);
      const contextMatch = hasRole && (() => {
        switch (targetStage.role) {
          case "hod":
            return user.department === record.organizing_department_snapshot && campusOk;
          case "dean":
            return user.school === record.organizing_school_snapshot && campusOk;
          case "cfo":
          case "accounts":
            return campusOk;
          default:
            return campusOk;
        }
      })();
      const canAct = contextMatch || isMasterAdmin;

      if (!canAct) {
        return res.status(403).json({
          error: `Not authorized to act on the ${targetStage.label} step`,
        });
      }

      const newStatus = action === "approve" ? "approved" : "rejected";

      // Build new stages array immutably — record who acted
      const actorName = user.name || user.email;
      const newStages = stages.map((s, idx) =>
        idx === targetIdx ? { ...s, status: newStatus, approved_by: actorName } : s
      );

      const phase1Complete  = isPhase1Complete(newStages);
      const wasAlreadyLive  = !!record.went_live_at;

      // Audit log entry
      const logEntry = {
        step_index:  targetIdx,
        step:        targetStage.role,
        action,
        by:          user.name || user.email,
        byEmail:     user.email,
        note:        note || null,
        is_override: isMasterAdmin && !hasRole,
      };

      const updates = {
        stages:         newStages,
        action_log:     appendActionLog(record.action_log, logEntry),
        last_action_by: user.email,
        last_action_at: new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      };

      // Auto go-live when all blocking stages complete
      if (action === "approve" && phase1Complete && !wasAlreadyLive) {
        updates.went_live_at = new Date().toISOString();
        await setEventOrFestLive(record.event_or_fest_id, record.type);
        console.log(`[Approvals] Phase 1 complete – ${record.type} ${record.event_or_fest_id} is now live`);

        if (record.submitted_by) {
          await sendApprovalNotification(
            record.submitted_by,
            "Your submission is live!",
            `Your ${record.type} has been fully approved and is now publicly visible.`
          );
        }

      }

      if (action === "reject" && record.submitted_by) {
        await sendApprovalNotification(
          record.submitted_by,
          "Approval returned",
          `Your ${record.type} was returned at the ${targetStage.label} step. Note: ${note || "No note provided."}`
        );
      }

      // Write update via Supabase directly (update helper doesn't support JSONB well)
      const { data: updated, error: updateError } = await supabase
        .from("approvals")
        .update(updates)
        .eq("id", record.id)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log(`[Approvals] ${action} on stage ${targetIdx} (${targetStage.role}) of ${record.type} ${record.event_or_fest_id} by ${user.email}`);
      return res.json({ approval: updated });
    } catch (error) {
      console.error("[Approvals] PATCH /approvals/:itemId/action error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
