import React from "react";
import { FestCard } from "./FestCard";
import { SectionHeader } from "./SectionHeader";
import { formatDateRange } from "@/lib/dateUtils";

interface Fest {
  fest_id: number;
  fest_title: string;
  organizing_dept: string;
  description: string;
  dateRange: string;
  fest_image_url: string;
  opening_date: Date;
  closing_date: Date;
  is_archived?: boolean | null;
  is_draft?: boolean | null;
  created_by?: string | null;
}

interface FestsSectionProps {
  title: string;
  fests: Fest[];
  showAll?: boolean;
  baseUrl?: string;
  approvalStatuses?: Record<string, "pending_approvals" | "live">;
}

export const FestsSection = ({
  title,
  fests,
  showAll = false,
  baseUrl = "fest",
  approvalStatuses = {},
}: FestsSectionProps) => {
  return (
    <div className="min-w-0">
      <SectionHeader title={title} link="fests" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {fests.map((fest) => (
          <div key={fest.fest_id} className="min-w-0 h-full">
            <FestCard
              title={fest.fest_title}
              dept={fest.organizing_dept}
              description={fest.description}
              dateRange={formatDateRange(fest.opening_date, fest.closing_date)}
              image={fest.fest_image_url}
              baseUrl={baseUrl}
              isArchived={Boolean(fest.is_archived)}
              isDraft={Boolean(fest.is_draft)}
              isPendingApproval={approvalStatuses[String(fest.fest_id)] === "pending_approvals"}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
