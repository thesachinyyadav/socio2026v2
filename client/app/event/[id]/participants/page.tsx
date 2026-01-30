"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ExcelJS from "exceljs";
import { useDebounce } from "@/lib/hooks/useDebounce";

interface CustomField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
}

interface Student {
  id: number;
  name: string;
  register_number: string;
  course?: string;
  department?: string;
  email: string;
  created_at?: string;
  custom_field_responses?: Record<string, string | number>;
}

const ITEMS_PER_PAGE = 20;

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params = useParams();
  const event_id = params?.id as string;

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
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiBaseUrl) {
          throw new Error("API endpoint is not configured.");
        }
        
        // Fetch both event details (for custom fields) and registrations in parallel
        const [eventResponse, registrationsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/events/${event_id}`),
          fetch(`${apiBaseUrl}/api/registrations?event_id=${event_id}`)
        ]);
        
        // Parse event custom fields
        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          const event = eventData.event || eventData;
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
          name: reg.registration_type === 'individual' ? reg.individual_name : reg.team_leader_name || "",
          register_number: reg.registration_type === 'individual' ? reg.individual_register_number : reg.team_leader_register_number || "",
          course: "",
          department: "",
          email: reg.registration_type === 'individual' ? reg.individual_email : reg.team_leader_email || "",
          created_at: reg.created_at || "",
          custom_field_responses: reg.custom_field_responses || {},
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
  }, [event_id]);

  const handleGenerateExcel = async () => {
    if (students.length === 0) {
      console.log("No participant data to export.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Participants");

    // Build headers dynamically including custom fields
    const baseHeaders = [
      "Name",
      "Register No.",
      "Course",
      "Department",
      "E-mail",
    ];
    
    // Add custom field labels as additional headers
    const customFieldHeaders = customFields.map(field => field.label);
    const headers = [...baseHeaders, ...customFieldHeaders, "Attendance"];
    
    const headerRow = worksheet.addRow(headers);

    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "ff154cb3" }, // Theme blue
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFB0C4DE" } },
        bottom: { style: "thin", color: { argb: "FFB0C4DE" } },
        left: { style: "thin", color: { argb: "FFB0C4DE" } },
        right: { style: "thin", color: { argb: "FFB0C4DE" } },
      };
    });
    headerRow.height = 30;

    students.forEach((student, index) => {
      // Build row data with custom field responses
      const baseData = [
        student.name || "",
        student.register_number || "",
        student.course || "",
        student.department || "",
        student.email || "",
      ];
      
      // Add custom field values in the same order as headers
      const customFieldValues = customFields.map(field => {
        const value = student.custom_field_responses?.[field.id];
        return value !== undefined && value !== null ? String(value) : "";
      });
      
      const rowData = [...baseData, ...customFieldValues, ""];
      const row = worksheet.addRow(rowData);

      row.eachCell((cell, colNumber) => {
        cell.font = { size: 11, color: { argb: "FF333333" } }; // Dark grey text
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD3D3D3" } },
          bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
          left: { style: "thin", color: { argb: "FFD3D3D3" } },
          right: { style: "thin", color: { argb: "FFD3D3D3" } },
        };
        cell.fill =
          index % 2 === 0
            ? {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE6F0FA" },
              }
            : {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFFFFFF" },
              };

        if (headers[colNumber - 1] === "Register No.") {
          cell.alignment = { ...cell.alignment, horizontal: "center" };
        }
        // Make URLs clickable for email and URL-type custom fields
        const headerName = headers[colNumber - 1];
        if (headerName === "E-mail") {
          cell.font = { ...cell.font, color: { argb: "FF1E90FF" } };
        }
        // Check if this is a URL-type custom field
        const customFieldIndex = colNumber - baseHeaders.length - 1;
        if (customFieldIndex >= 0 && customFieldIndex < customFields.length) {
          const field = customFields[customFieldIndex];
          if (field.type === 'url' && cell.value) {
            cell.font = { ...cell.font, color: { argb: "FF1E90FF" }, underline: true };
          }
        }
      });

      let estimatedHeight = 30;
      const emailCell = row.getCell(5);
      const emailLength = (student.email || "").length;
      if (emailLength > 30) {
        estimatedHeight = Math.max(
          estimatedHeight,
          30 + Math.ceil((emailLength - 30) / 30) * 15
        );
      }
      row.height = estimatedHeight;
    });

    // Set column widths dynamically
    const baseWidths = [25, 15, 20, 20, 35];
    const customFieldWidths = customFields.map(() => 30); // 30 width for each custom field
    worksheet.columns = [
      ...baseWidths.map(width => ({ width })),
      ...customFieldWidths.map(width => ({ width })),
      { width: 12 }, // Attendance column
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participants-${event_id}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
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
          <button
            onClick={handleGenerateExcel}
            className="bg-[#154CB3] cursor-pointer text-white text-sm px-4 py-2 rounded-full font-medium hover:bg-[#063168] transition-colors focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isDataLoading || students.length === 0}
          >
            Generate excel sheet
          </button>
        </div>

        {/* Custom Fields Info Banner */}
        {customFields.length > 0 && !isDataLoading && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#154CB3] flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[#063168]">Custom Fields Collected</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This event has {customFields.length} additional field{customFields.length > 1 ? 's' : ''} that participants filled during registration:
                  <span className="font-medium text-[#154CB3] ml-1">
                    {customFields.map(f => f.label).join(', ')}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  💡 These fields are included in the Excel export and displayed in the table below.
                </p>
              </div>
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

        {/* Desktop Table Header - Now scrollable for many custom fields */}
        <div className="hidden md:block overflow-x-auto">
          <div className={`grid gap-4 px-4 py-4 text-gray-500 font-medium border-b border-gray-200 min-w-max`}
               style={{ gridTemplateColumns: `repeat(${5 + customFields.length}, minmax(120px, 1fr))` }}>
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
            {paginatedStudents.length > 0 ? (
              paginatedStudents.map((student: Student) => (
                <div
                  key={student.id}
                  className="mb-4 md:mb-0 border rounded-lg md:rounded-none shadow-sm md:shadow-none md:border-0 md:border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  {/* Mobile Card View */}
                  <div className="block md:hidden p-4">
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
                  {/* Desktop Row View */}
                  <div className="hidden md:block overflow-x-auto">
                    <div 
                      className="grid gap-4 px-4 py-4 items-center min-w-max"
                      style={{ gridTemplateColumns: `repeat(${5 + customFields.length}, minmax(120px, 1fr))` }}
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
