"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ExcelJS from "exceljs";

interface Student {
  id: number;
  name: string;
  register_number: string;
  course?: string;
  department?: string;
  email: string;
  created_at?: string;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params = useParams();
  const event_id = params?.id as string;

  useEffect(() => {
    window.scrollTo(0, 0);

    const fetchStudents = async () => {
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
        const apiUrl = `${apiBaseUrl}/api/registrations?event_id=${event_id}`;
        const response = await fetch(apiUrl);
        if (!response.ok) {
          let errorMessage = `Error: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage = `Server Error: ${
              errorData.details || errorData.error || "Unknown error"
            }`;
          } catch {
            const errorText = await response.text();
            errorMessage = `Error ${
              response.status
            }: Failed to retrieve data. ${errorText.substring(0, 150)}`;
          }
          throw new Error(errorMessage);
        }
        const data = await response.json();
        const mappedStudents = (data.users || []).map((user: any) => ({
          id: user.registration_id || user.id || 0,
          name: user.name?.toString() || "",
          register_number: user.register_number?.toString() || "",
          course: user.course?.toString() || "",
          department: user.department?.toString() || "",
          email: user.email?.toString() || "",
          created_at: user.created_at || user.registration_time || "", // Use a consistent timestamp
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
    if (event_id) fetchStudents();
  }, [event_id]);

  const handleGenerateExcel = async () => {
    if (students.length === 0) {
      console.log("No participant data to export.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Participants");

    const headers = [
      "Name",
      "Register No.",
      "Course",
      "Department",
      "E-mail",
      "Attendance",
    ];
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
      const rowData = [
        student.name || "",
        student.register_number || "",
        student.course || "",
        student.department || "",
        student.email || "",
        "",
      ];
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
        if (headers[colNumber - 1] === "E-mail") {
          cell.font = { ...cell.font, color: { argb: "FF1E90FF" } };
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

    worksheet.columns = [
      { width: 25 },
      { width: 15 },
      { width: 20 },
      { width: 20 },
      { width: 35 },
      { width: 12 },
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
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = student.name?.toLowerCase().includes(searchLower);
    const registerNumberString =
      student.register_number != null ? String(student.register_number) : "";
    const registerNumberMatch = registerNumberString
      .toLowerCase()
      .includes(searchLower);
    const emailMatch = student.email?.toLowerCase().includes(searchLower);
    return nameMatch || registerNumberMatch || emailMatch;
  });

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

        <div className="hidden md:grid md:grid-cols-5 gap-6 px-4 py-4 text-gray-500 font-medium border-b border-gray-200">
          <div>Name</div>
          <div>Register No.</div>
          <div>Course</div>
          <div>Department</div>
          <div>E-mail</div>
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
            {filteredStudents.length > 0 ? (
              filteredStudents.map((student: Student) => (
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
                    </div>
                  </div>
                  <div className="hidden md:grid md:grid-cols-5 gap-6 px-4 py-4 items-center">
                    <div className="font-medium truncate">
                      {student.name || "N/A"}
                    </div>
                    <div>{student.register_number || "N/A"}</div>
                    <div>{student.course || "N/A"}</div>
                    <div>{student.department || "N/A"}</div>
                    <div className="text-[#154CB3] truncate">
                      {student.email || "N/A"}
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
          </>
        )}
      </main>
    </div>
  );
}
