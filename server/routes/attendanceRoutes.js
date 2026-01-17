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

    const qrData = parseQRCodeData(qrCodeData);
    if (!qrData) {
      await insert("qr_scan_logs", [{
        event_id: eventId,
        scanned_by: scannedBy || "unknown",
        scan_result: "invalid",
        scanner_info: scannerInfo || {},
      }]);
      return res.status(400).json({ error: "Invalid QR code format" });
    }

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

    const registration = await queryOne("registrations", { where: { registration_id: qrData.registrationId } });
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