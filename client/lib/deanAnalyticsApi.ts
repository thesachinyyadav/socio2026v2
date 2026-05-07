import { supabase } from "@/lib/supabaseClient";
import { getUserFriendlyErrorMessage } from "@/lib/userFacingErrors";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Please sign in again.");
  }
  return data.session.access_token;
}

async function getJson<T>(path: string): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; details?: string };
    throw new Error(getUserFriendlyErrorMessage(body));
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeanSummary {
  totalFests: number;
  totalEvents: number;
  totalRegistrations: number;
  totalAttended: number;
  avgAttendanceRate: number;
  avgFeedback: number;
  monthlyTrend: { month: string; registrations: number; attendance: number }[];
  insiderOutsider: { insiders: number; outsiders: number };
}

export interface DeanDeptRow {
  name: string;
  events: number;
  registrations: number;
  attendance: number;
  attendanceRate: number;
}

export interface DeanFestRow {
  id: string;
  name: string;
  events: number;
  registrations: number;
  attendance: number;
  attendanceRate: number;
  avgFeedback: number;
}

export interface DeanHighlights {
  bestAttendance: DeanFestRow | null;
  bestFeedback: DeanFestRow | null;
  worstTurnout: DeanFestRow | null;
  lowestAttendance: DeanFestRow | null;
}

export interface DeanFestsResponse {
  fests: DeanFestRow[];
  highlights: DeanHighlights;
}

// Drill-down shapes
export interface DrillDept {
  name: string;
  events: number;
  fests: number;
  registrations: number;
  attendance: number;
  attendanceRate: number;
}

export interface DrillFest {
  id: string;
  name: string;
  events: number;
  registrations: number;
  attendance: number;
  attendanceRate: number;
}

export interface BudgetItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface DrillEvent {
  id: string;
  name: string;
  cat: string;
  date: string;
  description: string;
  regs: number;
  attend: number;
  rate: number;
  insiders: number;
  outsiders: number;
  feedback: {
    count: number;
    q1: number; q2: number; q3: number; q4: number; q5: number;
    score: number;
  };
}

export interface DrillFestDetail {
  fest: { id: string; name: string; dates: string; description: string };
  budgetItems: BudgetItem[];
  budgetTotal: number;
  summary: {
    events: number;
    registrations: number;
    attendance: number;
    attendanceRate: number;
    insiders: number;
    outsiders: number;
  };
  events: DrillEvent[];
}

// ── Fetch functions ───────────────────────────────────────────────────────────

export function fetchDeanSummary() {
  return getJson<DeanSummary>("/api/dean-analytics/summary");
}

export function fetchDeanDepartments() {
  return getJson<{ departments: DeanDeptRow[] }>("/api/dean-analytics/departments");
}

export function fetchDeanFests() {
  return getJson<DeanFestsResponse>("/api/dean-analytics/fests");
}

export function fetchDrillDepartments() {
  return getJson<{ departments: DrillDept[] }>("/api/dean-analytics/drill");
}

export function fetchDrillFests(dept: string) {
  return getJson<{ fests: DrillFest[] }>(
    `/api/dean-analytics/drill?dept=${encodeURIComponent(dept)}`
  );
}

export function fetchDrillFestDetail(festId: string) {
  return getJson<DrillFestDetail>(
    `/api/dean-analytics/fest-detail?festId=${encodeURIComponent(festId)}`
  );
}
