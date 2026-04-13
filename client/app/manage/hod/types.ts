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

export type HodApprovalAction = "approve" | "return";
