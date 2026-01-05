import express from "express";
import { queryAll, queryOne } from "../config/database.js";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const users = await queryAll("users");
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

router.post("/", async (req, res) => {
  try {
    const { user: authClientUser } = req.body;
    if (!authClientUser || !authClientUser.email) {
      return res
        .status(400)
        .json({ error: "Invalid user data: email is required" });
    }

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
    
    // If registration number wasn't found and we have a name with digits at the end
    if (!registerNumber && name) {
      const nameParts = name.split(" ");
      if (nameParts.length > 1) {
        const lastPart = nameParts[nameParts.length - 1];
        if (/^\d+$/.test(lastPart)) {
          registerNumber = parseInt(lastPart);
          name = nameParts.slice(0, -1).join(" ");
        }
      }
    }
    
    // If no course was provided, try extracting from email
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
      course
    });

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        auth_uuid: authClientUser.id || null,
        email: authClientUser.email,
        name: name || "New User",
        avatar_url: avatarUrl,
        is_organiser: false,
        register_number: registerNumber,
        course: course
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

export default router;