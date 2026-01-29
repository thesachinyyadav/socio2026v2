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
}

interface FestsSectionProps {
  title: string;
  fests: Fest[];
  showAll?: boolean;
  baseUrl?: string;
}

export const FestsSection = ({
  title,
  fests,
  showAll = false,
  baseUrl = "fest",
}: FestsSectionProps) => {
  return (
    <div>
      <SectionHeader title={title} link="fests" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        {fests.map((fest) => (
          <div key={fest.fest_id}>
            <FestCard
              title={fest.fest_title}
              dept={fest.organizing_dept}
              description={fest.description}
              dateRange={formatDateRange(fest.opening_date, fest.closing_date)}
              image={fest.fest_image_url}
              baseUrl={baseUrl}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
