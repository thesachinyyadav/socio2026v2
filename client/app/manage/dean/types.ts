export interface DeanApprovalQueueItem {
  id: string;
  eventId: string;
  eventName: string;
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

export type DeanApprovalAction = "approve" | "reject" | "return";
