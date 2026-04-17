"use client";
import CreateFestForm from "../../../_components/CreateFestForm";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../../../context/AuthContext"; // Adjust path

const PENDING_WORKFLOW_STATUS_REGEX = /^pending_level_([1-4])$/;
const APPROVAL_LEVEL_LABEL_BY_NUMBER: Record<number, string> = {
  1: "Level 1 (HOD)",
  2: "Level 2 (Dean/Director)",
  3: "Level 3 (CFO/Campus Director)",
  4: "Level 4 (Accounts)",
};

const getPendingApprovalLabel = (workflowStatus?: string | null) => {
  const normalized = String(workflowStatus || "").trim().toLowerCase();
  const match = PENDING_WORKFLOW_STATUS_REGEX.exec(normalized);
  if (!match) return null;
  const level = Number(match[1]);
  const levelLabel = APPROVAL_LEVEL_LABEL_BY_NUMBER[level] || `Level ${level}`;
  return `Awaiting ${levelLabel} approval`;
};

const normalizeLifecycleStatus = (
  value: unknown,
  fallback: "draft" | "published" = "draft"
): "draft" | "pending_approvals" | "revision_requested" | "approved" | "published" => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (
    normalized === "draft" ||
    normalized === "pending_approvals" ||
    normalized === "revision_requested" ||
    normalized === "approved" ||
    normalized === "published"
  ) {
    return normalized;
  }

  return fallback;
};

interface FestDataForEdit {
  title: string;
  openingDate: string;
  closingDate: string;
  detailedDescription: string;
  department: string[];
  category: string;
  contactEmail: string;
  contactPhone: string;
  eventHeads: { email: string; expiresAt: string | null }[];
  organizingSchool: string;
  organizingDept: string;
  isDraft: boolean;
}

const normalizeApiBase = (value: unknown): string =>
  String(value || "").trim().replace(/\/+$/, "").replace(/\/api\/?$/i, "");

