import Link from "next/link";
import React from "react";

interface FestCardProps {
  title: string;
  dept: string;
  description: string;
  dateRange: string;
  image: string | null;
  baseUrl?: string;
}

export const FestCard = ({
  title,
  dept,
  description,
  dateRange,
  image,
  baseUrl = "fest",
}: FestCardProps) => {
  const formattedTitle = (title || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  return (
    <Link href={`/${baseUrl}/${formattedTitle}`} className="w-full">
      <div className="bg-[#F9F9F9] rounded-lg overflow-hidden cursor-pointer transform transition duration-100 ease-in-out hover:scale-101">
        <div className="h-40 bg-gray-200 border border-gray-100">
          {image ? (
            <img
              src={image}
              alt={title}
              className="bg-white w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="60"
                height="60"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-400"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
          )}
        </div>

        <div className="p-4 rounded-b-lg border border-gray-300 border-t-0">
          <h3 className="text-lg font-bold mb-1">{title}</h3>
          <p className="text-sm text-gray-500 mb-3 font-semibold">{dept}</p>

          <p className="text-sm text-gray-600 mb-4 line-clamp-3">
            {description}
          </p>

          <div className="flex items-center gap-1 text-sm text-[#154CB3]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 -mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{dateRange}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};
