"use client";

import React from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onNext: () => void;
  onPrev: () => void;
  totalItems: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onNext,
  onPrev,
  totalItems,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl mt-4 ${className}`}>
      <div className="text-xs text-gray-500">
        Page {currentPage} of {totalPages}
        <span className="ml-2 text-gray-400">({totalItems} items)</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Prev
        </button>
        <button
          onClick={onNext}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#154CB3] text-white hover:bg-[#124099] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
