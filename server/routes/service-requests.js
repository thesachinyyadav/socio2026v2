import express from "express";
import { authenticateUser, getUserInfo } from "../middleware/authMiddleware.js";
import { queryOne, queryAll, update, insert } from "../config/database.js";
import { ROLE_CODES } from "../utils/roleAccessService.js";

const router = express.Router();

router.use(authenticateUser, getUserInfo());

// POST /api/service-requests
router.post("/", async (req, res) => {
  try {
    const { entity_type, entity_id, service_type, details } = req.body;
    
    // Validate Entity Status
    if (entity_type === 'fest') {
      const fest = await queryOne('fests', { where: { fest_id: entity_id } });
      if (!fest || !['fully_approved', 'live'].includes(fest.workflow_status)) {
        return res.status(400).json({ error: "Fest must be fully approved to request services." });
      }
    } else if (entity_type === 'event') {
      const event = await queryOne('events', { where: { event_id: entity_id } });
      if (!event) return res.status(404).json({ error: "Event not found" });
      
      if (event.event_context === 'under_fest') {
        if (!['organiser_approved', 'fully_approved', 'live'].includes(event.workflow_status)) {
          return res.status(400).json({ error: "Event under fest must be approved by fest organiser." });
        }
      } else {
        if (!['auto_approved', 'fully_approved', 'live'].includes(event.workflow_status)) {
          return res.status(400).json({ error: "Standalone event must be fully approved." });
        }
      }
    }

    // Determine Incharge
    let assigned_incharge_email = 'fallback@christuniversity.in';
    const configRows = await queryAll('service_incharge_config', {
      where: { service_type: service_type, is_active: true }
    });
    // Normally match campus. We just pick the first active config here for simplicity if campus match fails.
    if (configRows && configRows.length > 0) {
      assigned_incharge_email = configRows[0].incharge_email;
    }

    const newRequest = await insert('service_requests', [{
      entity_type,
      entity_id,
      service_type,
      details,
      assigned_incharge_email,
      requester_email: req.userInfo.email
    }]);

    return res.json({ success: true, service_request: newRequest });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/service-requests/:requestId/action
router.post("/:requestId/action", async (req, res) => {
  try {
    const { action, notes } = req.body;
    const request = await queryOne('service_requests', { where: { id: req.params.requestId } });
    
    if (!request) return res.status(404).json({ error: "Not found" });
    if (request.assigned_incharge_email !== req.userInfo.email && !req.userInfo.is_masteradmin) {
      return res.status(403).json({ error: "Only assigned incharge can modify this request." });
    }

    if (action === 'approved') {
      await update('service_requests', { status: 'approved', updated_at: new Date().toISOString() }, { id: req.params.requestId });
      return res.json({ success: true, status: 'approved' });
    } else {
      if (!notes) return res.status(400).json({ error: "Notes required" });
      const newStatus = request.resubmission_count >= 1 ? 'final_rejected' : 'rejected';
      await update('service_requests', { status: newStatus, approval_notes: notes, updated_at: new Date().toISOString() }, { id: req.params.requestId });
      return res.json({ success: true, status: newStatus });
    }
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/service-requests/by-entity/:entityType/:entityId
router.get("/by-entity/:entityType/:entityId", async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const requests = await queryAll('service_requests', {
      where: { entity_type: entityType, entity_id: entityId }
    });
    return res.json(requests);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/service-requests/my-requests
router.get("/my-requests", async (req, res) => {
  try {
    const requests = await queryAll('service_requests', {
      where: { requester_email: req.userInfo.email }
    });
    return res.json(requests);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/service-requests/my-queue
router.get("/my-queue", async (req, res) => {
  try {
    const requests = await queryAll('service_requests', {
      where: { assigned_incharge_email: req.userInfo.email, status: 'pending' }
    });
    return res.json(requests);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
