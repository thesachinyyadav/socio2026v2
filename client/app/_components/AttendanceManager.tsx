"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import ExcelJS from "exceljs";
import { useAuth } from "@/context/AuthContext";
import { QRScanner } from "./QRScanner";

interface TeammateInfo {
  name?: string;
  email?: string;
  registerNumber?: string;
}

interface TeammateStatusEntry {
  status?: "attended" | "absent";
  marked_at?: string;
  marked_by?: string;
}

interface Participant {
  id: string;
  registrationId: string;
  name: string;
  email: string;
  registerNumber?: string;
  teamName?: string;
  status: "attended" | "absent";
  attendedAt?: string;
  registrationType?: "individual" | "team" | string;
  teammates?: TeammateInfo[];
  teammateStatuses?: Record<string, TeammateStatusEntry>;
}

interface AttendanceManagerProps {
  eventId: string;
  eventTitle: string;
}

const BRAND_BLUE = "#154CB3";
const BRAND_NAVY = "#063168";

const pad2 = (n: number) => String(n).padStart(2, "0");

const todayLocalISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const formatDDMMYYYY = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
};

const toAmPmLabel = (hhmm: string) => {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${pad2(h)}:${mStr}${ampm}`;
};

const toPeriodColumnName = (hhmm: string) => {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const ampm = h >= 12 ? "PM" : "AM";
  return `Period${pad2(h)}_${mStr}${ampm}`;
};

const deriveClassFromEmail = (email: string): string => {
  const m = email.toLowerCase().match(/@([^.]+)\.christuniversity\.in$/);
  return m ? m[1].toUpperCase() : "";
};

interface TimePickerProps {
  initial: string;
  onOk: (hhmm: string) => void;
  onCancel: () => void;
}

const TimePicker: React.FC<TimePickerProps> = ({ initial, onOk, onCancel }) => {
  const initH = initial ? Number(initial.split(":")[0]) : 0;
  const initM = initial ? Number(initial.split(":")[1]) : 0;
  const [hour, setHour] = useState<number>(isNaN(initH) ? 0 : initH);
  const [minute, setMinute] = useState<number>(isNaN(initM) ? 0 : initM);

  const ampm = hour >= 12 ? "PM" : "AM";

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const handleHourChange = (v: string) => {
    if (v === "") { setHour(0); return; }
    const n = parseInt(v, 10);
    if (!isNaN(n)) setHour(clamp(n, 0, 23));
  };
  const handleMinuteChange = (v: string) => {
    if (v === "") { setMinute(0); return; }
    const n = parseInt(v, 10);
    if (!isNaN(n)) setMinute(clamp(n, 0, 59));
  };

  const inputBase: React.CSSProperties = {
    width: "64px",
    height: "44px",
    textAlign: "center",
    fontSize: "20px",
    fontVariantNumeric: "tabular-nums",
    borderRadius: "8px",
    outline: "none",
  };

  const chip30Active = minute === 30;
  const chip45Active = minute === 45;

  return (
    <div className="mt-2 border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
      <div className="text-[10px] font-semibold tracking-wider text-gray-500 mb-2">
        ENTER TIME (24H)
      </div>
      <div className="flex items-center justify-center gap-2">
        <input
          type="number"
          min={0}
          max={23}
          value={pad2(hour)}
          onChange={(e) => handleHourChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          className="no-spin"
          style={{ ...inputBase, border: `2px solid ${BRAND_BLUE}`, background: "#fff" }}
        />
        <span className="text-2xl font-semibold text-gray-700">:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={pad2(minute)}
          onChange={(e) => handleMinuteChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          className="no-spin minute-input"
          style={inputBase}
        />
        <div
          aria-readonly
          className="select-none"
          style={{
            ...inputBase,
            width: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f3f4f6",
            color: "#374151",
            fontSize: "14px",
            fontWeight: 600,
            border: "1px solid #e5e7eb",
          }}
        >
          {ampm}
        </div>
      </div>

      <div className="mt-4 text-[10px] font-semibold tracking-wider text-gray-500 mb-2">
        POPULAR TIMINGS
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMinute(30)}
          className="px-3 py-1.5 text-sm rounded-md border transition-colors"
          style={
            chip30Active
              ? { background: BRAND_BLUE, color: "#fff", borderColor: BRAND_BLUE }
              : { background: "#fff", color: BRAND_BLUE, borderColor: BRAND_BLUE }
          }
        >
          {pad2(hour)}:30
        </button>
        <button
          type="button"
          onClick={() => setMinute(45)}
          className="px-3 py-1.5 text-sm rounded-md border transition-colors"
          style={
            chip45Active
              ? { background: BRAND_BLUE, color: "#fff", borderColor: BRAND_BLUE }
              : { background: "#fff", color: BRAND_BLUE, borderColor: BRAND_BLUE }
          }
        >
          {pad2(hour)}:45
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-md text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onOk(`${pad2(hour)}:${pad2(minute)}`)}
            className="px-4 py-1.5 text-sm rounded-md text-white"
            style={{ background: BRAND_BLUE }}
          >
            OK
          </button>
        </div>
      </div>

      <style jsx>{`
        .no-spin::-webkit-outer-spin-button,
        .no-spin::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spin {
          -moz-appearance: textfield;
        }
        .minute-input {
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
        }
        .minute-input:focus {
          background: #ffffff;
          border: 2px solid ${BRAND_BLUE};
        }
      `}</style>
    </div>
  );
};

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

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const toggleTeam = (id: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [showClaimsModal, setShowClaimsModal] = useState(false);
  const [claimsDate, setClaimsDate] = useState<string>("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<string[]>([""]);
  const [periodErrors, setPeriodErrors] = useState<Record<number, string>>({});
  const [pickerOpenIdx, setPickerOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    fetchParticipants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportMenuOpen]);

  const fetchParticipants = async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);
    const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

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

      const mappedParticipants: Participant[] = data.participants?.map((p: any) => ({
        id: p.id,
        registrationId: p.id,
        name: p.individual_name || p.team_leader_name || 'Unknown',
        email: p.individual_email || p.team_leader_email || '',
        registerNumber: p.individual_register_number || p.team_leader_register_number || '',
        teamName: p.registration_type === 'team' ? p.team_name : undefined,
        status: p.attendance_status === 'attended' ? 'attended' : 'absent',
        attendedAt: p.marked_at || undefined,
        registrationType: p.registration_type,
        teammates: Array.isArray(p.teammates) ? p.teammates : [],
        teammateStatuses: p.teammate_statuses && typeof p.teammate_statuses === 'object' ? p.teammate_statuses : {},
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

    const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

    try {
      const response = await fetch(
        `${API_URL}/api/events/${eventId}/attendance`,
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
    }
  };

  const markTeammateAttendance = async (
    participantId: string,
    registrationId: string,
    teammateRegisterNumber: string,
    status: "attended" | "absent"
  ) => {
    if (!session?.access_token) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

    try {
      const response = await fetch(
        `${API_URL}/api/events/${eventId}/teammate-attendance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            registrationId,
            teammateRegisterNumber,
            status,
            markedBy: userData?.email,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to mark teammate attendance");
      }

      const now = new Date().toISOString();
      setParticipants(prev =>
        prev.map(p =>
          p.id === participantId
            ? {
                ...p,
                teammateStatuses: {
                  ...(p.teammateStatuses || {}),
                  [teammateRegisterNumber]: {
                    status,
                    marked_at: now,
                    marked_by: userData?.email,
                  },
                },
              }
            : p
        )
      );
    } catch (err: any) {
      console.error("Error marking teammate attendance:", err);
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
    a.download = `attendance_${eventTitle}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const openClaimsModal = () => {
    setClaimsDate("");
    setDateError(null);
    setPeriods([""]);
    setPeriodErrors({});
    setPickerOpenIdx(null);
    setShowClaimsModal(true);
  };

  const closeClaimsModal = () => {
    setShowClaimsModal(false);
    setPickerOpenIdx(null);
  };

  const anyPeriodEmpty = periods.some((p) => p.trim() === "");

  const sortedOrder = useMemo(() => {
    const idxs = periods.map((_, i) => i);
    return idxs.sort((a, b) => {
      const va = periods[a].trim();
      const vb = periods[b].trim();
      if (va === "" && vb === "") return a - b;
      if (va === "") return 1;
      if (vb === "") return -1;
      if (va === vb) return a - b;
      return va < vb ? -1 : 1;
    });
  }, [periods]);

  const addPeriod = () => {
    if (anyPeriodEmpty) return;
    setPeriods((prev) => [...prev, ""]);
  };

  const removePeriod = (idx: number) => {
    if (periods.length <= 1) return;
    setPeriods((prev) => prev.filter((_, i) => i !== idx));
    setPeriodErrors((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki === idx) return;
        next[ki > idx ? ki - 1 : ki] = v;
      });
      return next;
    });
    if (pickerOpenIdx !== null) {
      if (pickerOpenIdx === idx) setPickerOpenIdx(null);
      else if (pickerOpenIdx > idx) setPickerOpenIdx(pickerOpenIdx - 1);
    }
  };

  const setPeriodValue = (idx: number, value: string) => {
    setPeriods((prev) => prev.map((p, i) => (i === idx ? value : p)));
    setPeriodErrors((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const validateAndGenerate = async () => {
    let ok = true;
    if (!claimsDate) {
      setDateError("Date is required");
      ok = false;
    } else {
      setDateError(null);
    }

    const errs: Record<number, string> = {};
    const firstSeen: Record<string, number> = {};
    periods.forEach((p, i) => {
      const v = p.trim();
      if (v === "") {
        errs[i] = "Time is required";
        ok = false;
      } else if (firstSeen[v] !== undefined) {
        errs[i] = `Duplicate of field ${firstSeen[v] + 1}. Please modify.`;
        ok = false;
      } else {
        firstSeen[v] = i;
      }
    });
    setPeriodErrors(errs);

    if (!ok) return;

    await generateClaimsXlsx();
    closeClaimsModal();
  };

  const generateClaimsXlsx = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Claims");

    const isChristEmail = (email: string) => /@[^.]+\.christuniversity\.in$/i.test(email);

    type ClaimEntry = { registerNumber: string; name: string; email: string };
    const entries: ClaimEntry[] = [];

    for (const p of participants) {
      if (p.registrationType === "team") {
        // Gate the entire team on the leader's email being a christ email
        if (!isChristEmail(p.email)) continue;
        const leaderReg = String(p.registerNumber || "").trim();

        if (p.status === "attended") {
          entries.push({
            registerNumber: leaderReg,
            name: p.name || "",
            email: p.email || "",
          });
        }

        for (const tm of p.teammates || []) {
          const tmReg = String(tm.registerNumber || "").trim();
          if (!tmReg || tmReg === leaderReg) continue;
          const tmStatus = p.teammateStatuses?.[tmReg]?.status;
          if (tmStatus !== "attended") continue;
          entries.push({
            registerNumber: tmReg,
            name: tm.name || "",
            email: tm.email || "",
          });
        }
      } else {
        if (p.status !== "attended") continue;
        if (!isChristEmail(p.email)) continue;
        entries.push({
          registerNumber: String(p.registerNumber || "").trim(),
          name: p.name || "",
          email: p.email || "",
        });
      }
    }

    const present = entries.sort((a, b) =>
      (a.registerNumber || "").localeCompare(b.registerNumber || "", undefined, { numeric: true })
    );

    const sortedTimes = [...periods].map((s) => s.trim()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const periodCols = sortedTimes.map((t) => toPeriodColumnName(t));

    const headers = ["SI No", "Register Number", "Name", "Class", "Date", ...periodCols];
    const totalCols = headers.length;
    const firstPeriodCol = 6;
    const lastPeriodCol = totalCols;

    const earliest = sortedTimes[0];
    const latest = sortedTimes[sortedTimes.length - 1];
    const bannerLeft = eventTitle;
    const bannerRight = `Hours missed (${toAmPmLabel(earliest)} - ${toAmPmLabel(latest)})`;

    ws.addRow(new Array(totalCols).fill(""));
    const bannerRowNum = 1;

    if (firstPeriodCol - 1 >= 1) {
      ws.mergeCells(bannerRowNum, 1, bannerRowNum, firstPeriodCol - 1);
      const leftCell = ws.getCell(bannerRowNum, 1);
      leftCell.value = bannerLeft;
      leftCell.alignment = { vertical: "middle", horizontal: "center" };
      leftCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      leftCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF063168" } };
    }
    ws.mergeCells(bannerRowNum, firstPeriodCol, bannerRowNum, lastPeriodCol);
    const rightCell = ws.getCell(bannerRowNum, firstPeriodCol);
    rightCell.value = bannerRight;
    rightCell.alignment = { vertical: "middle", horizontal: "center" };
    rightCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    rightCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF063168" } };
    ws.getRow(bannerRowNum).height = 28;

    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF154CB3" } };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = {
        top: { style: "thin", color: { argb: "FF1F2937" } },
        left: { style: "thin", color: { argb: "FF1F2937" } },
        bottom: { style: "thin", color: { argb: "FF1F2937" } },
        right: { style: "thin", color: { argb: "FF1F2937" } },
      };
    });
    headerRow.height = 24;
    ws.views = [{ state: "frozen", ySplit: 2 }];

    const dateStr = formatDDMMYYYY(claimsDate);
    const dataRows: (string | number)[][] = present.map((p, idx) => [
      idx + 1,
      p.registerNumber || "",
      p.name,
      deriveClassFromEmail(p.email),
      dateStr,
      ...periodCols,
    ]);

    const colWidths: number[] = headers.map((h, i) => {
      let max = h.length;
      for (const row of dataRows) {
        const len = String(row[i] ?? "").length;
        if (len > max) max = len;
      }
      return Math.max(4, Math.min(40, max + 2));
    });

    dataRows.forEach((row) => {
      const r = ws.addRow(row);
      r.eachCell((cell) => {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });

      let neededLines = 1;
      row.forEach((val, i) => {
        const len = String(val ?? "").length;
        const w = colWidths[i] || 4;
        const lines = Math.max(1, Math.ceil(len / Math.max(1, w - 2)));
        if (lines > neededLines) neededLines = lines;
      });
      if (neededLines > 1) {
        r.height = Math.min(120, 18 + (neededLines - 1) * 15);
      }
    });

    for (let c = 1; c <= totalCols; c++) {
      ws.getColumn(c).width = colWidths[c - 1];
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claims_${eventTitle.replace(/[/\\?%*:|"<>]/g, "-")}_${claimsDate}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleQRScanSuccess = (_result: any) => {
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
  };

  const presentCount = participants.reduce((sum, p) => {
    let count = p.status === "attended" ? 1 : 0;
    if (p.registrationType === "team") {
      const leaderReg = String(p.registerNumber || "").trim();
      for (const tm of p.teammates || []) {
        const tmReg = String(tm.registerNumber || "").trim();
        if (!tmReg || tmReg === leaderReg) continue;
        if (p.teammateStatuses?.[tmReg]?.status === "attended") count++;
      }
    }
    return sum + count;
  }, 0);

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
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 [&_button:not(:disabled)]:cursor-pointer">
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
    <div className="space-y-6 [&_button:not(:disabled)]:cursor-pointer">
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
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setExportMenuOpen((v) => !v)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {exportMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden"
                >
                  <button
                    role="menuitem"
                    onClick={() => { setExportMenuOpen(false); exportAttendance(); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-green-600" aria-hidden />
                    Attendance
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setExportMenuOpen(false); openClaimsModal(); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-green-800" aria-hidden />
                    Claims
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-[#154CB3]">{attendanceStats.total}</div>
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
                {filteredParticipants.map((participant) => {
                  const leaderReg = String(participant.registerNumber || "").trim();
                  const otherTeammates = (participant.teammates || []).filter(
                    (tm) => String(tm.registerNumber || "").trim() !== leaderReg
                  );
                  const isTeam = participant.registrationType === "team" && otherTeammates.length > 0;
                  const isExpanded = isTeam && expandedTeams.has(participant.id);
                  return (
                    <React.Fragment key={participant.id}>
                      <tr
                        onClick={isTeam ? () => toggleTeam(participant.id) : undefined}
                        role={isTeam ? "button" : undefined}
                        tabIndex={isTeam ? 0 : undefined}
                        aria-expanded={isTeam ? isExpanded : undefined}
                        onKeyDown={isTeam ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleTeam(participant.id);
                          }
                        } : undefined}
                        className={`hover:bg-gray-50 ${isTeam ? "cursor-pointer" : ""}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-start gap-2">
                            {isTeam ? (
                              <span
                                aria-hidden="true"
                                className="flex items-center justify-center w-6 h-6 rounded text-gray-600 mt-0.5"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={2}
                                  stroke="currentColor"
                                  className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                </svg>
                              </span>
                            ) : (
                              <span className="inline-block w-6" aria-hidden />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                              <div className="text-sm text-gray-500">{participant.email}</div>
                              {participant.registerNumber && (
                                <div className="text-sm text-gray-500">Reg: {participant.registerNumber}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {participant.teamName || "Individual"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            participant.status === "attended"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {participant.status}
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
                              onClick={(e) => { e.stopPropagation(); markAttendance(participant.id, "attended"); }}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            >
                              Mark Present
                            </button>
                          )}
                          {participant.status !== "absent" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); markAttendance(participant.id, "absent"); }}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                            >
                              Mark Absent
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={4} className="px-6 pt-5 pb-2">
                            <div className="pl-10 text-sm uppercase tracking-wide text-gray-500 font-semibold">
                              Teammates ({otherTeammates.length})
                            </div>
                          </td>
                        </tr>
                      )}
                      {isExpanded && otherTeammates.map((tm, idx) => {
                        const tmReg = String(tm.registerNumber || "").trim();
                        const tmStatusEntry = participant.teammateStatuses?.[tmReg];
                        const tmStatus: "attended" | "absent" =
                          tmStatusEntry?.status === "attended" ? "attended" : "absent";
                        return (
                          <tr
                            key={`${participant.id}-tm-${idx}`}
                            className="bg-gray-50"
                            style={idx === 0 ? { borderTopWidth: 0 } : undefined}
                          >
                            <td className="px-6 py-3 whitespace-nowrap">
                              <div className="pl-10 text-base text-gray-800">
                                <span className="text-gray-500 mr-3">{idx + 1}.</span>
                                {tmReg || "N/A"}
                              </div>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                              {participant.teamName || ""}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                tmStatus === "attended"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {tmStatus}
                              </span>
                              {tmStatusEntry?.marked_at && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {new Date(tmStatusEntry.marked_at).toLocaleString()}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm space-x-2">
                              {tmStatus !== "attended" && tmReg && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); markTeammateAttendance(participant.id, participant.registrationId, tmReg, "attended"); }}
                                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                >
                                  Mark Present
                                </button>
                              )}
                              {tmStatus !== "absent" && tmReg && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); markTeammateAttendance(participant.id, participant.registrationId, tmReg, "absent"); }}
                                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                >
                                  Mark Absent
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
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

      {/* Claims Modal */}
      {showClaimsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md p-4">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold" style={{ color: BRAND_NAVY }}>
                Claim sheet
              </h3>
            </div>
            <div className="px-6 py-4 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={claimsDate}
                  onChange={(e) => { setClaimsDate(e.target.value); if (e.target.value) setDateError(null); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
                />
                {dateError && (
                  <div className="mt-1 text-xs text-red-600">{dateError}</div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time periods <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {sortedOrder.map((idx) => {
                    const value = periods[idx];
                    const isOpen = pickerOpenIdx === idx;
                    const isOnlyRow = periods.length === 1;
                    const err = periodErrors[idx];
                    return (
                      <div key={idx}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPickerOpenIdx(isOpen ? null : idx)}
                            className="flex-1 flex items-center justify-between px-3 py-2 border rounded-md text-left bg-white hover:bg-gray-50"
                            style={{ borderColor: err ? "#dc2626" : "#d1d5db" }}
                          >
                            <span className={value ? "text-gray-900" : "text-gray-400"}>
                              {value || "Select time"}
                            </span>
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => removePeriod(idx)}
                            disabled={isOnlyRow}
                            className={`w-8 h-8 flex items-center justify-center rounded-md ${
                              isOnlyRow
                                ? "text-red-300 cursor-not-allowed"
                                : "text-red-600 hover:bg-red-50"
                            }`}
                            aria-label="Remove period"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {err && (
                          <div className="mt-1 text-xs text-red-600">{err}</div>
                        )}
                        {isOpen && (
                          <TimePicker
                            initial={value}
                            onCancel={() => setPickerOpenIdx(null)}
                            onOk={(hhmm) => { setPeriodValue(idx, hhmm); setPickerOpenIdx(null); }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={addPeriod}
                  disabled={anyPeriodEmpty}
                  title={anyPeriodEmpty ? "Fill the current time field to add next" : undefined}
                  className={`mt-3 inline-flex items-center px-3 py-1.5 text-sm font-medium border rounded-md transition-colors ${
                    anyPeriodEmpty
                      ? "text-gray-400 border-gray-200 bg-gray-50 cursor-not-allowed"
                      : "text-[#154CB3] border-[#154CB3] bg-white hover:bg-[#154CB3]/5"
                  }`}
                >
                  + Add period
                </button>
              </div>

              <div className="text-xs text-gray-500">
                {presentCount} present participant{presentCount === 1 ? "" : "s"} will be included.
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeClaimsModal}
                className="px-4 py-2 text-sm rounded-md text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={validateAndGenerate}
                className="px-4 py-2 text-sm rounded-md text-white"
                style={{ background: BRAND_BLUE }}
              >
                Generate &amp; Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