const parseJsonSafely = (value: string): any | null => {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const buildEndpointCandidates = (apiBase: string, path: string): string[] => {
  const candidates = new Set<string>();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  candidates.add(normalizedPath);

  if (apiBase) {
    candidates.add(`${apiBase}${normalizedPath}`);
  }
  return Array.from(candidates);
};

const EditPage = () => {
  const params = useParams();
  const festId = params?.id as string;
  const { session, userData, isLoading: authIsLoading } = useAuth();
  const API_URL = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);
  const [festData, setFestData] = useState<FestDataForEdit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);
  const [lifecycleStatus, setLifecycleStatus] = useState<string | null>(null);

  const [existingImageFileUrl, setExistingImageFileUrl] = useState<
    string | null
  >(null);
  const [existingBannerFileUrl, setExistingBannerFileUrl] = useState<
    string | null
  >(null);
  const [existingPdfFileUrl, setExistingPdfFileUrl] = useState<string | null>(
    null
  );

  const isMasterAdminUser = Boolean((userData as any)?.is_masteradmin);
  const pendingApprovalLabel = getPendingApprovalLabel(workflowStatus);
  const isLifecyclePendingApproval =
    normalizeLifecycleStatus(lifecycleStatus, "draft") === "pending_approvals";

  const isBudgetLocked =
    (Boolean(pendingApprovalLabel) || isLifecyclePendingApproval) &&
    !isMasterAdminUser;

  useEffect(() => {
    if (festId && session?.access_token) {
      const fetchFest = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
          const endpointPath = `/api/fests/${encodeURIComponent(festId)}`;
          const endpointCandidates = buildEndpointCandidates(API_URL, endpointPath);

          let data: any = null;
          let lastError: Error | null = null;

          for (const endpoint of endpointCandidates) {
            try {
              const response = await fetch(endpoint, {
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: "no-store",
              });

              const rawBody = await response.text();
              const parsedBody = parseJsonSafely(rawBody);

              if (!response.ok) {
                const responseError =
                  typeof parsedBody?.error === "string"
                    ? parsedBody.error
                    : response.status === 404
                      ? `Fest with ID '${festId}' not found.`
                      : `Failed to fetch fest (${response.status})`;
                throw new Error(responseError);
              }

              if (!parsedBody || typeof parsedBody !== "object") {
                throw new Error("Fest endpoint returned an invalid response.");
              }

              data = parsedBody;
              break;
            } catch (endpointError: any) {
              lastError =
                endpointError instanceof Error
                  ? endpointError
                  : new Error(String(endpointError || "Failed to fetch fest."));
            }
          }

          if (!data) {
            throw lastError || new Error("Failed to fetch fest data.");
          }

          if (data.fest) {
            const normalizedWorkflowStatus = String(data.fest.workflow_status || "").trim().toLowerCase();
            setWorkflowStatus(normalizedWorkflowStatus || null);
            const normalizedLifecycleStatus = normalizeLifecycleStatus(
              data.fest.status,
              data.fest.is_draft === true ||
                data.fest.is_draft === 1 ||
                data.fest.is_draft === "1" ||
                data.fest.is_draft === "true"
                ? "draft"
                : "published"
            );
            setLifecycleStatus(normalizedLifecycleStatus);

            // Transform event_heads to new format
            const eventHeadsData = data.fest.event_heads || [];
            const transformedEventHeads = eventHeadsData.map((head: any) => {
              if (typeof head === 'string') {
                return { email: head, expiresAt: null };
              }
              return { email: head.email || '', expiresAt: head.expiresAt || null };
            });

            const fetched: FestDataForEdit = {
              title: data.fest.fest_title || "",
              openingDate: data.fest.opening_date
                ? new Date(data.fest.opening_date).toISOString().split("T")[0]
                : "",
              closingDate: data.fest.closing_date
                ? new Date(data.fest.closing_date).toISOString().split("T")[0]
                : "",
              detailedDescription: data.fest.description || "",
              department: data.fest.department_access || [],
              category: data.fest.category || "",
              contactEmail: data.fest.contact_email || "",
              contactPhone: data.fest.contact_phone || "",
              eventHeads: transformedEventHeads,
              organizingSchool: data.fest.organizing_school || "",
              organizingDept: data.fest.organizing_dept || "",
              isDraft:
                data.fest.is_draft === true ||
                data.fest.is_draft === 1 ||
                data.fest.is_draft === "1" ||
                data.fest.is_draft === "true",
            };
            setFestData(fetched);

            setExistingImageFileUrl(data.fest.fest_image_url || null);
            setExistingBannerFileUrl(data.fest.banner_url || null);
            setExistingPdfFileUrl(data.fest.pdf_url || null);
          } else {
            throw new Error("Fest data not found in response.");
          }
        } catch (e: any) {
          console.error("Error fetching fest data:", e);
          setErrorMessage(`Error fetching fest: ${e.message}`);
        } finally {
          setIsLoading(false);
        }
      };
      fetchFest();
    } else {
      setIsLoading(false);
      if (!festId) {
        setErrorMessage("Fest ID is missing from URL.");
      }
    }
  }, [festId, session]);

  if (authIsLoading) {
    return <div className="p-8 text-center">Loading fest data...</div>;
  }

  if (isLoading) {
    return <div className="p-8 text-center">Loading fest data...</div>;
  }

  if (errorMessage && !festData) {
    return <div className="p-8 text-center text-red-600">{errorMessage}</div>;
  }

  if (!festData && festId && !isLoading) {
    return (
      <div className="p-8 text-center">
        Fest not found or there was an issue loading its data.
      </div>
    );
  }

  if (!festId) {
    return (
      <div className="p-8 text-center text-red-600">
        Fest ID is missing from URL. Cannot edit fest.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isBudgetLocked && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">
              {pendingApprovalLabel ?? "Approval in progress"}
            </p>
            <p className="mt-1">
              You can still edit the title, description, venue, dates and registration fields.
              Budget details are locked until the current approval is completed or rejected.
            </p>
          </div>
        )}
        <CreateFestForm
          isBudgetLocked={isBudgetLocked}
          title={festData?.title}
          openingDate={festData?.openingDate}
          closingDate={festData?.closingDate}
          detailedDescription={festData?.detailedDescription}
          department={festData?.department}
          category={festData?.category}
          contactEmail={festData?.contactEmail}
          contactPhone={festData?.contactPhone}
          eventHeads={festData?.eventHeads}
          organizingSchool={festData?.organizingSchool}
          organizingDept={festData?.organizingDept}
          isEditMode={true}
          existingImageFileUrl={existingImageFileUrl}
          existingBannerFileUrl={existingBannerFileUrl}
          existingPdfFileUrl={existingPdfFileUrl}
          isDraft={Boolean(festData?.isDraft)}
          lifecycleStatus={lifecycleStatus}
        />
      </div>
    </div>
  );
};

export default EditPage;

