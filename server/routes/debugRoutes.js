import express from 'express';
import { authenticateUser, getUserInfo, optionalAuth } from '../middleware/authMiddleware.js';
import { queryOne } from '../config/database.js';

const router = express.Router();

// Debug endpoint to check resource data (no auth required)
router.get('/resource/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    
    // Determine which field to query by
    let idField;
    if (table === 'events') idField = 'event_id';
    else if (table === 'fest') idField = 'fest_id';
    else return res.status(400).json({ error: 'Invalid table. Use "events" or "fest"' });
    
    // Query the resource
    const resource = await queryOne(table, { where: { [idField]: id } });
    
    if (!resource) {
      return res.status(404).json({ 
        error: 'Resource not found',
        table,
        id
      });
    }
    
    // Return diagnostic info (safe fields only)
    return res.status(200).json({
      found: true,
      resource: {
        id: resource[idField],
        title: resource.title || resource.fest_title,
        auth_uuid: resource.auth_uuid || null,
        created_by: resource.created_by || null,
        hasAuthUuid: !!resource.auth_uuid,
        hasCreatedBy: !!resource.created_by,
        created_at: resource.created_at
      },
      message: 'Use /api/debug/check-ownership/events/ID with auth token to check ownership'
    });
    
  } catch (error) {
    console.error('Debug resource endpoint error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Debug endpoint to check ownership data (requires auth)
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
        title: resource.title || resource.fest_title,
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
        wouldPassOwnership: (resource.auth_uuid === req.userId) || (resource.created_by === req.userInfo?.email),
        verdict: ((resource.auth_uuid === req.userId) || (resource.created_by === req.userInfo?.email)) 
          ? '✅ OWNERSHIP CHECK WOULD PASS' 
          : '❌ OWNERSHIP CHECK WOULD FAIL'
      },
      explanation: {
        authUuidCheck: resource.auth_uuid 
          ? `auth_uuid (${resource.auth_uuid}) ${resource.auth_uuid === req.userId ? '===' : '!=='} your userId (${req.userId})`
          : 'auth_uuid is null/missing',
        emailCheck: resource.created_by && req.userInfo?.email
          ? `created_by (${resource.created_by}) ${resource.created_by === req.userInfo?.email ? '===' : '!=='} your email (${req.userInfo?.email})`
          : 'email check not possible'
      }
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
