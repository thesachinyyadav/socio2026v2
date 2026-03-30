import Link from "next/link";
import React from "react";

interface FestCardProps {
  id?: string;
  title: string;
  dept: string;
  description: string;
  dateRange: string;
  image: string | null;
  baseUrl?: string;
}

export const FestCard = ({
  id,
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
    
  // Use id if available, otherwise fallback to title slug
  const slug = id || formattedTitle;

  return (
    <Link href={`/${baseUrl}/${slug}`} className="block w-full h-full min-w-0">
      <div className="bg-[#F9F9F9] rounded-lg overflow-hidden border-2 border-gray-200 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg shadow-md flex flex-col group w-full h-full min-w-0">
        <div className="relative h-40 bg-gray-200 overflow-hidden rounded-t-lg">
          {image ? (
            <>
              <div className="absolute inset-0 rounded-t-lg bg-gradient-to-t from-[#063168]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>
              <img
                src={image}
                alt={title}
                className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
              />
            </>
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

        <div className="p-4 rounded-b-lg min-w-0">
          <h3 className="text-lg font-bold mb-1 group-hover:text-[#3D75BD] transition-colors duration-200 break-words line-clamp-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-3 font-semibold break-words line-clamp-2">{dept}</p>

          <p className="text-sm text-gray-600 mb-4 line-clamp-3">
            {description}
          </p>

          <div className="flex items-center gap-1 text-sm text-[#154CB3] group-hover:underline transition-all duration-200">
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
