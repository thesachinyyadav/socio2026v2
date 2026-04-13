import supabase from "../config/supabaseClient.js";
import { queryAll, queryOne, update } from "../config/database.js";
import {
  ROLE_CODES,
  combineRoleCodes,
  deriveRoleCodesFromAssignments,
  deriveLegacyFlagsFromRoleCodes,
  deriveRoleCodesFromUserRecord,
  hasAnyRoleCode,
  isRoleAssignmentActive,
} from "../utils/roleAccessService.js";

const getRoleCodes = (userInfo) => (Array.isArray(userInfo?.role_codes) ? userInfo.role_codes : []);

const isMasterAdminUser = (userInfo) => {
  return Boolean(userInfo?.is_masteradmin) || hasAnyRoleCode(getRoleCodes(userInfo), [ROLE_CODES.MASTER_ADMIN]);
};

const isOrganiserUser = (userInfo) => {
  return Boolean(userInfo?.is_organiser) || hasAnyRoleCode(getRoleCodes(userInfo), [ROLE_CODES.ORGANIZER_TEACHER]);
};

const hasLegacyFlagForRole = (userInfo, roleCode) => {
  const normalizedRole = String(roleCode || "").trim().toUpperCase();

  if (!normalizedRole) {
    return false;
  }

  switch (normalizedRole) {
    case ROLE_CODES.MASTER_ADMIN:
      return Boolean(userInfo?.is_masteradmin);
    case ROLE_CODES.ORGANIZER_TEACHER:
      return Boolean(userInfo?.is_organiser);
    case ROLE_CODES.SUPPORT:
      return Boolean(userInfo?.is_support);
    case ROLE_CODES.HOD:
      return Boolean(userInfo?.is_hod);
    case ROLE_CODES.DEAN:
      return Boolean(userInfo?.is_dean);
    case ROLE_CODES.CFO:
      return Boolean(userInfo?.is_cfo);
    case ROLE_CODES.ACCOUNTS:
      return Boolean(userInfo?.is_finance_officer) || Boolean(userInfo?.is_finance_office);
    case ROLE_CODES.ORGANIZER_STUDENT:
      return Boolean(userInfo?.is_organiser_student);
    case ROLE_CODES.ORGANIZER_VOLUNTEER:
      return Boolean(userInfo?.is_volunteer);
    case ROLE_CODES.SERVICE_IT:
      return Boolean(userInfo?.is_service_it);
    case ROLE_CODES.SERVICE_VENUE:
      return Boolean(userInfo?.is_service_venue) || Boolean(userInfo?.is_venue_manager);
    case ROLE_CODES.SERVICE_CATERING:
      return Boolean(userInfo?.is_service_catering);
    case ROLE_CODES.SERVICE_STALLS:
      return Boolean(userInfo?.is_service_stalls);
    case ROLE_CODES.SERVICE_SECURITY:
      return Boolean(userInfo?.is_service_security);
    default:
      return false;
  }
};

const isMissingRelationError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes("schema cache"))
  );
};

const isMissingColumnError = (error, columnName) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  const normalizedColumn = String(columnName || "").toLowerCase();

  if (!normalizedColumn) {
    return false;
  }

  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes(`column \"${normalizedColumn}\"`) ||
    message.includes(`${normalizedColumn} does not exist`) ||
    (message.includes("could not find") && message.includes(normalizedColumn))
  );
};

const enrichUserInfoWithRoles = async (userRecord) => {
  if (!userRecord?.id) {
    return userRecord;
  }

  let roleAssignments = [];

  try {
    const assignmentRows = await queryAll("user_role_assignments", {
      where: { user_id: userRecord.id, is_active: true },
    });

    roleAssignments = (assignmentRows || []).filter((assignment) =>
      isRoleAssignmentActive(assignment)
    );
  } catch (error) {
    if (
      !isMissingRelationError(error) &&
      !isMissingColumnError(error, "role_code")
    ) {
      throw error;
    }
  }

  const roleCodes = combineRoleCodes(
    deriveRoleCodesFromUserRecord(userRecord),
    deriveRoleCodesFromAssignments(roleAssignments)
  );
  const legacyRoleFlags = deriveLegacyFlagsFromRoleCodes(roleCodes, userRecord);

  return {
    ...userRecord,
    ...legacyRoleFlags,
    role_assignments: roleAssignments,
    role_codes: roleCodes,
  };
};

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
        if (user.is_organiser) {
          updates.is_organiser = false;
          user.is_organiser = false;
        }

        if (user.is_organiser_student) {
          updates.is_organiser_student = false;
          user.is_organiser_student = false;
        }

        updates.organiser_expires_at = null;
        user.organiser_expires_at = null;
        hasExpiredRoles = true;
        console.log(`[RoleExpiration] Expired organiser/organiser-student role for ${user.email}`);
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
      req.userInfo = await enrichUserInfoWithRoles(user);
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
    console.error("[ORGANISER CHECK] ❌ No req.userInfo available");
    return res.status(401).json({ error: 'User info not available' });
  }

  const userIsOrganiser = isOrganiserUser(req.userInfo);
  const userIsMasterAdmin = isMasterAdminUser(req.userInfo);
  const roleCodes = Array.isArray(req.userInfo.role_codes) ? req.userInfo.role_codes : [];

  console.log(`[ORGANISER CHECK] Checking user: ${req.userInfo.email}, is_organiser: ${req.userInfo.is_organiser}, role_codes: ${roleCodes.join(',')}`);
  
  if (!userIsOrganiser && !userIsMasterAdmin) {
    console.warn(`[ORGANISER CHECK] ❌ User ${req.userInfo.email} is NOT an organiser. Access denied.`);
    return res.status(403).json({ 
      error: 'Access denied: Organiser privileges required',
      userEmail: req.userInfo.email,
      currentRole: roleCodes.length > 0 ? roleCodes.join(',') : 'regular_user'
    });
  }

  console.log(`[ORGANISER CHECK] ✅ User ${req.userInfo.email} has organiser-equivalent access. Proceeding.`);
  next();
};

