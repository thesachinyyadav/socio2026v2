import express from "express";
import { queryAll, queryOne, supabase } from "../config/database.js";
import { authenticateUser, getUserInfo, checkRoleExpiration } from "../middleware/authMiddleware.js";

const router = express.Router();

// Middleware: require organiser OR masteradmin
const requireOrganiserOrAdmin = (req, res, next) => {
  if (!req.userInfo) {
    return res.status(401).json({ error: "User info not available" });
  }
  if (!req.userInfo.is_organiser && !req.userInfo.is_masteradmin) {
    return res.status(403).json({ error: "Access denied: Organiser or Master Admin privileges required" });
  }
  next();
};

// Get comprehensive report data for selected events
// Returns event details, registration counts, attendance stats, and participant list
router.post("/report/data", authenticateUser, getUserInfo(), checkRoleExpiration, requireOrganiserOrAdmin, async (req, res) => {
  try {
    const { eventIds, festId } = req.body;
    const userEmail = req.userInfo?.email;
    const isMasterAdmin = req.userInfo?.is_masteradmin;

    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ error: "eventIds array is required" });
    }

    // Fetch all requested events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .in('event_id', eventIds);

    if (eventsError || !events) {
      return res.status(500).json({ error: "Failed to fetch events" });
    }

    // If festId provided, fetch fest details early for auth checks
    let festTitle = null;
    if (festId) {
      const { data: festLookup } = await supabase
        .from('fests')
        .select('fest_title, created_by')
        .eq('fest_id', festId)
        .single();
      if (festLookup) festTitle = festLookup.fest_title;
    }

    // Authorization check: organisers can only access their own events or events under their fests
    if (!isMasterAdmin) {
      const unauthorizedEvents = events.filter(event => {
        // Check if organiser created this event
        if (event.created_by === userEmail) return false;
        // Check if event belongs to the selected fest (fest column stores fest_title)
        if (festId && festTitle && event.fest === festTitle) {
          // We'll verify fest ownership below
          return false;
        }
        return true;
      });

      if (unauthorizedEvents.length > 0) {
        return res.status(403).json({ error: "Access denied to some events" });
      }

      // If festId provided, verify organiser owns that fest
      if (festId) {
        const { data: fest } = await supabase
          .from('fests')
          .select('created_by')
          .eq('fest_id', festId)
          .single();
        
        if (!fest || fest.created_by !== userEmail) {
          return res.status(403).json({ error: "Access denied to fest" });
        }
      }
    }

    // Fetch registrations for all events
    const { data: registrations, error: regError } = await supabase
      .from('registrations')
      .select('*')
      .in('event_id', eventIds)
      .order('created_at', { ascending: false });

    if (regError) {
      return res.status(500).json({ error: "Failed to fetch registrations" });
    }

    // Fetch attendance status for all registrations
    const registrationIds = registrations ? registrations.map(r => r.id) : [];
    let attendanceMap = {};
    if (registrationIds.length > 0) {
      const { data: attendanceData } = await supabase
        .from('attendance_status')
        .select('*')
        .in('registration_id', registrationIds);
      
      if (attendanceData) {
        attendanceData.forEach(att => {
          attendanceMap[att.registration_id] = att;
        });
      }
    }

    // Aggregate data per event
    const eventReports = events.map(event => {
      const eventRegs = (registrations || []).filter(r => r.event_id === event.event_id);
      
      // Count participants (individuals + team members)
      let totalParticipants = 0;
      let attendedCount = 0;
      const participantList = [];

      eventRegs.forEach(reg => {
        const attendance = attendanceMap[reg.id] || {};
        const isAttended = attendance.status === 'attended';

        if (reg.registration_type === 'individual') {
          totalParticipants += 1;
          if (isAttended) attendedCount += 1;
          
          participantList.push({
            registration_id: reg.registration_id,
            name: reg.individual_name,
            email: reg.individual_email,
            register_number: reg.individual_register_number,
            team_name: null,
            status: isAttended ? 'Attended' : 'Registered',
            attended_at: attendance.marked_at || null,
          });
        } else {
          // Team registration
          let teammates = [];
          try {
            teammates = reg.teammates ? (Array.isArray(reg.teammates) ? reg.teammates : JSON.parse(reg.teammates)) : [];
          } catch (e) {
            teammates = [];
          }

          const teamSize = teammates.length;
          totalParticipants += teamSize;
          if (isAttended) attendedCount += teamSize; // If team attended, count all members

          teammates.forEach(member => {
            participantList.push({
              registration_id: reg.registration_id,
              name: member.name,
              email: member.email,
              register_number: member.registerNumber || member.register_number,
              team_name: reg.team_name,
              status: isAttended ? 'Attended' : 'Registered',
              attended_at: attendance.marked_at || null,
            });
          });
        }
      });

      return {
        event_id: event.event_id,
        title: event.title,
        description: event.description,
        event_date: event.event_date,
        end_date: event.end_date,
        event_time: event.event_time,
        venue: event.venue,
        category: event.category,
        organizing_dept: event.organizing_dept,
        registration_fee: event.registration_fee,
        fest: event.fest,
        created_by: event.created_by,
        created_at: event.created_at,
        total_registrations: eventRegs.length,
        total_participants: totalParticipants,
        attended_count: attendedCount,
        absent_count: totalParticipants - attendedCount,
        participants: participantList,
      };
    });

    // If festId provided, fetch fest details
    let festInfo = null;
    if (festId) {
      const { data: fest } = await supabase
        .from('fests')
        .select('*')
        .eq('fest_id', festId)
        .single();
      festInfo = fest;
    }

    return res.json({
      events: eventReports,
      fest: festInfo,
      generated_at: new Date().toISOString(),
      generated_by: userEmail,
    });

  } catch (error) {
    console.error("Error generating report data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
