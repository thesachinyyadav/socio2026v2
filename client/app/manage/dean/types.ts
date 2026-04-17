export interface DeanApprovalQueueItem {
  id: string;
  eventId: string;
  eventName: string;
  entityType: "event" | "fest";
  totalBudget: number;
  coordinatorName: string;
  eventDate: string | null;
  requestedAt: string | null;
  departmentName: string;
}

export interface DeanDepartmentBudgetKpi {
  departmentName: string;
  requestedBudget: number;
  approvedBudget: number;
}

export interface DeanDashboardMetrics {
  pendingL2Approvals: number;
  pendingBudgetTotal: number;
}

export type DeanApprovalAction = "approve" | "return" | "decline";

export interface ApprovalHistoryItem {
  id: string;
  requestId: string;
  entityRef: string;
  entityType: "event" | "fest";
  eventName: string;
  departmentName: string;
  decision: "approved" | "rejected" | "returned_for_revision";
  comment: string | null;
  decidedByEmail: string;
  decidedAt: string;
}
