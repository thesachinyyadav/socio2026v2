import express from "express";
import { insert, queryAll, queryOne } from "../config/database.js";
import { authenticateUser } from "../middleware/authMiddleware.js";
import supabase from "../config/supabaseClient.js";
import { body, validationResult } from "express-validator";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiting for contact form (5 submissions per 15 minutes per IP)
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many contact submissions. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation rules for contact form
const contactValidationRules = () => [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required (max 100 chars)').escape(),
  body('email').isEmail().withMessage('Invalid email address'),
  body('subject').trim().isLength({ min: 1, max: 200 }).withMessage('Subject is required (max 200 chars)').escape(),
  body('message').trim().isLength({ min: 1, max: 5000 }).withMessage('Message is required (max 5000 chars)').escape(),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.post("/contact", contactLimiter, contactValidationRules(), handleValidationErrors, async (req, res) => {
  const { name, email, subject, message, source } = req.body || {};

  const payload = {
    name: String(name).trim(),
    email: String(email).trim(),
    subject: String(subject).trim(),
    message: String(message).trim(),
    source: source ? String(source).trim() : "contact",
    status: "new",
    created_at: new Date().toISOString(),
    ip_address: req.ip || req.connection.remoteAddress
  };

  try {
    await insert("contact_messages", [payload]);
    return res.status(201).json({ success: true, message: "Message received. We'll get back to you soon." });
  } catch (error) {
    console.error("[ContactForm] Error saving message:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to send message right now. Please try again later."
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
