import express from "express";
import { authenticateUser, getUserInfo } from "../middleware/authMiddleware.js";
import { queryOne, queryAll, update, insert } from "../config/database.js";
import { ROLE_CODES } from "../utils/roleAccessService.js";
import {
  sendSubmittedToHodEmail,
  sendSubmittedToDeanEmail,
  sendSubmittedToCfoEmail,
  sendFullyApprovedEmail,
  sendReturnedForRevisionEmail,
  sendFinalRejectionEmail,
} from "../utils/emailService.js";

const router = express.Router();

router.use(authenticateUser, getUserInfo());

// Fire-and-forget email helper
function fireEmail(fn) {
  Promise.resolve().then(fn).catch(err => console.error("[EventEmail]", err));
}

// Helper logic
async function findApproverEmail(roleCode, dept, campus) {
  const assignments = await queryAll('user_role_assignments', { 
    where: { role_code: roleCode, is_active: true } 
  });
  let match = assignments.find(a => 
    (!dept || a.department_scope?.toLowerCase() === dept?.toLowerCase()) &&
    (!campus || a.campus_scope?.toLowerCase() === campus?.toLowerCase())
  );
  if (!match && assignments.length > 0) match = assignments[0];
  if (match && match.user_id) {
    const user = await queryOne('users', { where: { id: match.user_id } });
    return user?.email;
  }
  return null;
}

async function logApprovalAction(entityType, entityId, step, action, userEmail, userRole, notes, version) {
  try {
    await insert('approval_chain_log', [{
      entity_type: entityType,
      entity_id: entityId,
      step, action, actor_email: userEmail, actor_role: userRole, notes: notes || null, version: version || 1
    }]);
  } catch (err) {
    console.error("Failed to insert approval log:", err);
  }
}

async function checkResubmissionLimit(entityType, entityId, step, version) {
  const logs = await queryAll('approval_chain_log', {
    where: { entity_type: entityType, entity_id: entityId, step: step, action: 'rejected', version: version }
  });
  return logs && logs.length > 0;
}

