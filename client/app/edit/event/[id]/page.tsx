"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { dayjs } from "@/lib/dateUtils";
import EventForm, { EventSubmitResult } from "@/app/_components/Admin/ManageEvent";
import {
  EventFormData,
  departments as departmentOptions,
  ScheduleItem as ScheduleItemType,
} from "@/app/lib/eventFormSchema";
import { useAuth } from "@/context/AuthContext";
import { FileText, Wrench } from "lucide-react";
import ServiceRequests from "@/app/_components/ServiceRequests";
import toast from "react-hot-toast";

const PENDING_WORKFLOW_STATUS_REGEX = /^pending_level_([1-4])$/;
const APPROVAL_LEVEL_LABEL_BY_NUMBER: Record<number, string> = {
  1: "Level 1 (HOD)",
  2: "Level 2 (Dean/Director)",
  3: "Level 3 (CFO/Campus Director)",
  4: "Level 4 (Accounts)",
};

const getPendingApprovalLabel = (workflowStatus?: string | null) => {
  const normalized = String(workflowStatus || "").trim().toLowerCase();
  const match = PENDING_WORKFLOW_STATUS_REGEX.exec(normalized);
  if (!match) return null;
  const level = Number(match[1]);
  const levelLabel = APPROVAL_LEVEL_LABEL_BY_NUMBER[level] || `Level ${level}`;
  return `Awaiting ${levelLabel} approval`;
};

const normalizeLifecycleStatus = (
  value: unknown,
  fallback: "draft" | "published" = "draft"
): "draft" | "pending_approvals" | "revision_requested" | "approved" | "published" => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (
    normalized === "draft" ||
    normalized === "pending_approvals" ||
    normalized === "revision_requested" ||
    normalized === "approved" ||
    normalized === "published"
  ) {
    return normalized;
  }

  return fallback;
};

