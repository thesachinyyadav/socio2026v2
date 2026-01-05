"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { QRScanner } from "./QRScanner";

interface Participant {
  id: string;
  name: string;
  email: string;
  registerNumber?: string;
  teamName?: string;
  status: "registered" | "attended" | "absent";
  attendedAt?: string;
}

interface AttendanceManagerProps {
  eventId: string;
  eventTitle: string;
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({
  eventId,
  eventTitle,
}) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const { userData, session } = useAuth();

  useEffect(() => {
    fetchParticipants();
  }, [eventId]);

  const fetchParticipants = async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    setError(null);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    
    try {
      const response = await fetch(
        `${API_URL}/api/events/${eventId}/participants`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch participants");
      }

      const data = await response.json();
      
      // Map API response to Participant interface
      const mappedParticipants = data.participants?.map((p: any) => ({
        id: p.id,
        name: p.individual_name || p.team_leader_name || 'Unknown',
        email: p.individual_email || p.team_leader_email || '',
        registerNumber: p.individual_register_number || p.team_leader_register_number || '',
        teamName: p.registration_type === 'team' ? p.team_name : undefined,
        status: p.attendance_status === 'attended' ? 'attended' : 
               p.attendance_status === 'absent' ? 'absent' : 'registered',
        attendedAt: p.marked_at || undefined
      })) || [];
      
      setParticipants(mappedParticipants);
    } catch (err: any) {
      setError(err.message || "Failed to load participants");
      console.error("Error fetching participants:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (participantId: string, status: "attended" | "absent") => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(
        `http://localhost:8000/api/events/${eventId}/attendance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            participantIds: [participantId],
            status,
            markedBy: userData?.email,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to mark attendance");
      }

      // Update local state
      setParticipants(prev =>
        prev.map(p =>
          p.id === participantId
            ? {
                ...p,
                status,
                attendedAt: status === "attended" ? new Date().toISOString() : undefined,
              }
            : p
        )
      );
    } catch (err: any) {
      console.error("Error marking attendance:", err);
      // You might want to show a toast notification here
    }
  };

  const exportAttendance = () => {
    const csvContent = [
      ["Name", "Email", "Register Number", "Team Name", "Status", "Attended At"].join(","),
      ...participants.map(p => [
        p.name,
        p.email,
        p.registerNumber || "",
        p.teamName || "",
        p.status,
        p.attendedAt ? new Date(p.attendedAt).toLocaleString() : "",
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${eventTitle}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleQRScanSuccess = (result: any) => {
    // Refresh participants list to show updated attendance
    fetchParticipants();
  };

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (p.registerNumber && p.registerNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterStatus === "all" || p.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const attendanceStats = {
    total: participants.length,
    attended: participants.filter(p => p.status === "attended").length,
    absent: participants.filter(p => p.status === "absent").length,
    pending: participants.filter(p => p.status === "registered").length,
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#154CB3]"></div>
        <span className="ml-3 text-gray-600">Loading participants...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="ml-2 text-red-700 font-medium">Error loading participants</span>
        </div>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={fetchParticipants}
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-[#063168]">
            Attendance - {eventTitle}
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowQRScanner(true)}
              className="px-4 py-2 bg-[#154CB3] text-white rounded-lg hover:bg-[#063168] transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 16h4m-4-4h4m-4-4v1m0 0h-1m1-1V8a5 5 0 00-10 0v.01M8 7a3 3 0 016 0v.01M12 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              QR Scanner
            </button>
            <button
              onClick={exportAttendance}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{attendanceStats.total}</div>
            <div className="text-sm text-blue-700">Total</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{attendanceStats.attended}</div>
            <div className="text-sm text-green-700">Attended</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{attendanceStats.absent}</div>
            <div className="text-sm text-red-700">Absent</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{attendanceStats.pending}</div>
            <div className="text-sm text-yellow-700">Pending</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, email, or register number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="registered">Registered</option>
              <option value="attended">Attended</option>
              <option value="absent">Absent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Participants List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredParticipants.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {participants.length === 0 ? "No participants registered yet" : "No participants match your search"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredParticipants.map((participant) => (
                  <tr key={participant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                        <div className="text-sm text-gray-500">{participant.email}</div>
                        {participant.registerNumber && (
                          <div className="text-sm text-gray-500">Reg: {participant.registerNumber}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {participant.teamName || "Individual"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        participant.status === "attended"
                          ? "bg-green-100 text-green-800"
                          : participant.status === "absent"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {participant.status === "registered" ? "Pending" : participant.status}
                      </span>
                      {participant.attendedAt && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(participant.attendedAt).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      {participant.status !== "attended" && (
                        <button
                          onClick={() => markAttendance(participant.id, "attended")}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          Mark Present
                        </button>
                      )}
                      {participant.status !== "absent" && (
                        <button
                          onClick={() => markAttendance(participant.id, "absent")}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                          Mark Absent
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScanner
          eventId={eventId}
          eventTitle={eventTitle}
          onScanSuccess={handleQRScanSuccess}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  );
};