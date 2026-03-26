import supabase from "../config/supabaseClient.js";
import { queryOne, update } from "../config/database.js";

/**
 * Middleware to check and clear expired roles
 * Run this after getUserInfo() to auto-expire roles
 */
export const checkRoleExpiration = async (req, res, next) => {
  try {
    if (!req.userInfo) {
      return next();
    }

    const user = req.userInfo;
    const now = new Date();
    let hasExpiredRoles = false;
    const updates = {};

    // Check each role expiration
    if (user.organiser_expires_at) {
      const expiresAt = new Date(user.organiser_expires_at);
      if (expiresAt < now) {
        updates.is_organiser = false;
        updates.organiser_expires_at = null;
        user.is_organiser = false;
        user.organiser_expires_at = null;
        hasExpiredRoles = true;
        console.log(`[RoleExpiration] Expired organiser role for ${user.email}`);
      }
    }

    if (user.support_expires_at) {
      const expiresAt = new Date(user.support_expires_at);
      if (expiresAt < now) {
        updates.is_support = false;
        updates.support_expires_at = null;
        user.is_support = false;
        user.support_expires_at = null;
        hasExpiredRoles = true;
        console.log(`[RoleExpiration] Expired support role for ${user.email}`);
      }
    }

    if (user.masteradmin_expires_at) {
      const expiresAt = new Date(user.masteradmin_expires_at);
      if (expiresAt < now) {
        updates.is_masteradmin = false;
        updates.masteradmin_expires_at = null;
        user.is_masteradmin = false;
        user.masteradmin_expires_at = null;
        hasExpiredRoles = true;
        console.log(`[RoleExpiration] Expired masteradmin role for ${user.email}`);
      }
    }

    // Update database if any roles expired
    if (hasExpiredRoles) {
      await update('users', updates, { auth_uuid: user.auth_uuid });
      console.log(`[RoleExpiration] Updated expired roles for ${user.email}`);
    }

    next();
  } catch (error) {
    console.error('[RoleExpiration] Error checking role expiration:', error);
    // Continue even if expiration check fails
    next();
  }
};

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
        console.warn('[UserInfo] ❌ No req.userId set by previous middleware');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`[UserInfo] 🔍 Fetching user info for UUID: ${req.userId}`);
      const user = await queryOne('users', { where: { auth_uuid: req.userId } });

      if (!user) {
        console.warn(`[UserInfo] ❌ User not found in database for UUID: ${req.userId}`);
        return res.status(404).json({ error: 'User not found in database' });
      }

      console.log(`[UserInfo] ✅ Found user: ${user.email}`);
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
 * Middleware to check if user is a master admin
 * Now also enforces an IP-based restriction and GRANTS access based on IP
 */
export const requireMasterAdmin = (req, res, next) => {
  if (!req.userInfo) {
    return res.status(401).json({ error: 'User info not available' });
  }

  // IP check first
  const allowedIps = (process.env.ADMIN_ALLOWED_IPS || '127.0.0.1,::1').split(',').map(ip => ip.trim());
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || req.ip;
  const normalizedIp = clientIp.startsWith('::ffff:') ? clientIp.substring(7) : clientIp;

  const isIpAllowed = allowedIps.includes(normalizedIp) || allowedIps.includes(clientIp);

  // 1. IP Bypass / Elevation
  if (isIpAllowed) {
    if (!req.userInfo.is_masteradmin) {
      console.log(`[MasterAdmin] ⬆️  SUDO: Elevating ${req.userInfo.email} to Master Admin via IP match (${normalizedIp})`);
      req.userInfo.is_masteradmin = true;
    } else {
      console.log(`[MasterAdmin] ✅ Access granted to ${req.userInfo.email} from authorized IP: ${normalizedIp}`);
    }
    return next();
  }

  // 2. Role-based check (Allow any IP if they are already Master Admin)
  if (req.userInfo.is_masteradmin) {
    console.log(`[MasterAdmin] ✅ Access granted to ${req.userInfo.email} from non-whitelisted IP: ${normalizedIp}`);
    return next();
  }

  // 3. Fallback: Deny access if not Master Admin and IP not allowed
  console.warn(`[MasterAdmin] ❌ Access denied for ${req.userInfo.email} - Not a Master Admin and unauthorized IP: ${normalizedIp}`);
  return res.status(403).json({ 
    error: 'Access denied: Master Admin privileges required',
    debug: process.env.NODE_ENV === 'development' ? { clientIp: normalizedIp } : undefined
  });
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
      // Master admin bypass - can access any resource
      if (req.userInfo?.is_masteradmin) {
        console.log(`[Ownership] ✅ BYPASSED for master admin: ${req.userInfo.email}`);
        
        // Still fetch the resource for req.resource
        const resourceId = req.params[paramName] || req.params.id;
        const columnMapping = {
          'eventId': 'event_id',
          'festId': 'fest_id',
          'id': 'id'
        };
        const dbColumnName = columnMapping[paramName] || paramName;
        
        try {
          const resource = await queryOne(table, { where: { [dbColumnName]: resourceId } });
          if (resource) {
            req.resource = resource;
          }
        } catch (err) {
          console.warn('[Ownership] Failed to fetch resource for master admin:', err.message);
        }
        
        return next();
      }

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

/**
 * Helper to create middleware that checks master admin OR ownership
 * Convenience wrapper around requireOwnership with master admin bypass
 */
export const requireMasterAdminOrOwnership = (table, paramName, ownerField = 'auth_uuid') => {
  // requireOwnership already has master admin bypass built-in now
  return requireOwnership(table, paramName, ownerField);
};

/**
 * Middleware to restrict access based on IP address
 * Should be used in conjunction with requireMasterAdmin for sensitive routes
 */
export const requireAdminIP = (req, res, next) => {
  const allowedIps = (process.env.ADMIN_ALLOWED_IPS || '127.0.0.1,::1').split(',').map(ip => ip.trim());
  
  // Try to get IP from various headers (accounting for proxies)
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                   req.socket.remoteAddress || 
                   req.ip;

  // Clean up IPv6-mapped IPv4 addresses
  const normalizedIp = clientIp.startsWith('::ffff:') ? clientIp.substring(7) : clientIp;
  console.log(`[IPRestriction] 🔍 Checking IP: ${normalizedIp} against [${allowedIps.join(', ')}]`);

  if (!allowedIps.includes(normalizedIp) && !allowedIps.includes(clientIp)) {
    // If user is already a master admin, ALLOW access from this non-whitelisted IP
    if (req.userInfo?.is_masteradmin) {
      console.log(`[IPRestriction] ✅ Master Admin access allowed from non-whitelisted IP: ${normalizedIp}`);
      return next();
    }

    console.warn(`[IPRestriction] ❌ Access denied for IP: ${normalizedIp} (Raw: ${clientIp})`);
    return res.status(403).json({ 
      error: 'Access denied: Master Admin privileges required or unauthorized IP address',
      debug: process.env.NODE_ENV === 'development' ? { clientIp: normalizedIp } : undefined
    });
  }

  console.log(`[IPRestriction] ✅ IP Access granted for ${normalizedIp}`);
  next();
};