// POST /api/events/:eventId/submit
router.post("/:eventId/submit", async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await queryOne('events', { where: { event_id: eventId } });
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (!['draft', 'rejected'].includes(event.workflow_status)) {
      return res.status(400).json({ error: "Event not in a submittable state." });
    }

    const organizerEmail = event.organizer_email || event.organiser_email || event.created_by;
    const entityTitle = event.title || eventId;

    if (event.event_context === 'under_fest') {
      const parentFest = await queryOne('fests', { where: { fest_id: event.parent_fest_id } });
      if (!parentFest || (parentFest.workflow_status !== 'fully_approved' && parentFest.workflow_status !== 'live')) {
        return res.status(400).json({ error: "Parent fest is not yet fully approved." });
      }

      await update('events', { workflow_status: 'pending_organiser' }, { event_id: eventId });
      await logApprovalAction('event', eventId, 'subhead_submit', 'submitted', req.userInfo.email, 'subhead', null, event.workflow_version);

      return res.json({ success: true, status: 'pending_organiser' });

    } else if (event.event_context === 'standalone') {
      const needsHodDean = event.needs_hod_dean_approval;
      const needsBudget = event.needs_budget_approval;

      if (!needsHodDean && !needsBudget) {
        await update('events', { workflow_status: 'auto_approved' }, { event_id: eventId });
        await logApprovalAction('event', eventId, 'auto_approval_check', 'auto_approved', req.userInfo.email, 'organizer', null, event.workflow_version);
        return res.json({ success: true, status: 'auto_approved' });
      }

      if (needsHodDean) {
        await update('events', { workflow_status: 'pending_hod' }, { event_id: eventId });
        await logApprovalAction('event', eventId, 'organizer_submit', 'submitted', req.userInfo.email, 'organizer', null, event.workflow_version);

        const hodEmail = await findApproverEmail('hod', event.organizing_dept, event.campus_hosted_at) || 'hod@christuniversity.in';
        fireEmail(() => sendSubmittedToHodEmail({
          hodEmail,
          entityType: 'event',
          entityTitle,
          organizerEmail,
        }));

        return res.json({ success: true, status: 'pending_hod' });
      }

      if (needsBudget) {
        const isL3Threshold = Number(event.budget) > 25000;
        const targetStatus = isL3Threshold ? 'pending_cfo' : 'pending_accounts';
        await update('events', { workflow_status: targetStatus }, { event_id: eventId });
        await logApprovalAction('event', eventId, 'organizer_submit', 'submitted', req.userInfo.email, 'organizer', null, event.workflow_version);
        return res.json({ success: true, status: targetStatus });
      }
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/events/:eventId/organiser-action (for under_fest events)
router.post("/:eventId/organiser-action", async (req, res) => {
  try {
    const { action, notes } = req.body;
    const event = await queryOne('events', { where: { event_id: req.params.eventId } });
    if (!event || event.workflow_status !== 'pending_organiser') return res.status(400).json({ error: "Invalid state" });
    
    // Check if requester is fest organizer
    const parentFest = await queryOne('fests', { where: { fest_id: event.parent_fest_id } });
    if (parentFest.auth_uuid !== req.userId && !req.userInfo.is_masteradmin) {
      return res.status(403).json({ error: "Only the fest organizer can approve this." });
    }

    const organizerEmail = event.organizer_email || event.organiser_email || event.created_by;
    const entityTitle = event.title || req.params.eventId;

    if (action === 'approved') {
      await update('events', { workflow_status: 'organiser_approved' }, { event_id: req.params.eventId });
      await logApprovalAction('event', req.params.eventId, 'organiser_review', 'approved', req.userInfo.email, 'organizer', notes, event.workflow_version);
      if (organizerEmail) {
        fireEmail(() => sendFullyApprovedEmail({ organizerEmail, entityType: 'event', entityTitle }));
      }
      return res.json({ success: true, status: 'organiser_approved' });
    } else {
      if (!notes || notes.length < 20) return res.status(400).json({ error: "Notes needed (min 20 chars)" });
      const isFinal = await checkResubmissionLimit('event', req.params.eventId, 'organiser_review', event.workflow_version);
      const newStatus = isFinal ? 'final_rejected' : 'rejected';
      await update('events', { workflow_status: newStatus }, { event_id: req.params.eventId });
      await logApprovalAction('event', req.params.eventId, 'organiser_review', action, req.userInfo.email, 'organizer', notes, event.workflow_version);
      if (organizerEmail) {
        fireEmail(() => isFinal
          ? sendFinalRejectionEmail({ organizerEmail, entityType: 'event', entityTitle, reviewerRole: 'Fest Organiser', rejectionReason: notes })
          : sendReturnedForRevisionEmail({ organizerEmail, entityType: 'event', entityTitle, reviewerRole: 'Fest Organiser', revisionNote: notes })
        );
      }
      return res.json({ success: true, status: newStatus });
    }
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error) });
  }
});

