import React from "react";
import { CentreClubCard } from "./ClubCard";
import { SectionHeader } from "./SectionHeader";

interface Centre {
  id: number;
  title: string;
  subtitle?: string;
  description: string;
  link?: string;
  image?: string;
  slug?: string;
}

interface Club {
  id: number;
  title: string;
  department: string;
  description: string;
  link?: string;
  image?: string;
}

interface SectionProps {
  title: string;
  items: Centre[] | Club[];
  type: "centre" | "club";
  linkUrl: string;
  showAll?: boolean;
}

export const ClubSection = ({
  title,
  items,
  type,
  linkUrl,
  showAll = false,
}: SectionProps) => {
  const displayItems = showAll ? items : items.slice(0, 6);

  return (
    <div>
      <SectionHeader title={title} link={linkUrl} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        {displayItems.map((item) => (
          <CentreClubCard
            key={item.id}
            title={item.title}
            subtitle={
              type === "club"
                ? (item as Club).department
                : (item as Centre).subtitle
            }
            description={item.description}
            link={item.link}
            slug={(item as Centre).slug}
            image={item.image}
            type={type === "centre" ? "center" : "club"}
          />
        ))}
      </div>
    </div>
  );
};
