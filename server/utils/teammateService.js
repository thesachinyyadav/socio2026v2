/**
 * Teammate User Management Service
 * Handles automatic user creation and management for team members
 * Ensures teammates have their own user records and can access the platform
 */

import { queryOne, insert } from "../config/database.js";

/**
 * Create or update user records for all teammates in a registration
 * @param {Array} teamList - Array of teammate objects {name, email, registerNumber}
 * @param {string} organizationType - 'christ_member' or 'outsider'
 * @returns {Promise<Array>} Created/updated user records
 */
export async function createOrUpdateTeammateUsers(teamList, organizationType = 'christ_member') {
  if (!Array.isArray(teamList) || teamList.length === 0) {
    return [];
  }

  const createdUsers = [];
  const errors = [];

  for (const teammate of teamList) {
    if (!teammate?.email) {
      console.warn('⚠️ Teammate missing email, skipping:', teammate);
      continue;
    }

    const normalizedEmail = String(teammate.email).toLowerCase().trim();

    try {
      // Check if user already exists
      const existingUser = await queryOne('users', {
        where: { email: normalizedEmail }
      });

      if (existingUser) {
        console.log(`👤 Teammate user already exists: ${normalizedEmail} (ID: ${existingUser.id})`);
        createdUsers.push({
          ...existingUser,
          isNew: false,
          status: 'existing'
        });
      } else {
        // Look up existing user data by register number to get department & campus
        let departmentId = null;
        let campus = null;
        let course = null;

        if (teammate?.registerNumber) {
          try {
            const existingData = await queryOne('users', {
              where: { register_number: teammate.registerNumber }
            });

            if (existingData) {
              departmentId = existingData.department_id || null;
              campus = existingData.campus || null;
              course = existingData.course || null;
              console.log(`📍 Found existing data for register # ${teammate.registerNumber}: dept=${departmentId}, campus=${campus}`);
            }
          } catch (lookupError) {
            console.warn(`⚠️ Could not lookup data for register # ${teammate.registerNumber}:`, lookupError.message);
          }
        }

        // Create new user record for teammate
        const [newUser] = await insert('users', {
          email: normalizedEmail,
          name: teammate.name || 'Team Member',
          register_number: teammate.registerNumber || null,
          organization_type: organizationType,
          department_id: departmentId,
          campus: campus,
          course: course,
          is_organiser: false,
          is_support: false,
          is_masteradmin: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        console.log(`✅ New teammate user created: ${normalizedEmail} (ID: ${newUser.id}) - campus: ${campus}, dept: ${departmentId}`);
        createdUsers.push({
          ...newUser,
          isNew: true,
          status: 'created'
        });
      }
    } catch (error) {
      const errorMsg = `Error creating/updating user for teammate ${normalizedEmail}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      errors.push({
        email: normalizedEmail,
        name: teammate.name,
        error: error.message
      });
    }
  }

  if (errors.length > 0) {
    console.warn(`⚠️ Failed to process ${errors.length} teammate(s):`, errors);
  }

  return {
    success: createdUsers.length,
    failed: errors.length,
    users: createdUsers,
    errors: errors
  };
}

/**
 * Verify all teammates in a registration have user records
 * Used for analytics and reporting
 * @param {Array} teamList - Array of teammate objects
 * @returns {Promise<Object>} Summary of user existence
 */
export async function verifyTeammateUsers(teamList) {
  if (!Array.isArray(teamList) || teamList.length === 0) {
    return { total: 0, existing: 0, missing: 0 };
  }

  let existing = 0;
  let missing = 0;

  for (const teammate of teamList) {
    if (!teammate?.email) continue;

    try {
      const user = await queryOne('users', {
        where: { email: String(teammate.email).toLowerCase().trim() }
      });

      if (user) {
        existing++;
      } else {
        missing++;
      }
    } catch (error) {
      console.warn(`Could not verify user for ${teammate.email}:`, error.message);
      missing++;
    }
  }

  return {
    total: teamList.length,
    existing,
    missing,
    allExist: missing === 0
  };
}

/**
 * Get user IDs for all teammates
 * Useful for bulk operations and analytics
 * @param {Array} teamList - Array of teammate objects
 * @returns {Promise<Array>} User IDs of teammates
 */
export async function getTeammateUserIds(teamList) {
  if (!Array.isArray(teamList) || teamList.length === 0) {
    return [];
  }

  const userIds = [];

  for (const teammate of teamList) {
    if (!teammate?.email) continue;

    try {
      const user = await queryOne('users', {
        where: { email: String(teammate.email).toLowerCase().trim() }
      });

      if (user?.id) {
        userIds.push(user.id);
      }
    } catch (error) {
      console.warn(`Could not fetch user ID for ${teammate.email}:`, error.message);
    }
  }

  return userIds;
}

/**
 * Enrich teammate data with their user IDs and details
 * @param {Array} teamList - Array of teammate objects
 * @returns {Promise<Array>} Teammates with full user details
 */
export async function enrichTeammateData(teamList) {
  if (!Array.isArray(teamList) || teamList.length === 0) {
    return [];
  }

  const enriched = [];

  for (const teammate of teamList) {
    if (!teammate?.email) continue;

    try {
      const user = await queryOne('users', {
        where: { email: String(teammate.email).toLowerCase().trim() }
      });

      enriched.push({
        ...teammate,
        userId: user?.id || null,
        userName: user?.name || teammate.name || null,
        userExists: !!user,
        userCreatedAt: user?.created_at || null
      });
    } catch (error) {
      enriched.push({
        ...teammate,
        userId: null,
        userExists: false,
        error: error.message
      });
    }
  }

  return enriched;
}
