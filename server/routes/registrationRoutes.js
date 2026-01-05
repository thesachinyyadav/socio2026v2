import express from "express";
import db from "../config/database.js";
import { v4 as uuidv4 } from "uuid";
import { generateQRCodeData, generateQRCodeImage } from "../utils/qrCodeUtils.js";

const router = express.Router();

// Get registrations for an event
router.get("/registrations", async (req, res) => {
  try {
    const { event_id } = req.query;
    if (!event_id || typeof event_id !== "string" || event_id.trim() === "") {
      return res
        .status(400)
        .json({ error: "Missing or invalid event_id parameter" });
    }

    const stmt = db.prepare(`
      SELECT * FROM registrations 
      WHERE event_id = ? 
      ORDER BY created_at DESC
    `);
    
    const registrations = stmt.all(event_id);

    // Format registrations for response
    const formattedRegistrations = registrations.map(reg => {
      const registration = { ...reg };
      
      // Parse JSON fields
      try {
        if (registration.teammates) {
          registration.teammates = JSON.parse(registration.teammates);
        }
      } catch (e) {
        registration.teammates = [];
      }

      return registration;
    });

    return res.status(200).json({ 
      registrations: formattedRegistrations,
      count: formattedRegistrations.length 
    });

  } catch (error) {
    console.error("Error fetching registrations:", error);
    return res.status(500).json({
      error: "Database error while fetching registrations.",
      details: error.message,
    });
  }
});

