import express from "express";
import {
  queryOne,
  queryAll,
  upsert,
  insert,
} from "../config/database.js";
import { verifyQRCodeData, parseQRCodeData } from "../utils/qrCodeUtils.js";

const router = express.Router();

// Get participants for an event
router.get("/events/:eventId/participants", async (req, res) => {
  try {
    const { eventId } = req.params;

    // Ensure event exists
    const event = await queryOne("events", { where: { event_id: eventId } });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Query registrations by event_id
    const registrations = await queryAll("registrations", {
      where: { event_id: eventId },
      order: { column: "created_at", ascending: false },
    });

    const attendanceRows = await queryAll("attendance_status", {
      where: { event_id: eventId },
    });
    const attendanceMap = new Map(
      (attendanceRows || []).map((row) => [row.registration_id, row])
    );

    const participants = (registrations || []).map((reg) => {
      const attendance = attendanceMap.get(reg.id) || attendanceMap.get(reg.registration_id) || {};
      const base = {
        id: reg.id,
        registration_id: reg.registration_id,
        event_id: reg.event_id,
        registration_type: reg.registration_type,
        created_at: reg.created_at,
        attendance_status: attendance.status || "absent",
        marked_at: attendance.marked_at || null,
        marked_by: attendance.marked_by || null,
      };

      if (reg.registration_type === "individual") {
        return {
          ...base,
          individual_name: reg.individual_name,
          individual_email: reg.individual_email,
          individual_register_number: reg.individual_register_number,
        };
      }

      let teammates = [];
      try {
        teammates = reg.teammates ? JSON.parse(reg.teammates) : [];
      } catch (_) {
        teammates = [];
      }

      return {
        ...base,
        team_name: reg.team_name,
        team_leader_name: reg.team_leader_name,
        team_leader_email: reg.team_leader_email,
        team_leader_register_number: reg.team_leader_register_number,
        teammates,
      };
    });

    return res.json({ event: { title: event.title }, participants });
  } catch (error) {
    console.error("Error fetching participants:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Mark attendance for participants
router.post("/events/:eventId/attendance", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { participantIds, status, markedBy = "admin" } = req.body;

    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: "participantIds array is required" });
    }

    if (!["attended", "absent"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'attended' or 'absent'" });
    }

    const event = await queryOne("events", { where: { event_id: eventId } });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const now = new Date().toISOString();
    let updatedCount = 0;

    for (const participantId of participantIds) {
      try {
        await upsert(
          "attendance_status",
          {
            registration_id: participantId,
            event_id: eventId,
            status,
            marked_at: now,
            marked_by: markedBy,
          },
          "registration_id"
        );
        updatedCount++;
      } catch (err) {
        console.error(`Error updating attendance for ${participantId}:`, err);
      }
    }

    return res.json({
      message: `Attendance updated for ${updatedCount} participants`,
      updated_count: updatedCount,
    });
  } catch (error) {
    console.error("Error marking attendance:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// QR Code scan for attendance
router.post("/events/:eventId/scan-qr", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { qrCodeData, scannedBy, scannerInfo } = req.body;

    if (!qrCodeData) {
      return res.status(400).json({ error: "QR code data is required" });
    }

    let isSimpleQR = false;
    let qrData = null;

    // 1. Try SOCIO URL parsing (e.g., https://app.withsocio.com/vc/[registrationId]/[eventId])
    if (typeof qrCodeData === "string" && qrCodeData.includes("/vc/")) {
      const parts = qrCodeData.split("/vc/")[1].split("/");
      if (parts.length >= 1) {
        isSimpleQR = true;
        qrData = {
          identifier: parts[0], // registrationId
          eventId: parts[1] || eventId // optional eventId from URL or use current
        };
      }
    }

    // 2. Try JSON parsing (Signed QR)
    if (!qrData) {
      const parsed = parseQRCodeData(qrCodeData);
      // Ensure it's an object and not a number/string/array
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        // If it's an object, check if it has the SOCIO signature fields
        if (parsed.registrationId && parsed.hash) {
          qrData = parsed;
        } else {
          // If it's an object but not a signed one, try to extract a possible identifier
          const possibleId = parsed.registrationId || parsed.id || parsed.identifier || parsed.registerNumber;
          if (possibleId) {
            isSimpleQR = true;
            qrData = {
              identifier: String(possibleId).trim(),
              eventId: parsed.eventId || eventId
            };
          }
        }
      }
    }

    // 3. FALLBACK: Treat the whole string as a raw identifier (e.g., register number)
    if (!qrData) {
      if (typeof qrCodeData === "string" && qrCodeData.trim().length > 0) {
        isSimpleQR = true;
        qrData = {
          identifier: qrCodeData.trim(),
          eventId: eventId
        };
      } else if (typeof qrCodeData === "object" && qrCodeData !== null) {
        // Final fallback for random objects: stringify and use as identifier
        isSimpleQR = true;
        qrData = {
          identifier: JSON.stringify(qrCodeData),
          eventId: eventId
        };
      }
    }

    if (!qrData) {
      await insert("qr_scan_logs", [{
        event_id: eventId,
        scanned_by: scannedBy || "unknown",
        scan_result: "invalid",
        scanner_info: scannerInfo || {},
      }]);
      return res.status(400).json({ error: "Invalid QR code format" });
    }

    // 4. Verification (ONLY for complex objects that aren't simple QRs)
    if (!isSimpleQR) {
      const verification = verifyQRCodeData(qrData);
      if (!verification.valid) {
        await insert("qr_scan_logs", [{
          registration_id: qrData.registrationId || null,
          event_id: eventId,
          scanned_by: scannedBy || "unknown",
          scan_result: "invalid",
          scanner_info: scannerInfo || {},
        }]);
        return res.status(400).json({ error: verification.message });
      }

      if (qrData.eventId !== eventId) {
        await insert("qr_scan_logs", [{
          registration_id: qrData.registrationId,
          event_id: eventId,
          scanned_by: scannedBy || "unknown",
          scan_result: "invalid",
          scanner_info: scannerInfo || {},
        }]);
        return res.status(400).json({ error: "QR code is not valid for this event" });
      }
    }

    let registration = null;

    if (isSimpleQR) {
      // For simple QR, the identifier could be a registration_id, register number, or email
      const normalizedId = qrData.identifier.trim().toUpperCase();
      
      // 1. Try direct registration_id lookup first
      registration = await queryOne("registrations", { 
        where: { registration_id: qrData.identifier, event_id: eventId } 
      });

      // 2. If not found, search all registrations for this event by other fields
      if (!registration) {
        const eventRegistrations = await queryAll("registrations", { where: { event_id: eventId } });
        registration = eventRegistrations.find(reg => {
          if (reg.individual_register_number && String(reg.individual_register_number).trim().toUpperCase() === normalizedId) return true;
          if (reg.team_leader_register_number && String(reg.team_leader_register_number).trim().toUpperCase() === normalizedId) return true;
          
          if (reg.teammates) {
            try {
              const team = Array.isArray(reg.teammates) ? reg.teammates : JSON.parse(reg.teammates);
              return team.some((t) => t.registerNumber && String(t.registerNumber).trim().toUpperCase() === normalizedId);
            } catch(e) {}
          }
          if (reg.individual_email && reg.individual_email.toLowerCase() === qrData.identifier.toLowerCase()) return true;
          if (reg.team_leader_email && reg.team_leader_email.toLowerCase() === qrData.identifier.toLowerCase()) return true;
          return false;
        });
      }

      if (registration) {
        qrData.registrationId = registration.registration_id;
      }
    } else {
      registration = await queryOne("registrations", { where: { registration_id: qrData.registrationId } });
    }
    if (!registration) {
      await insert("qr_scan_logs", [{
        registration_id: qrData.registrationId,
        event_id: eventId,
        scanned_by: scannedBy || "unknown",
        scan_result: "invalid",
        scanner_info: scannerInfo || {},
      }]);
      return res.status(404).json({ error: "Registration not found" });
    }

    const attendance = await queryOne("attendance_status", { where: { registration_id: registration.registration_id } });
    if (attendance?.status === "attended") {
      await insert("qr_scan_logs", [{
        registration_id: qrData.registrationId,
        event_id: eventId,
        scanned_by: scannedBy || "unknown",
        scan_result: "duplicate",
        scanner_info: scannerInfo || {},
      }]);
      return res.status(200).json({
        message: "Attendance already marked",
        participant: {
          name: registration.individual_name || registration.team_leader_name,
          email: registration.individual_email || registration.team_leader_email,
          registrationId: registration.registration_id,
          status: "already_present",
        },
      });
    }

    const now = new Date().toISOString();

    await upsert(
      "attendance_status",
      {
        registration_id: registration.registration_id,
        event_id: eventId,
        status: "attended",
        marked_at: now,
        marked_by: scannedBy || "qr_scanner",
      },
      "registration_id"
    );

    await insert("qr_scan_logs", [{
      registration_id: qrData.registrationId,
      event_id: eventId,
      scanned_by: scannedBy || "qr_scanner",
      scan_result: "success",
      scanner_info: scannerInfo || {},
    }]);

    return res.status(200).json({
      message: "Attendance marked successfully",
      participant: {
        name: registration.individual_name || registration.team_leader_name,
        email: registration.individual_email || registration.team_leader_email,
        registrationId: registration.registration_id,
        registrationType: registration.registration_type,
        teamName: registration.team_name,
        status: "marked_present",
        markedAt: now,
      },
    });
  } catch (error) {
    console.error("Error processing QR scan:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;