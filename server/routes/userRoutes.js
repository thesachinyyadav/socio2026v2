import express from "express";
import { queryAll, queryOne, update } from "../config/database.js";
import { createClient } from '@supabase/supabase-js';
import { 
  authenticateUser, 
  getUserInfo, 
  checkRoleExpiration,
  requireMasterAdmin,
  optionalAuth
} from "../middleware/authMiddleware.js";
import { sendWelcomeEmail } from "../utils/emailService.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// Get all users with optional search and role filter (master admin only)
router.get("/", authenticateUser, getUserInfo(), checkRoleExpiration, requireMasterAdmin, async (req, res) => {
  try {
    const { search, role } = req.query;
    
    let users = await queryAll("users");
    
    // Apply search filter (email or name)
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(user => 
        user.email?.toLowerCase().includes(searchLower) ||
        user.name?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply role filter
    if (role) {
      switch (role) {
        case 'organiser':
          users = users.filter(user => user.is_organiser);
          break;
        case 'support':
          users = users.filter(user => user.is_support);
          break;
        case 'masteradmin':
          users = users.filter(user => user.is_masteradmin);
          break;
      }
    }
    
    return res.status(200).json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const user = await queryOne("users", { where: { email } });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    return res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Allow outsider to edit their name once
router.put("/:email/name", optionalAuth, async (req, res) => {
  try {
    const { email } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Name must be a non-empty string' });
    }

    // Fetch user record by email
    const existingUser = await queryOne('users', { where: { email } });
    if (!existingUser) return res.status(404).json({ error: 'User not found' });

    // Only outsiders allowed
    if (existingUser.organization_type !== 'outsider') {
      return res.status(403).json({ error: 'Only outsider users can edit name using this endpoint' });
    }

    // Check if outsider has already used their one-time edit
    if (existingUser.outsider_name_edit_used) {
      return res.status(400).json({ error: 'Name edit already used' });
    }

    // Authorization options:
    // 1) Authenticated user (req.user via optionalAuth) matches email or is masteradmin
    // 2) Fallback: visitor_id provided in body matches user's visitor_id (outsider-only)

    let authorized = false;
    if (req.user && req.user.email && req.user.email === email) {
      authorized = true;
    }
    // allow masteradmin (if optionalAuth resolved req.user and we can check DB)
    if (!authorized && req.user && req.user.id) {
      const requester = await queryOne('users', { where: { auth_uuid: req.user.id } });
      if (requester && requester.is_masteradmin) authorized = true;
    }

    // Fallback: visitor_id match
    if (!authorized && req.body && req.body.visitor_id) {
      const providedVis = String(req.body.visitor_id).toUpperCase();
      if (existingUser.visitor_id && String(existingUser.visitor_id).toUpperCase() === providedVis) {
        authorized = true;
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Perform update
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({ name: name.trim(), outsider_name_edit_used: true })
      .eq('email', email)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ user: updatedUser, message: 'Name updated successfully' });
  } catch (error) {
    console.error('Error updating outsider name:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to generate unique visitor ID for outsiders
// Uses timestamp + random for guaranteed uniqueness without DB lookup
function generateVisitorId() {
  const timestamp = Date.now().toString(36).toUpperCase(); // Base36 timestamp
  const random = Math.random().toString(36).substring(2, 5).toUpperCase(); // 3 random chars
  return `VIS${timestamp.slice(-4)}${random}`; // e.g., VIS1A2BXYZ
}

// Helper function to generate unique staff ID
function generateStaffId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `STF${timestamp.slice(-4)}${random}`;
}

// Helper function to determine organization type from email
function getOrganizationType(email) {
  if (!email) return 'outsider';
  const lowerEmail = email.toLowerCase();
  const domain = lowerEmail.split('@')[1] || '';
  if (domain.endsWith('christuniversity.in')) return 'christ_member';
  return 'outsider';
}

function isStaffDomain(email) {
  if (!email) return false;
  const lowerEmail = email.toLowerCase();
  const domain = lowerEmail.split('@')[1] || '';
  return domain === 'christuniversity.in';
}

router.post("/", async (req, res) => {
  try {
    const { user: authClientUser } = req.body;
    if (!authClientUser || !authClientUser.email) {
      return res
        .status(400)
        .json({ error: "Invalid user data: email is required" });
    }

    // Determine organization type from email
    const organizationType = getOrganizationType(authClientUser.email);
    const isStaffEmail = isStaffDomain(authClientUser.email);
    
    console.log(`📧 User login: ${authClientUser.email} | Organization: ${organizationType}`);
    
    // Check if user already exists by email
    const existingUser = await queryOne("users", { where: { email: authClientUser.email } });

    if (existingUser) {
      // Build update object for fields that need updating
      const updateData = {};
      
      // SAFETY CHECK: If user is already a Christ member, NEVER convert to outsider
      if (existingUser.organization_type === 'christ_member' && organizationType === 'outsider') {
        console.warn(`⚠️  Attempted to convert Christ member to outsider: ${authClientUser.email}. Blocked.`);
        return res.status(200).json({
          user: existingUser,
          isNew: false,
          message: "User already exists.",
        });
      }
      
      // Check if auth_uuid needs updating
      if (!existingUser.auth_uuid && authClientUser.id) {
        updateData.auth_uuid = authClientUser.id;
      }
      
      // Check if register_number needs updating
      // NEVER overwrite existing register_number for Christ members
      if ((!existingUser.register_number || existingUser.register_number === 0) && 
          authClientUser.register_number &&
          existingUser.organization_type !== 'christ_member') {
        updateData.register_number = authClientUser.register_number;
      }
      
      // Check if course needs updating
      if (!existingUser.course && authClientUser.course) {
        updateData.course = authClientUser.course;
      }
      
      // Check if organization_type needs updating (for users created before this feature)
      // IMPORTANT: Only set organization_type if it doesn't exist - NEVER overwrite existing values
      if (!existingUser.organization_type) {
        updateData.organization_type = organizationType;
        
        // Only generate IDs for new outsiders (those without organization_type)
        if (organizationType === 'outsider') {
          const visitorId = generateVisitorId();
          updateData.visitor_id = visitorId;
          updateData.register_number = visitorId; // Use visitor_id as register_number for outsiders
        }
      }
      
      // If user is already marked as outsider but missing visitor_id, generate it
      if (existingUser.organization_type === 'outsider' && !existingUser.visitor_id) {
        const visitorId = generateVisitorId();
        updateData.visitor_id = visitorId;
        if (!existingUser.register_number || existingUser.register_number === '0') {
          updateData.register_number = visitorId;
        }
      }

      // If staff-domain user is missing a register_number, generate STF under christ_member
      if (isStaffEmail && existingUser.organization_type !== 'outsider' && (!existingUser.register_number || existingUser.register_number === '0')) {
        const staffId = generateStaffId();
        updateData.register_number = staffId;
      }

      // Auto-grant organiser access ONLY for staff-domain users (e.g. sachin@christuniversity.in)
      if (!existingUser.is_organiser && isStaffEmail) {
        updateData.is_organiser = true;
      }
      
      // Update user if needed
      if (Object.keys(updateData).length > 0) {
        const { data: updatedUser, error } = await supabase
          .from('users')
          .update(updateData)
          .eq('email', authClientUser.email)
          .select()
          .single();
        
        if (error) throw error;
        
        return res.status(200).json({
          user: updatedUser,
          isNew: false,
          message: "User information updated.",
        });
      }
      
      return res.status(200).json({
        user: existingUser,
        isNew: false,
        message: "User already exists.",
      });
    }

    // Create new user
    let name = authClientUser.name || authClientUser.user_metadata?.full_name || "";
    let registerNumber = authClientUser.register_number || authClientUser.user_metadata?.register_number || null;
    let course = authClientUser.course || null;
    let visitorId = null;
    
    // Handle outsiders differently
    if (organizationType === 'outsider') {
      // Generate visitor ID for outsiders
      visitorId = generateVisitorId();
      registerNumber = visitorId; // Use visitor_id as register_number for outsiders
      course = null; // Outsiders don't have a course
      
      console.log(`Generated visitor ID for outsider: ${visitorId}`);
    } else if (isStaffEmail) {
      const staffId = generateStaffId();
      registerNumber = staffId;
      course = null;
      console.log(`Generated staff ID: ${staffId}`);
    } else {
      // Christ member - extract registration number from name if not provided
      if (!registerNumber && name) {
        const nameParts = name.split(" ");
        if (nameParts.length > 1) {
          const lastPart = nameParts[nameParts.length - 1];
          if (/^\d+$/.test(lastPart)) {
            registerNumber = lastPart; // Store as string to match TEXT column
            name = nameParts.slice(0, -1).join(" ");
          }
        }
      }
      
      // Extract course from email for Christ members
      if (!course && authClientUser.email) {
        const emailParts = authClientUser.email.split("@");
        if (emailParts.length === 2) {
          const domainParts = emailParts[1].split(".");
          if (domainParts.length > 0) {
            const possibleCourse = domainParts[0].toUpperCase();
            if (possibleCourse && possibleCourse !== "CHRISTUNIVERSITY") {
              course = possibleCourse;
            }
          }
        }
      }
    }

    const avatarUrl =
      authClientUser.user_metadata?.avatar_url ||
      authClientUser.user_metadata?.picture ||
      authClientUser.avatar_url ||
      authClientUser.picture ||
      null;

    console.log("Creating new user with data:", {
      name,
      email: authClientUser.email,
      registerNumber,
      course,
      organizationType,
      visitorId
    });

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        auth_uuid: authClientUser.id || null,
        email: authClientUser.email,
        name: name || "New User",
        avatar_url: avatarUrl,
        is_organiser: isStaffEmail, // Only staff-domain (@christuniversity.in) get organiser access
        is_support: false,
        register_number: registerNumber,
        course: course,
        organization_type: organizationType,
        visitor_id: visitorId
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Return response immediately - don't block on background tasks
    res.status(201).json({
      user: newUser,
      isNew: true,
      message: "User created successfully.",
    });

    // Background tasks (fire and forget after response sent)
    // 1. Send welcome email
    sendWelcomeEmail(
      newUser.email,
      newUser.name,
      organizationType === 'outsider',
      visitorId
    ).catch(err => console.error('Welcome email failed:', err));

    // 2. Check if user was pre-added as event head (non-blocking)
    (async () => {
      try {
        const allFests = await queryAll('fest');
        for (const fest of allFests || []) {
          const eventHeads = fest.event_heads || [];
          const matchingHead = eventHeads.find((head) => 
            head && head.email && head.email.toLowerCase() === newUser.email.toLowerCase()
          );
          
          if (matchingHead) {
            console.log(`Found pending organiser access for ${newUser.email} in fest ${fest.fest_id}`);
            await supabase
              .from('users')
              .update({ 
                is_organiser: true,
                organiser_expires_at: matchingHead.expiresAt || null
              })
              .eq('email', newUser.email);
            console.log(`Granted pending organiser access to ${newUser.email}`);
            break;
          }
        }
      } catch (err) {
        console.error('Error checking for pending organiser access:', err);
      }
    })();

    return; // Already sent response
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update user roles (master admin only)
router.put("/:email/roles", authenticateUser, getUserInfo(), checkRoleExpiration, requireMasterAdmin, async (req, res) => {
  try {
    const { email } = req.params;
    const { 
      is_organiser, 
      organiser_expires_at,
      is_support, 
      support_expires_at,
      is_masteradmin, 
      masteradmin_expires_at 
    } = req.body;

    // Check if user exists
    const existingUser = await queryOne("users", { where: { email } });
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent removing last master admin
    if (existingUser.is_masteradmin && is_masteradmin === false) {
      const allMasterAdmins = await queryAll("users");
      const masterAdminCount = allMasterAdmins.filter(u => u.is_masteradmin).length;
      
      if (masterAdminCount <= 1) {
        return res.status(400).json({ 
          error: "Cannot remove the last master admin. Promote another user first." 
        });
      }
    }

    // Build update object
    const updates = {};
    
    if (typeof is_organiser === 'boolean') {
      updates.is_organiser = is_organiser;
      updates.organiser_expires_at = organiser_expires_at || null;
    }
    
    if (typeof is_support === 'boolean') {
      updates.is_support = is_support;
      updates.support_expires_at = support_expires_at || null;
    }
    
    if (typeof is_masteradmin === 'boolean') {
      updates.is_masteradmin = is_masteradmin;
      updates.masteradmin_expires_at = masteradmin_expires_at || null;
    }

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('email', email)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log(`[MasterAdmin] User roles updated: ${email} by ${req.userInfo.email}`);
    
    return res.status(200).json({ 
      user: updatedUser,
      message: "User roles updated successfully" 
    });
  } catch (error) {
    console.error("Error updating user roles:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete user (master admin only)
router.delete("/:email", authenticateUser, getUserInfo(), checkRoleExpiration, requireMasterAdmin, async (req, res) => {
  try {
    const { email } = req.params;

    // Check if user exists
    const existingUser = await queryOne("users", { where: { email } });
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent deleting last master admin
    if (existingUser.is_masteradmin) {
      const allMasterAdmins = await queryAll("users");
      const masterAdminCount = allMasterAdmins.filter(u => u.is_masteradmin).length;
      
      if (masterAdminCount <= 1) {
        return res.status(400).json({ 
          error: "Cannot delete the last master admin" 
        });
      }
    }

    // Prevent self-deletion
    if (email === req.userInfo.email) {
      return res.status(400).json({ 
        error: "Cannot delete your own account" 
      });
    }

    // Delete user (cascade deletes will handle related records via DB constraints)
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('email', email);

    if (deleteError) throw deleteError;

    console.log(`[MasterAdmin] User deleted: ${email} by ${req.userInfo.email}`);
    
    return res.status(200).json({ 
      message: "User deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;