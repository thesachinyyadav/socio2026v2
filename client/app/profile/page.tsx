"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import LoadingIndicator from "../_components/UI/LoadingIndicator";
import CampusDetectionModal from "../_components/CampusDetectionModal";
import { QRCodeDisplay } from "../_components/QRCodeDisplay";

interface DisplayableEvent {
  id: string;
  registration_id: string;
  event_id: string;
  name: string;
  date: string;
  department: string;
  status: "upcoming" | "completed";
}

interface FetchedUserEvent {
  id: string;
  registration_id?: string;
  event_id?: string;
  name: string;
  date: string;
  department: string;
}

interface ActiveQR {
  registrationId: string;
  eventTitle: string;
}

interface RoleMatrixAssignmentSummary {
  role_code?: string;
  role_tag?: string;
  department_scope?: string | null;
  department_label?: string | null;
  campus_scope?: string | null;
}

interface Student {
  name: string;
  registerNumber: string;
  course: string;
  school: string;
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
  school?: string;
  department?: string;
  campus?: string;
  created_at?: string;
  avatar_url?: string;
  is_organiser?: boolean;
  is_support?: boolean;
  is_masteradmin?: boolean;
  is_hod?: boolean;
  is_dean?: boolean;
  is_cfo?: boolean;
  is_finance_officer?: boolean;
  is_finance_office?: boolean;
  is_organiser_student?: boolean;
  is_student_organiser?: boolean;
  is_student_organizer?: boolean;
  is_volunteer?: boolean;
  is_service_it?: boolean;
  is_it_service?: boolean;
  is_it?: boolean;
  is_service_venue?: boolean;
  is_venue_manager?: boolean;
  is_venue?: boolean;
  is_service_catering?: boolean;
  is_catering_vendors?: boolean;
  is_catering_vendor?: boolean;
  is_service_stalls?: boolean;
  is_stalls_misc?: boolean;
  is_stall_misc?: boolean;
  is_stalls?: boolean;
  is_service_security?: boolean;
  university_role?: string | null;
  role_codes?: string[];
  role_matrix_assignments?: RoleMatrixAssignmentSummary[];
  role_matrix_tags?: string[];
  role_matrix_department?: string | null;
  organization_type?: "christ_member" | "outsider";
}

const ROLE_CODE_PROFILE_LABELS: Record<string, string> = {
  MASTER_ADMIN: "Master Admin",
  HOD: "HOD",
  DEAN: "Dean",
  CFO: "CFO",
  ORGANIZER_TEACHER: "Organiser",
  ORGANIZER_STUDENT: "Student Organizer",
  ORGANIZER_VOLUNTEER: "Volunteer",
  SUPPORT: "Support",
  FINANCE_OFFICER: "Finance Officer",
  ACCOUNTS: "Accounts",
  SERVICE_IT: "IT",
  SERVICE_VENUE: "Venue",
  SERVICE_CATERING: "Catering",
  SERVICE_STALLS: "Stalls/Misc",
  SERVICE_SECURITY: "Security",
};

const UNIVERSITY_ROLE_TO_ROLE_CODES: Record<string, string[]> = {
  masteradmin: ["MASTER_ADMIN"],
  master_admin: ["MASTER_ADMIN"],
  support: ["SUPPORT"],
  organiser: ["ORGANIZER_TEACHER"],
  organizer: ["ORGANIZER_TEACHER"],
  organiser_teacher: ["ORGANIZER_TEACHER"],
  organizer_teacher: ["ORGANIZER_TEACHER"],
  hod: ["HOD"],
  dean: ["DEAN"],
  cfo: ["CFO", "ACCOUNTS"],
  finance_officer: ["FINANCE_OFFICER"],
  accounts: ["ACCOUNTS", "FINANCE_OFFICER"],
  organiser_student: ["ORGANIZER_STUDENT"],
  organizer_student: ["ORGANIZER_STUDENT"],
  organiser_volunteer: ["ORGANIZER_VOLUNTEER"],
  organizer_volunteer: ["ORGANIZER_VOLUNTEER"],
  volunteer: ["ORGANIZER_VOLUNTEER"],
  it: ["SERVICE_IT"],
  it_service: ["SERVICE_IT"],
  service_it: ["SERVICE_IT"],
  venue: ["SERVICE_VENUE"],
  venue_service: ["SERVICE_VENUE"],
  service_venue: ["SERVICE_VENUE"],
  venue_manager: ["SERVICE_VENUE"],
  catering_service: ["SERVICE_CATERING"],
  catering_vendors: ["SERVICE_CATERING"],
  catering_vendor: ["SERVICE_CATERING"],
  service_catering: ["SERVICE_CATERING"],
  stalls_service: ["SERVICE_STALLS"],
  stalls_misc: ["SERVICE_STALLS"],
  stall_misc: ["SERVICE_STALLS"],
  stalls: ["SERVICE_STALLS"],
  service_stalls: ["SERVICE_STALLS"],
  security: ["SERVICE_SECURITY"],
  service_security: ["SERVICE_SECURITY"],
};

