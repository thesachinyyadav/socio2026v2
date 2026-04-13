import express from "express";
import { authenticateUser, getUserInfo } from "../middleware/authMiddleware.js";
import { queryOne, queryAll, update, insert } from "../config/database.js";
import {
  sendSubmittedToHodEmail,
  sendSubmittedToDeanEmail,
  sendSubmittedToCfoEmail,
  sendFullyApprovedEmail,
  sendReturnedForRevisionEmail,
  sendFinalRejectionEmail,
} from "../utils/emailService.js";
import { ROLE_CODES } from "../utils/roleAccessService.js";

const router = express.Router();

// Middleware to ensure user is logged in
router.use(authenticateUser, getUserInfo());

/**
 * Returns an assigned user's email based on role, dept, and campus.
 */
async function findApproverEmail(roleCode, dept, campus) {
  const assignments = await queryAll('user_role_assignments', { 
    where: { role_code: roleCode, is_active: true } 
  });
  
  let match = assignments.find(a => 
    (!dept || a.department_scope?.toLowerCase() === dept?.toLowerCase()) &&
    (!campus || a.campus_scope?.toLowerCase() === campus?.toLowerCase())
  );
  
  if (!match && assignments.length > 0) {
    match = assignments[0];
  }

  if (match && match.user_id) {
    const user = await queryOne('users', { where: { id: match.user_id } });
    return user?.email;
  }
  
  return null;
}

/**
 * Helper to log to immutable approval_chain_log table
 */
async function logApprovalAction(entityType, entityId, step, action, userEmail, userRole, notes, version) {
  try {
    await insert('approval_chain_log', [{
      entity_type: entityType,
      entity_id: entityId,
      step: step,
      action: action,
      actor_email: userEmail,
      actor_role: userRole,
      notes: notes || null,
      version: version || 1
    }]);
  } catch (err) {
    console.error("Failed to insert approval log:", err);
  }
}

// Check exactly 1 resubmission per step 
async function checkResubmissionLimit(entityType, entityId, step, version) {
  const logs = await queryAll('approval_chain_log', {
    where: { entity_type: entityType, entity_id: entityId, step: step, action: 'rejected', version: version }
  });
  return logs && logs.length > 0;
}

// Fire-and-forget email helper
function fireEmail(fn) {
  Promise.resolve().then(fn).catch(err => console.error("[FestEmail]", err));
}

