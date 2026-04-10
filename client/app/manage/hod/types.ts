export interface HodApprovalQueueItem {
  id: string;
  eventId: string;
  eventName: string;
  totalBudget: number;
  coordinatorName: string;
  eventDate: string | null;
  requestedAt: string | null;
}

export interface HodDashboardMetrics {
  deptBudgetUsedYtd: number;
  pendingL1Approvals: number;
}

export type HodApprovalAction = "approve" | "reject" | "return";
