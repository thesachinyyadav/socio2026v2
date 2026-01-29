"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useEvents,
  FetchedEvent as ContextFetchedEvent,
} from "../../../../context/EventContext";
import { useAuth } from "../../../../context/AuthContext";
import { QRCodeDisplay } from "../../../_components/QRCodeDisplay";
import { dayjs } from "@/lib/dateUtils";

interface Teammate {
  name: string;
  registerNumber: string;
  email: string;
}

interface FormErrors {
  teamName?: string;
  teammates: Array<{
    name?: string;
    registerNumber?: string;
    email?: string;
  }>;
}

const Page = () => {
  const routeParams = useParams();
  const router = useRouter();
  const { userData, isLoading: authIsLoading } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const { allEvents, isLoading: contextIsLoading, error: contextError } = useEvents();
  const eventId = routeParams?.id;

  // State
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventPageError, setEventPageError] = useState<string | null>(null);

  const [isIndividualEvent, setIsIndividualEvent] = useState(false);
  const [maxTeammates, setMaxTeammates] = useState(1);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [formData, setFormData] = useState<{
    teamName: string;
    teammates: Teammate[];
  }>({
    teamName: "",
    teammates: [{ name: "", registerNumber: "", email: "" }],
  });
  const [errors, setErrors] = useState<FormErrors>({
    teamName: "",
    teammates: [{}],
  });
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!eventId) {
      setEventPageError("Event ID is missing or invalid.");
      setEventLoading(false);
      return;
    }
    if (contextIsLoading) {
      setEventLoading(true);
      return;
    }
    if (contextError) {
      setEventPageError(contextError);
      setSelectedEvent(null);
      setEventLoading(false);
      return;
    }
    if (allEvents.length > 0) {
      const foundEvent = allEvents.find((e) => e.event_id === eventId);
      if (foundEvent) {
        setSelectedEvent(foundEvent);
        setEventPageError(null);
        const teamSize = foundEvent.participants_per_team ?? 1;
        setMaxTeammates(teamSize);
        setIsIndividualEvent(teamSize <= 1);
      } else {
        setSelectedEvent(null);
        setEventPageError(`Event with ID "${eventId}" not found.`);
      }
      setEventLoading(false);
    }
  }, [eventId, allEvents, contextIsLoading, contextError]);

  useEffect(() => {
    if (selectedEvent && !authIsLoading && userData) {
      const teamSize = selectedEvent.participants_per_team ?? 1;
      const individual = teamSize <= 1;

      const firstTeammateData: Teammate = {
        name: userData.name || "",
        registerNumber:
          userData.register_number != null
            ? String(userData.register_number)
            : "",
        email: userData.email || "",
      };

      const initialTeammates: Teammate[] = [];
      const initialErrorsTeammates: FormErrors["teammates"] = [];

      initialTeammates.push({ ...firstTeammateData });
      initialErrorsTeammates.push({});

      if (!individual) {
        for (let i = 1; i < teamSize; i++) {
          initialTeammates.push({ name: "", registerNumber: "", email: "" });
          initialErrorsTeammates.push({ registerNumber: "" });
        }
      }

      setFormData((prev) => ({
        teamName: individual ? "" : prev.teamName,
        teammates: initialTeammates,
      }));
      setErrors((prev) => ({
        teamName: individual ? "" : prev.teamName,
        teammates: initialErrorsTeammates,
      }));
    }
  }, [selectedEvent, userData, authIsLoading]);

  const validateField = (
    field: keyof Teammate | "teamName",
    value: string,
    index?: number
  ): string => {
    let error = "";
    const trimmedValue = typeof value === "string" ? value.trim() : "";

    if (!trimmedValue) {
      const isFirstTeammate = index === 0;
      if (
        (field === "name" || field === "email") &&
        typeof index === "number" &&
        !isFirstTeammate
      ) {
      } else {
        error = "This field is required";
      }
    } else if (field === "registerNumber" && !/^\d{7}$/.test(trimmedValue)) {
      error = "Register number must be exactly 7 digits";
    } else if (
      field === "email" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)
    ) {
      error = "Invalid email format";
    }
    return error;
  };

  const handleTeamNameChange = (value: string) => {
    setFormData({ ...formData, teamName: value });
    if (errors.teamName || value.trim()) {
      setErrors((prev) => ({
        ...prev,
        teamName: validateField("teamName", value),
      }));
    }
  };

  const handleTeammateChange = (
    index: number,
    field: keyof Teammate,
    value: string
  ) => {
    const updatedTeammates = [...formData.teammates];
    updatedTeammates[index] = {
      ...updatedTeammates[index],
      [field]: value,
    };
    setFormData({ ...formData, teammates: updatedTeammates });

    if (errors.teammates[index]?.[field] || value.trim()) {
      const newTeammateErrors = [...errors.teammates];
      newTeammateErrors[index] = {
        ...newTeammateErrors[index],
        [field]: validateField(field, value, index),
      };
      setErrors((prev) => ({ ...prev, teammates: newTeammateErrors }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistrationError(null);

    let hasErrors = false;
    const newErrors: FormErrors = {
      teamName: "",
      teammates: formData.teammates.map(() => ({})),
    };

    if (!isIndividualEvent) {
      const teamNameError = validateField("teamName", formData.teamName);
      if (teamNameError) {
        newErrors.teamName = teamNameError;
        hasErrors = true;
      }
    }

    formData.teammates.forEach((teammate, i) => {
      const currentTeammateErrors: FormErrors["teammates"][0] = {};
      const fieldsToValidate: (keyof Teammate)[] = ["registerNumber"];

      if (i === 0) {
        fieldsToValidate.push("name", "email");
      }

      fieldsToValidate.forEach((field) => {
        const value = teammate[field];
        const error = validateField(field, value, i);
        if (error) {
          currentTeammateErrors[field] = error;
          hasErrors = true;
        }
      });
      newErrors.teammates[i] = currentTeammateErrors;
    });

    const registerNumberUsage = new Map<string, number[]>();
    formData.teammates.forEach((teammate, index) => {
      const regNum = teammate.registerNumber.trim();

      if (regNum && !newErrors.teammates[index]?.registerNumber) {
        if (!registerNumberUsage.has(regNum)) {
          registerNumberUsage.set(regNum, []);
        }
        registerNumberUsage.get(regNum)!.push(index);
      }
    });

    registerNumberUsage.forEach((indices, regNum) => {
      if (indices.length > 1) {
        indices.forEach((dupIndex) => {
          if (!newErrors.teammates[dupIndex].registerNumber) {
            newErrors.teammates[dupIndex].registerNumber =
              "Register number must be unique.";
            hasErrors = true;
          }
        });
      }
    });

    setErrors(newErrors);

    if (!hasErrors && selectedEvent?.event_id) {
      setSubmitLoading(true);

      const payload = {
        eventId: selectedEvent.event_id,
        teamName: isIndividualEvent ? null : formData.teamName.trim() || null,
        teammates: formData.teammates.map((tm) => ({
          name: tm.name.trim(),
          registerNumber: tm.registerNumber.trim(),
          email: tm.email.trim(),
        })),
      };

      try {
        const response = await fetch(`${API_URL}/api/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        setSubmitLoading(false);

        if (response.ok) {
          const responseData = await response.json();
          setRegistrationId(responseData.registration?.registration_id || null);
          setShowSuccessMessage(true);
        } else {
          const errorData = await response.json();
          setRegistrationError(
            errorData.error ||
              errorData.message ||
              "Registration failed. Please try again."
          );
          console.error("Registration failed:", errorData);
        }
      } catch (error) {
        setSubmitLoading(false);
        setRegistrationError(
          "An unexpected error occurred. Please check your connection and try again."
        );
        console.error(
          "Network or unexpected error during registration:",
          error
        );
      }
    } else if (!selectedEvent?.event_id) {
      setRegistrationError(
        "Cannot submit registration: Event details are missing."
      );
    }
  };

  if (eventLoading || authIsLoading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <svg
          className="animate-spin h-8 w-8 text-[#063168]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    );
  }

  if (eventPageError || !selectedEvent || (!authIsLoading && !userData)) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[80vh] text-center px-4">
        <p className="text-xl text-red-500">
          {eventPageError ||
            (!selectedEvent
              ? "Could not load event details."
              : "Access denied or session expired. Please log in.")}
        </p>
        <Link
          href="/"
          className="mt-4 bg-[#063168] text-white py-2 px-4 rounded hover:bg-[#154CB3]"
        >
          Go to Homepage
        </Link>
      </div>
    );
  }

  if (showSuccessMessage) {
    return (
      <div>
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="bg-white p-6 sm:p-8 rounded-xl border-2 border-gray-200 text-center w-full max-w-md shadow-lg">
            <div className="bg-green-100 text-green-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-4">
              Registration successful!
            </h2>
            <p className="text-gray-600 mb-6">
              You have successfully registered for {selectedEvent.title}.
            </p>

            {/* QR Code Section */}
            {registrationId && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-[#154CB3] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 16h4m-4-4h4m-4-4v1m0 0h-1m1-1V8a5 5 0 00-10 0v.01M8 7a3 3 0 016 0v.01M12 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-blue-800">Your Event Ticket</h3>
                </div>
                <p className="text-sm text-blue-700 mb-4">
                  Your QR code ticket has been generated! Show this QR code at the event entrance for instant attendance marking.
                </p>
                <button
                  onClick={() => setShowQRCode(true)}
                  className="w-full bg-[#154CB3] text-white py-2 px-4 rounded-lg hover:bg-[#154cb3df] transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 16h4m-4-4h4m-4-4v1m0 0h-1m1-1V8a5 5 0 00-10 0v.01M8 7a3 3 0 016 0v.01M12 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  View QR Code Ticket
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-around gap-3">
              <Link href={`/Discover`} className="w-full sm:w-auto">
                <button className="w-full bg-[#154CB3] text-white py-2 px-6 rounded-full font-medium hover:bg-[#154cb3eb] transition-colors">
                  Back to Discover
                </button>
              </Link>
              {selectedEvent.whatsapp_invite_link && (
                <a
                  href={selectedEvent.whatsapp_invite_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <button className="w-full bg-green-200 text-green-600 py-2 px-6 rounded-full font-medium hover:bg-green-300 transition-colors flex items-center justify-center gap-2">
                    Join Whatsapp Group
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                      />
                    </svg>
                  </button>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* QR Code Display Modal */}
        {showQRCode && registrationId && (
          <QRCodeDisplay
            registrationId={registrationId}
            eventTitle={selectedEvent.title}
            participantName={
              isIndividualEvent
                ? (userData?.name || "Participant")
                : (formData.teamName || "Team")
            }
            onClose={() => setShowQRCode(false)}
          />
        )}
      </div>
    );
  }

  const registrationFee =
    selectedEvent.registration_fee != null && selectedEvent.registration_fee > 0
      ? `₹${selectedEvent.registration_fee}`
      : "Free";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#063168] text-white p-4 md:p-10">
        <div className="max-w-6xl mx-auto">
          <Link
            href={`/event/${eventId}`}
            className="flex items-center text-[#FFCC00] mb-4 hover:underline text-sm sm:text-base"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4 md:w-5 md:h-5 mr-1"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back to event
          </Link>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
            {selectedEvent.title || "Event Registration"}
          </h1>
          <p className="text-sm sm:text-lg text-gray-200 mt-1">
            {selectedEvent.organizing_dept || "Department"}
          </p>
          <p className="text-xs sm:text-sm text-gray-300 mt-2">
            {isIndividualEvent
              ? "Individual Event"
              : `Team Event (Up to ${maxTeammates} members)`}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-10">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4 sm:p-6 md:p-8 shadow-md">
          <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-4 sm:mb-6">
            Registration Form
          </h2>

          {selectedEvent.registration_fee != null &&
            selectedEvent.registration_fee > 0 && (
              <div className="mb-6 flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="bg-[#FFCC00] rounded-full w-10 h-10 flex items-center justify-center mr-3 flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6 text-black"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-800 font-medium">
                    Registration Fee: {registrationFee}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Payment will be collected at the venue (if applicable).
                  </p>
                </div>
              </div>
            )}

          {registrationError && (
            <div className="mb-6 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md text-sm">
              <p className="font-semibold">Registration Error:</p>
              <p>{registrationError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {!isIndividualEvent && (
              <div className="mb-6 sm:mb-8">
                <label
                  htmlFor="teamName"
                  className="block mb-2 text-sm sm:text-base font-bold text-[#063168]"
                >
                  Team name: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="teamName"
                  value={formData.teamName}
                  onChange={(e) => handleTeamNameChange(e.target.value)}
                  onBlur={() =>
                    setErrors((prev) => ({
                      ...prev,
                      teamName: validateField("teamName", formData.teamName),
                    }))
                  }
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg border ${
                    errors.teamName ? "border-red-500" : "border-gray-300"
                  } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent`}
                  placeholder="Enter team name..."
                />
                {errors.teamName && (
                  <p className="text-red-500 text-xs sm:text-sm mt-1">
                    {errors.teamName}
                  </p>
                )}
              </div>
            )}

            {formData.teammates.map((teammate, index) => (
              <div
                key={index}
                className="mb-6 sm:mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50/50"
              >
                <div className="flex items-center mb-3 sm:mb-4">
                  <div className="bg-[#063168] text-white rounded-full w-7 h-7 flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="text-sm font-semibold">{index + 1}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[#063168]">
                    {isIndividualEvent && index === 0
                      ? "Participant Details"
                      : index === 0
                      ? "Participant 1 Details (Team Leader)"
                      : `Participant ${index + 1} Details:`}
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 md:gap-6">
                  {index === 0 && (
                    <>
                      <div>
                        <label
                          htmlFor={`name-${index}`}
                          className="block mb-1 sm:mb-2 text-xs sm:text-sm font-medium text-gray-700"
                        >
                          Name: <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id={`name-${index}`}
                          value={teammate.name}
                          onChange={(e) =>
                            handleTeammateChange(index, "name", e.target.value)
                          }
                          onBlur={() => {
                            const err = validateField(
                              "name",
                              teammate.name,
                              index
                            );
                            const newTeammateErrors = [...errors.teammates];
                            if (!newTeammateErrors[index])
                              newTeammateErrors[index] = {};
                            newTeammateErrors[index].name = err;
                            setErrors((prev) => ({
                              ...prev,
                              teammates: newTeammateErrors,
                            }));
                          }}
                          className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg border ${
                            errors.teammates[index]?.name
                              ? "border-red-500"
                              : "border-gray-300"
                          } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent bg-gray-100 cursor-not-allowed`}
                          placeholder="Enter name..."
                          disabled={true}
                        />
                        {errors.teammates[index]?.name && (
                          <p className="text-red-500 text-xs sm:text-sm mt-1">
                            {errors.teammates[index].name}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor={`email-${index}`}
                          className="block mb-1 sm:mb-2 text-xs sm:text-sm font-medium text-gray-700"
                        >
                          Email: <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          id={`email-${index}`}
                          value={teammate.email}
                          onChange={(e) =>
                            handleTeammateChange(index, "email", e.target.value)
                          }
                          onBlur={() => {
                            const err = validateField(
                              "email",
                              teammate.email,
                              index
                            );
                            const newTeammateErrors = [...errors.teammates];
                            if (!newTeammateErrors[index])
                              newTeammateErrors[index] = {};
                            newTeammateErrors[index].email = err;
                            setErrors((prev) => ({
                              ...prev,
                              teammates: newTeammateErrors,
                            }));
                          }}
                          className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg border ${
                            errors.teammates[index]?.email
                              ? "border-red-500"
                              : "border-gray-300"
                          } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent bg-gray-100 cursor-not-allowed`}
                          placeholder="Enter email..."
                          disabled={true}
                        />
                        {errors.teammates[index]?.email && (
                          <p className="text-red-500 text-xs sm:text-sm mt-1">
                            {errors.teammates[index].email}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  <div>
                    <label
                      htmlFor={`register-${index}`}
                      className="block mb-1 sm:mb-2 text-xs sm:text-sm font-medium text-gray-700"
                    >
                      Register number: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id={`register-${index}`}
                      value={teammate.registerNumber}
                      onChange={(e) =>
                        handleTeammateChange(
                          index,
                          "registerNumber",
                          e.target.value
                        )
                      }
                      onBlur={() => {
                        const err = validateField(
                          "registerNumber",
                          teammate.registerNumber,
                          index
                        );
                        const newTeammateErrors = [...errors.teammates];
                        if (!newTeammateErrors[index])
                          newTeammateErrors[index] = {};
                        newTeammateErrors[index].registerNumber = err;
                        setErrors((prev) => ({
                          ...prev,
                          teammates: newTeammateErrors,
                        }));
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg border ${
                        errors.teammates[index]?.registerNumber
                          ? "border-red-500"
                          : "border-gray-300"
                      } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent ${
                        index === 0 ? "bg-gray-100 cursor-not-allowed" : ""
                      }`}
                      placeholder="Enter 7-digit register number..."
                      disabled={index === 0}
                    />
                    {errors.teammates[index]?.registerNumber && (
                      <p className="text-red-500 text-xs sm:text-sm mt-1">
                        {errors.teammates[index].registerNumber}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center w-full sm:w-auto">
                <div className="bg-yellow-100 p-2 rounded-full mr-3 flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 text-yellow-700"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                    />
                  </svg>
                </div>
                <p className="text-xs sm:text-sm text-gray-600">
                  Make sure to bring your ID card to the venue.
                </p>
              </div>

              <div className="w-full sm:w-auto">
                <button
                  type="submit"
                  className="cursor-pointer w-full sm:w-auto bg-[#154CB3] text-white py-2.5 sm:py-3 px-6 sm:px-8 rounded-full font-semibold hover:bg-[#154cb3eb] transition-colors flex items-center justify-center shadow-md"
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    "Register Now"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="mt-6 sm:mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6">
          <div className="flex items-start">
            <div className="bg-blue-100 p-2 rounded-full mr-3 mt-1 flex-shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-blue-700"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-semibold text-[#063168] mb-2">
                Important Information
              </h4>
              <ul className="text-xs sm:text-sm text-gray-600 space-y-2">
                {selectedEvent.registration_deadline && (
                  <li>
                    • Registration closes on{" "}
                    {dayjs(selectedEvent.registration_deadline).format(
                      "MMM Do, YYYY"
                    )}
                    .
                  </li>
                )}
                {!isIndividualEvent && (
                  <li>• All team members must be present at the event.</li>
                )}
                {selectedEvent.organizer_email && (
                  <li>
                    • For any queries, contact: {selectedEvent.organizer_email}.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