const ROLE_TAG_LABEL_ALIASES: Record<string, string> = {
  "masteradmin": "Master Admin",
  "master admin": "Master Admin",
  "support": "Support",
  "hod": "HOD",
  "dean": "Dean",
  "cfo": "CFO",
  "organiser": "Organiser",
  "organizer": "Organiser",
  "organiser teacher": "Organiser",
  "organizer teacher": "Organiser",
  "student organiser": "Student Organizer",
  "student organizer": "Student Organizer",
  "organiser student": "Student Organizer",
  "organizer student": "Student Organizer",
  "volunteer": "Volunteer",
  "organiser volunteer": "Volunteer",
  "organizer volunteer": "Volunteer",
  "finance officer": "Finance Officer",
  "accounts": "Accounts",
  "it": "IT",
  "it service": "IT",
  "service it": "IT",
  "venue": "Venue",
  "venue service": "Venue",
  "venue manager": "Venue",
  "service venue": "Venue",
  "catering": "Catering",
  "catering service": "Catering",
  "catering vendors": "Catering",
  "catering vendor": "Catering",
  "service catering": "Catering",
  "stall": "Stalls/Misc",
  "stalls": "Stalls/Misc",
  "stall misc": "Stalls/Misc",
  "stalls service": "Stalls/Misc",
  "stalls misc": "Stalls/Misc",
  "service stalls": "Stalls/Misc",
  "security": "Security",
  "service security": "Security",
};

const normalizeText = (value: unknown): string => String(value || "").trim();

const normalizeRoleTagKey = (value: unknown): string =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeNullableText = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
};

const canonicalizeRoleTag = (roleTag: unknown): string => {
  const rawRoleTag = normalizeText(roleTag);
  if (!rawRoleTag) {
    return "";
  }

  const aliasKey = normalizeRoleTagKey(rawRoleTag.replace(/_/g, " "));
  return ROLE_TAG_LABEL_ALIASES[aliasKey] || rawRoleTag;
};

const deriveRoleCodesFromUniversityRole = (universityRole: unknown): string[] => {
  const normalizedRoleKey = normalizeText(universityRole)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalizedRoleKey) {
    return [];
  }

  return UNIVERSITY_ROLE_TO_ROLE_CODES[normalizedRoleKey] || [];
};

