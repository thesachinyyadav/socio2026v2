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

// HOD: matched by department (if set) + campus; falls back to school + campus
async function findHodForDeptAndCampus(department, school, campus) {
  if (!campus) return null;
  if (department) {
    const rows = await queryAll("users", { where: { is_hod: true, department, campus }, limit: 1 });
    if (rows[0]) return rows[0];
  }
  if (school) {
    const rows = await queryAll("users", { where: { is_hod: true, school, campus }, limit: 1 });
    if (rows[0]) return rows[0];
  }
  return null;
}

// Dean: matched by school + campus
async function findDeanForSchoolAndCampus(school, campus) {
  if (!school || !campus) return null;
  const rows = await queryAll("users", { where: { is_dean: true, school, campus }, limit: 1 });
  return rows[0] || null;
}

// CFO: matched by campus only
async function findCfoForCampus(campus) {
  if (!campus) return null;
  const rows = await queryAll("users", { where: { is_cfo: true, campus }, limit: 1 });
  return rows[0] || null;
}

// Accounts / Finance Officer: matched by campus only
async function findAccountsForCampus(campus) {
  if (!campus) return null;
  const rows = await queryAll("users", { where: { is_accounts_office: true, campus }, limit: 1 });
  return rows[0] || null;
}

// Legacy aliases kept for fallback paths
async function findHodForSchool(school) {
  if (!school) return null;
  const rows = await queryAll("users", { where: { is_hod: true, school }, limit: 1 });
  return rows[0] || null;
}
async function findDeanForSchool(school) {
  if (!school) return null;
  const rows = await queryAll("users", { where: { is_dean: true, school }, limit: 1 });
  return rows[0] || null;
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
  venue:         "is_vendor_manager",
  catering:      "is_vendor_manager",
  stalls:        "is_stalls",
  miscellaneous: "is_vendor_manager",
};

// Auto-assign a stage based on role + org context (campus-aware)
async function autoAssignUser(role, orgDept, orgSchool, orgCampus) {
  if (!orgCampus) return null;
  switch (role) {
    case "hod":      return findHodForDeptAndCampus(orgDept, orgSchool, orgCampus);
    case "dean":     return findDeanForSchoolAndCampus(orgSchool, orgCampus);
    case "cfo":      return findCfoForCampus(orgCampus);
    case "accounts": return findAccountsForCampus(orgCampus);
    default:         return null;
  }
}

// Build stage object from a config entry
function makeStageObject(idx, role, label, isBlocking, isUnderFest, assigneeUser) {
  const skip = isUnderFest && isBlocking;
  return {
    step:             idx,
    role,
    label,
    status:           skip ? "skipped" : "pending",
    assignee_user_id: skip ? null : (assigneeUser?.id ?? null),
    routing_state:    skip ? "assigned" : (assigneeUser ? "assigned" : "waiting_for_assignment"),
    blocking:         isBlocking,
  };
}

// Build the stages array from workflow_config at submission time
async function buildStagesFromWorkflowConfig(orgDept, orgSchool, orgCampus, itemType, parentFestId) {
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
    const hodUser  = isUnderFest ? null : await autoAssignUser("hod",  orgDept, orgSchool, orgCampus);
    const deanUser = isUnderFest ? null : await autoAssignUser("dean", orgDept, orgSchool, orgCampus);
    return buildDefaultStages(orgDept, orgSchool, orgCampus, isUnderFest, hodUser, deanUser);
  }

  const assigneeCache = {};
  const results = [];
  for (const [idx, config] of configs.entries()) {
    let assigneeUser = null;
    if (!isUnderFest) {
      if (!assigneeCache[config.step_key]) {
        assigneeCache[config.step_key] = await autoAssignUser(config.step_key, orgDept, orgSchool, orgCampus);
      }
      assigneeUser = assigneeCache[config.step_key];
    }
    results.push(makeStageObject(idx, config.step_key, config.step_label, config.is_blocking, isUnderFest, assigneeUser));
  }
  return results;
}

