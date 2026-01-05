"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface DisplayableEvent {
  id: string;
  event_id: string;
  name: string;
  date: string;
  department: string;
  status: "upcoming" | "completed";
}

interface FetchedUserEvent {
  id: string;
  event_id?: string;
  name: string;
  date: string;
  department: string;
}

interface Student {
  name: string;
  registerNumber: string;
  course: string;
  department: string;
  campus: string;
  email: string;
  profilePicture: string;
  joined: string;
  registeredEvents: number;
}

interface UserData {
  name?: string;
  register_number?: string | number;
  email?: string;
  course?: string;
  department?: string;
  campus?: string;
  created_at?: string;
  avatar_url?: string;
  is_organiser?: boolean;
}

const StudentProfile = () => {
  const { userData, signOut } = useAuth();

  const [student, setStudent] = useState<Student>({
    name: "",
    registerNumber: "",
    course: "",
    department: "",
    campus: "",
    email: "",
    profilePicture: "",
    joined: "",
    registeredEvents: 0,
  });

  const [registeredEventsList, setRegisteredEventsList] = useState<
    DisplayableEvent[]
  >([]);
  const [isLoadingRegisteredEvents, setIsLoadingRegisteredEvents] =
    useState(true);

  useEffect(() => {
    if (userData) {
      const createdDate = userData.created_at
        ? new Date(userData.created_at)
        : new Date();
      const joinedFormatted = createdDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      setStudent((prevState) => ({
        ...prevState,
        name: userData.name || "Student",
        registerNumber: String(userData.register_number || ""),
        email: userData.email || "",
        course: userData.course || "Not specified",
        department: userData.department || "Not specified",
        campus: userData.campus || "Not specified",
        joined: joinedFormatted,
        profilePicture: userData.avatar_url || "",
      }));

      // Fetch registered events if possible
      const fetchRegisteredEvents = async () => {
        setIsLoadingRegisteredEvents(true);
        try {
          // Check if we have a registration number
          if (!userData.register_number) {
            console.warn("No registration number available for this user.");
            setRegisteredEventsList([]);
            setStudent((prevState) => ({ ...prevState, registeredEvents: 0 }));
            setIsLoadingRegisteredEvents(false);
            return;
          }

          const response = await fetch(
            `http://localhost:8000/api/registrations/user/${userData.register_number}/events`
          );
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data: { events: FetchedUserEvent[] } = await response.json();

          const displayableEvents = data.events.map(
            (event: FetchedUserEvent) => {
              const eventDateObj = new Date(event.date);
              const formattedDate = eventDateObj.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              });

              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const eventDay = new Date(eventDateObj);
              eventDay.setHours(0, 0, 0, 0);

              let eventStatus: "upcoming" | "completed";
              if (eventDay < today) {
                eventStatus = "completed";
              } else {
                eventStatus = "upcoming";
              }

              return {
                id: event.id,
                event_id: event.event_id || event.id, // fallback to id if event_id not available
                name: event.name,
                date: formattedDate,
                department: event.department,
                status: eventStatus,
              };
            }
          );

          setRegisteredEventsList(displayableEvents);
          setStudent((prevState) => ({
            ...prevState,
            registeredEvents: displayableEvents.length,
          }));
        } catch (error) {
          console.error("Failed to fetch registered events:", error);
          setRegisteredEventsList([]);
          setStudent((prevState) => ({ ...prevState, registeredEvents: 0 }));
        } finally {
          setIsLoadingRegisteredEvents(false);
        }
      };

      fetchRegisteredEvents();
    }
  }, [userData]);

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/";
  };

  if (!userData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-[#063168] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <Link
            href="/Discover"
            className="flex items-center text-[#FFCC00] mb-4 sm:mb-6 hover:underline"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5 mr-2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back to Discovery
          </Link>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
            Student Profile
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-4 py-6 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
              <div className="bg-[#063168] p-6 sm:p-8 flex flex-col items-center relative">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white mb-4 border-2 border-gray-200">
                  <div
                    className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center overflow-hidden"
                    style={{
                      backgroundImage: `url(${student.profilePicture})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {!student.profilePicture && (
                      <span className="text-3xl text-gray-500">?</span>
                    )}
                  </div>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  {student.name}
                </h2>
                <p className="text-gray-200 text-xs sm:text-sm">
                  {student.registerNumber}
                </p>
              </div>

              <div className="p-4 sm:p-6">
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <h3 className="text-xs sm:text-sm font-medium text-gray-500">
                      Course
                    </h3>
                    <p className="text-sm sm:text-base text-gray-800 font-medium">
                      {student.course}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-medium text-gray-500">
                      Department
                    </h3>
                    <p className="text-sm sm:text-base text-gray-800 font-medium">
                      {student.department}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-medium text-gray-500">
                      Campus
                    </h3>
                    <p className="text-sm sm:text-base text-gray-800 font-medium">
                      {student.campus}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-medium text-gray-500">
                      Email
                    </h3>
                    <p className="text-sm sm:text-base text-gray-800 font-medium break-words">
                      {student.email}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-medium text-gray-500">
                      Joined
                    </h3>
                    <p className="text-sm sm:text-base text-gray-800 font-medium">
                      {student.joined}
                    </p>
                  </div>
                  {userData.is_organiser && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">
                        Role
                      </h3>
                      <p className="text-gray-800 font-medium bg-blue-100 px-2 py-1 rounded-full text-xs inline-block mt-1">
                        Organiser
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-6 border-t border-gray-200">
                <button
                  onClick={handleLogout}
                  className="w-full bg-red-500 hover:bg-[#FF3C45] text-white rounded-full px-4 py-2.5 font-medium text-sm sm:text-base flex items-center justify-center cursor-pointer transition-colors duration-150"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-6 md:space-y-8">
            <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
              <div className="flex items-center p-4 sm:p-6">
                <div className="bg-[#063168] text-white rounded-lg w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center mr-3 sm:mr-3 flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 sm:w-6 sm:h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                    />
                  </svg>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[#063168]">
                  Registered Events ({student.registeredEvents})
                </h2>
              </div>

              <div className="p-4 sm:p-6 pt-0 sm:pt-2">
                <div className="space-y-3 sm:space-y-4">
                  {isLoadingRegisteredEvents ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      Loading registered events...
                    </p>
                  ) : registeredEventsList.length > 0 ? (
                    registeredEventsList.map((event) => (
                      <div
                        key={event.id}
                        className="flex flex-col sm:flex-row bg-white items-start sm:items-center rounded-xl p-3 sm:p-4 transition-all border-2 border-gray-200 cursor-pointer"
                      >
                        <div
                          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center mb-2 sm:mb-0 sm:mr-4 ${
                            event.status === "upcoming"
                              ? "bg-blue-100 text-[#154CB3]"
                              : "bg-green-100 text-green-700"
                          } flex-shrink-0`}
                        >
                          {event.status === "upcoming" ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="w-5 h-5 sm:w-6 sm:h-6"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="w-5 h-5 sm:w-6 sm:h-6"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.5 12.75l6 6 9-13.5"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link href={`/event/${event.event_id}`}>
                            <h3
                              className={`font-semibold ${
                                event.status === "upcoming"
                                  ? "text-[#154CB3]"
                                  : "text-green-700"
                              } hover:underline text-sm sm:text-base truncate`}
                            >
                              {event.name}
                            </h3>
                          </Link>
                          <div className="flex flex-wrap text-xs sm:text-sm text-gray-500 mt-1">
                            <span>{event.date}</span>
                            <span className="mx-2 hidden sm:inline">•</span>
                            <span className="block sm:hidden w-full mt-0.5"></span>{" "}
                            <span className="truncate">{event.department}</span>
                          </div>
                        </div>
                        <div className="mt-2 sm:mt-0 ml-0 sm:ml-2 self-start sm:self-center">
                          <span
                            className={`text-xs font-medium px-2 sm:px-3 py-1 rounded-full ${
                              event.status === "upcoming"
                                ? "bg-blue-100 text-[#154CB3]"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {event.status.charAt(0).toUpperCase() +
                              event.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No events registered.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
