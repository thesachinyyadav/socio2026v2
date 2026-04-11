import express from "express";
import {
  queryAll,
  queryOne,
  insert,
  update,
  remove,
} from "../config/database.js";
import { multerUpload } from "../utils/multerConfig.js";
import {
  uploadFileToSupabase,
  getPathFromStorageUrl,
  deleteFileFromLocal,
} from "../utils/fileUtils.js";
import {
  parseOptionalFloat,
  parseOptionalInt,
  parseJsonField,
} from "../utils/parsers.js";
import { v4 as uuidv4 } from "uuid";
import { getFestTableForDatabase } from "../utils/festTableResolver.js";

import { ROLE_CODES } from "../utils/roleAccessService.js";
// Import fest approval helpers for workflow logic
import {
  findActiveApprovalRequestForEntity,
  extractBudgetApprovalRequirement,
} from "./festRoutes.js";

const router = express.Router();

const normalizeWorkflowStatus = (value, fallback = "") => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || String(fallback || "").trim().toUpperCase();
};

const isMissingColumnError = (error) => String(error?.code || "") === "42703";
const isMissingRelationError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes("schema cache"))
  );
};

const isTruthy = (value) => {
  if (value === true || value === 1 || value === "1") return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "on";
  }
  return false;
};

// GET all events
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const today = new Date().toISOString().split('T')[0];
    
    let queryOptions = {
      order: { column: "created_at", ascending: false },
    };

    if (status === "upcoming") {
      queryOptions.filters = [
        { column: "event_date", operator: "gte", value: today }
      ];
      queryOptions.order = { column: "event_date", ascending: true };
    }

    const events = await queryAll("events", queryOptions);

    const processedEvents = (events || []).map((event) => ({
      ...event,
      fest: event.fest_id || null, // Map fest_id to fest for frontend compatibility
      department_access: Array.isArray(event.department_access)
        ? event.department_access
        : parseJsonField(event.department_access, []),
      rules: Array.isArray(event.rules)
        ? event.rules
        : parseJsonField(event.rules, []),
      schedule: Array.isArray(event.schedule)
        ? event.schedule
        : parseJsonField(event.schedule, []),
      prizes: Array.isArray(event.prizes)
        ? event.prizes
        : parseJsonField(event.prizes, []),
      custom_fields: Array.isArray(event.custom_fields)
        ? event.custom_fields
        : parseJsonField(event.custom_fields, []),
    }));

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).json({ events: processedEvents });
  } catch (error) {
    console.error("Server error GET /api/events:", error);
    return res.status(500).json({ error: "Internal server error while fetching events." });
  }
});

// GET specific event by ID
router.get("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!eventId || typeof eventId !== "string" || eventId.trim() === "") {
      return res.status(400).json({
        error: "Event ID must be provided in the URL path and be a non-empty string.",
      });
    }

  const event = await queryOne("events", { where: { event_id: eventId } });

    if (!event) {
      return res.status(404).json({ error: `Event with ID '${eventId}' not found.` });
    }

    // Parse JSON fields
    const processedEvent = {
      ...event,
      fest: event.fest_id || null, // Map fest_id to fest for frontend compatibility
      department_access: Array.isArray(event.department_access)
        ? event.department_access
        : parseJsonField(event.department_access, []),
      rules: Array.isArray(event.rules)
        ? event.rules
        : parseJsonField(event.rules, []),
      schedule: Array.isArray(event.schedule)
        ? event.schedule
        : parseJsonField(event.schedule, []),
      prizes: Array.isArray(event.prizes)
        ? event.prizes
        : parseJsonField(event.prizes, []),
      custom_fields: Array.isArray(event.custom_fields)
        ? event.custom_fields
        : parseJsonField(event.custom_fields, []),
    };

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).json({ event: processedEvent });
  } catch (error) {
    console.error(`Server error GET /api/events/${req.params.eventId}:`, error);
    return res.status(500).json({ error: "Internal server error while fetching specific event." });
  }
});

