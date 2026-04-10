export type TaskStatus = "pending" | "in_progress" | "done";

export interface VolunteerEventItem {
  eventId: string;
  title: string;
  eventDate: string | null;
  eventTime: string | null;
  venue: string | null;
  isPrimaryVolunteer: boolean;
  volunteerLabel: string | null;
}

export interface RunsheetTaskItem {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  scheduledTime: string | null;
  status: TaskStatus;
  statusLabel: string;
  responsiblePersonEmail: string | null;
  responsiblePersonLabel: string | null;
  idField: string;
  statusField: string;
  canMutate: boolean;
}

export interface EventResourceItem {
  id: string;
  eventId: string;
  name: string;
  category: string | null;
  quantityLabel: string | null;
  status: "allocated" | "in_use" | "returned";
  statusLabel: string;
  notes: string | null;
  idField: string;
  statusField: string;
  canMutate: boolean;
}

export interface IncidentLogItem {
  id: string;
  eventId: string;
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  description: string;
  reportedBy: string | null;
  createdAt: string | null;
}

export interface VolunteerExecutionDashboardData {
  events: VolunteerEventItem[];
  runsheetByEventId: Record<string, RunsheetTaskItem[]>;
  resourcesByEventId: Record<string, EventResourceItem[]>;
  incidentsByEventId: Record<string, IncidentLogItem[]>;
  warnings: string[];
  hasAccess: boolean;
}
