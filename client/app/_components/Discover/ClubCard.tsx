import Link from "next/link";
import React, { useState } from "react";

interface CardProps {
  title: string;
  subtitle?: string;
  description: string;
  link?: string;
  slug?: string;
  image?: string;
  type: "center" | "club" | "cell";
  showEditButton?: boolean;
  editHref?: string;
}

export const CentreClubCard = ({
  title,
  subtitle,
  description,
  link,
  slug,
  image,
  type,
  showEditButton = false,
  editHref,
}: CardProps) => {
  const [imageError, setImageError] = useState(false);
  // Use provided slug or create URL-friendly version of title for linking
  const slugTitle = slug || String(title ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  
  return (
    <div className="relative h-full min-w-0">
      {showEditButton && editHref ? (
        <Link
          href={editHref}
          onClick={(event) => event.stopPropagation()}
          className="absolute left-3 top-3 z-30 inline-flex items-center gap-1 rounded-full bg-[#154CB3] px-2.5 py-1 text-[11px] font-semibold text-white shadow-md hover:bg-[#0f3f95]"
          aria-label={`Edit ${title}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M17.414 2.586a2 2 0 010 2.828l-8.9 8.9a1 1 0 01-.39.242l-3 1a1 1 0 01-1.266-1.266l1-3a1 1 0 01.242-.39l8.9-8.9a2 2 0 012.828 0z" />
            <path d="M4 16a1 1 0 100 2h12a1 1 0 100-2H4z" />
          </svg>
          Edit
        </Link>
      ) : null}

      <Link href={`/club/${slugTitle}`} className="w-full block h-full min-w-0">
      <div className="bg-white rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg shadow-md h-full border border-blue-100 group w-full min-w-0">
        <div className="relative h-48 overflow-hidden">
          {image && !imageError ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-[#063168]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"></div>
              <img
                src={image}
                alt={title}
                className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                onError={() => setImageError(true)}
                loading="lazy"
              />
              <div className="absolute top-3 right-3 z-20">
                <div className="bg-[#063168]/90 text-white text-xs uppercase font-bold py-1 px-2 rounded-full">
                  {type === "center" ? "Centre" : type === "cell" ? "Cell" : "Club"}
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-[#3D75BD]/5 to-[#063168]/10">
              {type === "center" || type === "cell" ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="60"
                  height="60"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#063168"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-70"
                >
                  <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
                  <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9" />
                  <path d="M12 3v6" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="60"
                  height="60"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#063168"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-70"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              )}
            </div>
          )}
        </div>

        <div className="p-5 min-w-0">
          <div className="flex items-start mb-3">
            <div className="flex-1">
              <h3 className="font-bold text-xl text-[#063168] mb-1 group-hover:text-[#3D75BD] transition-colors duration-200 break-words line-clamp-2">{title}</h3>
              {subtitle && (
                <p className="text-sm text-gray-500 font-medium break-words line-clamp-2">
                  {subtitle}
                </p>
              )}
            </div>
            {title && (
              <div className="w-10 h-10 bg-[#3D75BD]/20 rounded-full flex items-center justify-center text-xl font-bold text-[#063168]">
                {title.charAt(0)}
              </div>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-4 line-clamp-3">
            {description}
          </p>

          <div className="flex items-center gap-2 text-sm text-[#3D75BD] font-medium pt-2 border-t border-gray-100 mt-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
            <span className="group-hover:underline">Learn More</span>
          </div>
        </div>
      </div>
      </Link>
    </div>
  );
};
