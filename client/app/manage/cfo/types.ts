export interface CfoApprovalQueueItem {
  id: string;
  eventId: string;
  eventName: string;
  totalBudget: number;
  coordinatorName: string;
  eventDate: string | null;
  requestedAt: string | null;
  schoolId: string;
  schoolName: string;
  departmentId: string;
  departmentName: string;
}

export interface CfoDashboardMetrics {
  campusRequestedBudgetYtd: number;
  campusApprovedBudgetYtd: number;
  highValuePendingRequests: number;
  highValuePendingBudget: number;
  l2Threshold: number;
}

export type CfoApprovalAction = "approve" | "reject" | "return";
