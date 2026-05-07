import { supabase } from "@/lib/supabaseClient";
import type { AnalyticsKpi, AnalyticsQuery } from "./masterAdminAnalyticsApi";
import { getUserFriendlyErrorMessage } from "@/lib/userFacingErrors";

export type { AnalyticsKpi, AnalyticsQuery };

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

// ── Shared range/dataQuality shape ─────────────────────────────────────────

type AnalyticsRange = {
  current: { start: string; end: string };
  previous: { start: string; end: string };
};

type DataQuality = {
  students: number;
  events: number;
  registrations: number;
  currentPeriodRegistrations: number;
};

// ── Insight ────────────────────────────────────────────────────────────────

export type HodInsightItem = {
  type: "risk" | "opportunity";
  title: string;
  statement: string;
  confidence: "low" | "medium" | "high";
};

// ── Overview ───────────────────────────────────────────────────────────────

export type HodOverviewResponse = {
  generatedAt: string;
  department: string;
  range: AnalyticsRange;
  dataQuality: DataQuality;
  kpis: AnalyticsKpi[];
  stats: {
    participationRate: number;
    attendanceRate: number;
    dropOffRate: number;
    avgEventsPerStudent: number;
    activeStudentsPct: number;
  };
  previousStats: {
    participationRate: number;
    attendanceRate: number;
    dropOffRate: number;
    avgEventsPerStudent: number;
    activeStudentsPct: number;
  };
  funnel: { registered: number; attended: number; feedback: number };
  monthlyTrend: Array<{
    month: string;
    registrations: number;
    attendanceRate: number;
    avgEngagement: number;
  }>;
  growthRate: number;
  insights: HodInsightItem[];
  activeTeachers: number;
  totalDeptEvents: number;
};

// ── Students ───────────────────────────────────────────────────────────────

export type HodStudentsResponse = {
  generatedAt: string;
  department: string;
  range: AnalyticsRange;
  segmentation: { active: number; inactive: number };
  topEngaged: Array<{
    studentId: string;
    name: string;
    department: string;
    year: string;
    engagementScore: number;
    attendedCount: number;
    organizedCount: number;
    noShows: number;
    noShowRate: number;
  }>;
  atRisk: Array<{
    studentId: string;
    name: string;
    department: string;
    year: string;
    engagementScore: number;
    attendedCount: number;
    organizedCount: number;
    noShows: number;
    noShowRate: number;
    engagementDrop: number;
    currentAttendedCount: number;
    previousAttendedCount: number;
    atRiskReason: string | null;
    lastActivityAt: string | null;
  }>;
  behavior: {
    averageNoShowRate: number;
    retentionRate: number;
    dropDetectionRate: number;
    droppedStudents: Array<{
      studentId: string;
      name: string;
      department: string;
      engagementDrop: number;
      currentAttendedCount: number;
      previousAttendedCount: number;
    }>;
  };
  engagementScores: Array<{
    studentId: string;
    name: string;
    department: string;
    year: string;
    registeredCount: number;
    attendedCount: number;
    organizedCount: number;
    noShows: number;
    noShowRate: number;
    engagementScore: number;
    status: "active" | "inactive";
    atRiskReason: string | null;
    lastActivityAt: string | null;
    engagementDrop: number;
    currentAttendedCount: number;
    previousAttendedCount: number;
  }>;
};

// ── Teachers ───────────────────────────────────────────────────────────────

export type HodTeacherEntry = {
  teacherId: string;
  name: string;
  email: string | null;
  eventsOrganized: number;
  totalRegistrations: number;
  totalAttended: number;
  avgAttendanceRate: number;
  lastActiveAt: string | null;
};

export type HodTeachersResponse = {
  generatedAt: string;
  department: string;
  range: AnalyticsRange;
  teachers: {
    summary: {
      totalTeachers: number;
      activeTeachers: number;
      avgAttendanceRate: number;
    };
    byTeacher: HodTeacherEntry[];
  };
};

// ── Events ─────────────────────────────────────────────────────────────────

