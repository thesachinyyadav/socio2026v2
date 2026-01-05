"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import moment from "moment";
import EventForm from "@/app/_components/Admin/ManageEvent";
import {
  EventFormData,
  departments as departmentOptions,
  ScheduleItem as ScheduleItemType,
} from "@/app/lib/eventFormSchema";
import { SubmitHandler } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";

export default function EditEventPage() {
  const { session, userData, isLoading: authIsLoading } = useAuth();
  const [initialData, setInitialData] = useState<
    Partial<EventFormData> | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [existingImageFileUrl, setExistingImageFileUrl] = useState<
    string | null
  >(null);
  const [existingBannerFileUrl, setExistingBannerFileUrl] = useState<
    string | null
  >(null);
  const [existingPdfFileUrl, setExistingPdfFileUrl] = useState<string | null>(
    null
  );

  const params = useParams();
  const eventIdSlug = params?.id as string;
  const router = useRouter();

  useEffect(() => {
    if (authIsLoading) return;

    if (!session) {
      setIsLoading(false);
      setErrorMessage("You must be logged in to edit an event.");
      return;
    }

    if (!userData || !(userData.is_organiser || (userData as any).is_admin)) {
      setIsLoading(false);
      setErrorMessage("You are not authorized to edit this event.");
      return;
    }

    if (!eventIdSlug) {
      setIsLoading(false);
      setErrorMessage("Event ID (slug) is missing from URL.");
      return;
    }

    async function fetchEventData() {
      setIsLoading(true);
      setErrorMessage(null);
      let response: Response | undefined = undefined;
      try {
        response = await fetch(
          `http://localhost:8000/api/events/${eventIdSlug}`
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

          const transformedData: Partial<EventFormData> = {
            eventTitle: data.title || "",
            eventDate: data.event_date
              ? moment.utc(data.event_date).format("YYYY-MM-DD") // Use moment.utc for consistency
              : "",
            endDate: data.end_date
              ? moment.utc(data.end_date).format("YYYY-MM-DD")
              : "",
            eventTime: formEventTimeString,
            detailedDescription: data.description || "",
            department: parsedDepartments,
            category: data.category || "",
            organizingDept: data.organizing_dept || "",
            festEvent: data.fest || "none",
            registrationDeadline: data.registration_deadline
              ? moment.utc(data.registration_deadline).format("YYYY-MM-DD")
              : "",
            location: data.venue || "",
            registrationFee: data.registration_fee?.toString() ?? "0",
            maxParticipants: data.participants_per_team?.toString() ?? "1",
            contactEmail: data.organizer_email || "",
            contactPhone: data.organizer_phone?.toString() ?? "",
            whatsappLink: data.whatsapp_invite_link || "",
            provideClaims: data.claims_applicable || false,
            scheduleItems: transformScheduleForForm(data.schedule),
            rules: transformSimpleListForForm(data.rules),
            prizes: transformSimpleListForForm(data.prizes),
            imageFile: null, // Always null initially for form, URL is separate
            bannerFile: null,
            pdfFile: null,
          };

          setInitialData(transformedData);
          setExistingImageFileUrl(data.event_image_url || null);
          setExistingBannerFileUrl(data.banner_url || null);
          setExistingPdfFileUrl(data.pdf_url || null);
        } else {
          setErrorMessage("Event data not found in API response.");
          setInitialData(undefined);
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
      } finally {
        setIsLoading(false);
      }
    }

    fetchEventData();
  }, [eventIdSlug, session, userData, authIsLoading, router]); // Added router to dependencies if used inside

  const handleUpdateEvent: SubmitHandler<EventFormData> = async (formData) => {
    if (!session) {
      setErrorMessage(
        "Authentication session expired or not found. Please log in again."
      );
      setIsSubmitting(false);
      throw new Error("Authentication session expired or not found."); // Ensure EventForm knows
    }
    if (!userData || !(userData.is_organiser || (userData as any).is_admin)) {
      setErrorMessage("You are not authorized to perform this action.");
      setIsSubmitting(false);
      throw new Error("Not authorized."); // Ensure EventForm knows
    }

    setIsSubmitting(true);
    setErrorMessage(null); // Clear previous page-level errors on new submission

    const payload = new FormData();

    payload.append("eventTitle", formData.eventTitle);
    payload.append("eventDate", formData.eventDate || "");
    payload.append("endDate", formData.endDate || "");
    payload.append("eventTime", formData.eventTime || "");
    payload.append("detailedDescription", formData.detailedDescription);
    payload.append("category", formData.category);
    payload.append("organizingDept", formData.organizingDept || "");
    payload.append("festEvent", formData.festEvent || "none");
    payload.append("registrationDeadline", formData.registrationDeadline || "");
    payload.append("location", formData.location);
    payload.append("registrationFee", formData.registrationFee || "0");
    payload.append("maxParticipants", formData.maxParticipants || "1");
    payload.append("contactEmail", formData.contactEmail);
    payload.append("contactPhone", formData.contactPhone || "");
    payload.append("whatsappLink", formData.whatsappLink || "");
    payload.append("provideClaims", String(formData.provideClaims));

    payload.append("department", JSON.stringify(formData.department || []));
    payload.append(
      "scheduleItems",
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

    if (formData.imageFile instanceof File)
      payload.append("imageFile", formData.imageFile);
    if (formData.bannerFile instanceof File)
      payload.append("bannerFile", formData.bannerFile);
    if (formData.pdfFile instanceof File)
      payload.append("pdfFile", formData.pdfFile);

    if (!(formData.imageFile instanceof File) && existingImageFileUrl) {
      payload.append("existingImageFileUrl", existingImageFileUrl);
    } else if (formData.imageFile === null && existingImageFileUrl) {
      payload.append("removeImageFile", "true");
    }

    if (!(formData.bannerFile instanceof File) && existingBannerFileUrl) {
      payload.append("existingBannerFileUrl", existingBannerFileUrl);
    } else if (formData.bannerFile === null && existingBannerFileUrl) {
      payload.append("removeBannerFile", "true");
    }

    if (!(formData.pdfFile instanceof File) && existingPdfFileUrl) {
      payload.append("existingPdfFileUrl", existingPdfFileUrl);
    } else if (formData.pdfFile === null && existingPdfFileUrl) {
      payload.append("removePdfFile", "true");
    }

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
        `http://localhost:8000/api/events/${eventIdSlug}`,
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
        setErrorMessage(`Update error: ${apiErrorMsg}`);
        throw new Error(apiErrorMsg);
      }

      try {
        const resultJson = JSON.parse(resultText);
        if (resultJson.event) {
          setExistingImageFileUrl(resultJson.event.event_image_url || null);
          setExistingBannerFileUrl(resultJson.event.banner_url || null);
          setExistingPdfFileUrl(resultJson.event.pdf_url || null);
        }
      } catch (e) {
        console.warn(
          "Could not parse update response as JSON, or event data missing in response."
        );
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

  if (authIsLoading || (isLoading && !initialData && !errorMessage)) {
    return (
      <div className="p-8 text-center text-lg font-semibold">
        Loading event data...
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
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Back to Manage Events
        </button>
      </div>
    );
  }

  return initialData &&
    session &&
    userData &&
    (userData.is_organiser || (userData as any).is_admin) ? (
    <>
      {errorMessage && !isSubmitting && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-12 pt-4">
          <div className="p-4 my-2 text-sm text-red-700 bg-red-100 border border-red-400 rounded text-center">
            <strong>Update Error:</strong> {errorMessage}
          </div>
        </div>
      )}
      <EventForm
        onSubmit={handleUpdateEvent}
        defaultValues={initialData}
        isSubmittingProp={isSubmitting}
        isEditMode={true}
        existingImageFileUrl={existingImageFileUrl}
        existingBannerFileUrl={existingBannerFileUrl}
        existingPdfFileUrl={existingPdfFileUrl}
      />
    </>
  ) : (
    <div className="p-8 text-center">
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
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        {!session ? "Go to Login" : "Back to Manage Events"}
      </button>
    </div>
  );
}
