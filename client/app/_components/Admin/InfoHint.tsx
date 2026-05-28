"use client";

import { Info } from "lucide-react";

type InfoHintProps = {
  text: string;
  label?: string;
  size?: "sm" | "md";
};

export default function InfoHint({ text, label, size = "md" }: InfoHintProps) {
  const buttonSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span className="group relative inline-flex shrink-0 align-middle">
      <button
        type="button"
        aria-label={label ? `More info: ${label}` : "More information"}
        className={`inline-flex ${buttonSize} items-center justify-center rounded-full text-slate-400 transition-colors hover:text-[#154CB3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#154CB3]/40`}
      >
        <Info className={iconSize} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-64 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
