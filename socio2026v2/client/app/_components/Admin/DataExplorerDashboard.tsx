"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarRange,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Table2,
  TrendingUp,
} from "lucide-react";
import ExcelJS from "exceljs";
import {
  fetchAdminAnalyticsDataset,
  type AnalyticsDataset,
  type AnalyticsUser,
} from "@/lib/adminAnalyticsQueries";
import {
  addThemedChartsSheet,
  type XlsxChartDataPoint,
  type XlsxChartType,
} from "@/lib/xlsxTheme";

type DatePreset = "7d" | "30d" | "90d" | "1y" | "all";
type TimeGranularity = "daily" | "weekly" | "monthly";
type CategoryMode = "department" | "event";
type DonutMode = "roles" | "ticket";
type SortDirection = "asc" | "desc";
type AttendanceStatus = "attended" | "absent" | "pending" | "unmarked";

type SortKey =
  | "registeredAt"
  | "eventTitle"
  | "festTitle"
  | "campus"
  | "department"
  | "eventType"
  | "ticketType"
  | "participantCount"
  | "estimatedRevenue"
  | "attendanceStatus"
  | "registrantEmail";

type ExplorerRow = {
  registrationId: string;
  registeredAt: string | null;
  eventId: string;
  eventTitle: string;
  eventDate: string | null;
  festId: string | null;
  festTitle: string;
  campus: string;
  department: string;
  eventType: string;
  registrationType: string;
  participantOrganization: string;
  ticketType: string;
  participantCount: number;
  estimatedRevenue: number;
  attendanceStatus: AttendanceStatus;
  attendedParticipants: number;
  registrantEmail: string;
  registrantRole: string;
};

type MultiSelectFilterProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
};

type DetailedExportColumn = {
  header: string;
  width: number;
  kind: "text" | "number" | "currency" | "status" | "ticket";
  value: (row: ExplorerRow) => string | number;
};

type ExportSummarySection = {
  title: string;
  rows: Array<{ label: string; value: string | number }>;
};

type ExportChartDefinition = {
  title: string;
  type: XlsxChartType;
  data: XlsxChartDataPoint[];
};

const CHART_COLORS = ["#0f4c81", "#0ea5a4", "#f59e0b", "#ef4444", "#8b5cf6", "#16a34a", "#0ea5e9", "#f97316"];
const DOT_COLOR_CLASSES = [
  "bg-[#0f4c81]",
  "bg-[#0ea5a4]",
  "bg-[#f59e0b]",
  "bg-[#ef4444]",
  "bg-[#8b5cf6]",
  "bg-[#16a34a]",
  "bg-[#0ea5e9]",
  "bg-[#f97316]",
];
const PRIMARY_ARGB = "FF0F4C81";
const SURFACE_ARGB = "FFF8FAFC";
const STRIPED_ROW_ARGB = "FFF6FAFF";

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function getPresetStart(preset: DatePreset): Date | null {
  if (preset === "all") return null;
  const now = new Date();
  const map: Record<Exclude<DatePreset, "all">, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
  };
  const days = map[preset];
  return startOfDay(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
}

function getWeekStart(date: Date): Date {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const value = new Date(date);
  value.setDate(value.getDate() + offset);
  return startOfDay(value);
}

function toCurrency(value: number): string {
  return `INR ${Math.round(value).toLocaleString()}`;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const parsed = toDate(value);
  return parsed ? parsed.toLocaleDateString("en-GB") : "";
}

function formatDateTime(value: string | null): string {
  if (!value) return "";
  const parsed = toDate(value);
  return parsed ? parsed.toLocaleString("en-GB") : "";
}

function formatFilterSelection(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "All";
}

function getExcelColumnLabel(index: number): string {
  let value = index;
  let output = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }

  return output;
}

function getAttendanceCellStyle(status: string): { fill: string; text: string } {
  switch (status.toLowerCase()) {
    case "attended":
      return { fill: "FFDCFCE7", text: "FF166534" };
    case "absent":
      return { fill: "FFFEE2E2", text: "FFB91C1C" };
    case "pending":
      return { fill: "FFFEF3C7", text: "FF92400E" };
    default:
      return { fill: "FFE2E8F0", text: "FF475569" };
  }
}

function getTicketTypeCellStyle(ticketType: string): { fill: string; text: string } {
  switch (ticketType.toLowerCase()) {
    case "outsider":
      return { fill: "FFFEF3C7", text: "FF92400E" };
    case "team":
      return { fill: "FFCCFBF1", text: "FF0F766E" };
    case "individual":
      return { fill: "FFDBEAFE", text: "FF1D4ED8" };
    default:
      return { fill: "FFE2E8F0", text: "FF475569" };
  }
}

function exportCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const escapedRows = rows.map((row) =>
    row
      .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );

  const csv = [headers.join(","), ...escapedRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportDetailedXlsx(
  filename: string,
  columns: DetailedExportColumn[],
  rows: ExplorerRow[],
  summarySections: ExportSummarySection[],
  charts?: {
    primary: ExportChartDefinition;
    secondary?: ExportChartDefinition;
  }
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SOCIO Master Admin";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 34 },
    { header: "Value", key: "value", width: 70 },
  ];

  summarySheet.mergeCells("A1:B1");
  const titleCell = summarySheet.getCell("A1");
  titleCell.value = "Data Explorer Detailed Export";
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_ARGB } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  summarySheet.getRow(1).height = 24;

  const subtitleCell = summarySheet.getCell("A2");
  subtitleCell.value = "Structured by sections: metadata, filters, and KPI snapshot.";
  subtitleCell.font = { italic: true, color: { argb: "FF64748B" } };

  let writeRow = 4;

  summarySections.forEach((section) => {
    summarySheet.mergeCells(`A${writeRow}:B${writeRow}`);
    const sectionTitle = summarySheet.getCell(`A${writeRow}`);
    sectionTitle.value = section.title;
    sectionTitle.font = { bold: true, color: { argb: "FFFFFFFF" } };
    sectionTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C3D67" } };
    sectionTitle.alignment = { horizontal: "left", vertical: "middle" };
    summarySheet.getRow(writeRow).height = 20;
    writeRow += 1;

    const sectionHeader = summarySheet.getRow(writeRow);
    sectionHeader.values = ["Field", "Value"];
    sectionHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    sectionHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_ARGB } };
    sectionHeader.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FF0C3D67" } },
        left: { style: "thin", color: { argb: "FF0C3D67" } },
        bottom: { style: "thin", color: { argb: "FF0C3D67" } },
        right: { style: "thin", color: { argb: "FF0C3D67" } },
      };
    });
    writeRow += 1;

    section.rows.forEach((entry, sectionIndex) => {
      const row = summarySheet.getRow(writeRow);
      row.values = [entry.label, String(entry.value)];

      row.eachCell((cell, columnNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

        if (sectionIndex % 2 === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SURFACE_ARGB } };
        }

        if (columnNumber === 1) {
          cell.font = { bold: true, color: { argb: "FF334155" } };
        }
      });

      writeRow += 1;
    });

    writeRow += 1;
  });

  const dataSheet = workbook.addWorksheet("Detailed Data", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  dataSheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.header,
    width: column.width,
  }));

  rows.forEach((row) => {
    dataSheet.addRow(columns.map((column) => column.value(row)));
  });

  const headerRow = dataSheet.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY_ARGB } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF0C3D67" } },
      left: { style: "thin", color: { argb: "FF0C3D67" } },
      bottom: { style: "thin", color: { argb: "FF0C3D67" } },
      right: { style: "thin", color: { argb: "FF0C3D67" } },
    };
  });

  const currencyColumnIndex = columns.findIndex((column) => column.kind === "currency") + 1;
  const statusColumnIndex = columns.findIndex((column) => column.kind === "status") + 1;
  const ticketColumnIndex = columns.findIndex((column) => column.kind === "ticket") + 1;

  for (let rowIndex = 2; rowIndex <= dataSheet.rowCount; rowIndex += 1) {
    const row = dataSheet.getRow(rowIndex);

    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: typeof cell.value === "number" ? "right" : "left",
        wrapText: true,
      };

      if (rowIndex % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPED_ROW_ARGB } };
      }
    });

    if (currencyColumnIndex > 0) {
      const revenueCell = row.getCell(currencyColumnIndex);
      revenueCell.numFmt = '"INR" #,##0';
    }

    if (statusColumnIndex > 0) {
      const statusCell = row.getCell(statusColumnIndex);
      const style = getAttendanceCellStyle(String(statusCell.value ?? ""));
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
      statusCell.font = { bold: true, color: { argb: style.text } };
      statusCell.alignment = { horizontal: "center", vertical: "middle" };
    }

    if (ticketColumnIndex > 0) {
      const ticketCell = row.getCell(ticketColumnIndex);
      const style = getTicketTypeCellStyle(String(ticketCell.value ?? ""));
      ticketCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
      ticketCell.font = { bold: true, color: { argb: style.text } };
      ticketCell.alignment = { horizontal: "center", vertical: "middle" };
    }
  }

  const headerEndColumn = getExcelColumnLabel(columns.length);
  dataSheet.autoFilter = `A1:${headerEndColumn}1`;

  if (charts && charts.primary.data.length > 0) {
    addThemedChartsSheet(workbook, {
      title: "Data Explorer Visual Overview",
      subtitle: "Chart snapshots are embedded for quick executive analysis.",
      primaryChart: charts.primary,
      secondaryChart: charts.secondary,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function classNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const summary = selected.length === 0 ? "All" : `${selected.length} selected`;

  return (
    <div ref={containerRef} className="relative min-w-[180px]">
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-300"
      >
        <span>{summary}</span>
        <Filter className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-full min-w-[220px] rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Options</span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[10px] font-semibold text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {options.length === 0 && <p className="px-2 py-1 text-xs text-slate-400">No values</p>}
            {options.map((option) => {
              const checked = selected.includes(option);
              return (
                <label
                  key={option}
                  className={classNames(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                    checked ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      if (event.target.checked) {
                        onChange([...selected, option]);
                      } else {
                        onChange(selected.filter((value) => value !== option));
                      }
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  <span className="truncate">{option}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  subLabel,
  accent,
}: {
  label: string;
  value: string;
  subLabel: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={classNames("mt-2 text-2xl font-bold", accent)}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subLabel}</p>
    </div>
  );
}

function getRoleLabel(user: AnalyticsUser | undefined): string {
  if (!user) return "Unknown";
  if (user.is_masteradmin) return "Master Admin";
  if (user.is_support) return "Support";
  if (user.is_organiser) return "Organiser";
  return "Student";
}

const DETAILED_EXPORT_COLUMNS: DetailedExportColumn[] = [
  { header: "Registered At", width: 24, kind: "text", value: (row) => formatDateTime(row.registeredAt) },
  { header: "Event Date", width: 16, kind: "text", value: (row) => formatDate(row.eventDate) },
  { header: "Registration ID", width: 26, kind: "text", value: (row) => row.registrationId },
  { header: "Event ID", width: 22, kind: "text", value: (row) => row.eventId },
  { header: "Event Title", width: 32, kind: "text", value: (row) => row.eventTitle },
  { header: "Fest ID", width: 20, kind: "text", value: (row) => row.festId ?? "" },
  { header: "Fest Title", width: 28, kind: "text", value: (row) => row.festTitle },
  { header: "Campus", width: 20, kind: "text", value: (row) => row.campus },
  { header: "Department", width: 24, kind: "text", value: (row) => row.department },
  { header: "Event Type", width: 22, kind: "text", value: (row) => row.eventType },
  { header: "Registration Type", width: 18, kind: "text", value: (row) => row.registrationType },
  { header: "Participant Organization", width: 24, kind: "text", value: (row) => row.participantOrganization },
  { header: "Ticket Type", width: 16, kind: "ticket", value: (row) => row.ticketType },
  { header: "Participants", width: 14, kind: "number", value: (row) => row.participantCount },
  { header: "Attended Participants", width: 20, kind: "number", value: (row) => row.attendedParticipants },
  { header: "Attendance Status", width: 18, kind: "status", value: (row) => row.attendanceStatus },
  { header: "Estimated Revenue (INR)", width: 20, kind: "currency", value: (row) => Math.round(row.estimatedRevenue) },
  { header: "Registrant Email", width: 34, kind: "text", value: (row) => row.registrantEmail },
  { header: "Registrant Role", width: 16, kind: "text", value: (row) => row.registrantRole },
];

export default function DataExplorerDashboard() {
  const [dataset, setDataset] = useState<AnalyticsDataset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [datePreset, setDatePreset] = useState<DatePreset>("90d");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [campusFilter, setCampusFilter] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [eventTypeFilter, setEventTypeFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>("weekly");
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("department");
  const [donutMode, setDonutMode] = useState<DonutMode>("ticket");

  const [tableQuery, setTableQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("registeredAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [tablePage, setTablePage] = useState(1);

  const loadDataset = useCallback(async (signal?: AbortSignal, silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      const data = await fetchAdminAnalyticsDataset(signal);
      if (signal?.aborted) return;
      setDataset(data);
    } catch (err) {
      if (signal?.aborted) return;
      const message = err instanceof Error ? err.message : "Unable to load analytics dataset.";
      setError(message);
    } finally {
      if (signal?.aborted) return;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadDataset(controller.signal);
    return () => controller.abort();
  }, [loadDataset]);

  const eventById = useMemo(() => {
    const map = new Map<string, AnalyticsDataset["events"][number]>();
    (dataset?.events ?? []).forEach((event) => {
      map.set(event.event_id, event);
    });
    return map;
  }, [dataset?.events]);

  const festById = useMemo(() => {
    const map = new Map<string, AnalyticsDataset["fests"][number]>();
    (dataset?.fests ?? []).forEach((fest) => {
      map.set(fest.fest_id, fest);
    });
    return map;
  }, [dataset?.fests]);

  const festByTitle = useMemo(() => {
    const map = new Map<string, AnalyticsDataset["fests"][number]>();
    (dataset?.fests ?? []).forEach((fest) => {
      map.set(fest.fest_title.toLowerCase(), fest);
    });
    return map;
  }, [dataset?.fests]);

  const userByEmail = useMemo(() => {
    const map = new Map<string, AnalyticsUser>();
    (dataset?.users ?? []).forEach((user) => {
      map.set(user.email.toLowerCase(), user);
    });
    return map;
  }, [dataset?.users]);

  const attendanceByRegistrationId = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    (dataset?.attendance ?? []).forEach((row) => {
      if (!row.registration_id) return;
      const status = row.status ?? "unmarked";
      map.set(row.registration_id, status);
    });
    return map;
  }, [dataset?.attendance]);

  const rows = useMemo<ExplorerRow[]>(() => {
    if (!dataset) return [];

    return dataset.registrations.map((registration) => {
      const event = eventById.get(registration.event_id);
      const festByEventId = event?.fest_id ? festById.get(event.fest_id) : undefined;
      const festByLegacyField = event?.fest ? festById.get(event.fest) ?? festByTitle.get(event.fest.toLowerCase()) : undefined;
      const fest = festByEventId ?? festByLegacyField;

      const registrantEmail =
        registration.user_email ?? registration.individual_email ?? registration.team_leader_email ?? "Unknown";
      const user = registrantEmail !== "Unknown" ? userByEmail.get(registrantEmail.toLowerCase()) : undefined;

      const campus = event?.campus_hosted_at ?? fest?.campus_hosted_at ?? user?.campus ?? "Unknown";
      const department = event?.organizing_dept ?? fest?.organizing_dept ?? user?.department ?? "Unknown";
      const eventType = event?.event_type ?? event?.category ?? "Uncategorized";
      const registrationType = registration.registration_type ?? "unknown";
      const participantOrganization = registration.participant_organization ?? "christ_member";

      const teammateCount = Array.isArray(registration.teammates) ? registration.teammates.length : 0;
      const participantCount = registrationType === "team" ? 1 + teammateCount : 1;

      const baseFee = event?.registration_fee ?? 0;
      const outsiderFee = event?.outsider_registration_fee || baseFee;
      const estimatedRevenue = participantOrganization === "outsider" ? outsiderFee : baseFee;

      const attendanceStatus = attendanceByRegistrationId.get(registration.registration_id) ?? "unmarked";
      const attendedParticipants = attendanceStatus === "attended" ? participantCount : 0;

      const ticketType =
        participantOrganization === "outsider"
          ? "Outsider"
          : registrationType === "team"
            ? "Team"
            : "Individual";

      return {
        registrationId: registration.registration_id,
        registeredAt: registration.created_at,
        eventId: registration.event_id,
        eventTitle: event?.title ?? registration.event_id,
        eventDate: event?.event_date ?? null,
        festId: fest?.fest_id ?? event?.fest_id ?? null,
        festTitle: fest?.fest_title ?? "No Fest",
        campus,
        department,
        eventType,
        registrationType,
        participantOrganization,
        ticketType,
        participantCount,
        estimatedRevenue,
        attendanceStatus,
        attendedParticipants,
        registrantEmail,
        registrantRole: getRoleLabel(user),
      };
    });
  }, [dataset, eventById, festById, festByTitle, userByEmail, attendanceByRegistrationId]);

  const campusOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.campus))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const departmentOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.department))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const eventTypeOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.eventType))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const dateStart = useMemo(() => {
    if (customStartDate) return startOfDay(new Date(customStartDate));
    return getPresetStart(datePreset);
  }, [customStartDate, datePreset]);

  const dateEnd = useMemo(() => {
    if (!customEndDate) return null;
    return endOfDay(new Date(customEndDate));
  }, [customEndDate]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const registeredDate = toDate(row.registeredAt);

      if (dateStart && (!registeredDate || registeredDate < dateStart)) return false;
      if (dateEnd && (!registeredDate || registeredDate > dateEnd)) return false;

      if (campusFilter.length > 0 && !campusFilter.includes(row.campus)) return false;
      if (departmentFilter.length > 0 && !departmentFilter.includes(row.department)) return false;
      if (eventTypeFilter.length > 0 && !eventTypeFilter.includes(row.eventType)) return false;

      if (normalizedSearch) {
        const haystack = [
          row.registrationId,
          row.eventTitle,
          row.festTitle,
          row.campus,
          row.department,
          row.eventType,
          row.registrantEmail,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(normalizedSearch)) return false;
      }

      return true;
    });
  }, [rows, dateStart, dateEnd, campusFilter, departmentFilter, eventTypeFilter, searchQuery]);

  const totalRegistrations = filteredRows.length;

  const totalParticipants = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + row.participantCount, 0);
  }, [filteredRows]);

  const totalAttendance = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + row.attendedParticipants, 0);
  }, [filteredRows]);

  const totalRevenue = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + row.estimatedRevenue, 0);
  }, [filteredRows]);

  const conversionRate = totalParticipants > 0 ? (totalAttendance / totalParticipants) * 100 : 0;

  const topFest = useMemo(() => {
    const festMap = new Map<string, { registrations: number; revenue: number }>();

    filteredRows.forEach((row) => {
      const entry = festMap.get(row.festTitle) ?? { registrations: 0, revenue: 0 };
      entry.registrations += 1;
      entry.revenue += row.estimatedRevenue;
      festMap.set(row.festTitle, entry);
    });

    const sorted = Array.from(festMap.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => {
        if (b.registrations !== a.registrations) return b.registrations - a.registrations;
        return b.revenue - a.revenue;
      });

    return sorted[0] ?? null;
  }, [filteredRows]);

  const timeSeriesData = useMemo(() => {
    const buckets = new Map<string, { label: string; registrations: number; attendance: number }>();

    filteredRows.forEach((row) => {
      const registeredDate = toDate(row.registeredAt);
      if (!registeredDate) return;

      let key = "";
      let label = "";

      if (timeGranularity === "daily") {
        const day = startOfDay(registeredDate);
        key = day.toISOString().slice(0, 10);
        label = day.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      } else if (timeGranularity === "weekly") {
        const weekStart = getWeekStart(registeredDate);
        key = weekStart.toISOString().slice(0, 10);
        label = `Week of ${weekStart.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
      } else {
        key = `${registeredDate.getFullYear()}-${String(registeredDate.getMonth() + 1).padStart(2, "0")}`;
        label = registeredDate.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      }

      const bucket = buckets.get(key) ?? { label, registrations: 0, attendance: 0 };
      bucket.registrations += 1;
      bucket.attendance += row.attendedParticipants;
      buckets.set(key, bucket);
    });

    return Array.from(buckets.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([, values]) => values);
  }, [filteredRows, timeGranularity]);

  const categoricalData = useMemo(() => {
    const group = new Map<string, { registrations: number; attendance: number }>();

    filteredRows.forEach((row) => {
      const bucket = categoryMode === "department" ? row.department : row.eventTitle;
      const current = group.get(bucket) ?? { registrations: 0, attendance: 0 };
      current.registrations += 1;
      current.attendance += row.attendedParticipants;
      group.set(bucket, current);
    });

    return Array.from(group.entries())
      .map(([name, values]) => ({
        name: name.length > 26 ? `${name.slice(0, 26)}...` : name,
        fullName: name,
        registrations: values.registrations,
        attendance: values.attendance,
      }))
      .sort((a, b) => b.registrations - a.registrations)
      .slice(0, 12);
  }, [filteredRows, categoryMode]);

  const donutData = useMemo(() => {
    const bucket = new Map<string, number>();

    filteredRows.forEach((row) => {
      const key = donutMode === "roles" ? row.registrantRole : row.ticketType;
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    });

    return Array.from(bucket.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRows, donutMode]);

  const tableRows = useMemo(() => {
    const normalizedQuery = tableQuery.trim().toLowerCase();

    let nextRows = filteredRows;

    if (normalizedQuery) {
      nextRows = nextRows.filter((row) => {
        const haystack = [
          row.registrationId,
          row.eventTitle,
          row.festTitle,
          row.campus,
          row.department,
          row.eventType,
          row.registrantEmail,
          row.ticketType,
          row.attendanceStatus,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      });
    }

    const sorted = [...nextRows].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "participantCount") {
        return (a.participantCount - b.participantCount) * direction;
      }

      if (sortKey === "estimatedRevenue") {
        return (a.estimatedRevenue - b.estimatedRevenue) * direction;
      }

      if (sortKey === "registeredAt") {
        const aDate = toDate(a.registeredAt)?.getTime() ?? 0;
        const bDate = toDate(b.registeredAt)?.getTime() ?? 0;
        return (aDate - bDate) * direction;
      }

      const valueA = String(a[sortKey] ?? "").toLowerCase();
      const valueB = String(b[sortKey] ?? "").toLowerCase();

      return valueA.localeCompare(valueB) * direction;
    });

    return sorted;
  }, [filteredRows, tableQuery, sortDirection, sortKey]);

  useEffect(() => {
    setTablePage(1);
  }, [tableQuery, filteredRows.length, sortDirection, sortKey]);

  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const safePage = Math.min(tablePage, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return tableRows.slice(start, start + PAGE_SIZE);
  }, [safePage, tableRows]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDirection("desc");
      }
    },
    [sortKey]
  );

  const exportDetailedCsv = useCallback(() => {
    exportCsv(
      "data_explorer_detailed",
      DETAILED_EXPORT_COLUMNS.map((column) => column.header),
      tableRows.map((row) => DETAILED_EXPORT_COLUMNS.map((column) => column.value(row)))
    );
  }, [tableRows]);

  const exportDetailedWorkbook = useCallback(async () => {
    setIsExportingXlsx(true);

    try {
      const activeDateWindow = customStartDate || customEndDate
        ? `${customStartDate || "Any start"} to ${customEndDate || "Any end"}`
        : datePreset === "all"
          ? "All time"
          : datePreset.toUpperCase();

      const timelineChart: ExportChartDefinition = {
        title: `Registrations Trend (${timeGranularity})`,
        type: "line",
        data: timeSeriesData.slice(-24).map((point) => ({
          label: point.label,
          value: point.registrations,
        })),
      };

      const distributionChart: ExportChartDefinition = {
        title: donutMode === "roles" ? "Registrations by User Role" : "Registrations by Ticket Type",
        type: "donut",
        data: donutData.slice(0, 10).map((point) => ({
          label: point.name,
          value: point.value,
        })),
      };

      await exportDetailedXlsx(
        "data_explorer_detailed",
        DETAILED_EXPORT_COLUMNS,
        tableRows,
        [
          {
            title: "Report Metadata",
            rows: [
              { label: "Export Generated At", value: new Date().toLocaleString("en-GB") },
              {
                label: "Data Snapshot Generated At",
                value: dataset?.generatedAt ? new Date(dataset.generatedAt).toLocaleString("en-GB") : "-",
              },
              { label: "Rows Exported", value: tableRows.length },
            ],
          },
          {
            title: "Active Filters and Sort",
            rows: [
              { label: "Date Window", value: activeDateWindow },
              { label: "Campus Filter", value: formatFilterSelection(campusFilter) },
              { label: "Department Filter", value: formatFilterSelection(departmentFilter) },
              { label: "Event Type Filter", value: formatFilterSelection(eventTypeFilter) },
              { label: "Global Search", value: searchQuery.trim() || "None" },
              { label: "Grid Search", value: tableQuery.trim() || "None" },
              { label: "Sort", value: `${sortKey} (${sortDirection})` },
            ],
          },
          {
            title: "KPI Snapshot",
            rows: [
              { label: "Registrations In Scope", value: totalRegistrations.toLocaleString() },
              { label: "Participants In Scope", value: totalParticipants.toLocaleString() },
              { label: "Attendance In Scope", value: totalAttendance.toLocaleString() },
              { label: "Conversion Rate", value: `${conversionRate.toFixed(1)}%` },
              { label: "Estimated Revenue", value: toCurrency(totalRevenue) },
            ],
          },
        ],
        {
          primary: timelineChart,
          secondary: distributionChart,
        }
      );
    } finally {
      setIsExportingXlsx(false);
    }
  }, [
    campusFilter,
    conversionRate,
    customEndDate,
    customStartDate,
    dataset?.generatedAt,
    datePreset,
    departmentFilter,
    eventTypeFilter,
    searchQuery,
    sortDirection,
    sortKey,
    tableQuery,
    tableRows,
    timeGranularity,
    timeSeriesData,
    totalAttendance,
    donutData,
    donutMode,
    totalParticipants,
    totalRegistrations,
    totalRevenue,
  ]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <Loader2 className="mx-auto mb-3 h-9 w-9 animate-spin text-[#0f4c81]" />
        <p className="text-sm font-medium text-slate-600">Loading Data Explorer...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h3 className="text-base font-semibold text-red-800">Unable to load analytics dataset</h3>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => loadDataset(undefined, true)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 rounded-xl border border-slate-200 bg-slate-50/95 p-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#0f4c81]" />
            <p className="text-sm font-semibold text-slate-800">Global Cross Filters</p>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {filteredRows.length.toLocaleString()} rows
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadDataset(undefined, true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw className={classNames("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportDetailedCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0f4c81]/30 bg-white px-3 py-2 text-xs font-semibold text-[#0f4c81] hover:bg-[#eff6ff]"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => {
                void exportDetailedWorkbook();
              }}
              disabled={isExportingXlsx}
              className={classNames(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white",
                isExportingXlsx ? "cursor-not-allowed bg-[#0f4c81]/70" : "bg-[#0f4c81] hover:bg-[#0c3d67]"
              )}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {isExportingXlsx ? "Exporting XLSX..." : "Export XLSX"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Date Window</label>
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
              {(["7d", "30d", "90d", "1y", "all"] as DatePreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setDatePreset(preset);
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  className={classNames(
                    "rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase",
                    datePreset === preset && !customStartDate
                      ? "bg-[#0f4c81] text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-[230px]">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Custom Range</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
              <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={customStartDate}
                onChange={(event) => {
                  setCustomStartDate(event.target.value);
                  setDatePreset("all");
                }}
                title="Custom start date"
                aria-label="Custom start date"
                className="w-full text-xs text-slate-700 outline-none"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(event) => {
                  setCustomEndDate(event.target.value);
                  setDatePreset("all");
                }}
                title="Custom end date"
                aria-label="Custom end date"
                className="w-full text-xs text-slate-700 outline-none"
              />
            </div>
          </div>

          <MultiSelectFilter
            label="Campus"
            options={campusOptions}
            selected={campusFilter}
            onChange={setCampusFilter}
          />
          <MultiSelectFilter
            label="Department"
            options={departmentOptions}
            selected={departmentFilter}
            onChange={setDepartmentFilter}
          />
          <MultiSelectFilter
            label="Event Type"
            options={eventTypeOptions}
            selected={eventTypeFilter}
            onChange={setEventTypeFilter}
          />

          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Global Search</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search events, fests, campuses, departments..."
                className="w-full text-xs text-slate-700 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Total Attendance"
          value={totalAttendance.toLocaleString()}
          subLabel={`${totalParticipants.toLocaleString()} participants in scope`}
          accent="text-[#0f4c81]"
        />
        <KpiCard
          label="Conversion Rate"
          value={`${conversionRate.toFixed(1)}%`}
          subLabel="Attended participants / registered participants"
          accent="text-emerald-700"
        />
        <KpiCard
          label="Top Performing Fest"
          value={topFest ? topFest.name : "N/A"}
          subLabel={topFest ? `${topFest.registrations.toLocaleString()} registrations` : "No registrations in scope"}
          accent="text-amber-600"
        />
        <KpiCard
          label="Total Registrations"
          value={totalRegistrations.toLocaleString()}
          subLabel={`${new Set(filteredRows.map((row) => row.eventId)).size.toLocaleString()} unique events`}
          accent="text-slate-900"
        />
        <KpiCard
          label="Estimated Revenue"
          value={toCurrency(totalRevenue)}
          subLabel="Calculated from registration fee and ticket mix"
          accent="text-rose-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Registrations Over Time</h3>
              <p className="text-xs text-slate-500">Switch between daily, weekly, and monthly trend lines.</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(["daily", "weekly", "monthly"] as TimeGranularity[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTimeGranularity(mode)}
                  className={classNames(
                    "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase",
                    timeGranularity === mode ? "bg-[#0f4c81] text-white" : "text-slate-600 hover:bg-white"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {timeSeriesData.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No timeline data for current filters.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeSeriesData} margin={{ top: 10, right: 12, left: -14, bottom: 8 }}>
                <defs>
                  <linearGradient id="registrationArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f4c81" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0f4c81" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }}
                  labelStyle={{ fontSize: 11, fontWeight: 700 }}
                />
                <Area
                  type="monotone"
                  dataKey="registrations"
                  stroke="#0f4c81"
                  strokeWidth={2.5}
                  fill="url(#registrationArea)"
                  dot={{ r: 2.5 }}
                  activeDot={{ r: 4 }}
                  name="Registrations"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Categorical Comparison</h3>
              <p className="text-xs text-slate-500">Compare registrations and attendance side-by-side.</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(["department", "event"] as CategoryMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCategoryMode(mode)}
                  className={classNames(
                    "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase",
                    categoryMode === mode ? "bg-[#0f4c81] text-white" : "text-slate-600 hover:bg-white"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {categoricalData.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No categorical data for current filters.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoricalData} margin={{ top: 8, right: 10, left: -18, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-25} textAnchor="end" height={70} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                  contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }}
                />
                <Bar dataKey="registrations" fill="#0f4c81" radius={[4, 4, 0, 0]} name="Registrations" />
                <Bar dataKey="attendance" fill="#0ea5a4" radius={[4, 4, 0, 0]} name="Attendance" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Distribution Explorer</h3>
            <p className="text-xs text-slate-500">Analyze user roles or ticket types at a glance.</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(["ticket", "roles"] as DonutMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDonutMode(mode)}
                className={classNames(
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase",
                  donutMode === mode ? "bg-[#0f4c81] text-white" : "text-slate-600 hover:bg-white"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {donutData.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No distribution data for current filters.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={3}>
                    {donutData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {donutData.map((entry, index) => {
                const percentage = totalRegistrations > 0 ? (entry.value / totalRegistrations) * 100 : 0;
                return (
                  <div key={entry.name} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={classNames(
                          "inline-block h-2.5 w-2.5 rounded-full",
                          DOT_COLOR_CLASSES[index % DOT_COLOR_CLASSES.length]
                        )}
                      />
                      <span className="text-xs font-semibold text-slate-700">{entry.name}</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{entry.value.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{percentage.toFixed(1)}% share</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-[#0f4c81]" />
            <h3 className="text-sm font-bold text-slate-900">Data Grid</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {tableRows.length.toLocaleString()} rows
            </span>
          </div>

          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 md:max-w-[360px]">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={tableQuery}
              onChange={(event) => setTableQuery(event.target.value)}
              placeholder="Filter table rows..."
              className="w-full text-xs text-slate-700 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                {[
                  ["registeredAt", "Registered At"],
                  ["registrationId", "Registration ID"],
                  ["eventTitle", "Event"],
                  ["festTitle", "Fest"],
                  ["campus", "Campus"],
                  ["department", "Department"],
                  ["eventType", "Event Type"],
                  ["ticketType", "Ticket Type"],
                  ["participantCount", "Participants"],
                  ["estimatedRevenue", "Revenue"],
                  ["attendanceStatus", "Attendance"],
                  ["registrantEmail", "Registrant"],
                ].map(([key, label]) => {
                  const normalized = key as SortKey;
                  const isActive = sortKey === normalized;
                  return (
                    <th
                      key={key}
                      className="cursor-pointer whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-100"
                      onClick={() => handleSort(normalized)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {isActive && <TrendingUp className={classNames("h-3 w-3", sortDirection === "asc" && "rotate-180")} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-sm text-slate-400">
                    No rows match the current filter combination.
                  </td>
                </tr>
              )}

              {paginatedRows.map((row) => (
                <tr key={row.registrationId} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {row.registeredAt ? new Date(row.registeredAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{row.registrationId}</td>
                  <td className="px-3 py-2 text-slate-700">{row.eventTitle}</td>
                  <td className="px-3 py-2 text-slate-700">{row.festTitle}</td>
                  <td className="px-3 py-2 text-slate-700">{row.campus}</td>
                  <td className="px-3 py-2 text-slate-700">{row.department}</td>
                  <td className="px-3 py-2 text-slate-700">{row.eventType}</td>
                  <td className="px-3 py-2 text-slate-700">{row.ticketType}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.participantCount.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{toCurrency(row.estimatedRevenue)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={classNames(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        row.attendanceStatus === "attended" && "bg-emerald-100 text-emerald-700",
                        row.attendanceStatus === "absent" && "bg-red-100 text-red-700",
                        row.attendanceStatus === "pending" && "bg-amber-100 text-amber-700",
                        row.attendanceStatus === "unmarked" && "bg-slate-100 text-slate-600"
                      )}
                    >
                      {row.attendanceStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.registrantEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">
            Page {safePage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTablePage((prev) => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
              className={classNames(
                "rounded-lg px-3 py-1.5 text-xs font-semibold",
                safePage <= 1 ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-white text-slate-700 hover:bg-slate-100"
              )}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setTablePage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
              className={classNames(
                "rounded-lg px-3 py-1.5 text-xs font-semibold",
                safePage >= totalPages
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                  : "bg-[#0f4c81] text-white hover:bg-[#0c3d67]"
              )}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-500">
        <p>
          Data source snapshot: {dataset?.generatedAt ? new Date(dataset.generatedAt).toLocaleString() : "-"}. 
          Queries run via authenticated browser Supabase session and processed with memoized client transforms.
        </p>
      </div>
    </div>
  );
}
