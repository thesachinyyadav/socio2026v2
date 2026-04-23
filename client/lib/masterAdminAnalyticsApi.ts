import { supabase } from "@/lib/supabaseClient";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

export type AnalyticsKpi = {
  key: string;
  label: string;
  value: number;
  unit: string;
  changePct: number;
};

export type OverviewResponse = {
  generatedAt: string;
  range: {
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
  dataQuality: {
    students: number;
    events: number;
    registrations: number;
    currentPeriodRegistrations: number;
  };
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
  funnel: {
    registered: number;
    attended: number;
    feedback: number;
  };
  monthlyTrend: Array<{
    month: string;
    registrations: number;
    attendanceRate: number;
    avgEngagement: number;
  }>;
  growthRate: number;
};

export type StudentsResponse = {
  generatedAt: string;
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

export type EventsResponse = {
  generatedAt: string;
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
  funnel: {
    registered: number;
    attended: number;
    feedback: number;
  };
  predictions: {
    attendancePrediction: Array<{
      eventId: string;
      title: string;
      eventDate: string | null;
      predictedAttendanceRate: number;
      predictedDropOffRisk: number;
      confidence: "low" | "medium" | "high";
      heuristic: string;
    }>;
    dropOffPrediction: Array<{
      eventId: string;
      title: string;
      eventDate: string | null;
      riskScore: number;
      confidence: "low" | "medium" | "high";
      rationale: string;
    }>;
  };
};

export type DepartmentsResponse = {
  generatedAt: string;
  departments: Array<{
    department: string;
    participationRate: number;
    eventsHosted: number;
    contributionIndex: number;
    crossDepartmentParticipationRate: number;
    crossDepartmentParticipants: number;
    avgEngagementScore: number;
    participatingStudents: number;
    totalStudents: number;
  }>;
};

export type InsightsResponse = {
  generatedAt: string;
  insights: Array<{
    type: "risk" | "opportunity";
    title: string;
    statement: string;
    confidence: "low" | "medium" | "high";
  }>;
  peakAttendanceTime: {
    hour: string;
    attendedCount: number;
    day: string;
    dayAttendanceCount: number;
  };
  timingEfficiency: Array<{
    slot: string;
    day: string;
    hour: string;
    registrations: number;
    attended: number;
    attendanceRate: number;
  }>;
  predictions: EventsResponse["predictions"];
};

export type MasterAdminAnalyticsBundle = {
  overview: OverviewResponse;
  students: StudentsResponse;
  events: EventsResponse;
  departments: DepartmentsResponse;
  insights: InsightsResponse;
};

export type AnalyticsQuery = {
  days?: number;
  start?: string;
  end?: string;
};

function buildQueryString(query: AnalyticsQuery): string {
  const params = new URLSearchParams();
  if (query.days) params.set("days", String(query.days));
  if (query.start) params.set("start", query.start);
  if (query.end) params.set("end", query.end);
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Admin authentication token not available.");
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
    let message = `Failed request: ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string; details?: string };
      message = payload.details || payload.error || message;
    } catch {
      // Ignore JSON parse failure and retain generic message
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchMasterAdminAnalytics(query: AnalyticsQuery = {}): Promise<MasterAdminAnalyticsBundle> {
  const [overview, students, events, departments, insights] = await Promise.all([
    getJson<OverviewResponse>("/api/analytics/overview", query),
    getJson<StudentsResponse>("/api/analytics/students", query),
    getJson<EventsResponse>("/api/analytics/events", query),
    getJson<DepartmentsResponse>("/api/analytics/departments", query),
    getJson<InsightsResponse>("/api/analytics/insights", query),
  ]);

  return { overview, students, events, departments, insights };
}