export default function EditEventPage() {
  const params = useParams();
  const eventIdSlug = params?.id as string;
  const router = useRouter();
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  const MAX_EMAIL_LENGTH = 100;

  const normalizeEmail = (value: unknown): string =>
    String(value ?? "").trim().toLowerCase();

  const validateEmail = (value: unknown): boolean =>
    EMAIL_REGEX.test(normalizeEmail(value));

  const { session, userData, isLoading: authIsLoading } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

  const [initialData, setInitialData] = useState<Partial<EventFormData>>();
  const [existingImageFileUrl, setExistingImageFileUrl] = useState<
    string | null
  >(null);
  const [existingBannerFileUrl, setExistingBannerFileUrl] = useState<
    string | null
  >(null);
  const [existingPdfFileUrl, setExistingPdfFileUrl] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isArchived, setIsArchived] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [isArchiveUpdating, setIsArchiveUpdating] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);
  const [lifecycleStatus, setLifecycleStatus] = useState<string | null>(null);
  const [canEditLoadedEvent, setCanEditLoadedEvent] = useState(false);

  const [activeTab, setActiveTab] = useState<"details" | "services">("details");

  const isMasterAdminUser = Boolean((userData as any)?.is_masteradmin);
  const pendingApprovalLabel = getPendingApprovalLabel(workflowStatus);
  const isLifecyclePendingApproval =
    normalizeLifecycleStatus(lifecycleStatus, "draft") === "pending_approvals";
  
  // Service requests allowed if it's past HOD or Dean approval
  // (pending_dean, dept_approved, pending_cfo, cfo_approved, fully_approved, live etc.)
  const SERVICE_ALLOWED_STATUSES = [
    'pending_dean', 'dept_approved', 'pending_cfo', 'cfo_approved', 
    'pending_accounts', 'fully_approved', 'live', 'organiser_approved'
  ];
  const isUnlockedForServices = SERVICE_ALLOWED_STATUSES.includes(workflowStatus || '');

  const isPendingApprovalLocked =
    (Boolean(pendingApprovalLabel) || isLifecyclePendingApproval) &&
    !isMasterAdminUser && activeTab === 'details';

  useEffect(() => {
    if (authIsLoading) return;

    if (!session) {
      setIsLoading(false);
      setCanEditLoadedEvent(false);
      setErrorMessage("You must be logged in to edit an event.");
      return;
    }

    if (!userData || !(userData.is_organiser || (userData as any).is_masteradmin)) {
      setIsLoading(false);
      setCanEditLoadedEvent(false);
      setErrorMessage("You are not authorized to edit this event.");
      return;
    }

    if (!eventIdSlug) {
      setIsLoading(false);
      setCanEditLoadedEvent(false);
      setErrorMessage("Event ID (slug) is missing from URL.");
      return;
    }

    async function fetchEventData() {
      setIsLoading(true);
      setCanEditLoadedEvent(false);
      setErrorMessage(null);
      let response: Response | undefined = undefined;
      try {
        response = await fetch(
          `${API_URL}/api/events/${eventIdSlug}`
        );

        // Try to clone the response to read text, as .json() consumes the body
        const responseText = await response.clone().text();

        if (!response.ok) {
          let errorData;
          try {
            errorData = JSON.parse(responseText); // Use the cloned text
          } catch (parseError) {
            // If JSON parsing fails, use the raw text or a generic message
            errorData = {
              error: responseText || `HTTP error! status: ${response.status}`,
            };
          }
          throw new Error(
            errorData.error ||
              errorData.detail ||
              `HTTP error! status: ${response.status}`
          );
        }

        const parsedResponse = JSON.parse(responseText); // Use the cloned text again for actual data
        const data = parsedResponse.event;

        if (data) {
          const currentUserEmail = normalizeEmail(userData?.email);
          const ownershipCandidates = [
            data.created_by,
            data.organizer_email,
            data.organiser_email,
          ]
            .map((owner: unknown) => normalizeEmail(owner))
            .filter(Boolean);
          const isOwner =
            ownershipCandidates.length > 0 &&
            Boolean(currentUserEmail) &&
            ownershipCandidates.includes(currentUserEmail);

          if (!isMasterAdminUser && !isOwner) {
            setErrorMessage("You can only edit events you created.");
            setInitialData(undefined);
            setCanEditLoadedEvent(false);
            return;
          }

          const normalizedWorkflowStatus = String(data.workflow_status || "").trim().toLowerCase();
          setWorkflowStatus(normalizedWorkflowStatus || null);
          const normalizedLifecycle = normalizeLifecycleStatus(
            data.status,
            data.is_draft === true ||
              data.is_draft === 1 ||
              data.is_draft === "1" ||
              data.is_draft === "true"
              ? "draft"
              : "published"
          );
          setLifecycleStatus(normalizedLifecycle);

          let parsedDepartments: string[] = [];
          const dbDepartmentAccess = data.department_access;
          if (dbDepartmentAccess) {
            if (Array.isArray(dbDepartmentAccess)) {
              parsedDepartments = dbDepartmentAccess.filter(
                (val: any) =>
                  typeof val === "string" &&
                  departmentOptions.some((opt) => opt.value === val)
              );
            } else if (typeof dbDepartmentAccess === "string") {
              try {
                const jsonData = JSON.parse(dbDepartmentAccess);
                if (
                  Array.isArray(jsonData) &&
                  jsonData.every((item) => typeof item === "string")
                ) {
                  parsedDepartments = jsonData.filter((val) =>
                    departmentOptions.some((opt) => opt.value === val)
                  );
                }
              } catch (e) {
                // If not JSON array, check if it's a single valid department string
                if (
                  departmentOptions.some(
                    (opt) => opt.value === dbDepartmentAccess.trim()
                  )
                ) {
                  parsedDepartments = [dbDepartmentAccess.trim()];
                }
              }
            }
          }

          let formEventTimeString: string = "";
          if (data.event_time) {
            // Assuming event_time is "HH:mm:ss" or just "HH:mm"
            const timeParts = data.event_time.split(":");
            if (timeParts.length >= 2) {
              formEventTimeString = `${timeParts[0].padStart(
                2,
                "0"
              )}:${timeParts[1].padStart(2, "0")}`;
            }
          }

          const transformSimpleListForForm = (
            items: any
          ): { value: string }[] => {
            let stringArray: string[] = [];
            if (Array.isArray(items)) {
              stringArray = items
                .filter(
                  (item) => typeof item === "string" || typeof item === "number"
                ) // Allow numbers too, convert to string
                .map(String);
            } else if (typeof items === "string") {
              try {
                const parsed = JSON.parse(items);
                if (
                  Array.isArray(parsed) &&
                  parsed.every(
                    (item) =>
                      typeof item === "string" || typeof item === "number"
                  )
                ) {
                  stringArray = parsed.map(String);
                } else if (
                  typeof parsed === "string" ||
                  typeof parsed === "number"
                ) {
                  stringArray = [String(parsed)];
                }
              } catch (e) {
                if (items.trim() !== "") stringArray = [items.trim()];
              }
            } else if (typeof items === "number") {
              stringArray = [String(items)];
            }
            return stringArray.map((item) => ({ value: item }));
          };

          const normalizeStringList = (items: any): string[] => {
            if (Array.isArray(items)) {
              return items
                .filter(
                  (item): item is string | number =>
                    typeof item === "string" || typeof item === "number"
                )
                .map((item) => String(item).trim())
                .filter(Boolean);
            }

            if (typeof items === "string") {
              const trimmed = items.trim();
              if (!trimmed) return [];

              try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                  return parsed
                    .filter(
                      (item): item is string | number =>
                        typeof item === "string" || typeof item === "number"
                    )
                    .map((item) => String(item).trim())
                    .filter(Boolean);
                }

                if (typeof parsed === "string" || typeof parsed === "number") {
                  const parsedValue = String(parsed).trim();
                  return parsedValue ? [parsedValue] : [];
                }
              } catch {
                if (trimmed.includes(",")) {
                  return trimmed
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean);
                }

                return [trimmed];
              }
            }

            if (typeof items === "number") {
              return [String(items)];
            }

            return [];
          };

          const transformScheduleForForm = (
            schedule: any
          ): ScheduleItemType[] => {
            let parsedScheduleItems: any[] = [];
            if (Array.isArray(schedule)) {
              parsedScheduleItems = schedule;
            } else if (typeof schedule === "string") {
              try {
                parsedScheduleItems = JSON.parse(schedule);
                if (!Array.isArray(parsedScheduleItems))
                  parsedScheduleItems = [];
              } catch (e) {
                /* Ignore parse error, treat as empty */
              }
            }
            return parsedScheduleItems
              .filter(
                (item) =>
                  item &&
                  typeof item.time === "string" && // Ensure time and activity are strings
                  typeof item.activity === "string"
              )
              .map((item) => ({
                time: item.time,
                activity: item.activity,
              }));
          };

          const parseAdditionalRequests = (
            additionalRequests: unknown
          ): EventFormData["additionalRequests"] => {
            const defaults = {
              it: {
                enabled: false,
                description: "",
              },
              venue: {
                enabled: false,
                selectedVenue: "",
                customVenue: "",
                startTime: "",
                endTime: "",
              },
              catering: {
                enabled: false,
                approximateCount: "",
                description: "",
              },
              stalls: {
                enabled: false,
                canopySelected: false,
                canopyQuantity: "0",
                canopyDescription: "",
                hardboardSelected: false,
                hardboardQuantity: "0",
                hardboardDescription: "",
                description: "",
              },
            };

            if (!additionalRequests) {
              return defaults;
            }

            let parsed: any = additionalRequests;
            if (typeof additionalRequests === "string") {
              try {
                parsed = JSON.parse(additionalRequests);
              } catch {
                parsed = null;
              }
            }

            if (!parsed || typeof parsed !== "object") {
              return defaults;
            }

            return {
              it: {
                ...defaults.it,
                ...(parsed.it || {}),
              },
              venue: {
                ...defaults.venue,
                ...(parsed.venue || {}),
              },
              catering: {
                ...defaults.catering,
                ...(parsed.catering || {}),
              },
              stalls: {
                ...defaults.stalls,
                ...(parsed.stalls || {}),
                description:
                  (parsed?.stalls?.description as string | undefined) ||
                  (parsed?.stalls?.hardboardDescription as string | undefined) ||
                  (parsed?.stalls?.canopyDescription as string | undefined) ||
                  "",
              },
            };
          };

          const parseBooleanWithFallback = (
            value: unknown,
            fallback: boolean
          ): boolean => {
            if (typeof value === "boolean") return value;
            if (typeof value === "number") return value !== 0;
            if (typeof value === "string") {
              const normalized = value.trim().toLowerCase();
              if (["true", "1", "yes", "y"].includes(normalized)) return true;
              if (["false", "0", "no", "n"].includes(normalized)) return false;
            }
            return fallback;
          };

          const transformedData: Partial<EventFormData> = {
            eventTitle: data.title || "",
            eventDate: data.event_date
              ? dayjs(data.event_date).format("YYYY-MM-DD")
              : "",
            endDate: data.end_date
              ? dayjs(data.end_date).format("YYYY-MM-DD")
              : "",
            eventTime: formEventTimeString,
            detailedDescription: data.description || "",
            department: parsedDepartments,
            category: data.category || "",
            organizingSchool: data.organizing_school || "",
            organizingDept: data.organizing_dept || "",
            festEvent: data.fest_id || data.fest || "",
            standaloneRequiresHodApproval: parseBooleanWithFallback(
              data.requires_hod_approval,
              false
            ),
            standaloneRequiresDeanApproval: parseBooleanWithFallback(
              data.requires_dean_approval,
              false
            ),
            registrationDeadline: data.registration_deadline
              ? dayjs(data.registration_deadline).format("YYYY-MM-DD")
              : "",
            location: data.venue || "",
            registrationFee: data.registration_fee?.toString() ?? "0",
            isTeamEvent: Number(data.participants_per_team ?? 1) > 1,
            maxParticipants: data.participants_per_team?.toString() ?? "1",
            minParticipants:
              data.min_participants?.toString() ??
              (Number(data.participants_per_team ?? 1) > 1 ? "2" : "1"),
            contactEmail: data.organizer_email || "",
            contactPhone: data.organizer_phone?.toString() ?? "",
            whatsappLink: data.whatsapp_invite_link || "",
            provideClaims: data.claims_applicable || false,
            onSpot: data.on_spot === true || data.on_spot === 1 || data.on_spot === "1" || data.on_spot === "true",
            allowOutsiders: data.allow_outsiders || false,
            outsiderRegistrationFee: data.outsider_registration_fee?.toString() ?? "",
            outsiderMaxParticipants: data.outsider_max_participants?.toString() ?? "",
            campusHostedAt: normalizeStringList(data.campus_hosted_at)[0] || "",
            allowedCampuses: normalizeStringList(data.allowed_campuses),
            scheduleItems: transformScheduleForForm(data.schedule),
            rules: transformSimpleListForForm(data.rules),
            prizes: transformSimpleListForForm(data.prizes),
            customFields: Array.isArray(data.custom_fields) ? data.custom_fields : [],
            additionalRequests: parseAdditionalRequests(data.additional_requests),
            imageFile: null, // Always null initially for form, URL is separate
            bannerFile: null,
            pdfFile: null,
          };

          setInitialData(transformedData);
          const manualArchived =
            data.is_archived === true ||
            data.is_archived === 1 ||
            data.is_archived === "1" ||
            data.is_archived === "true";
          const effectiveArchived =
            data.archived_effective === true ||
            data.archived_effective === 1 ||
            data.archived_effective === "1" ||
            data.archived_effective === "true";
          const draftValue =
            data.is_draft === true ||
            data.is_draft === 1 ||
            data.is_draft === "1" ||
            data.is_draft === "true";
          setIsArchived(Boolean(manualArchived || effectiveArchived));
          setIsDraft(Boolean(draftValue));
          setExistingImageFileUrl(data.event_image_url || null);
          setExistingBannerFileUrl(data.banner_url || null);
          setExistingPdfFileUrl(data.pdf_url || null);
          setCanEditLoadedEvent(true);
        } else {
          setErrorMessage("Event data not found in API response.");
          setInitialData(undefined);
          setCanEditLoadedEvent(false);
        }
      } catch (e: any) {
        console.error("Error in fetchEventData:", e);
        let detailedMessage = e.message;
        if (
          response &&
          !response.ok &&
          e.message &&
          typeof e.message === "string" &&
          e.message.toLowerCase().includes("<!doctype html>") // More robust HTML check
        ) {
          detailedMessage = `The server returned an HTML page (Status: ${response.status}). This usually indicates an error page. Please check the API endpoint and server logs.`;
        } else if (response && !response.ok) {
          detailedMessage = `An error occurred (Status: ${response.status}): ${e.message}`;
        }
        setErrorMessage(`Failed to load event data: ${detailedMessage}`);
        setInitialData(undefined);
        setCanEditLoadedEvent(false);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEventData();
  }, [eventIdSlug, session, userData, authIsLoading, router]); // Added router to dependencies if used inside

  const handleToggleArchive = async () => {
    if (!session?.access_token) {
      toast.error("Please log in again to update archive status.");
      return;
    }

    if (isPendingApprovalLocked) {
      toast.error("This event is awaiting approval and cannot be modified right now.");
      return;
    }

    setIsArchiveUpdating(true);
    try {
      const response = await fetch(`${API_URL}/api/events/${eventIdSlug}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ archive: !isArchived }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (payload?.error_code === "PENDING_APPROVAL_BLOCK") {
          setWorkflowStatus(String(payload?.workflow_status || workflowStatus || "").trim().toLowerCase() || null);
          if (payload?.lifecycle_status) {
            setLifecycleStatus(
              normalizeLifecycleStatus(payload.lifecycle_status, "draft")
            );
          }
          throw new Error(payload?.message || "This event is awaiting approval and is locked.");
        }
        throw new Error(payload?.error || "Failed to update archive status.");
      }

      const archivedValue =
        payload?.event?.is_archived === true ||
        payload?.event?.is_archived === 1 ||
        payload?.event?.is_archived === "1" ||
        payload?.event?.is_archived === "true";

      setIsArchived(archivedValue);
      toast.success(archivedValue ? "Event archived successfully." : "Event moved back to active list.");
    } catch (error: any) {
      console.error("Archive toggle failed:", error);
      toast.error(error?.message || "Unable to update archive status.");
    } finally {
      setIsArchiveUpdating(false);
    }
  };

  const submitEventUpdate = async (
    formData: EventFormData,
    options?: { archiveAsDraft?: boolean }
  ): Promise<EventSubmitResult | void> => {
    const normalizeStringArrayPayload = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean);
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];

        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean);
          }
        } catch {
          if (trimmed.includes(",")) {
            return trimmed
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean);
          }
        }

        return [trimmed];
      }

      return [];
    };

    const archiveAsDraft = Boolean(options?.archiveAsDraft);
    const publishFromDraft = !archiveAsDraft && isDraft;
    const shouldSendPublishNotifications =
      publishFromDraft && formData.sendNotifications !== false;
    const normalizedContactEmail = normalizeEmail(formData.contactEmail);

    if (!normalizedContactEmail) {
      setErrorMessage("Contact email is required.");
      setIsSubmitting(false);
      throw new Error("Contact email is required.");
    }

    if (normalizedContactEmail.length > MAX_EMAIL_LENGTH) {
      setErrorMessage("Contact email must be 100 characters or fewer.");
      setIsSubmitting(false);
      throw new Error("Contact email must be 100 characters or fewer.");
    }

    if (!validateEmail(normalizedContactEmail)) {
      setErrorMessage("Please enter a valid contact email, like name@gmail.com.");
      setIsSubmitting(false);
      throw new Error("Please enter a valid contact email.");
    }

    if (!session) {
      setErrorMessage(
        "Authentication session expired or not found. Please log in again."
      );
      setIsSubmitting(false);
      throw new Error("Authentication session expired or not found."); // Ensure EventForm knows
    }
    if (!userData || !(userData.is_organiser || (userData as any).is_masteradmin)) {
      setErrorMessage("You are not authorized to perform this action.");
      setIsSubmitting(false);
      throw new Error("Not authorized."); // Ensure EventForm knows
    }

    if (!canEditLoadedEvent) {
      setErrorMessage("You are not authorized to edit this event.");
      setIsSubmitting(false);
      throw new Error("Not authorized.");
    }

    if (isPendingApprovalLocked) {
      const lockedMessage = "This event is awaiting approval and cannot be edited right now.";
      setErrorMessage(lockedMessage);
      throw new Error(lockedMessage);
    }

    setIsSubmitting(true);
    setErrorMessage(null); // Clear previous page-level errors on new submission

    const payload = new FormData();

    // Use backend field names (match create page)
    payload.append("title", formData.eventTitle);
    payload.append("event_date", formData.eventDate || "");
    payload.append("end_date", formData.endDate || "");
    payload.append("event_time", formData.eventTime || "");
    payload.append("description", formData.detailedDescription);
    payload.append("category", formData.category);
    payload.append("organizing_school", formData.organizingSchool || "");
    payload.append("organizing_dept", formData.organizingDept || "");
    // Only append fest_id if it's not "none"
    if (formData.festEvent && formData.festEvent !== "none") {
      payload.append("fest_id", formData.festEvent);
    }
    payload.append(
      "requires_hod_approval",
      String(Boolean(formData.standaloneRequiresHodApproval))
    );
    payload.append(
      "requires_dean_approval",
      String(Boolean(formData.standaloneRequiresDeanApproval))
    );
    payload.append("registration_deadline", formData.registrationDeadline || "");
    payload.append("venue", formData.location);
    payload.append("registration_fee", formData.registrationFee || "0");
    payload.append(
      "max_participants",
      formData.isTeamEvent ? (formData.maxParticipants || "2") : "1"
    );
    payload.append(
      "min_participants",
      formData.isTeamEvent ? (formData.minParticipants || "2") : "1"
    );
    payload.append("organizer_email", normalizedContactEmail);
    payload.append("organizer_phone", formData.contactPhone || "");
    payload.append("whatsapp_invite_link", formData.whatsappLink || "");
    payload.append("claims_applicable", String(formData.provideClaims));
    payload.append("on_spot", String(formData.onSpot || false));
    if (archiveAsDraft) {
      payload.append("is_draft", "true");
      payload.append("is_archived", "false");
    } else if (publishFromDraft) {
      payload.append("is_draft", "false");
      payload.append("is_archived", "false");
      payload.append(
        "send_notifications",
        String(shouldSendPublishNotifications)
      );
    }

    payload.append("department_access", JSON.stringify(formData.department || []));
    payload.append(
      "schedule",
      JSON.stringify(formData.scheduleItems || [])
    );
    payload.append(
      "rules",
      JSON.stringify(formData.rules ? formData.rules.map((r) => r.value) : [])
    );
    payload.append(
      "prizes",
      JSON.stringify(formData.prizes ? formData.prizes.map((p) => p.value) : [])
    );

    // Outsider support fields
    payload.append("allow_outsiders", String(formData.allowOutsiders || false));
    payload.append("outsider_registration_fee", formData.outsiderRegistrationFee || "");
    payload.append("outsider_max_participants", formData.outsiderMaxParticipants || "");

    // Campus fields
    const normalizedCampusHostedAt = String(formData.campusHostedAt || "").trim();
    const normalizedAllowedCampuses = normalizeStringArrayPayload(
      formData.allowedCampuses
    );
    payload.append("campus_hosted_at", normalizedCampusHostedAt);
    payload.append("allowed_campuses", JSON.stringify(normalizedAllowedCampuses));

    // Custom fields
    payload.append("custom_fields", JSON.stringify(formData.customFields || []));
    payload.append(
      "additional_requests",
      JSON.stringify(formData.additionalRequests || {})
    );

    const appendFile = (key: string, file: any) => {
      if (!file) return false;
      
      if (file instanceof FileList) {
        if (file.length > 0) {
          payload.append(key, file[0]);
          return true;
        }
        return false;
      }
      
      if (file instanceof File) {
        payload.append(key, file);
        return true;
      }
      return false;
    };

    const hasNewImage = appendFile("eventImage", formData.imageFile);
    if (!hasNewImage && existingImageFileUrl) {
      payload.append("existingImageFileUrl", existingImageFileUrl);
    } else if (formData.imageFile === null && existingImageFileUrl) {
      payload.append("removeImageFile", "true");
    }

    const hasNewBanner = appendFile("bannerImage", formData.bannerFile);
    if (!hasNewBanner && existingBannerFileUrl) {
      payload.append("existingBannerFileUrl", existingBannerFileUrl);
    } else if (formData.bannerFile === null && existingBannerFileUrl) {
      payload.append("removeBannerFile", "true");
    }

    const hasNewPdf = appendFile("pdfFile", formData.pdfFile);
    if (!hasNewPdf && existingPdfFileUrl) {
      payload.append("existingPdfFileUrl", existingPdfFileUrl);
    } else if (formData.pdfFile === null && existingPdfFileUrl) {
      payload.append("removePdfFile", "true");
    }

    // DEBUG: Log what we're sending
    console.log("=== EDIT EVENT FORM DATA ===");
    console.log("formData.eventTitle:", formData.eventTitle);
    console.log("📁 FILE HANDLING:");
    console.log(`  formData.imageFile instanceof File: ${formData.imageFile instanceof File}`);
    console.log(`  formData.imageFile: ${formData.imageFile}`);
    console.log(`  existingImageFileUrl: ${existingImageFileUrl}`);
    for (let [key, value] of payload.entries()) {
      if (value instanceof File) {
        console.log(`${key}: [FILE] ${value.name} (${value.size} bytes)`);
      } else if (key.toLowerCase().includes('image') || key.toLowerCase().includes('file')) {
        console.log(`${key}: ${value}`);
      }
    }
    console.log("=== END FORM DATA ===");

    let response: Response | undefined = undefined;
    try {
      const token = session?.access_token;
      const apiHeaders: HeadersInit = {};
      if (token) {
        apiHeaders["Authorization"] = `Bearer ${token}`;
      } else {
        setErrorMessage("Authentication token not found. Please log in again.");
        setIsSubmitting(false);
        throw new Error("Authentication token not found.");
      }

      response = await fetch(
        `${API_URL}/api/events/${eventIdSlug}`,
        {
          method: "PUT",
          body: payload,
          headers: apiHeaders,
        }
      );

      const resultText = await response.text();

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(resultText);
        } catch (e) {
          errorData = {
            error:
              resultText || `Update failed with status: ${response.status}`,
          };
        }
        const apiErrorMsg =
          errorData.error ||
          errorData.detail ||
          `Update failed: ${response.status}`;

        if (errorData?.error_code === "PENDING_APPROVAL_BLOCK") {
          setWorkflowStatus(String(errorData?.workflow_status || workflowStatus || "").trim().toLowerCase() || null);
          if (errorData?.lifecycle_status) {
            setLifecycleStatus(
              normalizeLifecycleStatus(errorData.lifecycle_status, "draft")
            );
          }
        }

        setErrorMessage(`Update error: ${apiErrorMsg}`);
        const wrappedError = new Error(apiErrorMsg);
        (wrappedError as any).fieldErrors =
          errorData.fieldErrors && typeof errorData.fieldErrors === "object"
            ? errorData.fieldErrors
            : null;
        throw wrappedError;
      }

      try {
        const resultJson = JSON.parse(resultText);
        const latestWorkflowStatus =
          resultJson?.workflow_status || resultJson?.event?.workflow_status || null;
        if (latestWorkflowStatus !== null && latestWorkflowStatus !== undefined) {
          setWorkflowStatus(String(latestWorkflowStatus).trim().toLowerCase() || null);
        }

        const latestLifecycleStatus =
          resultJson?.lifecycle_status || resultJson?.event?.status || null;
        if (latestLifecycleStatus !== null && latestLifecycleStatus !== undefined) {
          setLifecycleStatus(normalizeLifecycleStatus(latestLifecycleStatus, "draft"));
        }

        if (resultJson.event) {
          setExistingImageFileUrl(resultJson.event.event_image_url || null);
          setExistingBannerFileUrl(resultJson.event.banner_url || null);
          setExistingPdfFileUrl(resultJson.event.pdf_url || null);
          const stillArchived =
            resultJson.event.is_archived === true ||
            resultJson.event.is_archived === 1 ||
            resultJson.event.is_archived === "1" ||
            resultJson.event.is_archived === "true";
          const stillDraft =
            resultJson.event.is_draft === true ||
            resultJson.event.is_draft === 1 ||
            resultJson.event.is_draft === "1" ||
            resultJson.event.is_draft === "true";
          setIsArchived(Boolean(stillArchived));
          setIsDraft(Boolean(stillDraft));
          setLifecycleStatus(
            normalizeLifecycleStatus(
              resultJson?.lifecycle_status || resultJson?.event?.status,
              stillDraft ? "draft" : "published"
            )
          );
        }

        const successMessage = archiveAsDraft
          ? "Draft saved successfully!"
          : publishFromDraft
            ? "Event published successfully!"
            : "Event updated successfully!";

        const approvalState = String(
          resultJson?.workflow?.approval_state || resultJson?.event?.approval_state || ""
        )
          .trim()
          .toUpperCase();
        const activationState = String(
          resultJson?.workflow?.activation_state || resultJson?.event?.activation_state || ""
        )
          .trim()
          .toUpperCase();
        const workflowOutcome: EventSubmitResult["workflowOutcome"] =
          approvalState === "UNDER_REVIEW" || activationState === "PENDING"
            ? "approval_pending"
            : "published";

        const submitResult: EventSubmitResult = {
          workflowOutcome,
          message:
            typeof resultJson?.message === "string" && resultJson.message.trim()
              ? resultJson.message.trim()
              : successMessage,
          approvalState: approvalState || null,
          activationState: activationState || null,
        };
        
        // If the event_id changed (title was updated), show success message and redirect to new URL
        if (resultJson.id_changed && resultJson.event_id) {
          const oldId = eventIdSlug;
          const newId = resultJson.event_id;
          console.log(`Event ID changed from '${oldId}' to '${newId}', redirecting...`);
          
          toast.success(
            `${successMessage} The event link has changed from /event/${oldId} to /event/${newId}`,
            { duration: 5000 }
          );
          
          router.replace(`/edit/event/${newId}`);
          return submitResult;
        } else {
          // Show regular success message
          toast.success(successMessage, { duration: 3000 });
          return submitResult;
        }
      } catch (e) {
        console.warn(
          "Could not parse update response as JSON, or event data missing in response."
        );
        // Still show success if response was ok
        const fallbackMessage = archiveAsDraft
          ? "Draft saved successfully!"
          : publishFromDraft
            ? "Event published successfully!"
            : "Event updated successfully!";
        toast.success(fallbackMessage, { duration: 3000 });
        return {
          workflowOutcome: "published",
          message: fallbackMessage,
        };
      }
    } catch (error: any) {
      console.error("Error in handleUpdateEvent:", error);
      if (!errorMessage)
        setErrorMessage(
          error.message || "An unknown error occurred during update."
        );
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEvent = async (
    formData: EventFormData
  ): Promise<EventSubmitResult | void> =>
    submitEventUpdate(formData, { archiveAsDraft: false });

  const handleSaveDraft = async (
    formData: EventFormData
  ): Promise<EventSubmitResult | void> =>
    submitEventUpdate(formData, { archiveAsDraft: true });

  if (authIsLoading || (isLoading && !initialData && !errorMessage)) {
    return (
      <div className="p-8 text-center text-lg font-semibold">
        Loading event data...
      </div>
    );
  }

  if (isPendingApprovalLocked) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-amber-700 mb-3">Approval Pending</h2>
        <p className="text-amber-700">
          {pendingApprovalLabel}. This event is locked for editing until approval is completed or rejected.
        </p>
        <button
          onClick={() => router.push("/manage")}
          className="mt-6 px-4 py-2 bg-[#154CB3] text-white rounded hover:bg-[#154cb3df]"
        >
          Back to Manage Events
        </button>
      </div>
    );
  }

  if (
    errorMessage &&
    (!initialData || !session || !userData || (!authIsLoading && !isLoading))
  ) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-red-700 mb-4">Error</h2>
        <p className="text-red-600">{errorMessage}</p>
        <button
          onClick={() => router.push("/manage")}
          className="mt-6 px-4 py-2 bg-[#154CB3] text-white rounded hover:bg-[#154cb3df]"
        >
          Back to Manage Events
        </button>
      </div>
    );
  }

  if (!initialData && !isLoading && !errorMessage && session && userData) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg">Event not found or could not be loaded.</p>
        <button
          onClick={() => router.push("/manage")}
          className="mt-6 px-4 py-2 bg-[#154CB3] text-white rounded hover:bg-[#154cb3df]"
        >
          Back to Manage Events
        </button>
      </div>
    );
  }

  if (!eventIdSlug) {
    return (
      <div className="p-8 text-center text-red-600">
        <p>Event ID is missing from the URL.</p>
        <button
          onClick={() => router.push("/manage")}
          className="mt-6 px-4 py-2 bg-[#154CB3] text-white rounded hover:bg-[#154cb3df]"
        >
          Back to Manage Events
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Tab Navigation header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8 h-16">
            <button
              onClick={() => setActiveTab("details")}
              className={`flex items-center gap-2 h-full border-b-2 px-1 text-sm font-semibold transition-all ${
                activeTab === "details"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <FileText className="w-4 h-4" />
              Event Details
            </button>
            <button
              onClick={() => setActiveTab("services")}
              className={`flex items-center gap-2 h-full border-b-2 px-1 text-sm font-semibold transition-all ${
                activeTab === "services"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Wrench className="w-4 h-4" />
              Service Requests
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "details" ? (
          initialData &&
          session &&
          userData &&
          canEditLoadedEvent ? (
            <>
              {errorMessage && !isSubmitting && (
                <div className="max-w-4xl mx-auto pt-4">
                  <div className="p-4 my-2 text-sm text-red-700 bg-red-100 border border-red-400 rounded text-center">
                    <strong>Update Error:</strong> {errorMessage}
                  </div>
                </div>
              )}
              <EventForm
                onSubmit={handleUpdateEvent}
                onSubmitDraft={handleSaveDraft}
                defaultValues={initialData}
                isSubmittingProp={isSubmitting}
                isEditMode={true}
                lifecycleStatus={lifecycleStatus}
                existingImageFileUrl={existingImageFileUrl}
                existingBannerFileUrl={existingBannerFileUrl}
                existingPdfFileUrl={existingPdfFileUrl}
                isArchived={isArchived}
                isDraft={isDraft}
                isArchiveUpdating={isArchiveUpdating}
                onToggleArchive={handleToggleArchive}
              />
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
              <h2 className="text-xl font-semibold text-red-700 mb-4">
                Access Denied or Data Error
              </h2>
              <p className="text-red-600">
                {errorMessage ||
                  (!session || !userData
                    ? "You must be logged in and authorized to edit this event."
                    : !initialData
                    ? "Event data could not be loaded or is missing."
                    : "Unable to load the event editor. Please try again or contact support.")}
              </p>
              <button
                onClick={() => router.push(!session ? "/login" : "/manage")}
                className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                {!session ? "Go to Login" : "Back to Manage Events"}
              </button>
            </div>
          )
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <ServiceRequests 
              entityType="event"
              entityId={eventIdSlug}
              isUnlocked={isUnlockedForServices || isMasterAdminUser}
              authToken={session?.access_token}
            />
          </div>
        )}
      </div>
    </div>
  );
}