// POST /api/events/:eventId/hod-dean-action
router.post("/:eventId/hod-dean-action", async (req, res) => {
  try {
    const { hod_action, hod_notes, dean_action, dean_notes } = req.body;
    const event = await queryOne('events', { where: { event_id: req.params.eventId } });
    const entityTitle = event?.title || req.params.eventId;
    const organizerEmail = event?.organizer_email || event?.organiser_email || event?.created_by;

    if (hod_action) {
      if (!req.userInfo.role_codes?.includes(ROLE_CODES.HOD) && !req.userInfo.is_masteradmin) return res.status(403).json({ error: "Unauthorized" });
      if (hod_action === 'approved') {
        await update('events', { workflow_status: 'pending_dean' }, { event_id: req.params.eventId });
        await logApprovalAction('event', req.params.eventId, 'hod_review', 'approved', req.userInfo.email, 'hod', hod_notes, event.workflow_version);

        const deanEmail = await findApproverEmail('dean', event.organizing_dept, event.campus_hosted_at) || 'dean@christuniversity.in';
        fireEmail(() => sendSubmittedToDeanEmail({
          deanEmail,
          entityType: 'event',
          entityTitle,
          hodEmail: req.userInfo.email,
        }));
      } else {
        const isFinal = await checkResubmissionLimit('event', req.params.eventId, 'hod_review', event.workflow_version);
        const newStatus = isFinal ? 'final_rejected' : 'rejected';
        await update('events', { workflow_status: newStatus }, { event_id: req.params.eventId });
        await logApprovalAction('event', req.params.eventId, 'hod_review', hod_action, req.userInfo.email, 'hod', hod_notes, event.workflow_version);
        if (organizerEmail) {
          fireEmail(() => isFinal
            ? sendFinalRejectionEmail({ organizerEmail, entityType: 'event', entityTitle, reviewerRole: 'HOD', rejectionReason: hod_notes })
            : sendReturnedForRevisionEmail({ organizerEmail, entityType: 'event', entityTitle, reviewerRole: 'HOD', revisionNote: hod_notes })
          );
        }
      }
      return res.json({ success: true });
    }

    if (dean_action) {
      if (!req.userInfo.role_codes?.includes(ROLE_CODES.DEAN) && !req.userInfo.is_masteradmin) return res.status(403).json({ error: "Unauthorized" });
      if (event.workflow_status !== 'pending_dean') return res.status(400).json({ error: "Not waiting for dean" });
      
      if (dean_action === 'approved') {
        const nextStatus = event.needs_budget_approval ? 'pending_cfo' : 'fully_approved';
        await update('events', { workflow_status: nextStatus }, { event_id: req.params.eventId });
        await logApprovalAction('event', req.params.eventId, 'dean_review', 'approved', req.userInfo.email, 'dean', dean_notes, event.workflow_version);

        if (event.needs_budget_approval) {
          const cfoEmail = await findApproverEmail('cfo', null, event.campus_hosted_at) || 'cfo@christuniversity.in';
          fireEmail(() => sendSubmittedToCfoEmail({
            cfoEmail,
            entityType: 'event',
            entityTitle,
            estimatedBudget: event.budget,
          }));
        } else if (organizerEmail) {
          fireEmail(() => sendFullyApprovedEmail({ organizerEmail, entityType: 'event', entityTitle }));
        }
      } else {
        const isFinal = await checkResubmissionLimit('event', req.params.eventId, 'dean_review', event.workflow_version);
        const newStatus = isFinal ? 'final_rejected' : 'rejected';
        await update('events', { workflow_status: newStatus }, { event_id: req.params.eventId });
        await logApprovalAction('event', req.params.eventId, 'dean_review', dean_action, req.userInfo.email, 'dean', dean_notes, event.workflow_version);
        if (organizerEmail) {
          fireEmail(() => isFinal
            ? sendFinalRejectionEmail({ organizerEmail, entityType: 'event', entityTitle, reviewerRole: 'Dean', rejectionReason: dean_notes })
            : sendReturnedForRevisionEmail({ organizerEmail, entityType: 'event', entityTitle, reviewerRole: 'Dean', revisionNote: dean_notes })
          );
        }
      }
      return res.json({ success: true });
    }
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error) });
  }
});

// GET /api/events/approval-queue
router.get("/approval-queue", async (req, res) => {
  try {
    const roles = req.userInfo.role_codes || [];
    let pendingEventsList = [];
    
    if (req.userInfo.is_masteradmin) {
      // Masteradmin sees everything pending
      pendingEventsList = await queryAll('events', { where: {} }) || [];
    } else {
      if (roles.includes(ROLE_CODES.HOD)) {
        pendingEventsList.push(...await queryAll('events', { where: { workflow_status: 'pending_hod' } }));
      }
      if (roles.includes(ROLE_CODES.DEAN)) {
        pendingEventsList.push(...await queryAll('events', { where: { workflow_status: 'pending_dean' } }));
      }
      if (roles.includes(ROLE_CODES.CFO)) {
        pendingEventsList.push(...await queryAll('events', { where: { workflow_status: 'pending_cfo' } }));
      }
      // Organizer sees pending sub-events under their fests
      const myFests = await queryAll('fests', { where: { auth_uuid: req.userId } });
      for (const f of myFests) {
        pendingEventsList.push(...await queryAll('events', { where: { parent_fest_id: f.fest_id, workflow_status: 'pending_organiser' } }));
      }
    }
    return res.json(pendingEventsList);
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error) });
  }
});

export default router;
