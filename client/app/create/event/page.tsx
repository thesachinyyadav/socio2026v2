"use client";
import React, { useState } from "react";
import EventForm from "@/app/_components/Admin/ManageEvent";
import { EventFormData } from "@/app/lib/eventFormSchema";
import { SubmitHandler } from "react-hook-form";
import { createBrowserClient } from "@supabase/ssr";

export default function CreateEventPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleCreateEvent: SubmitHandler<EventFormData> = async (
    dataFromHookForm
  ) => {
    console.log(
      "CreateEventPage: handleCreateEvent CALLED. Data:",
      JSON.stringify(dataFromHookForm, null, 2)
    );

    setIsSubmitting(true);

    let token;
    let userEmail: string | undefined;
    try {
      console.log("CreateEventPage: Attempting to get session...");
      
      // First, try to refresh the session to ensure we have a valid token
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.warn("CreateEventPage: Session refresh failed, trying to get existing session:", refreshError);
      }
      
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error(
          "CreateEventPage: Session error or no session.",
          sessionError
        );
        alert("Authentication error or no active session. Please log in again.");
        setIsSubmitting(false);
        // Redirect to auth page
        window.location.href = '/auth';
        return;
      }
      
      token = session.access_token;
      userEmail = session.user.email;
      console.log("CreateEventPage: Session obtained, token acquired.");
      
      // Verify token is not expired
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (tokenPayload.exp <= currentTime) {
        console.error("CreateEventPage: Token has expired");
        alert("Your session has expired. Please log in again.");
        setIsSubmitting(false);
        window.location.href = '/auth';
        return;
      }
      
    } catch (e: any) {
      console.error("CreateEventPage: Unexpected error getting session:", e);
      alert(
        "An unexpected error occurred while verifying your session. Please log in again."
      );
      setIsSubmitting(false);
      window.location.href = '/auth';
      return;
    }

    const formData = new FormData();

    const appendIfExists = (key: string, value: any) => {
      if (
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
      ) {
        formData.append(key, String(value));
      }
    };

    const appendJsonArrayOrObject = (key: string, value: any) => {
      if (Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
      } else if (
        typeof value === "object" &&
        value !== null &&
        Object.keys(value).length > 0
      ) {
        formData.append(key, JSON.stringify(value));
      }
    };

    appendIfExists("title", dataFromHookForm.eventTitle);
    appendIfExists("event_date", dataFromHookForm.eventDate);
    appendIfExists("end_date", dataFromHookForm.endDate);
    appendIfExists("event_time", dataFromHookForm.eventTime);
    appendIfExists("description", dataFromHookForm.detailedDescription);

    appendIfExists("organizing_dept", dataFromHookForm.organizingDept);

    appendJsonArrayOrObject("department_access", dataFromHookForm.department);

    appendIfExists("category", dataFromHookForm.category);
    appendIfExists("fest", dataFromHookForm.festEvent);
    appendIfExists(
      "registration_deadline",
      dataFromHookForm.registrationDeadline
    );
    appendIfExists("venue", dataFromHookForm.location);

    appendIfExists("registration_fee", dataFromHookForm.registrationFee);
    appendIfExists("max_participants", dataFromHookForm.maxParticipants);

    appendIfExists("organizer_email", dataFromHookForm.contactEmail);
    appendIfExists("organizer_phone", dataFromHookForm.contactPhone);
    appendIfExists("whatsapp_invite_link", dataFromHookForm.whatsappLink);

    formData.append("claims_applicable", String(dataFromHookForm.provideClaims));
    formData.append(
      "send_notifications",
      String(dataFromHookForm.sendNotifications)
    );

    appendJsonArrayOrObject("schedule", dataFromHookForm.scheduleItems);
    appendJsonArrayOrObject("rules", dataFromHookForm.rules);
    appendJsonArrayOrObject("prizes", dataFromHookForm.prizes);
    appendJsonArrayOrObject("event_heads", dataFromHookForm.eventHeads);
    appendIfExists("created_by", userEmail);

    const appendFile = (key: string, file: any) => {
      if (!file) {
        console.log(`Skipping ${key}: No file provided.`);
        return;
      }
      
      // Handle FileList (the native browser object)
      if (file instanceof FileList) {
        if (file.length > 0) {
          formData.append(key, file[0]);
          console.log(`✅ ${key}: ${file[0].name} (${file[0].size} bytes, ${file[0].type})`);
        } else {
          console.warn(`⚠️ ${key}: FileList is empty`);
        }
        return;
      }
      
      // Handle direct File object
      if (file instanceof File) {
        formData.append(key, file);
        console.log(`✅ ${key}: ${file.name} (${file.size} bytes, ${file.type})`);
        return;
      }
      
      // If we get here, something unexpected happened
      console.error(`❌ ${key}: Unexpected type`, typeof file, file);
    };

    appendFile("eventImage", dataFromHookForm.imageFile);
    appendFile("bannerImage", dataFromHookForm.bannerFile);
    appendFile("pdfFile", dataFromHookForm.pdfFile);

    console.log("CreateEventPage: FormData prepared. Content snapshot:");
    console.log("=== RAW FORM DATA BEFORE SENDING ===");
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(
          `  ${key}: [FILE] ${value.name}, ${value.type}, ${value.size} bytes`
        );
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
    console.log("=== END FORM DATA ===");
    console.log(`CreateEventPage: API_URL is: ${API_URL}`);

    try {
      console.log(`CreateEventPage: Initiating fetch to ${API_URL}/api/events`);
      const response = await fetch(`${API_URL}/api/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      console.log(
        "CreateEventPage: Fetch responded. Status:",
        response.status,
        "Ok:",
        response.ok
      );

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          const responseText = await response.text();
          console.error(
            "CreateEventPage: Failed to parse error response JSON. Raw text:",
            responseText
          );
          errorData = {
            error: "Failed to parse error response from server.",
            details: `Status: ${response.status}, StatusText: ${response.statusText}. Response body: ${responseText}`,
          };
        }
        console.error("CreateEventPage: API Error Data:", errorData);
        const message =
          errorData.error ||
          errorData.message ||
          (typeof errorData.details === "string" ? errorData.details : null) ||
          errorData.detail ||
          `Server error: ${response.status} ${response.statusText}`;
        throw new Error(message);
      }

      const result = await response.json();
      console.log(
        "CreateEventPage: Event created successfully via API:",
        result
      );
    } catch (error: any) {
      console.error(
        "CreateEventPage: Error during event creation fetch/processing:",
        error.message,
        error
      );
      alert(
        `Failed to create event. ${
          error?.message || "An unknown error occurred."
        }`
      );
      throw error;
    } finally {
      console.log("CreateEventPage: handleCreateEvent FINALLY block.");
      setIsSubmitting(false);
    }
  };

  return (
    <EventForm
      onSubmit={handleCreateEvent}
      isSubmittingProp={isSubmitting}
      isEditMode={false}
      existingImageFileUrl={null}
      existingBannerFileUrl={null}
      existingPdfFileUrl={null}
    />
  );
}
