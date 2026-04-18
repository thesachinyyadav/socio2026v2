"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useAuth } from "@/context/AuthContext";
import {
  addThemedChartsSheet,
  addStructuredTableSheet,
  createThemedWorkbook,
  downloadWorkbook,
  type ThemedSheetColumn,
} from "@/lib/xlsxTheme";

interface CustomField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
}

interface Student {
  id: number;
  registration_id?: string;
  name: string;
  register_number: string;
  course?: string;
  department?: string;
  email: string;
  created_at?: string;
  custom_field_responses?: Record<string, string | number>;
  attendance_status?: string;
}

const ITEMS_PER_PAGE = 20;

export default function StudentsPage() {
  const { session, userData } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState<string>("");
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [eventOnSpotEnabled, setEventOnSpotEnabled] = useState(false);
  const [eventCreatedBy, setEventCreatedBy] = useState<string>("");
  const [showOnSpotForm, setShowOnSpotForm] = useState(false);
  const [onSpotName, setOnSpotName] = useState("");
  const [onSpotRegisterId, setOnSpotRegisterId] = useState("");
  const [onSpotEmail, setOnSpotEmail] = useState("");
  const [onSpotError, setOnSpotError] = useState<string | null>(null);
  const [onSpotSuccess, setOnSpotSuccess] = useState<string | null>(null);
  const [isOnSpotSubmitting, setIsOnSpotSubmitting] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const params = useParams();
  const event_id = params?.id as string;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

  const currentUserEmail = String(session?.user?.email || "").toLowerCase();
  const isMasterAdmin = Boolean(userData?.is_masteradmin);
  const isOrganiser = Boolean(userData?.is_organiser);
  const isEventOwner =
    Boolean(eventCreatedBy) &&
    Boolean(currentUserEmail) &&
    String(eventCreatedBy).toLowerCase() === currentUserEmail;
  const canUseOnSpot = eventOnSpotEnabled && (isMasterAdmin || (isOrganiser && isEventOwner));

  // Debounce search for better performance
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    window.scrollTo(0, 0);

    const fetchData = async () => {
      if (!event_id) {
        setIsDataLoading(false);
        return;
      }
      setIsDataLoading(true);
      setError(null);
      try {
        // Fetch event details, registrations, and attendance status in parallel
        const [eventResponse, registrationsResponse, attendanceResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/events/${event_id}`),
          fetch(`${apiBaseUrl}/api/registrations?event_id=${event_id}`),
          fetch(`${apiBaseUrl}/api/events/${event_id}/participants`)
        ]);
        
        // Parse event custom fields
        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          const event = eventData.event || eventData;
          setEventTitle(event.title || "");
          setEventOnSpotEnabled(
            event.on_spot === true ||
              event.on_spot === 1 ||
              event.on_spot === "1" ||
              event.on_spot === "true"
          );
          setEventCreatedBy(event.created_by || "");
          let fields: CustomField[] = [];
          if (event.custom_fields) {
            if (typeof event.custom_fields === 'string') {
              try {
                fields = JSON.parse(event.custom_fields);
              } catch (e) {
                console.warn('Failed to parse custom_fields:', e);
              }
            } else if (Array.isArray(event.custom_fields)) {
              fields = event.custom_fields;
            }
          }
          setCustomFields(fields);
        }
        
        // Build attendance map by registration_id
        if (attendanceResponse.ok) {
          const attendanceData = await attendanceResponse.json();
          const map: Record<string, string> = {};
          (attendanceData.participants || []).forEach((p: any) => {
            const key = String(p.registration_id || p.id || "");
            if (key) {
              map[key] = p.attendance_status || "absent";
            }
          });
          setAttendanceMap(map);
        }

        if (!registrationsResponse.ok) {
          let errorMessage = `Error: ${registrationsResponse.status} ${registrationsResponse.statusText}`;
          try {
            const errorData = await registrationsResponse.json();
            errorMessage = `Server Error: ${
              errorData.details || errorData.error || "Unknown error"
            }`;
          } catch {
            const errorText = await registrationsResponse.text();
            errorMessage = `Error ${
              registrationsResponse.status
            }: Failed to retrieve data. ${errorText.substring(0, 150)}`;
          }
          throw new Error(errorMessage);
        }
        const data = await registrationsResponse.json();
        const mappedStudents = (data.registrations || []).map((reg: any) => ({
          id: reg.registration_id || reg.id || 0,
          registration_id: reg.registration_id || reg.id || "",
          name: reg.registration_type === 'individual' ? reg.individual_name : reg.team_leader_name || "",
          register_number: reg.registration_type === 'individual' ? reg.individual_register_number : reg.team_leader_register_number || "",
          course: reg.course || "",
          department: reg.department || "",
          email: reg.registration_type === 'individual' ? reg.individual_email : reg.team_leader_email || "",
          created_at: reg.created_at || "",
          custom_field_responses: reg.custom_field_responses || {},
          attendance_status: reg.attendance_status || "",
        }));
        setStudents(mappedStudents);
      } catch (err) {
        console.error("Fetch error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load participants."
        );
      } finally {
        setIsDataLoading(false);
      }
    };
    if (event_id) fetchData();
  }, [event_id, apiBaseUrl, refreshNonce]);

  const handleOnSpotRegistration = async () => {
    setOnSpotError(null);
    setOnSpotSuccess(null);

    if (!session?.access_token) {
      setOnSpotError("Please sign in again to add on-spot participants.");
      return;
    }

    const attendeeName = onSpotName.trim();
    const registerIdentifier = onSpotRegisterId.trim();
    const attendeeEmail = onSpotEmail.trim();

    if (!attendeeName) {
      setOnSpotError("Participant name is required.");
      return;
    }

    if (!registerIdentifier) {
      setOnSpotError("Register number or visitor ID is required.");
      return;
    }

    setIsOnSpotSubmitting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/events/${event_id}/on-spot-register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: attendeeName,
          register_number: registerIdentifier,
          email: attendeeEmail || undefined,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed with status ${response.status}`);
      }

      setOnSpotSuccess("On-spot participant added successfully.");
      setOnSpotName("");
      setOnSpotRegisterId("");
      setOnSpotEmail("");
      setRefreshNonce((prev) => prev + 1);
    } catch (submitError: any) {
      setOnSpotError(submitError?.message || "Unable to add on-spot participant.");
    } finally {
      setIsOnSpotSubmitting(false);
    }
  };

  const handleGenerateExcel = async () => {
    if (students.length === 0) {
      console.log("No participant data to export.");
      return;
    }

    const workbook = createThemedWorkbook("SOCIO - Christ University");

    const customFieldColumns = customFields.map((field) => ({
      field,
      key: `custom_${field.id}`,
    }));

    type ParticipantExportRow = Record<string, string | number | null | undefined>;

    const columns: Array<ThemedSheetColumn<ParticipantExportRow>> = [
      { header: "Name", key: "name", width: 25 },
      { header: "Register No.", key: "register_number", width: 16, horizontal: "center" },
      { header: "Course", key: "course", width: 20 },
      { header: "Department", key: "department", width: 20 },
      { header: "E-mail", key: "email", width: 35, kind: "email" },
      ...customFieldColumns.map(({ field, key }) => ({
        header: field.label,
        key,
        width: 30,
        kind: (field.type === "url" ? "link" : "text") as "link" | "text",
      })),
      { header: "Attendance", key: "attendance", width: 14, kind: "status" },
    ];

    const rows: ParticipantExportRow[] = students.map((student) => {
      const row: ParticipantExportRow = {
        name: student.name || "",
        register_number: student.register_number || "",
        course: student.course || "",
        department: student.department || "",
        email: student.email || "",
      };

      customFieldColumns.forEach(({ field, key }) => {
        const value = student.custom_field_responses?.[field.id];
        row[key] = value !== undefined && value !== null ? String(value) : "";
      });

      const attendanceKey = String(student.registration_id || student.id || "");
      row.attendance = attendanceMap[attendanceKey] || student.attendance_status || "absent";

      return row;
    });

    addStructuredTableSheet(workbook, {
      sheetName: "Participants",
      columns,
      rows,
      rowHeight: 24,
    });

    const attendanceChartData = [
      {
        label: "Attended",
        value: rows.filter((row) => String(row.attendance ?? "").toLowerCase() === "attended").length,
      },
      {
        label: "Absent",
        value: rows.filter((row) => String(row.attendance ?? "").toLowerCase() === "absent").length,
      },
      {
        label: "Pending",
        value: rows.filter((row) => String(row.attendance ?? "").toLowerCase() === "pending").length,
      },
      {
        label: "Unmarked",
        value: rows.filter((row) => String(row.attendance ?? "").toLowerCase() === "unmarked").length,
      },
    ];

    const departmentChartData = Object.entries(
      rows.reduce<Record<string, number>>((acc, row) => {
        const dept = String(row.department || "Unknown");
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      }, {})
    )
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    addThemedChartsSheet(workbook, {
      title: "Participants Visual Overview",
      subtitle: "Chart snapshots are embedded for quick review.",
      primaryChart: {
        title: "Participants by Department",
        type: "bar",
        data: departmentChartData,
      },
      secondaryChart: {
        title: "Attendance Status Mix",
        type: "donut",
        data: attendanceChartData,
      },
    });

    await downloadWorkbook(workbook, `participants-${event_id}.xlsx`);
    console.log("Excel file generated.");
  };

  const filteredStudents = students.filter((student) => {
    const searchLower = debouncedSearch.toLowerCase();
    const nameMatch = student.name?.toLowerCase().includes(searchLower);
    const registerNumberString =
      student.register_number != null ? String(student.register_number) : "";
    const registerNumberMatch = registerNumberString
      .toLowerCase()
      .includes(searchLower);
    const emailMatch = student.email?.toLowerCase().includes(searchLower);
    return nameMatch || registerNumberMatch || emailMatch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  if (params && !event_id && isDataLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <div className="flex-1 flex justify-center items-center h-64">
          <span className="text-gray-600">Loading event data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="px-4 sm:px-6 md:px-12 pt-6 md:pt-8">
        <div className="mb-4">
          <Link
            href="/manage"
            className="inline-flex items-center text-[#154CB3] hover:text-[#063168] font-medium transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4 mr-1"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>

      <main className="flex-1 px-4 sm:px-6 md:px-12 pb-6 md:pb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-8 gap-4 sm:gap-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#154CB3]">
            Participants ({students.length})
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {canUseOnSpot && (
              <button
                onClick={() => {
                  setShowOnSpotForm((prev) => !prev);
                  setOnSpotError(null);
                  setOnSpotSuccess(null);
                }}
                className="bg-white text-[#154CB3] border border-[#154CB3] text-sm px-4 py-2 rounded-full font-medium hover:bg-[#154CB3] hover:text-white transition-colors"
              >
                {showOnSpotForm ? "Hide on-spot" : "On Spot Registration"}
              </button>
            )}
            <Link
              href={`/attendance?eventId=${event_id}&eventTitle=${encodeURIComponent(eventTitle || "Event")}`}
              className="bg-white text-[#154CB3] border border-[#154CB3] text-sm px-4 py-2 rounded-full font-medium hover:bg-[#154CB3] hover:text-white transition-colors"
            >
              Mark attendance
            </Link>
            <button
              onClick={handleGenerateExcel}
              className="bg-[#154CB3] cursor-pointer text-white text-sm px-4 py-2 rounded-full font-medium hover:bg-[#063168] transition-colors focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isDataLoading || students.length === 0}
            >
              Generate excel sheet
            </button>
          </div>
        </div>

        {showOnSpotForm && canUseOnSpot && (
          <div className="mb-6 border border-blue-200 bg-blue-50 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-[#063168] mb-3">Add On-Spot Participant</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={onSpotName}
                onChange={(e) => setOnSpotName(e.target.value)}
                placeholder="Participant name *"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
              />
              <input
                type="text"
                value={onSpotRegisterId}
                onChange={(e) => setOnSpotRegisterId(e.target.value)}
                placeholder="Register no. or Visitor ID (VIS...) *"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
              />
              <input
                type="email"
                value={onSpotEmail}
                onChange={(e) => setOnSpotEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              If the attendee does not have a register number or visitor ID, ask them to log in on SOCIO and get one first.
            </p>
            {onSpotError && <p className="text-xs text-red-600 mt-2">{onSpotError}</p>}
            {onSpotSuccess && <p className="text-xs text-emerald-700 mt-2">{onSpotSuccess}</p>}
            <div className="mt-3">
              <button
                onClick={handleOnSpotRegistration}
                disabled={isOnSpotSubmitting}
                className="bg-[#154CB3] text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-[#063168] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isOnSpotSubmitting ? "Adding..." : "Add Participant"}
              </button>
            </div>
          </div>
        )}

        <div className="relative mb-6 md:mb-8">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-gray-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search student by name, register no, or email..."
            className="w-full pl-12 pr-4 py-3 bg-gray-100 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Desktop Table - Single scrollable container for header and rows */}
        <div className="hidden md:block overflow-x-auto">
          {/* Table Header */}
          <div className={`grid gap-4 px-4 py-4 text-gray-500 font-medium border-b border-gray-200`}
               style={{ gridTemplateColumns: `200px 120px 150px 150px 250px ${customFields.map(() => '180px').join(' ')}`.trim(), minWidth: 'max-content' }}>
            <div>Name</div>
            <div>Register No.</div>
            <div>Course</div>
            <div>Department</div>
            <div>E-mail</div>
            {customFields.map(field => (
              <div key={field.id} className="text-[#154CB3] font-semibold">
                {field.label}
              </div>
            ))}
          </div>
          
          {/* Table Body */}
          {!isDataLoading && !error && paginatedStudents.length > 0 && paginatedStudents.map((student: Student) => (
            <div 
              key={student.id}
              className="grid gap-4 px-4 py-4 items-center border-b border-gray-200 hover:bg-gray-50 transition-colors"
              style={{ gridTemplateColumns: `200px 120px 150px 150px 250px ${customFields.map(() => '180px').join(' ')}`.trim(), minWidth: 'max-content' }}
            >
              <div className="font-medium truncate">
                {student.name || "N/A"}
              </div>
              <div>{student.register_number || "N/A"}</div>
              <div>{student.course || "N/A"}</div>
              <div>{student.department || "N/A"}</div>
              <div className="text-[#154CB3] truncate">
                {student.email || "N/A"}
              </div>
              {customFields.map(field => {
                const value = student.custom_field_responses?.[field.id];
                return (
                  <div key={field.id} className="truncate">
                    {field.type === 'url' && value ? (
                      <a 
                        href={String(value)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[#154CB3] hover:underline"
                      >
                        {String(value)}
                      </a>
                    ) : (
                      <span>{value !== undefined && value !== null ? String(value) : "N/A"}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {isDataLoading ? (
          <div className="flex justify-center items-center h-64">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="size-8 animate-spin text-[#063168]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            <span className="ml-2 text-gray-600">Loading participants...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col justify-center items-center h-64 text-red-500">
            <p className="font-semibold">Failed to load data</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : (
          <>
            {/* Mobile Card Views */}
            <div className="md:hidden">
              {paginatedStudents.length > 0 ? (
                paginatedStudents.map((student: Student) => (
                  <div
                    key={student.id}
                    className="mb-4 border rounded-lg shadow-sm border-gray-200"
                  >
                    <div className="p-4">
                      <div className="font-medium text-lg mb-2">
                        {student.name || "N/A"}
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex">
                          <span className="text-gray-500 w-28 flex-shrink-0">
                            Register No.
                          </span>
                          <span>{student.register_number || "N/A"}</span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-500 w-28 flex-shrink-0">
                            Course
                          </span>
                          <span>{student.course || "N/A"}</span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-500 w-28 flex-shrink-0">
                            Department
                          </span>
                          <span>{student.department || "N/A"}</span>
                        </div>
                        <div className="flex">
                          <span className="text-gray-500 w-28 flex-shrink-0">
                            E-mail
                          </span>
                          <span className="text-[#154CB3] break-all">
                            {student.email || "N/A"}
                          </span>
                        </div>
                        {/* Custom Fields in Mobile View */}
                        {customFields.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="text-sm font-medium text-[#154CB3] mb-2">Additional Information</div>
                            {customFields.map(field => {
                              const value = student.custom_field_responses?.[field.id];
                              return (
                                <div key={field.id} className="flex flex-col mb-2">
                                  <span className="text-gray-500 text-xs">{field.label}</span>
                                  {field.type === 'url' && value ? (
                                    <a 
                                      href={String(value)} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-[#154CB3] text-sm break-all hover:underline"
                                    >
                                      {String(value)}
                                    </a>
                                  ) : (
                                    <span className="text-sm break-all">{value !== undefined && value !== null ? String(value) : "N/A"}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex justify-center items-center h-32 text-gray-500">
                  {searchQuery
                    ? "No participants found matching your search criteria."
                    : "No participants registered for this event yet."}
                </div>
              )}
            </div>

            {/* Desktop - Empty state only */}
            {paginatedStudents.length === 0 && (
              <div className="hidden md:flex justify-center items-center h-32 text-gray-500">
                {searchQuery
                  ? "No participants found matching your search criteria."
                  : "No participants registered for this event yet."}
              </div>
            )}

            {/* Pagination Controls */}
            {filteredStudents.length > ITEMS_PER_PAGE && (
              <div className="flex justify-center items-center gap-4 py-8 border-t mt-6">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-[#154CB3] text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#154cb3eb] transition-colors font-medium"
                >
                  Previous
                </button>
                <span className="text-gray-700 font-medium">
                  Page {currentPage} of {totalPages} ({filteredStudents.length} total)
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-[#154CB3] text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#154cb3eb] transition-colors font-medium"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