const toRoleTag = (roleCode: string): string => {
  if (ROLE_CODE_PROFILE_LABELS[roleCode]) {
    return ROLE_CODE_PROFILE_LABELS[roleCode];
  }

  return roleCode
    .toLowerCase()
    .split("_")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const resolveRoleMatrixDepartment = (userData: UserData | null): string | null => {
  if (!userData) {
    return null;
  }

  const explicitDepartment = normalizeNullableText(userData.role_matrix_department);
  if (explicitDepartment) {
    return explicitDepartment;
  }

  if (!Array.isArray(userData.role_matrix_assignments)) {
    return null;
  }

  for (const assignment of userData.role_matrix_assignments) {
    const departmentLabel = normalizeNullableText(assignment?.department_label);
    if (departmentLabel) {
      return departmentLabel;
    }

    const departmentScope = normalizeNullableText(assignment?.department_scope);
    if (departmentScope) {
      return departmentScope;
    }
  }

  return null;
};

const resolveProfileRoleTags = (userData: UserData | null): string[] => {
  if (!userData) {
    return [];
  }

  const tags = new Map<string, string>();
  const addRoleTag = (roleTag: unknown): void => {
    const canonicalRoleTag = canonicalizeRoleTag(roleTag);
    const normalizedRoleTagKey = normalizeRoleTagKey(canonicalRoleTag);

    if (!normalizedRoleTagKey || tags.has(normalizedRoleTagKey)) {
      return;
    }

    tags.set(normalizedRoleTagKey, canonicalRoleTag);
  };

  if (Array.isArray(userData.role_matrix_tags)) {
    userData.role_matrix_tags
      .map((tag) => normalizeText(tag))
      .filter((tag) => tag.length > 0)
      .forEach((tag) => addRoleTag(tag));
  }

  if (Array.isArray(userData.role_matrix_assignments)) {
    userData.role_matrix_assignments.forEach((assignment) => {
      const roleTag = normalizeNullableText(assignment?.role_tag);
      if (roleTag) {
        addRoleTag(roleTag);
        return;
      }

      const roleCode = normalizeText(assignment?.role_code).toUpperCase();
      if (roleCode) {
        addRoleTag(toRoleTag(roleCode));
      }
    });
  }

  if (Array.isArray(userData.role_codes)) {
    userData.role_codes
      .map((roleCode) => normalizeText(roleCode).toUpperCase())
      .filter((roleCode) => roleCode.length > 0)
      .forEach((roleCode) => addRoleTag(toRoleTag(roleCode)));
  }

  const normalizedUniversityRole = normalizeNullableText(userData.university_role);
  if (normalizedUniversityRole) {
    const derivedUniversityRoleCodes = deriveRoleCodesFromUniversityRole(
      normalizedUniversityRole
    );

    if (derivedUniversityRoleCodes.length > 0) {
      derivedUniversityRoleCodes.forEach((roleCode) => addRoleTag(toRoleTag(roleCode)));
    } else {
      addRoleTag(normalizedUniversityRole);
    }
  }

  if (userData.is_organiser) addRoleTag("Organiser");
  if (userData.is_support) addRoleTag("Support");
  if (userData.is_masteradmin) addRoleTag("Master Admin");
  if (userData.is_hod) addRoleTag("HOD");
  if (userData.is_dean) addRoleTag("Dean");
  if (userData.is_cfo) {
    addRoleTag("CFO");
    addRoleTag("Accounts");
  }
  if (userData.is_finance_officer || userData.is_finance_office) {
    addRoleTag("Finance Officer");
  }
  if (userData.is_organiser_student || userData.is_student_organiser || userData.is_student_organizer) {
    addRoleTag("Student Organizer");
  }
  if (userData.is_volunteer) addRoleTag("Volunteer");
  if (userData.is_service_it || userData.is_it_service || userData.is_it) addRoleTag("IT");
  if (userData.is_service_venue || userData.is_venue_manager || userData.is_venue) addRoleTag("Venue");
  if (userData.is_service_catering || userData.is_catering_vendors || userData.is_catering_vendor) {
    addRoleTag("Catering");
  }
  if (userData.is_service_stalls || userData.is_stalls_misc || userData.is_stall_misc || userData.is_stalls) {
    addRoleTag("Stalls/Misc");
  }
  if (userData.is_service_security) addRoleTag("Security");

  if (!userData.is_cfo) {
    tags.delete(normalizeRoleTagKey("Accounts"));
  }

  return Array.from(tags.values());
};

const getRoleTagClassName = (roleTag: string): string => {
  const normalizedRoleTag = normalizeText(roleTag).toLowerCase();

  if (normalizedRoleTag.includes("master")) {
    return "text-gray-800 font-medium bg-red-100 px-2 py-1 rounded-full text-xs inline-block";
  }
  if (normalizedRoleTag.includes("support")) {
    return "text-gray-800 font-medium bg-green-100 px-2 py-1 rounded-full text-xs inline-block";
  }
  if (
    normalizedRoleTag.includes("hod") ||
    normalizedRoleTag.includes("dean") ||
    normalizedRoleTag.includes("cfo") ||
    normalizedRoleTag.includes("finance") ||
    normalizedRoleTag.includes("accounts")
  ) {
    return "text-gray-800 font-medium bg-amber-100 px-2 py-1 rounded-full text-xs inline-block";
  }
  if (
    normalizedRoleTag.includes("it") ||
    normalizedRoleTag.includes("venue") ||
    normalizedRoleTag.includes("catering") ||
    normalizedRoleTag.includes("stall") ||
    normalizedRoleTag.includes("security")
  ) {
    return "text-gray-800 font-medium bg-teal-100 px-2 py-1 rounded-full text-xs inline-block";
  }

  return "text-gray-800 font-medium bg-blue-100 px-2 py-1 rounded-full text-xs inline-block";
};

const StudentProfile = () => {
  const { userData, signOut, session, isLoading } = useAuth();
  const router = useRouter();
  const normalizedUserData = (userData as UserData | null) || null;
  const profileRoleTags = resolveProfileRoleTags(normalizedUserData);

  const [student, setStudent] = useState<Student>({
    name: "",
    registerNumber: "",
    course: "",
    school: "",
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
  const [showCampusDetect, setShowCampusDetect] = useState(false);
  const [activeQR, setActiveQR] = useState<ActiveQR | null>(null);

  useEffect(() => {
    if (userData) {
      const resolvedRoleMatrixDepartment = resolveRoleMatrixDepartment(
        (userData as UserData | null) || null
      );
      const createdDate = userData.created_at
        ? new Date(userData.created_at)
        : new Date();
      const joinedFormatted = createdDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      const isStaff = userData.email?.toLowerCase().endsWith('@christuniversity.in');

      setStudent((prevState) => ({
        ...prevState,
        name: userData.name || "Student",
        registerNumber: String(userData.register_number || ""),
        email: userData.email || "",
        course: isStaff ? "Staff" : (userData.course || "Not specified"),
        school: userData.school || "Not specified",
        department:
          resolvedRoleMatrixDepartment ||
          (isStaff ? "Staff" : userData.department || "Not specified"),
        campus: userData.campus || "Not specified",
        joined: joinedFormatted,
        profilePicture: userData.avatar_url || "",
      }));

      // Fetch registered events if possible
      const fetchRegisteredEvents = async () => {
        setIsLoadingRegisteredEvents(true);
        const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");
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
            `${API_URL}/api/registrations/user/${userData.register_number}/events`
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
                registration_id: event.registration_id || event.id,
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
    router.replace("/");
  };

  // One-time name edit for outsiders
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [isSubmittingName, setIsSubmittingName] = useState(false);
  const [nameEditError, setNameEditError] = useState<string | null>(null);

  const canEditName = (userData as any)?.organization_type === 'outsider' && !(userData as any)?.outsider_name_edit_used;
  const isChristOrganizationUser = userData?.organization_type === "christ_member";
  const isVisitorAccount =
    (userData as any)?.organization_type === 'outsider' ||
    (userData as any)?.is_christ_member === false ||
    (userData as any)?.ischristmember === false;

  const submitNameEdit = async () => {
    setNameEditError(null);
    if (!nameInput || nameInput.trim() === "") {
      setNameEditError("Name cannot be empty");
      return;
    }
    setIsSubmittingName(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");
      const headers: any = { 'Content-Type': 'application/json' };
      const token = (session as any)?.access_token || (session as any)?.provider_token || (session as any)?.refresh_token;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const bodyPayload: any = { name: nameInput.trim() };
      if ((userData as any)?.organization_type === 'outsider') {
        bodyPayload.visitor_id = (userData as any)?.visitor_id || (userData as any)?.register_number;
      }

      const resp = await fetch(`${API_URL}/api/users/${encodeURIComponent(userData!.email)}/name`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(bodyPayload)
      });
      const data = await resp.json();
      if (!resp.ok) {
        setNameEditError(data.error || 'Failed to update name');
        setIsSubmittingName(false);
        return;
      }

      // Update local display and reload to refresh auth context
      setStudent(prev => ({ ...prev, name: nameInput.trim() }));
      setIsEditingName(false);
      setIsSubmittingName(false);
      router.refresh();
    } catch (error) {
      console.error('Error submitting name edit:', error);
      setNameEditError('Network error');
      setIsSubmittingName(false);
    }
  };

  if (!userData) {
    if (isLoading) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <LoadingIndicator label="Loading profile" />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-600 text-lg">Unable to load your profile.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.refresh()}
              className="px-5 py-2 bg-[#063168] text-white rounded-lg hover:bg-[#063168]/90 transition"
            >
              Try Again
            </button>
            <Link
              href="/Discover"
              className="px-5 py-2 border border-[#063168] text-[#063168] rounded-lg hover:bg-gray-50 transition"
            >
              Back to Discover
            </Link>
          </div>
        </div>
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
                  <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {student.profilePicture ? (
                      <img
                        src={student.profilePicture}
                        alt={`${student.name || "Student"} profile`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-3xl text-gray-500">?</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-white">
                    {student.name}
                  </h2>
                  {canEditName && !isEditingName && (
                    <button
                      onClick={() => { setNameInput(student.name); setIsEditingName(true); }}
                      className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                      title="Edit name (one-time only)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Visitor ID Badge for Outsiders */}
                {(userData as any)?.organization_type === 'outsider' && student.registerNumber && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-[#FFCC00] text-[#063168] px-3 py-1 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
                    </svg>
                    <span className="font-bold text-sm">{student.registerNumber}</span>
                  </div>
                )}
                
                {/* Register Number for Christ Members */}
                {(userData as any)?.organization_type !== 'outsider' && student.registerNumber && (
                  <p className="text-gray-200 text-xs sm:text-sm mt-1">
                    {student.registerNumber}
                  </p>
                )}
                
                {/* Outsider Badge */}
                {(userData as any)?.organization_type === 'outsider' && (
                  <div className="mt-2 inline-flex items-center gap-1 bg-white/20 text-white px-2 py-0.5 rounded text-xs">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                    <span>External Visitor</span>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6">
                <div className="space-y-3 sm:space-y-4">
                  {!isVisitorAccount && (
                    <>
                      <div>
                        <h3 className="text-xs sm:text-sm font-medium text-gray-500">
                          Course
                        </h3>
                        <p className="text-sm sm:text-base text-gray-800 font-medium">
                          {student.course}
                        </p>
                      </div>
                      {isChristOrganizationUser && (
                        <div>
                          <h3 className="text-xs sm:text-sm font-medium text-gray-500">
                            School
                          </h3>
                          <p className="text-sm sm:text-base text-gray-800 font-medium">
                            {student.school}
                          </p>
                        </div>
                      )}
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
                        <div className="flex items-center gap-2">
                          <p className="text-sm sm:text-base text-gray-800 font-medium">
                            {student.campus}
                          </p>
                          {userData?.organization_type === 'christ_member' && !userData?.campus && (
                            <button
                              onClick={() => setShowCampusDetect(true)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#154CB3] hover:bg-[#0f3d8a] text-white rounded-md transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                              </svg>
                              Detect Campus
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
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
                  {profileRoleTags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">
                        Role
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {profileRoleTags.map((roleTag) => (
                          <p key={roleTag} className={getRoleTagClassName(roleTag)}>
                            {roleTag}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {(userData.is_organiser || (userData as any).is_masteradmin) && (
                <div className="px-4 sm:px-6 pb-4 flex flex-col gap-2">
                  {userData.is_organiser && (
                    <Link
                      href="/guide/organiser"
                      className="flex items-center justify-between w-full border border-[#154CB3] text-[#154CB3] rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#154CB3] hover:text-white transition-colors duration-150"
                    >
                      <span>Organiser Guide</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  )}
                  {(userData as any).is_masteradmin && (
                    <Link
                      href="/guide/masteradmin"
                      className="flex items-center justify-between w-full border border-red-500 text-red-500 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-red-500 hover:text-white transition-colors duration-150"
                    >
                      <span>Master Admin Guide</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  )}
                </div>
              )}

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
                        <div className="mt-2 sm:mt-0 ml-0 sm:ml-2 self-start sm:self-center flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveQR({
                                registrationId: event.registration_id,
                                eventTitle: event.name,
                              })
                            }
                            className="text-xs font-semibold px-3 py-1 rounded-full border border-[#154CB3] text-[#154CB3] hover:bg-[#154CB3] hover:text-white transition-colors"
                          >
                            QR
                          </button>
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

      {activeQR && (
        <QRCodeDisplay
          registrationId={activeQR.registrationId}
          eventTitle={activeQR.eventTitle}
          participantName={student.name}
          onClose={() => setActiveQR(null)}
        />
      )}
      
      {/* Edit Name Modal for Outsiders */}
      {isEditingName && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-[#063168] px-6 py-4">
              <h3 className="text-xl font-bold text-white">Edit Your Name</h3>
              <p className="text-gray-300 text-sm mt-1">This can only be done once</p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Display Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[#154CB3] focus:outline-none transition-colors text-gray-800"
                  placeholder="Enter your full name"
                  autoFocus
                />
              </div>
              
              {nameEditError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    {nameEditError}
                  </p>
                </div>
              )}
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <span>You can only edit your name <strong>once</strong>. After saving, this option will no longer be available.</span>
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => { setIsEditingName(false); setNameEditError(null); }}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  disabled={isSubmittingName}
                >
                  Cancel
                </button>
                <button
                  onClick={submitNameEdit}
                  disabled={isSubmittingName || !nameInput.trim()}
                  className="flex-1 px-4 py-3 bg-[#154CB3] text-white rounded-lg font-medium hover:bg-[#0f3d8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmittingName ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Name'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campus Detection Modal */}
      {showCampusDetect && session?.access_token && userData?.email && (
        <CampusDetectionModal
          userEmail={userData.email}
          accessToken={session.access_token}
          onComplete={(campus) => {
            setShowCampusDetect(false);
            setStudent((prev) => ({ ...prev, campus }));
            router.refresh();
          }}
          onDismiss={() => setShowCampusDetect(false)}
        />
      )}
    </div>
  );
};

export default StudentProfile;