export type HodEventsResponse = {
  generatedAt: string;
  department: string;
  range: AnalyticsRange;
  attendanceByEvent: Array<{
    eventId: string;
    title: string;
    category: string;
    department: string;
    registrations: number;
    attended: number;
    attendanceRate: number;
    avgFeedback: number;
    repeatParticipation: number;
    successScore: number;
  }>;
  topEvents: Array<{
    eventId: string;
    title: string;
    successScore: number;
    attendanceRate: number;
    avgFeedback: number;
  }>;
  categoryPerformance: Array<{
    category: string;
    events: number;
    popularityIndex: number;
    attendanceRate: number;
    avgFeedback: number;
    avgSuccessScore: number;
  }>;
  funnel: { registered: number; attended: number; feedback: number };
  overallAttendanceRate: number;
};

// ── Bundle ─────────────────────────────────────────────────────────────────

export type HodAnalyticsBundle = {
  overview: HodOverviewResponse;
  students: HodStudentsResponse;
  teachers: HodTeachersResponse;
  events: HodEventsResponse;
};

// ── Fetch helpers ──────────────────────────────────────────────────────────

function buildQueryString(query: AnalyticsQuery): string {
  const params = new URLSearchParams();
  if (query.days) params.set("days", String(query.days));
  if (query.start) params.set("start", query.start);
  if (query.end) params.set("end", query.end);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Please sign in again.");
  }
  return data.session.access_token;
}

async function getJson<T>(path: string, query: AnalyticsQuery = {}): Promise<T> {
  const token = await getAuthToken();
  const response = await fetch(`${API_URL}${path}${buildQueryString(query)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const payload = (await response.json()) as { error?: string; details?: string };
      message = getUserFriendlyErrorMessage(payload, message);
    } catch {
      // Ignore JSON parse failure
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchHodAnalytics(
  query: AnalyticsQuery = {}
): Promise<HodAnalyticsBundle> {
  const [overview, students, teachers, events] = await Promise.all([
    getJson<HodOverviewResponse>("/api/hod-analytics/overview", query),
    getJson<HodStudentsResponse>("/api/hod-analytics/students", query),
    getJson<HodTeachersResponse>("/api/hod-analytics/teachers", query),
    getJson<HodEventsResponse>("/api/hod-analytics/events", query),
  ]);
  return { overview, students, teachers, events };
}

// ── Fest Dashboard types & helpers ─────────────────────────────────────────

export interface HodFest {
  id: string;
  name: string;
  dates: string;
}

export interface HodFestFeedback {
  count: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  q5: number;
  score: number;
}

export interface HodFestEvent {
  id: string;
  name: string;
  cat: string;
  date: string;
  regs: number;
  attend: number;
  rate: number;
  insiders: number;
  outsiders: number;
  description: string;
  feedback: HodFestFeedback;
}

export interface HodFestSummaryStats {
  events: number;
  registrations: number;
  attendance: number;
  attendanceRate: number;
  dropOff: number;
  insiders: number;
  outsiders: number;
  feedbackRate: number;
}

export interface HodFestSummary {
  fest: HodFest;
  department: string;
  summary: HodFestSummaryStats;
  events: HodFestEvent[];
  deptBreakdown: { dept: string; count: number; color?: string }[];
}

// ── Token-less fetch helpers (mirrors deanAnalyticsApi pattern) ───────────────

export function fetchHodFestsInternal(): Promise<{ fests: HodFest[]; department: string }> {
  return getJson<{ fests: HodFest[]; department: string }>("/api/hod-analytics/fests");
}

export function fetchHodFestDetail(festId: string): Promise<HodFestSummary> {
  return getJson<HodFestSummary>(
    `/api/hod-analytics/fest-summary?festId=${encodeURIComponent(festId)}`
  );
}

export async function fetchHodFests(token: string): Promise<HodFest[]> {
  const response = await fetch(`${API_URL}/api/hod-analytics/fests`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `Failed to fetch fests: ${response.status}`);
  }
  const data = await response.json() as { fests: HodFest[] };
  return data.fests;
}

export async function fetchHodFestSummary(token: string, festId: string): Promise<HodFestSummary> {
  const response = await fetch(
    `${API_URL}/api/hod-analytics/fest-summary?festId=${encodeURIComponent(festId)}`,
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `Failed to fetch fest summary: ${response.status}`);
  }
  return response.json() as Promise<HodFestSummary>;
}
