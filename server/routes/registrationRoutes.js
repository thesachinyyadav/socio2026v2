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
import { resolveGatedEvent, createGatedVisitor, getGatedVerifyUrl, isGatedEnabled, pushEventToGated } from "../utils/gatedSync.js";
import { sendRegistrationEmail } from "../utils/emailService.js";
import { 
  authenticateUser, 
  getUserInfo, 
  checkRoleExpiration, 
  requireMasterAdmin,
  requireOrganiser,
  requireOwnership,
} from "../middleware/authMiddleware.js";

const router = express.Router();

const asBoolean = (value) => {
  return value === true || value === 1 || value === "1" || value === "true";
};

const normalizeRegisterIdentifier = (value) => {
  return String(value || "").trim().toUpperCase();
};

const countParticipantsInRegistration = (registration) => {
  if (registration?.registration_type === "team" && registration?.teammates) {
    try {
      const teammates = Array.isArray(registration.teammates)
        ? registration.teammates
        : JSON.parse(registration.teammates || "[]");
      return teammates.length;
    } catch (_error) {
      return 1;
    }
  }

  return 1;
};

// Get registrations for an event (or all registrations if no event_id)
router.get(
  "/registrations",
  (req, res, next) => {
    // If event_id is provided, it's likely a public check for a specific event's participants (less sensitive)
    if (req.query.event_id) return next();

    // If no event_id, we're fetching ALL registrations (Highly sensitive)
    return authenticateUser(req, res, () => {
      getUserInfo()(req, res, () => {
        checkRoleExpiration(req, res, () => {
          requireMasterAdmin(req, res, next);
        });
      });
    });
  },
  async (req, res) => {
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
    // Removed: console.log that exposed PII (names, emails, register numbers)
    // Privacy protection: Sensitive user data is not logged
    
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
    
    // 🔒 CHECK IF EVENT IS ARCHIVED (BLOCK REGISTRATIONS FOR ARCHIVED EVENTS)
    if (event.is_archived) {
      return res.status(403).json({
        error: "Event is archived",
        details: "This event has been archived and is no longer accepting registrations.",
        code: "EVENT_ARCHIVED"
      });
    }
    
    // ===== REGISTRATION TIME VALIDATIONS =====
    const currentDate = new Date();
    
    // 1. CHECK REGISTRATION DEADLINE
    if (event.registration_deadline) {
      const deadlineDate = new Date(event.registration_deadline);
      if (currentDate > deadlineDate) {
        if (asBoolean(event.on_spot)) {
          console.log(`ℹ️ Registration deadline passed for ${normalizedEventId}, but on_spot is enabled. Allowing online registration.`);
        } else {
        return res.status(403).json({
          error: "Registration deadline has passed",
          details: `This event's registration deadline was ${event.registration_deadline}. You cannot register now.`,
          code: "DEADLINE_PASSED"
        });
        }
      }
    }
    
    // 4. CHECK MAX PARTICIPANTS LIMIT
    if (event.max_participants) {
      const allRegistrations = await queryAll("registrations", {
        where: { event_id: normalizedEventId }
      });
      
      let totalParticipants = 0;
      allRegistrations.forEach(reg => {
        if (reg.registration_type === 'team' && reg.teammates) {
          const teammates = Array.isArray(reg.teammates) ? reg.teammates : JSON.parse(reg.teammates || '[]');
          totalParticipants += teammates.length;
        } else {
          totalParticipants += 1;
        }
      });
      
      // Count the incoming participants
      let incomingParticipants = normalizedRegistrationType === 'team' 
        ? (teammates?.length || 1) 
        : 1;
      
      if (totalParticipants + incomingParticipants > event.max_participants) {
        return res.status(400).json({
          error: "Event registration capacity exceeded",
          details: `This event can accept maximum ${event.max_participants} participants. Currently ${totalParticipants} are registered.`,
          code: "CAPACITY_FULL",
          availableSpots: Math.max(0, event.max_participants - totalParticipants)
        });
      }
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
      console.log('🌍 Outsider registration detected (visitor ID)');
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

    const normalize = (value) => String(value || "").trim().toUpperCase();

    const incomingRegisterNumbers = new Set();
    if (processedData.individual_register_number) {
      incomingRegisterNumbers.add(normalize(processedData.individual_register_number));
    }
    if (processedData.team_leader_register_number) {
      incomingRegisterNumbers.add(normalize(processedData.team_leader_register_number));
    }
    if (Array.isArray(processedTeammates || teammates)) {
      (processedTeammates || teammates).forEach((teammate) => {
        if (teammate?.registerNumber) {
          incomingRegisterNumbers.add(normalize(teammate.registerNumber));
        }
      });
    }

    const existingRegistrations = await queryAll("registrations", {
      where: { event_id: normalizedEventId },
    });

    const existingRegisterNumbers = new Set();
    const existingEmails = new Set();

    existingRegistrations.forEach((registration) => {
      if (registration?.individual_register_number) {
        existingRegisterNumbers.add(normalize(registration.individual_register_number));
      }
      if (registration?.team_leader_register_number) {
        existingRegisterNumbers.add(normalize(registration.team_leader_register_number));
      }
      if (registration?.individual_email) {
        existingEmails.add(String(registration.individual_email).trim().toLowerCase());
      }
      if (registration?.team_leader_email) {
        existingEmails.add(String(registration.team_leader_email).trim().toLowerCase());
      }

      if (registration?.teammates) {
        try {
          const teammatesList = Array.isArray(registration.teammates)
            ? registration.teammates
            : JSON.parse(registration.teammates || "[]");
          teammatesList.forEach((teammate) => {
            if (teammate?.registerNumber) {
              existingRegisterNumbers.add(normalize(teammate.registerNumber));
            }
            if (teammate?.email) {
              existingEmails.add(String(teammate.email).trim().toLowerCase());
            }
          });
        } catch (e) {
          // ignore malformed teammate payloads
        }
      }
    });

    const duplicateRegisterNumber = Array.from(incomingRegisterNumbers).find((rn) => existingRegisterNumbers.has(rn));
    const normalizedParticipantEmail = String(participantEmail || "").trim().toLowerCase();
    const hasDuplicateEmail = normalizedParticipantEmail && existingEmails.has(normalizedParticipantEmail);

    if (duplicateRegisterNumber || hasDuplicateEmail) {
      return res.status(409).json({
        error: "You are already registered for this event",
        code: "ALREADY_REGISTERED",
      });
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
          console.log('🌍 Outsider detected from processed data (visitor ID)');
        } else if (!regCandidate && participantEmail) {
          // Lookup user by email to see if they're an outsider
          const user = await queryOne('users', { where: { email: participantEmail } });
          if (user && user.visitor_id && String(user.visitor_id).toUpperCase().startsWith('VIS')) {
            participantOrganization = 'outsider';
            console.log('🌍 Outsider detected from user record (visitor ID)');
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

        // ENHANCED: Check outsider quota with proper participant count
        if (event.outsider_max_participants) {
          // Use existing registrations we already fetched
          let outsiderCount = 0;
          existingRegistrations.forEach(reg => {
            if (reg.participant_organization === 'outsider') {
              if (reg.registration_type === 'team' && reg.teammates) {
                const teammates = Array.isArray(reg.teammates) ? reg.teammates : JSON.parse(reg.teammates || '[]');
                outsiderCount += teammates.length;
              } else {
                outsiderCount += 1;
              }
            }
          });

          // Count incoming outsider participants
          let incomingOutsiders = normalizedRegistrationType === 'team' 
            ? (teammates?.length || 1) 
            : 1;

          if (outsiderCount + incomingOutsiders > event.outsider_max_participants) {
            return res.status(400).json({
              error: "Outsider registration quota reached",
              details: `This event can accept maximum ${event.outsider_max_participants} outsider participants. Currently ${outsiderCount} are registered.`,
              code: "OUTSIDER_QUOTA_FULL",
              availableSpots: Math.max(0, event.outsider_max_participants - outsiderCount)
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

    // For Christ members, add a simple QR string: "registerNumber/eventId"
    if (participantOrganization === 'christ_member') {
      const regNo = processedData.individual_register_number || processedData.team_leader_register_number || participantEmail;
      qrCodeData.simple_qr = `${regNo}/${normalizedEventId}`;
    }

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

    // Auto-create Gated visitor pass for outsiders (non-blocking)
    if (participantOrganization === 'outsider' && isGatedEnabled()) {
      (async () => {
        try {
          // Try to resolve the Gated event — first by direct event_id, then by fest
          let gatedEvent = await resolveGatedEvent(normalizedEventId);

          // If not found directly, check if event belongs to an outsider-enabled fest
          if (!gatedEvent && event.fest) {
            gatedEvent = await resolveGatedEvent(event.fest);
          }

          // If still no Gated event, push this event to Gated now (handles events created before integration)
          if (!gatedEvent) {
            console.log(`ℹ️  No Gated event found for SOCIO event ${normalizedEventId} — pushing now...`);
            try {
              // Fetch organiser info for the push
              const organiser = await queryOne('users', { where: { email: event.created_by || event.organizer_email } });
              await pushEventToGated(
                event,
                event.created_by || event.organizer_email || 'unknown@socio.app',
                organiser?.name || 'SOCIO Organiser'
              );
              // Wait a moment for the DB trigger to create the events row
              await new Promise(resolve => setTimeout(resolve, 1500));
              // Try resolving again
              gatedEvent = await resolveGatedEvent(normalizedEventId);
              if (!gatedEvent && event.fest) {
                gatedEvent = await resolveGatedEvent(event.fest);
              }
            } catch (pushErr) {
              console.error(`❌ Failed to on-demand push event to Gated:`, pushErr.message);
            }
          }

          if (gatedEvent) {
            const participantName = processedData.individual_name || processedData.team_leader_name || 'Unknown';
            const participantPhone = req.body.phone || null;
            const participantRegNo = processedData.individual_register_number || processedData.team_leader_register_number || null;

            const gatedVisitor = await createGatedVisitor({
              name: participantName,
              email: participantEmail,
              phone: participantPhone,
              registerNumber: participantRegNo,
              eventName: event.title,
              dateFrom: event.event_date,
              dateTo: event.end_date || event.event_date,
              gatedEventId: gatedEvent.id,
            });

            if (gatedVisitor) {
              // Store the Gated visitor ID in qr_code_data for QR generation
              const updatedQrData = {
                ...qrCodeData,
                gated_visitor_id: gatedVisitor.id,
                gated_verify_url: getGatedVerifyUrl(gatedVisitor.id),
              };
              await update('registrations', { qr_code_data: updatedQrData }, { registration_id });
              console.log(`🎫 Created Gated visitor pass for outsider participant`);
            }
          } else {
            console.log(`ℹ️  No approved Gated event found for SOCIO event ${normalizedEventId} — outsider registered without gate pass`);
          }
        } catch (gatedError) {
          console.error('❌ Failed to create Gated visitor pass:', gatedError.message);
          // Non-blocking — SOCIO registration proceeds regardless
        }
      })();
    }

    const newTotalParticipants = Math.max(
      0,
      (event.total_participants || 0) + participantCount
    );

    await update(
      "events",
      { total_participants: newTotalParticipants },
      { event_id: normalizedEventId }
    );

    // Send confirmation email with QR code (non-blocking)
    (async () => {
      try {
        const emailRecipient = participantEmail;
        const recipientName = processedData.individual_name || processedData.team_leader_name || 'Participant';
        const qrImage = await generateQRCodeImage(qrCodeData);
        await sendRegistrationEmail(emailRecipient, recipientName, event, registration_id, qrImage);
      } catch (emailErr) {
        console.error('⚠️  Failed to send registration email:', emailErr.message);
      }
    })();

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

// Organiser-owned on-spot registration
router.post(
  "/events/:eventId/on-spot-register",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  requireOwnership("events", "eventId", "auth_uuid"),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const event = req.resource || (await queryOne("events", { where: { event_id: eventId } }));

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      if (!asBoolean(event.on_spot)) {
        return res.status(403).json({
          error: "On-spot registration is disabled for this event",
          code: "ON_SPOT_DISABLED",
        });
      }

      if (event.is_archived) {
        return res.status(403).json({
          error: "Event is archived",
          details: "This event has been archived and is no longer accepting registrations.",
          code: "EVENT_ARCHIVED",
        });
      }

      const attendeeName = String(req.body?.name || "").trim();
      const registerNumberRaw = String(req.body?.register_number || req.body?.registerNumber || "").trim();
      const visitorIdRaw = String(req.body?.visitor_id || req.body?.visitorId || "").trim();
      const attendeeEmail = String(req.body?.email || "").trim() || null;

      if (!attendeeName) {
        return res.status(400).json({ error: "Name is required" });
      }

      const registerIdentifier = registerNumberRaw || visitorIdRaw;
      if (!registerIdentifier) {
        return res.status(400).json({
          error: "Register number or visitor ID is required",
          code: "REGISTER_ID_REQUIRED",
        });
      }

      const normalizedIdentifier = normalizeRegisterIdentifier(registerIdentifier);
      const participantOrganization = normalizedIdentifier.startsWith("VIS") ? "outsider" : "christ_member";

      if (participantOrganization === "outsider") {
        const allowsOutsiders = asBoolean(event.allow_outsiders);
        if (!allowsOutsiders) {
          return res.status(403).json({
            error: "This event does not allow outsider registrations",
            details: "Only Christ University members can register for this event",
          });
        }
      }

      const existingRegistrations = await queryAll("registrations", {
        where: { event_id: eventId },
      });

      const existingRegisterNumbers = new Set();
      existingRegistrations.forEach((registration) => {
        if (registration?.individual_register_number) {
          existingRegisterNumbers.add(normalizeRegisterIdentifier(registration.individual_register_number));
        }
        if (registration?.team_leader_register_number) {
          existingRegisterNumbers.add(normalizeRegisterIdentifier(registration.team_leader_register_number));
        }

        if (registration?.teammates) {
          try {
            const teammatesList = Array.isArray(registration.teammates)
              ? registration.teammates
              : JSON.parse(registration.teammates || "[]");
            teammatesList.forEach((teammate) => {
              if (teammate?.registerNumber) {
                existingRegisterNumbers.add(normalizeRegisterIdentifier(teammate.registerNumber));
              }
            });
          } catch (_error) {
            // ignore malformed teammate payloads
          }
        }
      });

      if (existingRegisterNumbers.has(normalizedIdentifier)) {
        return res.status(409).json({
          error: "Participant is already registered for this event",
          code: "ALREADY_REGISTERED",
        });
      }

      if (event.max_participants) {
        const totalParticipants = (existingRegistrations || []).reduce(
          (count, registration) => count + countParticipantsInRegistration(registration),
          0
        );

        if (totalParticipants + 1 > event.max_participants) {
          return res.status(400).json({
            error: "Event registration capacity exceeded",
            details: `This event can accept maximum ${event.max_participants} participants. Currently ${totalParticipants} are registered.`,
            code: "CAPACITY_FULL",
            availableSpots: Math.max(0, event.max_participants - totalParticipants),
          });
        }
      }

      if (participantOrganization === "outsider" && event.outsider_max_participants) {
        const outsiderCount = (existingRegistrations || []).reduce((count, registration) => {
          if (registration?.participant_organization !== "outsider") return count;
          return count + countParticipantsInRegistration(registration);
        }, 0);

        if (outsiderCount + 1 > event.outsider_max_participants) {
          return res.status(400).json({
            error: "Outsider registration quota reached",
            details: `This event can accept maximum ${event.outsider_max_participants} outsider participants. Currently ${outsiderCount} are registered.`,
            code: "OUTSIDER_QUOTA_FULL",
            availableSpots: Math.max(0, event.outsider_max_participants - outsiderCount),
          });
        }
      }

      const registration_id = uuidv4().replace(/-/g, "");
      const qrEmail = attendeeEmail || `${normalizedIdentifier.toLowerCase()}@onspot.socio`;
      const qrCodeData = generateQRCodeData(registration_id, eventId, qrEmail);
      if (participantOrganization === "christ_member") {
        qrCodeData.simple_qr = `${normalizedIdentifier}/${eventId}`;
      }

      const [registration] = await insert("registrations", {
        registration_id,
        event_id: eventId,
        user_email: attendeeEmail,
        registration_type: "individual",
        individual_name: attendeeName,
        individual_email: attendeeEmail,
        individual_register_number: normalizedIdentifier,
        team_name: null,
        team_leader_name: attendeeName,
        team_leader_email: attendeeEmail,
        team_leader_register_number: normalizedIdentifier,
        teammates: [],
        participant_organization: participantOrganization,
        qr_code_data: qrCodeData,
        qr_code_generated_at: new Date().toISOString(),
        custom_field_responses: null,
      });

      const newTotalParticipants = Math.max(0, (event.total_participants || 0) + 1);
      await update("events", { total_participants: newTotalParticipants }, { event_id: eventId });

      return res.status(201).json({
        message: "On-spot registration added successfully",
        registration: {
          ...registration,
          teammates: [],
        },
      });
    } catch (error) {
      console.error("Error creating on-spot registration:", error);
      return res.status(500).json({
        error: "Failed to create on-spot registration",
        details: error.message,
      });
    }
  }
);

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

// Check if gated visitor pass is ready for an outsider registration
router.get("/registrations/:registrationId/gated-status", async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await queryOne("registrations", {
      select: "qr_code_data, participant_organization",
      where: { registration_id: registrationId },
    });

    if (!registration) {
      return res.status(404).json({ error: "Registration not found" });
    }

    const qrData =
      typeof registration.qr_code_data === "string"
        ? JSON.parse(registration.qr_code_data)
        : registration.qr_code_data;

    const gatedReady = !!(qrData?.gated_verify_url);

    return res.status(200).json({
      gated_ready: gatedReady,
      is_outsider: registration.participant_organization === "outsider",
    });
  } catch (error) {
    console.error("Error checking gated status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete registration
// Delete registration - REQUIRES MASTER ADMIN ROLE
router.delete("/registrations/:registrationId", (req, res, next) => {
  return authenticateUser(req, res, () => {
    getUserInfo()(req, res, () => {
      requireMasterAdmin(req, res, next);
    });
  });
}, async (req, res) => {
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
    const registrationSelect = "registration_id, event_id, teammates, created_at";
    const queries = [
      supabase.from("registrations").select(registrationSelect).eq("individual_register_number", registerIdStr),
      supabase.from("registrations").select(registrationSelect).eq("team_leader_register_number", registerIdStr),
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
        .select(registrationSelect)
        .not("teammates", "is", null);

      if (teammateRegs) {
        const matchingRegs = teammateRegs.filter(reg => {
          if (!reg.teammates) return false;
          const teammates = Array.isArray(reg.teammates) ? reg.teammates : JSON.parse(reg.teammates || '[]');
          return teammates.some(tm => String(tm.registerNumber) === registerIdStr);
        });
        allRegistrations.push(...matchingRegs);
      }
    } catch (teammateError) {
      console.warn("Could not check teammates:", teammateError.message);
    }

    if (allRegistrations.length === 0) {
      return res.status(200).json({ events: [], count: 0 });
    }

    const uniqueByRegistrationId = new Map();
    for (const reg of allRegistrations) {
      if (!reg?.registration_id || !reg?.event_id) continue;
      uniqueByRegistrationId.set(reg.registration_id, reg);
    }

    const dedupedRegistrations = Array.from(uniqueByRegistrationId.values());
    const registrationByEventId = new Map();
    for (const reg of dedupedRegistrations) {
      if (!registrationByEventId.has(reg.event_id)) {
        registrationByEventId.set(reg.event_id, reg.registration_id);
      }
    }

    const eventIds = [...new Set(dedupedRegistrations.map((reg) => reg.event_id))].filter(Boolean);

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
      registration_id: registrationByEventId.get(evt.event_id) || null,
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