import { supabase } from "@/lib/supabaseClient";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Campus Director authentication token not available.");
  }
  return data.session.access_token;
}

async function getJson<T>(path: string): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
    throw new Error(body.details || body.error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Kpi {
  key: string;
  label: string;
  value: number;
  unit: string;
  changePct: number;
}

export interface Insight {
  type: string;
  title: string;
  statement: string;
}

export interface EventRow {
  eventId: string;
  title: string;
  category: string;
  department: string;
  registrations: number;
  attended: number;
  attendanceRate: number;
  avgFeedback: number;
  successScore: number;
}

export interface CategoryRow {
  category: string;
  events: number;
  popularityIndex: number;
  attendanceRate: number;
  avgFeedback: number;
  avgSuccessScore: number;
}

export interface DepartmentRow {
  department: string;
  participationRate: number;
  eventsHosted: number;
  contributionIndex: number;
  crossDepartmentParticipationRate: number;
  crossDepartmentParticipants: number;
  avgEngagementScore: number;
  participatingStudents: number;
  totalStudents: number;
}

export interface MonthlyTrendRow {
  month: string;
  registrations: number;
  attendanceRate: number;
  avgEngagement: number;
}

export interface StudentRow {
  studentId: string;
  name: string;
  department: string;
  year: string;
  registeredCount: number;
  attendedCount: number;
  engagementScore: number;
  noShowRate: number;
  atRiskReason: string | null;
}

export interface FinancialDeptRow {
  department: string;
  total: number;
}

export interface FinancialFestRow {
  fest: string;
  total: number;
}

export interface CampusDirectorSnapshot {
  generatedAt: string;
  campus: string;
  filters?: { school: string | null; department: string | null };
  range: {
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
  dataQuality: {
    students: number;
    events: number;
    fests: number;
    registrations: number;
    currentPeriodRegistrations: number;
  };
  overview: {
    kpis: Kpi[];
    currentStats: Record<string, number>;
    previousStats: Record<string, number>;
    insights: Insight[];
  };
  students: {
    segmentation: { active: number; inactive: number };
    topEngaged: StudentRow[];
    atRisk: StudentRow[];
    behavior: {
      averageNoShowRate: number;
      retentionRate: number;
      dropDetectionRate: number;
    };
  };
  events: {
    attendanceByEvent: EventRow[];
    topEvents: EventRow[];
    categoryPerformance: CategoryRow[];
    funnel: { registered: number; attended: number; feedback: number };
    overallAttendanceRate: number;
  };
  departments: DepartmentRow[];
  time: {
    monthlyTrend: MonthlyTrendRow[];
    growthRate: number;
  };
  audience: { insiders: number; outsiders: number };
  feedback: { avgFeedback: number };
  financials: {
    totalBudget: number;
    itemCount: number;
    approvalCount: number;
    byDepartment: FinancialDeptRow[];
    byFest: FinancialFestRow[];
  };
}

// ── Fetch functions ───────────────────────────────────────────────────────────

export interface CampusDirectorQuery {
  days?: number;
  start?: string;
  end?: string;
  school?: string;
  department?: string;
}

export function fetchCampusDirectorOverview(query: CampusDirectorQuery = {}) {
  const params = new URLSearchParams();
  if (query.start && query.end) {
    params.set("start", query.start);
    params.set("end", query.end);
  } else if (query.days) {
    params.set("days", String(query.days));
  }
  if (query.school) params.set("school", query.school);
  if (query.department) params.set("department", query.department);
  const qs = params.toString();
  return getJson<CampusDirectorSnapshot>(
    `/api/campus-director-analytics/overview${qs ? `?${qs}` : ""}`
  );
}

// ── Hierarchy drill-down (school → department → fest → events) ──────────────────

export interface HierarchyEvent {
  eventId: string;
  title: string;
  category: string;
  date: string | null;
  registrations: number;
  attended: number;
  attendanceRate: number;
  insiders: number;
  outsiders: number;
  feedback: { count: number; score: number };
}

export interface HierarchyFest {
  festId: string | null;
  name: string;
  openingDate: string | null;
  standalone: boolean;
  events: number;
  registrations: number;
  attended: number;
  attendanceRate: number;
  budgetTotal: number;
  eventList: HierarchyEvent[];
}

export interface HierarchyDepartment {
  department: string;
  fests: number;
  events: number;
  registrations: number;
  attended: number;
  attendanceRate: number;
  budgetTotal: number;
  festList: HierarchyFest[];
}

export interface CampusDirectorHierarchy {
  generatedAt: string;
  campus: string;
  range: { start: string; end: string };
  // Flat, deduped by department. The client groups these into the canonical
  // schools (via the eventFormSchema department → school mapping).
  departments: HierarchyDepartment[];
}

export interface CampusDirectorHierarchyQuery {
  days?: number;
  start?: string;
  end?: string;
}

export function fetchCampusDirectorHierarchy(query: CampusDirectorHierarchyQuery = {}) {
  const params = new URLSearchParams();
  if (query.start && query.end) {
    params.set("start", query.start);
    params.set("end", query.end);
  } else if (query.days) {
    params.set("days", String(query.days));
  }
  const qs = params.toString();
  return getJson<CampusDirectorHierarchy>(
    `/api/campus-director-analytics/hierarchy${qs ? `?${qs}` : ""}`
  );
}
