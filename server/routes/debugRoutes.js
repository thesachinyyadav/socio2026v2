import express from 'express';
import { authenticateUser, getUserInfo } from '../middleware/authMiddleware.js';
import { queryOne } from '../config/database.js';

const router = express.Router();

// Debug endpoint to check ownership data
router.get('/check-ownership/:table/:id', authenticateUser, getUserInfo(), async (req, res) => {
  try {
    const { table, id } = req.params;
    
    // Determine which field to query by
    let idField;
    if (table === 'events') idField = 'event_id';
    else if (table === 'fest') idField = 'fest_id';
    else return res.status(400).json({ error: 'Invalid table' });
    
    // Query the resource
    const resource = await queryOne(table, { where: { [idField]: id } });
    
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Return diagnostic info
    return res.status(200).json({
      resource: {
        id: resource[idField],
        auth_uuid: resource.auth_uuid,
        created_by: resource.created_by,
        hasAuthUuid: !!resource.auth_uuid,
        hasCreatedBy: !!resource.created_by
      },
      user: {
        userId: req.userId,
        email: req.userInfo?.email,
        is_organiser: req.userInfo?.is_organiser
      },
      ownership: {
        authUuidMatches: resource.auth_uuid === req.userId,
        emailMatches: resource.created_by === req.userInfo?.email,
        wouldPass: (resource.auth_uuid === req.userId) || (resource.created_by === req.userInfo?.email)
      }
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

export default router;
