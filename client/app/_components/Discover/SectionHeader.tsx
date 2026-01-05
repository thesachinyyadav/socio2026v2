import Link from "next/link";
import React from "react";

interface SectionHeaderProps {
  title: string;
  link: string;
}

export const SectionHeader = ({ title, link }: SectionHeaderProps) => {
  return (
    <div className="flex justify-between items-center mb-4 md:mb-6">
      <h2 className="text-xl md:text-2xl font-bold text-[#063168]">{title}</h2>

      {title != "Browse by category" ? (
        <Link
          href={link}
          className="text-[#063168] text-sm md:text-base font-semibold flex items-center"
        >
          View all
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3 md:h-4 md:w-4 ml-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      ) : null}
    </div>
  );
};
