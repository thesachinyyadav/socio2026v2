import express from "express";
import { queryAll, queryOne, update } from "../config/database.js";
import { createClient } from '@supabase/supabase-js';
import { 
  authenticateUser, 
  getUserInfo, 
  checkRoleExpiration,
  requireMasterAdmin 
} from "../middleware/authMiddleware.js";

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

// Helper function to generate unique visitor ID for outsiders
async function generateVisitorId() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    // Generate random 7-digit number
    const randomNumber = Math.floor(1000000 + Math.random() * 9000000);
    const visitorId = `VIS${randomNumber}`;
    
    // Check if this visitor ID already exists
    const existing = await queryOne("users", { where: { visitor_id: visitorId } });
    
    if (!existing) {
      return visitorId;
    }
    
    attempts++;
  }
  
  throw new Error("Failed to generate unique visitor ID after 10 attempts");
}

// Helper function to determine organization type from email
function getOrganizationType(email) {
  if (!email) return 'outsider';
  return email.toLowerCase().endsWith('@christuniversity.in') ? 'christ_member' : 'outsider';
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
    
    // Check if user already exists by email
    const existingUser = await queryOne("users", { where: { email: authClientUser.email } });

    if (existingUser) {
      // Build update object for fields that need updating
      const updateData = {};
      
      // Check if auth_uuid needs updating
      if (!existingUser.auth_uuid && authClientUser.id) {
        updateData.auth_uuid = authClientUser.id;
      }
      
      // Check if register_number needs updating
      if ((!existingUser.register_number || existingUser.register_number === 0) && 
          authClientUser.register_number) {
        updateData.register_number = authClientUser.register_number;
      }
      
      // Check if course needs updating
      if (!existingUser.course && authClientUser.course) {
        updateData.course = authClientUser.course;
      }
      
      // Check if organization_type needs updating (for users created before this feature)
      if (!existingUser.organization_type) {
        updateData.organization_type = organizationType;
      }
      
      // Check if visitor_id needs to be generated (for outsiders without one)
      if (organizationType === 'outsider' && !existingUser.visitor_id) {
        const visitorId = await generateVisitorId();
        updateData.visitor_id = visitorId;
        updateData.register_number = visitorId; // Use visitor_id as register_number for outsiders
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
      visitorId = await generateVisitorId();
      registerNumber = visitorId; // Use visitor_id as register_number for outsiders
      course = null; // Outsiders don't have a course
      
      console.log(`Generated visitor ID for outsider: ${visitorId}`);
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
        is_organiser: organizationType === 'christ_member', // Only Christ members can be organisers
        is_support: false,
        register_number: registerNumber,
        course: course,
        organization_type: organizationType,
        visitor_id: visitorId
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      user: newUser,
      isNew: true,
      message: "User created successfully.",
    });
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