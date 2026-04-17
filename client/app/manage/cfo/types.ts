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
