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
 */
export const requireOwnership = (table, idField, ownerField = 'auth_uuid') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[idField] || req.params.id;
      
      if (!resourceId) {
        return res.status(400).json({ error: `${idField} parameter is required` });
      }

      console.log(`Ownership check: table=${table}, idField=${idField}, resourceId=${resourceId}, ownerField=${ownerField}`);
      
      const resource = await queryOne(table, { where: { [idField]: resourceId } });
      
      if (!resource) {
        console.log(`Ownership check failed: Resource not found in ${table} with ${idField}=${resourceId}`);
        return res.status(404).json({ error: `${table.slice(0, -1)} not found` });
      }

      console.log(`Ownership check: resource[${ownerField}]=${resource[ownerField]}, req.userId=${req.userId}`);
      
      // Primary check: Compare auth_uuid
      if (resource[ownerField] && resource[ownerField] === req.userId) {
        console.log(`Ownership check passed via auth_uuid for user ${req.userId}`);
        req.resource = resource;
        return next();
      }
      
      // Fallback for legacy records without auth_uuid: Compare email
      if (!resource[ownerField] && resource.created_by && req.userInfo?.email) {
        if (resource.created_by === req.userInfo.email) {
          console.log(`Ownership check passed via email fallback for ${req.userInfo.email}`);
          // Automatically update the record with auth_uuid for future requests
          try {
            const updateField = table === 'events' ? 'event_id' : table === 'fest' ? 'fest_id' : idField;
            await update(table, { auth_uuid: req.userId }, { [updateField]: resourceId });
            console.log(`Auto-updated auth_uuid for ${table} ${resourceId}`);
          } catch (updateError) {
            console.warn('Failed to auto-update auth_uuid:', updateError.message);
          }
          req.resource = resource;
          return next();
        }
      }
      
      console.log(`Ownership check failed: User ${req.userId} (${req.userInfo?.email}) does not own this resource`);
      return res.status(403).json({ error: 'Access denied: You can only modify your own resources' });
      
    } catch (error) {
      console.error('Ownership check error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        table,
        idField,
        ownerField
      });
      return res.status(500).json({ error: 'Database error while checking ownership' });
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