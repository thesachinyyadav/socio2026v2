import express from "express";
import { v4 as uuidv4 } from "uuid";
import {
  queryAll,
  queryOne,
  insert,
  update,
  supabase,
} from "../config/database.js";
import { generateQRCodeData, generateQRCodeImage } from "../utils/qrCodeUtils.js";

const router = express.Router();

// Get registrations for an event (or all registrations if no event_id)
router.get("/registrations", async (req, res) => {
  try {
    const { event_id } = req.query;
    
    // If no event_id provided, return ALL registrations (for master admin)
    let registrations;
    if (!event_id) {
      registrations = await queryAll("registrations", {
        order: { column: "created_at", ascending: false },
      });
    } else {
      if (typeof event_id !== "string" || event_id.trim() === "") {
        return res
          .status(400)
          .json({ error: "Invalid event_id parameter" });
      }

      registrations = await queryAll("registrations", {
        where: { event_id },
        order: { column: "created_at", ascending: false },
      });
    }

    // Collect all unique register numbers to look up user data
    const registerNumbers = new Set();
    registrations.forEach(reg => {
      if (reg.individual_register_number) {
        registerNumbers.add(String(reg.individual_register_number));
      }
      if (reg.team_leader_register_number) {
        registerNumbers.add(String(reg.team_leader_register_number));
      }
    });

    // Fetch user data for all register numbers in one query
    let userDataMap = {};
    if (registerNumbers.size > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('register_number, course, department')
        .in('register_number', Array.from(registerNumbers));
      
      if (usersData) {
        usersData.forEach(user => {
          userDataMap[String(user.register_number)] = {
            course: user.course || '',
            department: user.department || ''
          };
        });
      }
    }

    const formattedRegistrations = registrations.map((reg) => {
      // Get user data based on register number
      const regNum = reg.registration_type === 'individual' 
        ? reg.individual_register_number 
        : reg.team_leader_register_number;
      const userData = userDataMap[String(regNum)] || { course: '', department: '' };
      
      return {
        ...reg,
        // Add course and department from user lookup
        course: userData.course,
        department: userData.department,
        teammates: Array.isArray(reg.teammates)
          ? reg.teammates
          : (() => {
              try {
                return reg.teammates ? JSON.parse(reg.teammates) : [];
              } catch (e) {
                return [];
              }
            })(),
        custom_field_responses: (() => {
          if (!reg.custom_field_responses) return null;
          if (typeof reg.custom_field_responses === 'object') return reg.custom_field_responses;
          try {
            return JSON.parse(reg.custom_field_responses);
          } catch (e) {
            return null;
          }
        })(),
      };
    });

    return res.status(200).json({
      registrations: formattedRegistrations,
      count: formattedRegistrations.length,
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
    console.log('\n🎫 === NEW REGISTRATION REQUEST ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const {
      eventId,
      teamName,
      teammates,
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

    const isNewFormat = eventId !== undefined && teammates !== undefined;

    const normalizedEventId = isNewFormat ? eventId : event_id;
    const normalizedTeamName = isNewFormat ? teamName : team_name;

    const normalizedRegistrationType = isNewFormat
      ? normalizedTeamName
        ? "team"
        : "individual"
      : registration_type;

    if (!normalizedEventId) {
      return res.status(400).json({
        error: "Event ID is required",
      });
    }

    const event = await queryOne("events", { where: { event_id: normalizedEventId } });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    
    // Determine participant's organization type from register number
    let participantOrganization = 'christ_member'; // default
    let registerNumber = null;
    
    if (isNewFormat) {
      const firstTeammate = teammates && teammates.length > 0 ? teammates[0] : null;
      registerNumber = firstTeammate?.registerNumber || null;
    } else {
      registerNumber = normalizedRegistrationType === "individual"
        ? individual_register_number
        : team_leader_register_number;
    }
    
    // Check if register number is a visitor ID - case-insensitive
    if (registerNumber && String(registerNumber).toUpperCase().startsWith('VIS')) {
      participantOrganization = 'outsider';
      console.log('🌍 Outsider registration detected (by register number):', registerNumber);
    }

    const registration_id = uuidv4().replace(/-/g, "");

    let processedData = {};
    let processedTeammates = null;

    if (isNewFormat) {
      const firstTeammate = teammates && teammates.length > 0 ? teammates[0] : null;

      processedData = {
        user_email: firstTeammate?.email || null,
        individual_name: firstTeammate?.name || null,
        individual_email: firstTeammate?.email || null,
        individual_register_number: firstTeammate?.registerNumber || null,
        team_leader_name: firstTeammate?.name || null,
        team_leader_email: firstTeammate?.email || null,
        team_leader_register_number: firstTeammate?.registerNumber || null,
      };

      processedTeammates = teammates;
    } else {
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

    let participantEmail;
    if (isNewFormat) {
      const firstTeammate = teammates && teammates.length > 0 ? teammates[0] : null;
      participantEmail = firstTeammate?.email || "unknown@example.com";
    } else {
      participantEmail =
        normalizedRegistrationType === "individual"
          ? individual_email || user_email
          : team_leader_email || user_email;
    }

    const qrCodeData = generateQRCodeData(
      registration_id,
      normalizedEventId,
      participantEmail
    );

    // Robust outsider detection & quota enforcement (fallbacks)
    try {
      // If not already detected as outsider, try to infer from processed data or user record
      if (participantOrganization !== 'outsider') {
        // Candidate register numbers from processed data
        const regCandidate = processedData.individual_register_number || processedData.team_leader_register_number || (processedTeammates && processedTeammates[0]?.registerNumber) || null;
        if (regCandidate && String(regCandidate).toUpperCase().startsWith('VIS')) {
          participantOrganization = 'outsider';
          console.log('🌍 Outsider detected from processed data register number:', regCandidate);
        } else if (!regCandidate && participantEmail) {
          // Lookup user by email to see if they're an outsider
          const user = await queryOne('users', { where: { email: participantEmail } });
          if (user && user.visitor_id && String(user.visitor_id).toUpperCase().startsWith('VIS')) {
            participantOrganization = 'outsider';
            console.log('🌍 Outsider detected from user.visitor_id lookup:', user.visitor_id, 'for', participantEmail);
          }
        }
      }

      // If outsider, enforce event.allow_outsiders and quotas
      if (participantOrganization === 'outsider') {
        const allowsOutsiders = !!(event.allow_outsiders === true || event.allow_outsiders === 'true' || event.allow_outsiders === 1 || event.allow_outsiders === '1' || event.allow_outsiders === 't' || event.allow_outsiders === 'T');
        if (!allowsOutsiders) {
          return res.status(403).json({
            error: "This event does not allow outsider registrations",
            details: "Only Christ University members can register for this event"
          });
        }

        if (event.outsider_max_participants) {
          const outsiderRegistrations = await queryAll("registrations", {
            where: {
              event_id: normalizedEventId,
              participant_organization: 'outsider'
            }
          });

          // Count total outsider participants
          let outsiderCount = 0;
          outsiderRegistrations.forEach(reg => {
            if (reg.registration_type === 'team' && reg.teammates) {
              const teammates = Array.isArray(reg.teammates) ? reg.teammates : JSON.parse(reg.teammates || '[]');
              outsiderCount += teammates.length;
            } else {
              outsiderCount += 1;
            }
          });

          if (outsiderCount >= event.outsider_max_participants) {
            return res.status(400).json({
              error: "Outsider registration quota reached",
              details: `This event has reached its limit of ${event.outsider_max_participants} outsider participants`
            });
          }
        }
      }
    } catch (detectionError) {
      console.error('Error during outsider detection/validation:', detectionError);
      // proceed without blocking registration, but log
    }

    let participantCount = 1;

    if (isNewFormat) {
      participantCount = teammates ? teammates.length : 1;
    } else {
      participantCount =
        normalizedRegistrationType === "individual"
          ? 1
          : teammates
          ? teammates.length + 1
          : 1;
    }

    console.log('📋 Processed Data:', processedData);
    console.log('🎟️  Registration ID:', registration_id);
    console.log('🎪 Event ID:', normalizedEventId);
    console.log('👥 Registration Type:', normalizedRegistrationType);

    const [registration] = await insert("registrations", {
      registration_id,
      event_id: normalizedEventId,
      user_email: processedData.user_email,
      registration_type: normalizedRegistrationType,
      individual_name: processedData.individual_name,
      individual_email: processedData.individual_email,
      individual_register_number: processedData.individual_register_number,
      team_name: normalizedTeamName,
      team_leader_name: processedData.team_leader_name,
      team_leader_email: processedData.team_leader_email,
      team_leader_register_number: processedData.team_leader_register_number,
      teammates: processedTeammates || teammates || [],
      participant_organization: participantOrganization,
      qr_code_data: qrCodeData,
      qr_code_generated_at: new Date().toISOString(),
      custom_field_responses: req.body.custom_field_responses || null,
    });

    console.log('✅ Registration saved:', registration);

    const newTotalParticipants = Math.max(
      0,
      (event.total_participants || 0) + participantCount
    );

    await update(
      "events",
      { total_participants: newTotalParticipants },
      { event_id: normalizedEventId }
    );

    return res.status(201).json({
      message: "Registration successful",
      registration: {
        ...registration,
        teammates: registration.teammates || [],
      },
    });
  } catch (error) {
    console.error("Error creating registration:", error);

    if (error.code === "23505" || error.message?.includes("duplicate key")) {
      return res.status(409).json({
        error: "Registration with this ID already exists",
      });
    }

    return res.status(500).json({
      error: "Failed to create registration",
      details: error.message,
    });
  }
});

// Get registration by ID
router.get("/registrations/:registrationId", async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await queryOne("registrations", {
      where: { registration_id: registrationId },
    });

    if (!registration) {
      return res.status(404).json({ error: "Registration not found" });
    }

    return res.status(200).json({
      registration: {
        ...registration,
        teammates: Array.isArray(registration.teammates)
          ? registration.teammates
          : (() => {
              try {
                return registration.teammates
                  ? JSON.parse(registration.teammates)
                  : [];
              } catch (e) {
                return [];
              }
            })(),
      },
    });
  } catch (error) {
    console.error("Error fetching registration:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get QR code image for a registration
router.get("/registrations/:registrationId/qr-code", async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await queryOne("registrations", {
      select: "qr_code_data, event_id",
      where: { registration_id: registrationId },
    });

    if (!registration) {
      return res.status(404).json({ error: "Registration not found" });
    }

    if (!registration.qr_code_data) {
      return res.status(404).json({ error: "QR code not found for this registration" });
    }

    try {
      const qrData =
        typeof registration.qr_code_data === "string"
          ? JSON.parse(registration.qr_code_data)
          : registration.qr_code_data;
      const qrImage = await generateQRCodeImage(qrData);

      return res.status(200).json({
        qrCodeImage: qrImage,
        eventId: registration.event_id,
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

    const registration = await queryOne("registrations", {
      where: { registration_id: registrationId },
    });

    if (!registration) {
      return res.status(404).json({ error: "Registration not found" });
    }

    await supabase
      .from("registrations")
      .delete()
      .eq("registration_id", registrationId);

    const event = await queryOne("events", { where: { event_id: registration.event_id } });

    const participantCount =
      registration.registration_type === "individual"
        ? 1
        : registration.teammates
        ? Array.isArray(registration.teammates)
          ? registration.teammates.length + 1
          : (() => {
              try {
                return JSON.parse(registration.teammates).length + 1;
              } catch (e) {
                return 1;
              }
            })()
        : 1;

    if (event) {
      const updatedTotal = Math.max(
        0,
        (event.total_participants || 0) - participantCount
      );

      await update(
        "events",
        { total_participants: updatedTotal },
        { event_id: registration.event_id }
      );
    }

    return res.status(200).json({
      message: "Registration deleted successfully",
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

    const registerIdStr = String(registerId).trim();

    // Use multiple queries instead of complex OR to avoid query failures
    const queries = [
      supabase.from("registrations").select("event_id").eq("individual_register_number", registerIdStr),
      supabase.from("registrations").select("event_id").eq("team_leader_register_number", registerIdStr),
    ];

    const results = await Promise.allSettled(queries);
    
    let allRegistrations = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.data) {
        allRegistrations.push(...result.value.data);
      }
    }

    // Also check teammates JSONB (if not empty)
    try {
      const { data: teammateRegs } = await supabase
        .from("registrations")
        .select("event_id, teammates")
        .not("teammates", "is", null);

      if (teammateRegs) {
        const matchingRegs = teammateRegs.filter(reg => {
          if (!reg.teammates) return false;
          const teammates = Array.isArray(reg.teammates) ? reg.teammates : JSON.parse(reg.teammates || '[]');
          return teammates.some(tm => String(tm.registerNumber) === registerIdStr);
        });
        allRegistrations.push(...matchingRegs.map(r => ({ event_id: r.event_id })));
      }
    } catch (teammateError) {
      console.warn("Could not check teammates:", teammateError.message);
    }

    if (allRegistrations.length === 0) {
      return res.status(200).json({ events: [], count: 0 });
    }

    const eventIds = [...new Set(allRegistrations.map((reg) => reg.event_id))].filter(Boolean);

    if (eventIds.length === 0) {
      return res.status(200).json({ events: [], count: 0 });
    }

    const { data: eventsData, error: eventsError } = await supabase
      .from("events")
      .select("event_id, title, organizing_dept, event_date")
      .in("event_id", eventIds);

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      return res.status(200).json({ events: [], count: 0 }); // Return empty instead of error
    }

    const events = (eventsData || []).map((evt) => ({
      id: evt.event_id,
      event_id: evt.event_id,
      name: evt.title,
      date: evt.event_date,
      department: evt.organizing_dept,
    }));

    return res.status(200).json({
      events,
      registeredEventIds: events.map(e => e.event_id),
      count: events.length,
    });
  } catch (error) {
    console.error("Error fetching user registrations:", error);
    // Return empty array instead of error to prevent UI breaking
    return res.status(200).json({ 
      events: [], 
      registeredEventIds: [],
      count: 0,
      warning: "Could not fetch registrations"
    });
  }
});

export default router;