/**
 * Middleware to check if user is a master admin
 */
export const requireMasterAdmin = (req, res, next) => {
  if (!req.userInfo) {
    return res.status(401).json({ error: 'User info not available' });
  }

  if (!isMasterAdminUser(req.userInfo)) {
    console.warn(`[MasterAdmin] Access denied for ${req.userInfo.email} - Master Admin privileges required`);
    return res.status(403).json({
      error: 'Access denied: Master Admin privileges required'
    });
  }

  console.log(`[MasterAdmin] Access granted to ${req.userInfo.email}`);
  return next();
};

/**
 * Middleware factory for requiring any one role from a set.
 * Master admin bypass is enabled by default.
 */
export const requireAnyRole = (allowedRoleCodes = [], options = {}) => {
  const normalizedAllowedRoles = Array.from(
    new Set((allowedRoleCodes || []).map((roleCode) => String(roleCode || "").trim().toUpperCase()).filter(Boolean))
  );

  const allowMasterAdminBypass = options.allowMasterAdminBypass !== false;

  return (req, res, next) => {
    if (!req.userInfo) {
      return res.status(401).json({ error: "User info not available" });
    }

    if (normalizedAllowedRoles.length === 0) {
      return next();
    }

    if (allowMasterAdminBypass && isMasterAdminUser(req.userInfo)) {
      return next();
    }

    const userRoleCodes = Array.isArray(req.userInfo.role_codes) ? req.userInfo.role_codes : [];
    if (hasAnyRoleCode(userRoleCodes, normalizedAllowedRoles)) {
      return next();
    }

    const fallbackAllowedByLegacyFlags = normalizedAllowedRoles.some((roleCode) =>
      hasLegacyFlagForRole(req.userInfo, roleCode)
    );

    if (fallbackAllowedByLegacyFlags) {
      return next();
    }

    return res.status(403).json({
      error: "Access denied: Required role assignment missing",
      required_roles: normalizedAllowedRoles,
    });
  };
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
      const resolveResource = async (tableName, whereClause) => {
        const isMissingRelationError = (error) => {
          const code = String(error?.code || '').toUpperCase();
          const message = String(error?.message || '').toLowerCase();
          return (
            code === '42P01' ||
            code === 'PGRST205' ||
            (message.includes('relation') && message.includes('does not exist')) ||
            (message.includes('could not find') && message.includes('schema cache'))
          );
        };

        try {
          return await queryOne(tableName, { where: whereClause });
        } catch (error) {
          const canFallbackFestTable = (tableName === 'fest' || tableName === 'fests') && isMissingRelationError(error);
          if (!canFallbackFestTable) {
            throw error;
          }

          const fallbackTable = tableName === 'fest' ? 'fests' : 'fest';
          return await queryOne(fallbackTable, { where: whereClause });
        }
      };

      // Master admin bypass - can access any resource
      if (isMasterAdminUser(req.userInfo)) {
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
          const resource = await resolveResource(table, { [dbColumnName]: resourceId });
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
        resource = await resolveResource(table, { [dbColumnName]: resourceId });
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
          console.log(`[Ownership] ⚠️ auth_uuid mismatch (${resource.auth_uuid} !== ${req.userId}), checking legacy created_by fallback...`);
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

        // Best-effort user profile hydration for role-aware optional routes.
        try {
          const localUser = await queryOne('users', { where: { auth_uuid: user.id } });
          if (localUser) {
            req.userInfo = await enrichUserInfoWithRoles(localUser);
          }
        } catch (dbError) {
          console.warn('[optionalAuth] Failed to hydrate req.userInfo:', dbError?.message || dbError);
        }
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