// Hardcoded fallback in case workflow_config table is empty
function buildDefaultStages(orgDept, orgSchool, orgCampus, isUnderFest, hodUser, deanUser) {
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
  const byRole = { hod: hodUser, dean: deanUser };
  return all.map((cfg, idx) =>
    makeStageObject(idx, cfg.role, cfg.label, cfg.is_blocking, isUnderFest, byRole[cfg.role] || null)
  );
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
      const { itemId, type, customStages } = req.body;

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
      const isCreator =
        (item.auth_uuid && item.auth_uuid === req.userId) ||
        (item.created_by && item.created_by === req.userInfo.email);
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
        // Organiser-customized stage order — apply campus-aware auto-assign per role
        const assigneeCache = {};
        stages = await Promise.all(customStages.map(async (s, idx) => {
          if (!assigneeCache[s.role] && !isUnderFest) {
            assigneeCache[s.role] = await autoAssignUser(s.role, orgDept, orgSchool, orgCampus);
          }
          return makeStageObject(idx, s.role, s.label, s.blocking, isUnderFest, assigneeCache[s.role] || null);
        }));
      } else {
        stages = await buildStagesFromWorkflowConfig(orgDept, orgSchool, orgCampus, type, parentFestId);
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
        went_live_at:    allBlockingSkipped ? nowIso : null,
        action_log:      [],
      };

      const [created] = await insert("approvals", newRecord);

      // Under-fest events go live immediately (all blocking skipped)
      if (allBlockingSkipped && isUnderFest) {
        await setEventOrFestLive(itemId, type);
      }

      // Notify assigned HOD/Dean
      const hodStage  = stages.find(s => s.role === "hod"  && s.assignee_user_id);
      const deanStage = stages.find(s => s.role === "dean" && s.assignee_user_id);
      const itemTitle = item.title || item.fest_title || itemId;

      if (hodStage?.assignee_user_id) {
        const hodUser = await queryOne("users", { where: { id: hodStage.assignee_user_id } });
        if (hodUser?.email) {
          await sendApprovalNotification(
            hodUser.email,
            "New Approval Request",
            `A ${type} "${itemTitle}" requires your approval as HOD.`
          );
        }
      }
      if (deanStage?.assignee_user_id) {
        const deanUser = await queryOne("users", { where: { id: deanStage.assignee_user_id } });
        if (deanUser?.email) {
          await sendApprovalNotification(
            deanUser.email,
            "New Approval Request",
            `A ${type} "${itemTitle}" requires your approval as Dean.`
          );
        }
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
      } else if (filter === "unassigned") {
        query = query.filter("stages", "cs", JSON.stringify([{ routing_state: "waiting_for_assignment", status: "pending" }]));
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

      if (user.is_hod) {
        // Assigned directly to this HOD
        const { data: assigned } = await supabase
          .from("approvals")
          .select("*")
          .filter("stages", "cs", JSON.stringify([{ role: "hod", status: "pending", assignee_user_id: String(user.id) }]))
          .order("created_at", { ascending: true });

        // Unassigned — school + campus must both match
        let unassigned = [];
        if (user.school && user.campus) {
          const { data: unassignedRows } = await supabase
            .from("approvals")
            .select("*")
            .eq("organizing_school_snapshot", user.school)
            .eq("organizing_campus_snapshot", user.campus)
            .filter("stages", "cs", JSON.stringify([{ role: "hod", status: "pending", routing_state: "waiting_for_assignment" }]))
            .order("created_at", { ascending: true });
          unassigned = unassignedRows || [];
        }

        const seenIds = new Set();
        for (const r of [...(assigned || []), ...unassigned]) {
          if (!seenIds.has(r.id)) { seenIds.add(r.id); results.push({ ...r, _queue_role: "hod" }); }
        }
      }

      if (user.is_dean) {
        // Assigned directly to this Dean
        const { data: assigned } = await supabase
          .from("approvals")
          .select("*")
          .filter("stages", "cs", JSON.stringify([{ role: "dean", status: "pending", assignee_user_id: String(user.id) }]))
          .order("created_at", { ascending: true });

        // Unassigned — school + campus must both match
        let unassigned = [];
        if (user.school && user.campus) {
          const { data: unassignedRows } = await supabase
            .from("approvals")
            .select("*")
            .eq("organizing_school_snapshot", user.school)
            .eq("organizing_campus_snapshot", user.campus)
            .filter("stages", "cs", JSON.stringify([{ role: "dean", status: "pending", routing_state: "waiting_for_assignment" }]))
            .order("created_at", { ascending: true });
          unassigned = unassignedRows || [];
        }

        // Sequential: HOD must be done before Dean can act
        const seenIds = new Set();
        for (const r of [...(assigned || []), ...unassigned]) {
          if (seenIds.has(r.id)) continue;
          const hodStage = r.stages?.find(s => s.role === "hod");
          const hodDone = !hodStage || hodStage.status === "approved" || hodStage.status === "skipped";
          if (hodDone) { seenIds.add(r.id); results.push({ ...r, _queue_role: "dean" }); }
        }
      }

      if (user.is_cfo) {
        // CFO sees unassigned + assigned by campus
        const { data: assigned } = await supabase
          .from("approvals")
          .select("*")
          .filter("stages", "cs", JSON.stringify([{ role: "cfo", status: "pending", assignee_user_id: String(user.id) }]))
          .order("created_at", { ascending: true });

        let unassigned = [];
        if (user.campus) {
          const { data: unassignedRows } = await supabase
            .from("approvals")
            .select("*")
            .eq("organizing_campus_snapshot", user.campus)
            .filter("stages", "cs", JSON.stringify([{ role: "cfo", status: "pending", routing_state: "waiting_for_assignment" }]))
            .order("created_at", { ascending: true });
          unassigned = unassignedRows || [];
        }

        const seenIds = new Set();
        for (const r of [...(assigned || []), ...unassigned]) {
          if (!seenIds.has(r.id)) { seenIds.add(r.id); results.push({ ...r, _queue_role: "cfo" }); }
        }
      }

      if (user.is_accounts_office) {
        const { data: assigned } = await supabase
          .from("approvals")
          .select("*")
          .filter("stages", "cs", JSON.stringify([{ role: "accounts", status: "pending", assignee_user_id: String(user.id) }]))
          .order("created_at", { ascending: true });

        let unassigned = [];
        if (user.campus) {
          const { data: unassignedRows } = await supabase
            .from("approvals")
            .select("*")
            .eq("organizing_campus_snapshot", user.campus)
            .filter("stages", "cs", JSON.stringify([{ role: "accounts", status: "pending", routing_state: "waiting_for_assignment" }]))
            .order("created_at", { ascending: true });
          unassigned = unassignedRows || [];
        }

        const seenIds = new Set();
        for (const r of [...(assigned || []), ...unassigned]) {
          if (!seenIds.has(r.id)) { seenIds.add(r.id); results.push({ ...r, _queue_role: "accounts" }); }
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

      const isCreator    = record.submitted_by === user.email;
      const isApprover   = record.stages?.some(s => s.assignee_user_id === String(user.id));
      const isSchoolUser = record.organizing_school_snapshot === user.school &&
                           (user.is_hod || user.is_dean);
      const canView      = isCreator || isApprover || isSchoolUser || user.is_masteradmin;

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

      // Authorization: assigned user OR context-matched role user OR masteradmin
      // HOD/Dean: school + campus; CFO/Accounts: campus only; others: school
      const requiredFlag  = ROLE_TO_USER_FLAG[targetStage.role];
      const hasRole       = requiredFlag ? !!user[requiredFlag] : false;
      const isAssigned    = targetStage.assignee_user_id && targetStage.assignee_user_id === String(user.id);
      const campusMatch   = user.campus && user.campus === record.organizing_campus_snapshot;
      const schoolMatch   = user.school && user.school === record.organizing_school_snapshot;
      const contextMatch  = hasRole && (() => {
        switch (targetStage.role) {
          case "hod":
          case "dean":     return schoolMatch && campusMatch;
          case "cfo":
          case "accounts": return campusMatch;
          default:         return schoolMatch;
        }
      })();
      const canAct        = isAssigned || contextMatch || isMasterAdmin;

      if (!canAct) {
        return res.status(403).json({
          error: `Not authorized to act on the ${targetStage.label} step`,
        });
      }

      // Auto-assign if unassigned and this user qualifies
      const preAssign = (!targetStage.assignee_user_id && (isAssigned || contextMatch))
        ? { assignee_user_id: String(user.id), routing_state: "assigned" }
        : {};

      const newStatus = action === "approve" ? "approved" : "rejected";

      // Build new stages array immutably
      const newStages = stages.map((s, idx) =>
        idx === targetIdx ? { ...s, ...preAssign, status: newStatus } : s
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