// POST /api/fests/:festId/submit
router.post("/:festId/submit", async (req, res) => {
  try {
    const festId = req.params.festId;
    const fest = await queryOne('fests', { where: { fest_id: festId } });

    if (!fest) return res.status(404).json({ error: "Fest not found" });
    if (fest.auth_uuid !== req.userId) return res.status(403).json({ error: "Only the organizer can submit the fest" });
    if (!['draft', 'rejected'].includes(fest.workflow_status)) {
      return res.status(400).json({ error: "Fest is not in a submittable state." });
    }

    const hodEmail = await findApproverEmail('hod', fest.organizing_dept, fest.campus_hosted_at) || 'hod@christuniversity.in';

    await update('fests', { workflow_status: 'pending_hod' }, { fest_id: festId });
    await logApprovalAction('fest', festId, 'organizer_submit', 'submitted', req.userInfo.email, 'organizer', 'Fest submitted for approval', fest.workflow_version);

    fireEmail(() => sendSubmittedToHodEmail({
      hodEmail,
      entityType: 'fest',
      entityTitle: fest.fest_title || festId,
      organizerEmail: req.userInfo.email,
    }));

    return res.json({ success: true, message: "Fest submitted to HOD successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/fests/:festId/hod-action
router.post("/:festId/hod-action", async (req, res) => {
  try {
    const festId = req.params.festId;
    const { action, notes } = req.body;
    
    if (!req.userInfo.role_codes?.includes(ROLE_CODES.HOD) && !req.userInfo.is_masteradmin) {
      return res.status(403).json({ error: "Not authorized. Must be HOD." });
    }

    const fest = await queryOne('fests', { where: { fest_id: festId } });
    if (!fest || fest.workflow_status !== 'pending_hod') {
      return res.status(400).json({ error: "Fest not available for HOD review." });
    }

    if (action === 'approved') {
      await update('fests', { workflow_status: 'pending_dean' }, { fest_id: festId });
      await logApprovalAction('fest', festId, 'hod_review', 'approved', req.userInfo.email, 'hod', notes, fest.workflow_version);
      
      const deanEmail = await findApproverEmail('dean', fest.organizing_dept, fest.campus_hosted_at) || 'dean@christuniversity.in';
      fireEmail(() => sendSubmittedToDeanEmail({
        deanEmail,
        entityType: 'fest',
        entityTitle: fest.fest_title || festId,
        hodEmail: req.userInfo.email,
      }));
      return res.json({ success: true, status: 'pending_dean' });
      
    } else if (action === 'rejected' || action === 'returned_for_revision') {
      if (!notes || notes.length < 20) return res.status(400).json({ error: "Notes must be at least 20 chars." });
      
      const isFinal = await checkResubmissionLimit('fest', festId, 'hod_review', fest.workflow_version);
      const newStatus = isFinal ? 'final_rejected' : 'rejected';
      
      await update('fests', { workflow_status: newStatus }, { fest_id: festId });
      await logApprovalAction('fest', festId, 'hod_review', action, req.userInfo.email, 'hod', notes, fest.workflow_version);
      
      const organizerEmail = fest.contact_email || fest.created_by;
      if (organizerEmail) {
        fireEmail(() => isFinal
          ? sendFinalRejectionEmail({ organizerEmail, entityType: 'fest', entityTitle: fest.fest_title || festId, reviewerRole: 'HOD', rejectionReason: notes })
          : sendReturnedForRevisionEmail({ organizerEmail, entityType: 'fest', entityTitle: fest.fest_title || festId, reviewerRole: 'HOD', revisionNote: notes })
        );
      }
      return res.json({ success: true, status: newStatus });
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/fests/:festId/dean-action
router.post("/:festId/dean-action", async (req, res) => {
  try {
    const festId = req.params.festId;
    const { action, notes } = req.body;
    
    if (!req.userInfo.role_codes?.includes(ROLE_CODES.DEAN) && !req.userInfo.is_masteradmin) {
      return res.status(403).json({ error: "Not authorized. Must be Dean." });
    }

    const fest = await queryOne('fests', { where: { fest_id: festId } });
    if (!fest || fest.workflow_status !== 'pending_dean') {
      return res.status(400).json({ error: "Fest not available for Dean review." });
    }

    if (action === 'approved') {
      const isBudgeted = Number(fest.total_estimated_expense) > 0;
      const nextStatus = isBudgeted ? 'pending_cfo' : 'fully_approved';
      
      await update('fests', { workflow_status: nextStatus }, { fest_id: festId });
      await logApprovalAction('fest', festId, 'dean_review', 'approved', req.userInfo.email, 'dean', notes, fest.workflow_version);
      
      const organizerEmail = fest.contact_email || fest.created_by;

      if (isBudgeted) {
        const cfoEmail = await findApproverEmail('cfo', null, fest.campus_hosted_at) || 'cfo@christuniversity.in';
        fireEmail(() => sendSubmittedToCfoEmail({
          cfoEmail,
          entityType: 'fest',
          entityTitle: fest.fest_title || festId,
          estimatedBudget: fest.total_estimated_expense,
        }));
      } else if (organizerEmail) {
        fireEmail(() => sendFullyApprovedEmail({
          organizerEmail,
          entityType: 'fest',
          entityTitle: fest.fest_title || festId,
        }));
      }
      return res.json({ success: true, status: nextStatus });
      
    } else if (action === 'rejected' || action === 'returned_for_revision') {
      if (!notes || notes.length < 20) return res.status(400).json({ error: "Notes must be at least 20 chars." });
      
      const isFinal = await checkResubmissionLimit('fest', festId, 'dean_review', fest.workflow_version);
      const newStatus = isFinal ? 'final_rejected' : 'rejected';
      
      await update('fests', { workflow_status: newStatus }, { fest_id: festId });
      await logApprovalAction('fest', festId, 'dean_review', action, req.userInfo.email, 'dean', notes, fest.workflow_version);

      const organizerEmail = fest.contact_email || fest.created_by;
      if (organizerEmail) {
        fireEmail(() => isFinal
          ? sendFinalRejectionEmail({ organizerEmail, entityType: 'fest', entityTitle: fest.fest_title || festId, reviewerRole: 'Dean', rejectionReason: notes })
          : sendReturnedForRevisionEmail({ organizerEmail, entityType: 'fest', entityTitle: fest.fest_title || festId, reviewerRole: 'Dean', revisionNote: notes })
        );
      }
      return res.json({ success: true, status: newStatus });
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/fests/:festId/cfo-action
router.post("/:festId/cfo-action", async (req, res) => {
  try {
    const festId = req.params.festId;
    const { action, notes } = req.body;
    
    if (!req.userInfo.role_codes?.includes(ROLE_CODES.CFO) && !req.userInfo.is_masteradmin) {
      return res.status(403).json({ error: "Not authorized. Must be CFO." });
    }

    const fest = await queryOne('fests', { where: { fest_id: festId } });
    if (!fest || fest.workflow_status !== 'pending_cfo') return res.status(400).json({ error: "Fest not waiting for CFO." });

    if (action === 'approved') {
      await update('fests', { workflow_status: 'pending_accounts' }, { fest_id: festId });
      await logApprovalAction('fest', festId, 'cfo_review', 'approved', req.userInfo.email, 'cfo', notes, fest.workflow_version);
      return res.json({ success: true, status: 'pending_accounts' });

    } else if (action === 'rejected' || action === 'returned_for_revision') {
      if (!notes || notes.length < 20) return res.status(400).json({ error: "Notes min 20 chars." });
      const isFinal = await checkResubmissionLimit('fest', festId, 'cfo_review', fest.workflow_version);
      const newStatus = isFinal ? 'final_rejected' : 'rejected';
      await update('fests', { workflow_status: newStatus }, { fest_id: festId });
      await logApprovalAction('fest', festId, 'cfo_review', action, req.userInfo.email, 'cfo', notes, fest.workflow_version);

      const organizerEmail = fest.contact_email || fest.created_by;
      if (organizerEmail) {
        fireEmail(() => isFinal
          ? sendFinalRejectionEmail({ organizerEmail, entityType: 'fest', entityTitle: fest.fest_title || festId, reviewerRole: 'CFO', rejectionReason: notes })
          : sendReturnedForRevisionEmail({ organizerEmail, entityType: 'fest', entityTitle: fest.fest_title || festId, reviewerRole: 'CFO', revisionNote: notes })
        );
      }
      return res.json({ success: true, status: newStatus });
    }
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/fests/:festId/accounts-action
router.post("/:festId/accounts-action", async (req, res) => {
  try {
    const festId = req.params.festId;
    const { action, notes } = req.body;
    
    if (!req.userInfo.role_codes?.includes(ROLE_CODES.ACCOUNTS) && !req.userInfo.is_masteradmin) {
      return res.status(403).json({ error: "Not authorized. Must be Accounts." });
    }

    const fest = await queryOne('fests', { where: { fest_id: festId } });
    if (!fest || fest.workflow_status !== 'pending_accounts') return res.status(400).json({ error: "Fest not waiting for accounts." });

    if (action === 'approved') {
      await update('fests', { workflow_status: 'fully_approved' }, { fest_id: festId });
      await logApprovalAction('fest', festId, 'accounts_review', 'approved', req.userInfo.email, 'accounts', notes, fest.workflow_version);

      const organizerEmail = fest.contact_email || fest.created_by;
      if (organizerEmail) {
        fireEmail(() => sendFullyApprovedEmail({
          organizerEmail,
          entityType: 'fest',
          entityTitle: fest.fest_title || festId,
        }));
      }
      return res.json({ success: true, status: 'fully_approved' });

    } else if (action === 'rejected' || action === 'returned_for_revision') {
      if (!notes || notes.length < 20) return res.status(400).json({ error: "Notes min 20 chars." });
      const isFinal = await checkResubmissionLimit('fest', festId, 'accounts_review', fest.workflow_version);
      const newStatus = isFinal ? 'final_rejected' : 'rejected';
      await update('fests', { workflow_status: newStatus }, { fest_id: festId });
      await logApprovalAction('fest', festId, 'accounts_review', action, req.userInfo.email, 'accounts', notes, fest.workflow_version);

      const organizerEmail = fest.contact_email || fest.created_by;
      if (organizerEmail) {
        fireEmail(() => isFinal
          ? sendFinalRejectionEmail({ organizerEmail, entityType: 'fest', entityTitle: fest.fest_title || festId, reviewerRole: 'Accounts', rejectionReason: notes })
          : sendReturnedForRevisionEmail({ organizerEmail, entityType: 'fest', entityTitle: fest.fest_title || festId, reviewerRole: 'Accounts', revisionNote: notes })
        );
      }
      return res.json({ success: true, status: newStatus });
    }
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/fests/:festId/activate
router.post("/:festId/activate", async (req, res) => {
  try {
    const festId = req.params.festId;
    const fest = await queryOne('fests', { where: { fest_id: festId } });
    if (!fest) return res.status(404).json({ error: "Fest not found" });
    if (fest.auth_uuid !== req.userId && !req.userInfo.is_masteradmin) return res.status(403).json({ error: "Only organizer can activate." });
    
    if (fest.workflow_status !== 'fully_approved') {
      return res.status(400).json({ error: "Fest must be fully approved to activate." });
    }

    await update('fests', { 
      workflow_status: 'live',
      activated_at: new Date().toISOString(),
      activated_by: req.userInfo.email
    }, { fest_id: festId });

    return res.json({ success: true, status: 'live' });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/fests/approval-queue
router.get("/approval-queue", async (req, res) => {
  try {
    const roles = req.userInfo.role_codes || [];
    let pendingFestsRow = [];
    
    if (req.userInfo.is_masteradmin) {
      pendingFestsRow = await queryAll('fests', { where: { status: 'published' }});
    } else {
      if (roles.includes(ROLE_CODES.HOD)) {
        const fests = await queryAll('fests', { where: { workflow_status: 'pending_hod' } });
        pendingFestsRow.push(...fests);
      }
      if (roles.includes(ROLE_CODES.DEAN)) {
        const fests = await queryAll('fests', { where: { workflow_status: 'pending_dean' } });
        pendingFestsRow.push(...fests); 
      }
      if (roles.includes(ROLE_CODES.CFO)) {
        const fests = await queryAll('fests', { where: { workflow_status: 'pending_cfo' } });
        pendingFestsRow.push(...fests);
      }
      if (roles.includes(ROLE_CODES.ACCOUNTS)) {
        const fests = await queryAll('fests', { where: { workflow_status: 'pending_accounts' } });
        pendingFestsRow.push(...fests);
      }
    }

    return res.json(pendingFestsRow);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
