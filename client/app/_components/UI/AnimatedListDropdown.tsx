"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import AnimatedList from "@/components/AnimatedList";
import { cn } from "@/lib/utils";

interface AnimatedListOption {
  value: string;
  label: string;
}

interface AnimatedListDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: AnimatedListOption[];
  placeholder: string;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
}

export default function AnimatedListDropdown({
  value,
  onChange,
  options,
  placeholder,
  className,
  triggerClassName,
  panelClassName,
}: AnimatedListDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const labels = options.map((option) => option.label);

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700",
          "focus:outline-none focus:ring-2 focus:ring-[#154cb3]/30 flex items-center justify-between gap-3",
          "hover:bg-slate-50 transition-colors cursor-pointer",
          triggerClassName
        )}
      >
        <span className="truncate text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 transition-transform",
            isOpen ? "rotate-180" : "rotate-0"
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute z-40 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg p-2",
            panelClassName
          )}
        >
          <AnimatedList
            items={labels}
            initialSelectedIndex={selectedIndex}
            onItemSelect={(_, index) => {
              const selected = options[index];
              if (!selected) return;
              onChange(selected.value);
              setIsOpen(false);
            }}
            showGradients
            enableArrowNavigation={false}
            displayScrollbar={false}
            className="w-full"
            listClassName="max-h-[240px] px-1 py-1"
            itemWrapperClassName="mb-1 last:mb-0"
            itemClassName="!bg-slate-50 hover:!bg-slate-100 !rounded-md !p-3"
            selectedItemClassName="!bg-[#154cb3]/10"
            itemTextClassName="!text-slate-700 text-sm font-medium"
            topGradientClassName="bg-gradient-to-b from-white to-transparent"
            bottomGradientClassName="bg-gradient-to-t from-white to-transparent"
          />
        </div>
      )}
    </div>
  );
}