// Register for an event
router.post("/register", async (req, res) => {
  try {
    // Handle both new and old API formats
    const {
      // New API format used by the client
      eventId,
      teamName,
      teammates,
      
      // Old API format (kept for backwards compatibility)
      event_id,
      user_email,
      registration_type,
      individual_name,
      individual_email,
      individual_register_number,
      team_name,
      team_leader_name,
      team_leader_email,
      team_leader_register_number,
    } = req.body;

    // Determine which API format is being used
    const isNewFormat = eventId !== undefined && teammates !== undefined;
    
    // Normalize the data based on the format
    const normalizedEventId = isNewFormat ? eventId : event_id;
    const normalizedTeamName = isNewFormat ? teamName : team_name;
    
    // Registration type is determined by team name in new format
    const normalizedRegistrationType = isNewFormat 
      ? (normalizedTeamName ? "team" : "individual") 
      : registration_type;
    
    // Validate required fields
    if (!normalizedEventId) {
      return res.status(400).json({
        error: "Event ID is required"
      });
    }

    // Check if event exists
    const eventStmt = db.prepare("SELECT id, title FROM events WHERE event_id = ?");
    const event = eventStmt.get(normalizedEventId);
    
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Generate registration ID
    const registration_id = uuidv4().replace(/-/g, '');
    
    // Process data based on the format
    let processedData = {};
    let processedTeammates = null;
    
    if (isNewFormat) {
      // Process new format data
      // For individual registrations, first teammate is the registrant
      const firstTeammate = teammates && teammates.length > 0 ? teammates[0] : null;
      
      processedData = {
        user_email: null, // We don't have user email in new format
        individual_register_number: firstTeammate?.registerNumber || null,
        team_leader_register_number: firstTeammate?.registerNumber || null,
      };
      
      processedTeammates = teammates;
    } else {
      // Process old format data
      processedData = {
        user_email: user_email || null,
        individual_name: individual_name || null,
        individual_email: individual_email || null,
        individual_register_number: individual_register_number || null,
        team_leader_name: team_leader_name || null,
        team_leader_email: team_leader_email || null,
        team_leader_register_number: team_leader_register_number || null,
      };
    }
    
    // Determine participant email for QR generation
    let participantEmail;
    if (isNewFormat) {
      participantEmail = "unknown@example.com"; // Default for QR code if no email available
    } else {
      participantEmail = normalizedRegistrationType === 'individual' ? 
        (individual_email || user_email) : 
        (team_leader_email || user_email);
    }

    // Generate QR code data
    const qrCodeData = generateQRCodeData(registration_id, normalizedEventId, participantEmail);
    const qrCodeString = JSON.stringify(qrCodeData);

    // Insert registration with QR code data
    const insertStmt = db.prepare(`
      INSERT INTO registrations (
        registration_id, event_id, user_email, registration_type,
        individual_name, individual_email, individual_register_number,
        team_name, team_leader_name, team_leader_email, 
        team_leader_register_number, teammates, qr_code_data, qr_code_generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      registration_id,
      normalizedEventId,
      processedData.user_email,
      normalizedRegistrationType,
      processedData.individual_name,
      processedData.individual_email,
      processedData.individual_register_number,
      normalizedTeamName,
      processedData.team_leader_name,
      processedData.team_leader_email,
      processedData.team_leader_register_number,
      JSON.stringify(processedTeammates || teammates || []),
      qrCodeString,
      new Date().toISOString()
    );

    // Update event participant count
    const updateEventStmt = db.prepare(`
      UPDATE events 
      SET total_participants = total_participants + ? 
      WHERE event_id = ?
    `);
    
    let participantCount = 1; // Default to 1
    
    if (isNewFormat) {
      participantCount = teammates ? teammates.length : 1;
    } else {
      participantCount = normalizedRegistrationType === 'individual' ? 1 : 
        (teammates ? teammates.length + 1 : 1);
    }
    
    updateEventStmt.run(participantCount, normalizedEventId);

    // Get the created registration
    const getStmt = db.prepare("SELECT * FROM registrations WHERE registration_id = ?");
    const registration = getStmt.get(registration_id);

    // Parse teammates field for response
    if (registration.teammates) {
      try {
        registration.teammates = JSON.parse(registration.teammates);
      } catch (e) {
        registration.teammates = [];
      }
    }

    return res.status(201).json({
      message: "Registration successful",
      registration: registration
    });

  } catch (error) {
    console.error("Error creating registration:", error);
    
    // Handle unique constraint errors (Supabase returns code 23505 for unique violations)
    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      return res.status(409).json({
        error: "Registration with this ID already exists"
      });
    }

    return res.status(500).json({
      error: "Failed to create registration",
      details: error.message
    });
  }
});

// Get registration by ID
router.get("/registrations/:registrationId", async (req, res) => {
  try {
    const { registrationId } = req.params;

    const stmt = db.prepare("SELECT * FROM registrations WHERE registration_id = ?");
    const registration = stmt.get(registrationId);

    if (!registration) {
      return res.status(404).json({ error: "Registration not found" });
    }

    // Parse teammates field
    if (registration.teammates) {
      try {
        registration.teammates = JSON.parse(registration.teammates);
      } catch (e) {
        registration.teammates = [];
      }
    }

    return res.status(200).json({ registration });

  } catch (error) {
    console.error("Error fetching registration:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get QR code image for a registration
router.get("/registrations/:registrationId/qr-code", async (req, res) => {
  try {
    const { registrationId } = req.params;

    const stmt = db.prepare("SELECT qr_code_data, event_id FROM registrations WHERE registration_id = ?");
    const registration = stmt.get(registrationId);

    if (!registration) {
      return res.status(404).json({ error: "Registration not found" });
    }

    if (!registration.qr_code_data) {
      return res.status(404).json({ error: "QR code not found for this registration" });
    }

    try {
      const qrData = JSON.parse(registration.qr_code_data);
      const qrImage = await generateQRCodeImage(qrData);
      
      return res.status(200).json({ 
        qrCodeImage: qrImage,
        eventId: registration.event_id
      });
    } catch (error) {
      console.error("Error generating QR code image:", error);
      return res.status(500).json({ error: "Failed to generate QR code image" });
    }

  } catch (error) {
    console.error("Error fetching QR code:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete registration
router.delete("/registrations/:registrationId", async (req, res) => {
  try {
    const { registrationId } = req.params;

    // Get registration details first
    const getStmt = db.prepare("SELECT * FROM registrations WHERE registration_id = ?");
    const registration = getStmt.get(registrationId);

    if (!registration) {
      return res.status(404).json({ error: "Registration not found" });
    }

    // Delete registration
    const deleteStmt = db.prepare("DELETE FROM registrations WHERE registration_id = ?");
    const result = deleteStmt.run(registrationId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Registration not found" });
    }

    // Update event participant count
    const updateEventStmt = db.prepare(`
      UPDATE events 
      SET total_participants = CASE 
        WHEN total_participants > ? THEN total_participants - ?
        ELSE 0 
      END
      WHERE event_id = ?
    `);
    
    const participantCount = registration.registration_type === 'individual' ? 1 : 
      (registration.teammates ? JSON.parse(registration.teammates).length + 1 : 1);
    
    updateEventStmt.run(participantCount, participantCount, registration.event_id);

    return res.status(200).json({
      message: "Registration deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting registration:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get events registered by a user based on registration number
router.get("/registrations/user/:registerId/events", async (req, res) => {
  try {
    const { registerId } = req.params;
    
    if (!registerId) {
      return res.status(400).json({ error: "Registration ID is required" });
    }

    // Convert registerId to string to ensure consistent comparison
    const registerIdStr = String(registerId);

    // Query to find all registrations with the given registration number
    const registrationsStmt = db.prepare(`
      SELECT r.*, e.title as name, e.department, e.date
      FROM registrations r
      JOIN events e ON r.event_id = e.event_id
      WHERE 
        (r.individual_register_number = ? OR 
        r.team_leader_register_number = ? OR 
        r.teammates LIKE ?)
      ORDER BY r.created_at DESC
    `);
    
    const registrations = registrationsStmt.all(
      registerIdStr, 
      registerIdStr, 
      `%"registerNumber":"${registerIdStr}"%`
    );

    if (!registrations || registrations.length === 0) {
      return res.status(200).json({ events: [] });
    }

    // Get all event IDs from the registrations
    const eventIds = [...new Set(registrations.map(reg => reg.event_id))];
    
    // Format the events
    const events = registrations.map(reg => ({
      id: reg.event_id,
      event_id: reg.event_id,
      name: reg.name,
      date: reg.date,
      department: reg.department,
    }));

    return res.status(200).json({ 
      events,
      count: events.length 
    });

  } catch (error) {
    console.error("Error fetching user registrations:", error);
    return res.status(500).json({
      error: "Database error while fetching user registrations.",
      details: error.message,
    });
  }
});

export default router;