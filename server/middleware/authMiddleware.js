import supabase from "../config/supabaseClient.js";
import { queryOne, update } from "../config/database.js";

/**
 * Middleware to verify Supabase JWT token and extract user info
 * Only uses Supabase for auth token validation
 */
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token with Supabase - ONLY used for Google auth token validation
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('Token validation error:', error);
      if (error.message.includes('Invalid token') || error.message.includes('expired')) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      return res.status(401).json({ error: 'Token validation failed: ' + error.message });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user info to request
    req.user = user;
    req.userId = user.id;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication service error: ' + error.message });
  }
};

/**
 * Middleware to check if user exists in local database and get their info
 */
export const getUserInfo = () => {
  return async (req, res, next) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const user = await queryOne('users', { where: { auth_uuid: req.userId } });

      if (!user) {
        return res.status(404).json({ error: 'User not found in database' });
      }

      req.userInfo = user;
      next();
    } catch (error) {
      console.error('Get user info error:', error);
      return res.status(500).json({ error: 'Database error while fetching user info' });
    }
  };
};

/**
 * Middleware to check if user is an organiser
 */
export const requireOrganiser = (req, res, next) => {
  if (!req.userInfo) {
    return res.status(401).json({ error: 'User info not available' });
  }

  if (!req.userInfo.is_organiser) {
    return res.status(403).json({ error: 'Access denied: Organiser privileges required' });
  }

  next();
};

/**
 * Middleware to check if user owns the resource (for updates/deletes)
 * @param {string} table - Database table name (e.g., 'events', 'fest')
 * @param {string} paramName - URL parameter name (e.g., 'eventId', 'festId')
 * @param {string} ownerField - Database column to check ownership (default: 'auth_uuid')
 */
export const requireOwnership = (table, paramName, ownerField = 'auth_uuid') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName] || req.params.id;
      
      if (!resourceId) {
        console.error('requireOwnership: Missing resourceId');
        return res.status(400).json({ error: `${paramName} parameter is required` });
      }

      // Map parameter names to actual database column names
      const columnMapping = {
        'eventId': 'event_id',
        'festId': 'fest_id',
        'id': 'id'
      };
      
      const dbColumnName = columnMapping[paramName] || paramName;

      console.log(`[Ownership] Checking: table=${table}, paramName=${paramName}, dbColumn=${dbColumnName}, resourceId=${resourceId}, ownerField=${ownerField}`);
      console.log(`[Ownership] User: userId=${req.userId}, email=${req.userInfo?.email}`);
      
      // Query the resource using the correct database column name
      let resource;
      try {
        resource = await queryOne(table, { where: { [dbColumnName]: resourceId } });
      } catch (queryError) {
        console.error('[Ownership] Database query failed:', {
          error: queryError.message,
          code: queryError.code,
          details: queryError.details,
          hint: queryError.hint,
          table,
          paramName,
          dbColumnName,
          resourceId
        });
        return res.status(500).json({ 
          error: 'Database error while fetching resource',
          debug: process.env.NODE_ENV === 'development' ? {
            message: queryError.message,
            code: queryError.code
          } : undefined
        });
      }
      
      if (!resource) {
        console.log(`[Ownership] Resource not found: ${table} with ${dbColumnName}=${resourceId}`);
        return res.status(404).json({ error: `${table.slice(0, -1)} not found` });
      }

      console.log(`[Ownership] Resource found:`, {
        auth_uuid: resource.auth_uuid,
        created_by: resource.created_by,
        hasAuthUuid: !!resource.auth_uuid
      });
      
      // Strategy 1: Check auth_uuid (preferred for new records)
      if (resource.auth_uuid) {
        if (resource.auth_uuid === req.userId) {
          console.log(`[Ownership] ✅ PASSED via auth_uuid match`);
          req.resource = resource;
          return next();
        } else {
          console.log(`[Ownership] ❌ FAILED: auth_uuid mismatch (${resource.auth_uuid} !== ${req.userId})`);
          return res.status(403).json({ error: 'Access denied: You can only modify your own resources' });
        }
      }
      
      // Strategy 2: Fallback to email comparison (for legacy records)
      if (resource.created_by && req.userInfo?.email) {
        if (resource.created_by === req.userInfo.email) {
          console.log(`[Ownership] ✅ PASSED via email fallback (${req.userInfo.email})`);
          
          // Try to auto-populate auth_uuid for future requests (non-blocking)
          setImmediate(async () => {
            try {
              const updateWhere = {};
              updateWhere[dbColumnName] = resourceId;
              
              await update(table, { auth_uuid: req.userId }, updateWhere);
              console.log(`[Ownership] Auto-updated auth_uuid for ${table}/${resourceId}`);
            } catch (updateError) {
              console.warn('[Ownership] Failed to auto-update auth_uuid (non-critical):', updateError.message);
            }
          });
          
          req.resource = resource;
          return next();
        }
      }
      
      // No match found
      console.log(`[Ownership] ❌ FAILED: No ownership match found`);
      console.log(`[Ownership] Checked: auth_uuid=${resource.auth_uuid}, created_by=${resource.created_by}`);
      console.log(`[Ownership] Against: userId=${req.userId}, email=${req.userInfo?.email}`);
      
      return res.status(403).json({ 
        error: 'Access denied: You can only modify your own resources',
        debug: process.env.NODE_ENV === 'development' ? {
          resource_created_by: resource.created_by,
          your_email: req.userInfo?.email
        } : undefined
      });
      
    } catch (error) {
      console.error('[Ownership] Unexpected error:', error);
      console.error('[Ownership] Error stack:', error.stack);
      console.error('[Ownership] Context:', {
        table,
        idField,
        ownerField,
        userId: req.userId,
        userEmail: req.userInfo?.email
      });
      return res.status(500).json({ 
        error: 'Database error while checking ownership',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};

/**
 * Optional authentication - allows both authenticated and anonymous users
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        req.user = user;
        req.userId = user.id;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if there's an error
    next();
  }
};