"use client";
import React, { Suspense, useMemo, useRef, useState } from "react";
import EventForm, { WorkflowStage, STANDALONE_EVENT_STAGES, OperationalConfig, BudgetItem } from "@/app/_components/Admin/ManageEvent";
import { EventFormData } from "@/app/lib/eventFormSchema";
import { SubmitHandler } from "react-hook-form";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { fetchWithTimeout } from "@/app/lib/fetchWithTimeout";

export default function CreateEventPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { isStudentOrganiser } = useAuth();
  const approvalConfigRef = useRef<{ enabled: boolean; stages: WorkflowStage[]; budgetItems: BudgetItem[] }>({
    enabled: true,
    stages: STANDALONE_EVENT_STAGES,
    budgetItems: [],
  });
  const operationalConfigRef = useRef<OperationalConfig>({
    it:       { enabled: false, description: '' },
    venue:    { enabled: false, venue_name: '', date: '', start_time: '', end_time: '' },
    catering: { enabled: false, approximate_count: '', description: '' },
    stalls:   { enabled: false, total_stalls: '', canopy_count: '', hardboard_count: '', description: '' },
  });
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  const MAX_EMAIL_LENGTH = 100;

  const normalizeEmail = (value: unknown): string =>
    String(value ?? "").trim().toLowerCase();

  const validateEmail = (value: unknown): boolean =>
    EMAIL_REGEX.test(normalizeEmail(value));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }, [supabaseAnonKey, supabaseUrl]);

  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const submitEvent = async (dataFromHookForm: EventFormData, saveAsDraft: boolean) => {
    setIsSubmitting(true);

    if (!supabase) {
      alert("Supabase configuration is missing. Please contact support.");
      setIsSubmitting(false);
      router.replace('/auth');
      return;
    }

    let token: string;
    let userEmail: string | undefined;
    try {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) console.warn("Session refresh failed:", refreshError);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        alert("Authentication error or no active session. Please log in again.");
        setIsSubmitting(false);
        router.replace('/auth');
        return;
      }

      token = session.access_token;
      userEmail = session.user.email;

      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      if (tokenPayload.exp <= Math.floor(Date.now() / 1000)) {
        alert("Your session has expired. Please log in again.");
        setIsSubmitting(false);
        router.replace('/auth');
        return;
      }
    } catch (e: any) {
      alert("An unexpected error occurred while verifying your session. Please log in again.");
      setIsSubmitting(false);
      router.replace('/auth');
      return;
    }

    const normalizedContactEmail = normalizeEmail(dataFromHookForm.contactEmail);
    if (!normalizedContactEmail) {
      alert("Contact email is required.");
      setIsSubmitting(false);
      return;
    }
    if (normalizedContactEmail.length > MAX_EMAIL_LENGTH) {
      alert("Contact email must be 100 characters or fewer.");
      setIsSubmitting(false);
      return;
    }
    if (!validateEmail(normalizedContactEmail)) {
      alert("Please enter a valid contact email, like name@gmail.com.");
      setIsSubmitting(false);
      return;
    }

    const hasInvalidEventHeadEmail = Array.isArray(dataFromHookForm.eventHeads)
      ? dataFromHookForm.eventHeads.some(
          (head) => normalizeEmail(head).length > 0 && !validateEmail(head)
        )
      : false;
    if (hasInvalidEventHeadEmail) {
      alert("Each event head email must be valid.");
      setIsSubmitting(false);
      return;
    }

    const isFestEventEarly = dataFromHookForm.festEvent && dataFromHookForm.festEvent !== "none";
    if (!isFestEventEarly && !saveAsDraft) {
      const { stages: approvalStagesEarly, budgetItems: budgetItemsEarly } = approvalConfigRef.current;
      const hasCfoOrAccounts = approvalStagesEarly.filter(s => s.blocking).some(s => s.role === 'cfo' || s.role === 'accounts');
      if (hasCfoOrAccounts && (!budgetItemsEarly || budgetItemsEarly.length === 0)) {
        alert("Budget Estimate is required when CFO or Finance Officer is included in the approval workflow.");
        setIsSubmitting(false);
        return;
      }
    }

    const formData = new FormData();
    const appendIfExists = (key: string, value: any) => {
      if (value !== null && value !== undefined && String(value).trim() !== "") {
        formData.append(key, String(value));
      }
    };
    const appendJsonArrayOrObject = (key: string, value: any) => {
      if (Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
      } else if (typeof value === "object" && value !== null && Object.keys(value).length > 0) {
        formData.append(key, JSON.stringify(value));
      }
    };

    appendIfExists("title", dataFromHookForm.eventTitle);
    appendIfExists("event_date", dataFromHookForm.eventDate);
    appendIfExists("end_date", dataFromHookForm.endDate);
    appendIfExists("event_time", dataFromHookForm.eventTime);
    appendIfExists("end_time", dataFromHookForm.endTime);
    appendIfExists("description", dataFromHookForm.detailedDescription);
    appendIfExists("organizing_school", dataFromHookForm.organizingSchool);
    appendIfExists("organizing_dept", dataFromHookForm.organizingDept);
    appendJsonArrayOrObject("department_access", dataFromHookForm.department);
    appendIfExists("category", dataFromHookForm.category);
    if (dataFromHookForm.festEvent && dataFromHookForm.festEvent !== "none") {
      appendIfExists("fest_id", dataFromHookForm.festEvent);
    }
    appendIfExists("registration_deadline", dataFromHookForm.registrationDeadline);
    appendIfExists("venue", dataFromHookForm.location);
    appendIfExists("registration_fee", dataFromHookForm.registrationFee);
    appendIfExists("max_participants", dataFromHookForm.isTeamEvent ? dataFromHookForm.maxParticipants : "1");
    appendIfExists("min_participants", dataFromHookForm.isTeamEvent ? dataFromHookForm.minParticipants : "1");
    appendIfExists("organizer_email", normalizedContactEmail);
    appendIfExists("organizer_phone", dataFromHookForm.contactPhone);
    appendIfExists("whatsapp_invite_link", dataFromHookForm.whatsappLink);

    const shouldSendNotifications = !saveAsDraft && dataFromHookForm.sendNotifications !== false;
    formData.append("claims_applicable", String(dataFromHookForm.provideClaims));
    formData.append("send_notifications", String(shouldSendNotifications));
    formData.append("is_draft", String(saveAsDraft));
    if (saveAsDraft) formData.append("is_archived", "false");
    formData.append("on_spot", String(dataFromHookForm.onSpot));
    formData.append("allow_outsiders", String(dataFromHookForm.allowOutsiders));
    appendIfExists("outsider_registration_fee", dataFromHookForm.outsiderRegistrationFee);
    appendIfExists("outsider_max_participants", dataFromHookForm.outsiderMaxParticipants);
    appendIfExists("campus_hosted_at", dataFromHookForm.campusHostedAt);
    appendJsonArrayOrObject("allowed_campuses", dataFromHookForm.allowedCampuses);
    appendJsonArrayOrObject("schedule", dataFromHookForm.scheduleItems);
    appendJsonArrayOrObject("rules", dataFromHookForm.rules);
    appendJsonArrayOrObject("prizes", dataFromHookForm.prizes);
    appendJsonArrayOrObject("event_heads", dataFromHookForm.eventHeads);
    appendJsonArrayOrObject("custom_fields", dataFromHookForm.customFields);
    appendJsonArrayOrObject("volunteers", dataFromHookForm.volunteers || []);
    appendIfExists("created_by", userEmail);

    const itConfig = operationalConfigRef.current.it;
    if (itConfig.enabled) {
      formData.append("it_enabled", "true");
      appendIfExists("it_description", itConfig.description);
    }

    const appendFile = (key: string, file: any) => {
      if (!file) return;
      if (file instanceof FileList) {
        if (file.length > 0) formData.append(key, file[0]);
        return;
      }
      if (file instanceof File) { formData.append(key, file); return; }
    };
    appendFile("eventImage", dataFromHookForm.imageFile);
    appendFile("bannerImage", dataFromHookForm.bannerFile);
    appendFile("pdfFile", dataFromHookForm.pdfFile);

    try {
      const response = await fetchWithTimeout(`/api/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token!}` },
        body: formData,
      }, 30000);

      if (!response.ok) {
        let errorData: any = {};
        try { errorData = await response.json(); } catch { /* non-JSON body */ }
        const message = errorData.details || errorData.message || errorData.error || `Server error: ${response.status}`;
        throw new Error(message);
      }

      const result = await response.json();
      const createdEventId: string | undefined = result?.event_id;

      if (!createdEventId) {
        router.push('/manage');
        return;
      }

      const isFestEvent = dataFromHookForm.festEvent && dataFromHookForm.festEvent !== "none";
      const { enabled: approvalEnabled, stages: approvalStages } = approvalConfigRef.current;
      const opConfig = operationalConfigRef.current;

      // For standalone events: submit blocking approval record first
      if (!isFestEvent && approvalEnabled) {
        try {
          await fetchWithTimeout(`${API_URL}/api/approvals`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token!}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              itemId: createdEventId,
              type: "event",
              customStages: approvalStages.filter(s => s.blocking),
              budgetItems: approvalConfigRef.current.budgetItems,
            }),
          }, 30000);
        } catch {
          // Non-critical
        }
      }

      // Attach operational stages (both fest and standalone)
      const operationalStages = buildOperationalStages(opConfig);
      if (operationalStages.length > 0) {
        try {
          await fetch(`${API_URL}/api/approvals/${createdEventId}/operational`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token!}`, "Content-Type": "application/json" },
            body: JSON.stringify({ operationalStages }),
          });
        } catch {
          // Non-critical
        }
      }

      // Student organisers publish directly under their fest — no approval redirect
      if (isStudentOrganiser) {
        router.push('/manage');
        return;
      }

      // Redirect to approval status page (or manage if no approval)
      if (isFestEvent || approvalEnabled) {
        router.push(`/approvals/${createdEventId}?type=event`);
      } else {
        router.push('/manage');
      }
    } catch (error: any) {
      alert(`Failed to ${saveAsDraft ? "save draft" : "create event"}. ${error?.message || "An unknown error occurred."}`);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateEvent: SubmitHandler<EventFormData> = async (data) => submitEvent(data, false);
  const handleSaveDraft: SubmitHandler<EventFormData> = async (data) => submitEvent(data, true);

  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Loading event form...</div>}>
      <EventForm
        onSubmit={handleCreateEvent}
        onSubmitDraft={handleSaveDraft}
        isSubmittingProp={isSubmitting}
        isEditMode={false}
        existingImageFileUrl={null}
        existingBannerFileUrl={null}
        existingPdfFileUrl={null}
        onApprovalConfigChange={(enabled, stages, budgetItems) => {
          approvalConfigRef.current = { enabled, stages, budgetItems };
        }}
        onOperationalConfigChange={(config) => {
          operationalConfigRef.current = config;
        }}
      />
    </Suspense>
  );
}

function buildOperationalStages(config: OperationalConfig) {
  const map: { role: string; label: string; request_data: Record<string, unknown> }[] = [
    { role: "it",       label: "IT Support",      request_data: config.it as unknown as Record<string, unknown> },
    { role: "venue",    label: "Venue",            request_data: config.venue as unknown as Record<string, unknown> },
    { role: "catering", label: "Catering",         request_data: config.catering as unknown as Record<string, unknown> },
    { role: "stalls",   label: "Stalls",           request_data: config.stalls as unknown as Record<string, unknown> },
  ];
  return map.filter(s => (s.request_data as any).enabled);
}
