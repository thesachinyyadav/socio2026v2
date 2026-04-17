export type FinanceApprovalAction = "approve" | "reject" | "return";

export interface FinanceL4ApprovalItem {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string | null;
  cfoApprovedAt: string | null;
  requestedAt: string | null;
  departmentName: string;
  schoolName: string;
  coordinatorName: string;
  totalEstimatedExpense: number;
}

export interface FinanceAdvanceRequestItem {
  budgetId: string;
  eventId: string;
  eventName: string;
  departmentName: string;
  totalEstimatedExpense: number;
  advanceRequestedAmount: number;
  advancePaidAmount: number;
  advanceRemainingAmount: number;
  vendors: string[];
}

export interface FinanceExpenseDocumentItem {
  id: string;
  eventId: string;
  budgetId: string | null;
  fileName: string;
  fileUrl: string;
  documentType: string;
  amount: number | null;
  uploadedAt: string | null;
  uploadedBy: string | null;
  financeVerified: boolean;
}

export interface FinanceSettlementItem {
  budgetId: string;
  eventId: string;
  eventName: string;
  departmentName: string;
  schoolName: string;
  totalEstimatedExpense: number;
  totalActualExpense: number;
  varianceAmount: number;
  settlementStatus: string;
  financeStatus: string;
  allDocumentsVerified: boolean;
  mathChecksOut: boolean;
  documents: FinanceExpenseDocumentItem[];
}

export interface FinanceDashboardData {
  approvals: FinanceL4ApprovalItem[];
  advances: FinanceAdvanceRequestItem[];
  settlements: FinanceSettlementItem[];
  history: ApprovalHistoryItem[];
  warnings: string[];
}

export interface FinanceActionResult {
  ok: boolean;
  message: string;
}

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
