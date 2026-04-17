export interface HodApprovalQueueItem {
  id: string;
  eventId: string;
  eventName: string;
  entityType: "event" | "fest";
  totalBudget: number;
  coordinatorName: string;
  departmentName: string;
  eventDate: string | null;
  requestedAt: string | null;
}

export interface HodDashboardMetrics {
  deptBudgetUsedYtd: number;
  pendingL1Approvals: number;
}

export type HodApprovalAction = "approve" | "return" | "decline";

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
