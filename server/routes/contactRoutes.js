import express from "express";
import { insert, queryAll, queryOne } from "../config/database.js";
import { authenticateUser } from "../middleware/authMiddleware.js";
import { validateContactForm } from "../middleware/validation.js";
import supabase from "../config/supabaseClient.js";

const router = express.Router();

router.post("/contact", validateContactForm, async (req, res) => {
  const { name, email, subject, message, source } = req.body || {};

  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: "Name, email, subject, and message are required."
    });
  }

  const payload = {
    name: String(name).trim(),
    email: String(email).trim(),
    subject: String(subject).trim(),
    message: String(message).trim(),
    source: source ? String(source).trim() : "contact",
    status: "new",
    created_at: new Date().toISOString()
  };

  try {
    await insert("contact_messages", [payload]);
    return res.status(201).json({ success: true });
  } catch (error) {
    console.error("Error saving contact message:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to send message right now."
    });
  }
});

router.get("/support/messages", authenticateUser, async (req, res) => {
  try {
    const authId = req.user?.id;
    if (!authId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const supportUser = await queryOne("users", { where: { auth_uuid: authId } });
    if (!supportUser?.is_support) {
      return res.status(403).json({ success: false, message: "Support privileges required." });
    }

    const messages = await queryAll("contact_messages", {
      order: { column: "created_at", ascending: false }
    });

    return res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching contact messages:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load messages right now."
    });
  }
});

router.patch("/support/messages/:id", authenticateUser, async (req, res) => {
  try {
    const authId = req.user?.id;
    if (!authId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const supportUser = await queryOne("users", { where: { auth_uuid: authId } });
    if (!supportUser?.is_support) {
      return res.status(403).json({ success: false, message: "Support privileges required." });
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["new", "read", "resolving", "solved"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      });
    }

    // Update the status using Supabase
    const { data, error } = await supabase
      .from("contact_messages")
      .update({ status })
      .eq("id", id)
      .select();

    if (error) {
      console.error("Error updating message status:", error);
      return res.status(500).json({ success: false, message: "Failed to update status.", error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: "Message not found." });
    }

    return res.status(200).json({ success: true, message: data[0] });
  } catch (error) {
    console.error("Error updating message status:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update status right now."
    });
  }
});

export default router;