// DELETE event - REQUIRES MASTER ADMIN ROLE
router.delete("/:eventId", (req, res, next) => {
  return authenticateUser(req, res, () => {
    getUserInfo()(req, res, () => {
      requireMasterAdmin(req, res, next);
    });
  });
}, async (req, res) => {
  const { eventId } = req.params;

  try {
    const event = await queryOne("events", { where: { event_id: eventId } });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const filesToDelete = [
      { url: event.event_image_url, bucket: "event-images" },
      { url: event.banner_url, bucket: "event-banners" },
      { url: event.pdf_url, bucket: "event-pdfs" },
    ];

    for (const fileInfo of filesToDelete) {
      if (fileInfo.url) {
        const filePath = getPathFromStorageUrl(fileInfo.url, fileInfo.bucket);
        if (filePath) {
          await deleteFileFromLocal(filePath, fileInfo.bucket);
        }
      }
    }

    await remove("attendance_status", { event_id: eventId });
    await remove("registrations", { event_id: eventId });
    const deleted = await remove("events", { event_id: eventId });

    if (!deleted || deleted.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    return res.status(500).json({ error: "Internal server error while deleting event." });
  }
});

// POST - Create new event (with file uploads)
router.post("/", multerUpload.fields([
    { name: "eventImage", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
    { name: "pdfFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      console.log("POST /api/events - Creating new event");

      const eventData = req.body;
      const files = req.files || {};

      const pickField = (...keys) => {
        for (const key of keys) {
          const value = eventData[key];
          if (value !== undefined && value !== null) {
            return value;
          }
        }

        return undefined;
      };

      const titleValue = String(pickField("title") || "").trim();
      const eventDateValue = String(
        pickField("eventDate", "event_date") || ""
      ).trim();
      const categoryValue = String(pickField("category") || "").trim();
      const organizingDeptValue = String(
        pickField("organizingDept", "organizing_dept") || ""
      ).trim();
      const venueValue = String(pickField("venue", "location") || "").trim();

      const requiredFields = [
        ["title", titleValue],
        ["eventDate", eventDateValue],
        ["category", categoryValue],
        ["organizingDept", organizingDeptValue],
        ["venue", venueValue],
      ];

      for (const [fieldName, fieldValue] of requiredFields) {
        if (!fieldValue) {
          return res.status(400).json({ error: `Missing required field: ${fieldName}` });
        }
      }

      const shouldSaveAsDraft = isTruthy(pickField("is_draft", "isDraft"));
      const claimsApplicable = isTruthy(
        pickField("claimsApplicable", "claims_applicable")
      );

      const rawFestId = String(
        pickField("fest_id", "fest", "festEvent") || ""
      ).trim();
      const festId =
        rawFestId && rawFestId.toLowerCase() !== "none" ? rawFestId : null;

      const customFieldsRaw = pickField("custom_fields", "customFields");
      const customFields = Array.isArray(customFieldsRaw)
        ? customFieldsRaw
        : parseJsonField(customFieldsRaw, []);

      // Generate slug-based ID from title
      let event_id = titleValue
        ? titleValue
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
        : "";

      if (!event_id) {
        event_id = uuidv4().replace(/-/g, "");
      }

      // Check for collision (optional but recommended)
      // For this user's request matching the 'green box', we use the simple slug.
      // Ideally we would append a suffix if it exists, but let's stick to the requested format.

      // Upload files if they exist
      let event_image_url = null;
      let banner_url = null;
      let pdf_url = null;

      try {
        if (files.eventImage && files.eventImage[0]) {
          const result = await uploadFileToSupabase(
            files.eventImage[0],
            "event-images",
            event_id
          );
          event_image_url = result?.publicUrl || result?.path || null;
        }

        if (files.bannerImage && files.bannerImage[0]) {
          const result = await uploadFileToSupabase(
            files.bannerImage[0],
            "event-banners",
            event_id
          );
          banner_url = result?.publicUrl || result?.path || null;
        }

        if (files.pdfFile && files.pdfFile[0]) {
          const result = await uploadFileToSupabase(
            files.pdfFile[0],
            "event-pdfs",
            event_id
          );
          pdf_url = result?.publicUrl || result?.path || null;
        }
      } catch (fileError) {
        console.error("File upload error:", fileError);
        return res.status(500).json({ error: "Failed to upload files" });
      }


      // ─── WORKFLOW: Approval Gating ─────────────────────────────
      let approvalRequestId = null;
      let approval_state = null;
      let activation_state = null;
      const is_budget_related =
        claimsApplicable || extractBudgetApprovalRequirement(customFields);
      let festApprovalInherited = false;
      let festApprovalBypassed = false;
      let requiresDeanApproval = false;
      let requiresCfoApproval = false;

      if (!shouldSaveAsDraft) {
        if (festId) {
          let festRecord = null;

          try {
            const festTable = await getFestTableForDatabase(queryAll);
            festRecord = await queryOne(festTable, { where: { fest_id: festId } });
          } catch (festLookupError) {
            if (!isMissingRelationError(festLookupError) && !isMissingColumnError(festLookupError)) {
              throw festLookupError;
            }
          }

          const festApprovalState = normalizeWorkflowStatus(festRecord?.approval_state);
          const festActivationState = normalizeWorkflowStatus(
            festRecord?.activation_state,
            "ACTIVE"
          );
          festApprovalBypassed =
            festApprovalState === "APPROVED" && festActivationState === "ACTIVE";

          if (!festApprovalBypassed) {
            const festApproval = await findActiveApprovalRequestForEntity({
              entityType: "FEST",
              entityRef: festId,
            });

            if (festApproval) {
              approvalRequestId = festApproval.id;
              approval_state = "UNDER_REVIEW";
              activation_state = "PENDING";
              festApprovalInherited = true;
            }
          }
        }

        if (!festApprovalInherited && !festApprovalBypassed) {
          requiresDeanApproval = true;
          requiresCfoApproval = Boolean(is_budget_related);

          try {
            const nowIso = new Date().toISOString();
            const insertedRequest = await insert("approval_requests", [
              {
                request_id: `APR-EVENT-${event_id}-${Date.now()}`,
                entity_type: "EVENT",
                entity_ref: event_id,
                parent_fest_ref: festId,
                requested_by_user_id: req.userInfo?.id || req.user?.id || null,
                requested_by_email: req.userInfo?.email || req.user?.email || null,
                organizing_dept: organizingDeptValue || null,
                campus_hosted_at:
                  pickField("campus_hosted_at", "campusHostedAt") || null,
                is_budget_related: Boolean(is_budget_related),
                status: "UNDER_REVIEW",
                submitted_at: nowIso,
              },
            ]);

            const approvalRequest = insertedRequest?.[0];
            if (approvalRequest) {
              approvalRequestId = approvalRequest.id;
              approval_state = "UNDER_REVIEW";
              activation_state = "PENDING";

              const approvalSteps = [
                {
                  approval_request_id: approvalRequest.id,
                  step_code: "DEAN",
                  role_code: ROLE_CODES.DEAN,
                  step_group: 1,
                  sequence_order: 1,
                  required_count: 1,
                  status: "PENDING",
                },
              ];

              if (requiresCfoApproval) {
                approvalSteps.push({
                  approval_request_id: approvalRequest.id,
                  step_code: "CFO",
                  role_code: ROLE_CODES.CFO,
                  step_group: 2,
                  sequence_order: 2,
                  required_count: 1,
                  status: "PENDING",
                });
              }

              await insert("approval_steps", approvalSteps);
            }
          } catch (workflowError) {
            if (String(workflowError?.code || "") === "23505") {
              const existingRequest = await findActiveApprovalRequestForEntity({
                entityType: "EVENT",
                entityRef: event_id,
              });

              if (existingRequest) {
                approvalRequestId = existingRequest.id;
                approval_state = "UNDER_REVIEW";
                activation_state = "PENDING";
              }
            } else if (!isMissingRelationError(workflowError) && !isMissingColumnError(workflowError)) {
              throw workflowError;
            }
          }
        }
      }

      const departmentAccessRaw = pickField("departmentAccess", "department_access");
      const allowedCampusesRaw = pickField("allowed_campuses", "allowedCampuses");
      const scheduleRaw = pickField("scheduleItems", "schedule");
      const rulesRaw = pickField("rules");
      const prizesRaw = pickField("prizes");
      const organizerEmailValue = String(
        pickField("organizerEmail", "organizer_email", "contactEmail", "contact_email") || ""
      ).trim();
      const organizerPhoneValue = String(
        pickField("organizerPhone", "organizer_phone", "contactPhone", "contact_phone") || ""
      ).trim();
      const whatsappInviteLinkValue = String(
        pickField(
          "whatsappInviteLink",
          "whatsapp_invite_link",
          "whatsappLink",
          "whatsapp_link"
        ) || ""
      ).trim();
      const eventTimeValue = String(
        pickField("eventTime", "event_time") || ""
      ).trim();
      const endDateValue = String(
        pickField("endDate", "end_date") || ""
      ).trim();
      const registrationDeadlineValue = String(
        pickField("registrationDeadline", "registration_deadline") || ""
      ).trim();
      const createdByValue = String(
        pickField("createdBy", "created_by") || "admin"
      ).trim();

      // Prepare event payload
      const eventPayload = {
        event_id: event_id,
        title: titleValue,
        description: pickField("description", "detailedDescription") || "",
        event_date: eventDateValue,
        event_time: eventTimeValue || null,
        end_date: endDateValue || null,
        venue: venueValue,
        category: categoryValue,
        department_access: Array.isArray(departmentAccessRaw)
          ? departmentAccessRaw
          : parseJsonField(departmentAccessRaw, []),
        claims_applicable: claimsApplicable ? 1 : 0,
        registration_fee: parseOptionalFloat(
          pickField("registrationFee", "registration_fee"),
          0
        ),
        participants_per_team: parseOptionalInt(
          pickField("participantsPerTeam", "participants_per_team"),
          1
        ),
        max_participants: parseOptionalInt(
          pickField("maxParticipants", "max_participants"),
          null
        ),
        organizer_email: organizerEmailValue,
        organizer_phone: organizerPhoneValue,
        whatsapp_invite_link: whatsappInviteLinkValue,
        organizing_dept: organizingDeptValue,
        fest_id: festId,
        registration_deadline: registrationDeadlineValue || null,
        allow_outsiders: isTruthy(
          pickField("allowOutsiders", "allow_outsiders")
        )
          ? 1
          : 0,
        outsider_registration_fee: parseOptionalFloat(
          pickField("outsiderRegistrationFee", "outsider_registration_fee"),
          null
        ),
        outsider_max_participants: parseOptionalInt(
          pickField("outsiderMaxParticipants", "outsider_max_participants"),
          null
        ),
        campus_hosted_at:
          pickField("campus_hosted_at", "campusHostedAt") || null,
        allowed_campuses: Array.isArray(allowedCampusesRaw)
          ? allowedCampusesRaw
          : parseJsonField(allowedCampusesRaw, []),
        schedule: Array.isArray(scheduleRaw)
          ? scheduleRaw
          : parseJsonField(scheduleRaw, []),
        rules: Array.isArray(rulesRaw)
          ? rulesRaw
          : parseJsonField(rulesRaw, []),
        prizes: Array.isArray(prizesRaw)
          ? prizesRaw
          : parseJsonField(prizesRaw, []),
        custom_fields: customFields,
        event_image_url: event_image_url,
        banner_url: banner_url,
        pdf_url: pdf_url,
        min_participants: parseOptionalInt(
          pickField("minParticipants", "min_participants"),
          1
        ),
        total_participants: 0,
        created_by: createdByValue || "admin",
        // Approval workflow fields
        approval_request_id: approvalRequestId,
        approval_state: approval_state,
        activation_state: activation_state,
        is_budget_related: is_budget_related,
        is_draft: shouldSaveAsDraft ? true : approval_state === "UNDER_REVIEW",
      };

      const [createdEvent] = await insert("events", [eventPayload]);

      const responseEvent = {
        ...createdEvent,
        department_access: Array.isArray(createdEvent.department_access)
          ? createdEvent.department_access
          : parseJsonField(createdEvent.department_access, []),
        rules: Array.isArray(createdEvent.rules)
          ? createdEvent.rules
          : parseJsonField(createdEvent.rules, []),
        schedule: Array.isArray(createdEvent.schedule)
          ? createdEvent.schedule
          : parseJsonField(createdEvent.schedule, []),
        prizes: Array.isArray(createdEvent.prizes)
          ? createdEvent.prizes
          : parseJsonField(createdEvent.prizes, []),
        custom_fields: Array.isArray(createdEvent.custom_fields)
          ? createdEvent.custom_fields
          : parseJsonField(createdEvent.custom_fields, []),
      };

      return res.status(201).json({
        message: shouldSaveAsDraft
          ? "Event draft saved successfully"
          : approval_state === "UNDER_REVIEW"
          ? festApprovalInherited
            ? "Event created and linked to fest approval workflow. Activation pending required approvals."
            : "Event created and sent for approval. Activation pending required approvals."
          : "Event created successfully",
        workflow: {
          approval_state: approval_state || "NONE",
          activation_state: activation_state || "ACTIVE",
          fest_approval_inherited: festApprovalInherited,
          fest_approval_bypassed: festApprovalBypassed,
          requires_dean_approval: requiresDeanApproval,
          requires_cfo_approval: requiresCfoApproval,
        },
        event: responseEvent,
      });

    } catch (error) {
      console.error("Error creating event:", error);
      return res.status(500).json({ error: "Internal server error while creating event." });
    }
  }
);

export default router;