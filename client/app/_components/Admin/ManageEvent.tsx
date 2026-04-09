"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  useForm,
  SubmitHandler,
  FieldError,
  Controller,
  ControllerRenderProps,
  useWatch,
  Control,
  FieldErrors,
  Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";

import {
  EventFormData,
  eventFormSchema,
  departments as departmentOptions,
  categories as categoryOptions,
  festEvents as festEventOptions,
  christCampuses,
} from "@/app/lib/eventFormSchema";

import { getFests } from "@/lib/api";

import {
  InputField,
  CustomDropdown,
  FileInput,
  DynamicScheduleList,
  DynamicTextList,
} from "@/app/_components/UI/FormElements";

import { DynamicCustomFieldBuilder, CustomField } from "@/app/_components/UI/DynamicCustomFieldBuilder";

import { useAuth } from "@/context/AuthContext";
import LoadingIndicator from "@/app/_components/UI/LoadingIndicator";
import PublishingOverlay from "@/app/_components/UI/PublishingOverlay";
import {
  buildEventPreviewData,
  saveEventPreviewDraft,
} from "@/app/lib/eventPreviewDraft";

export const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseYYYYMMDD = (dateString: string): Date | null => {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
  const date = new Date(dateString + "T00:00:00Z");
  const [year, month, day] = dateString.split("-").map(Number);
  if (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  ) {
    return date;
  }
  return null;
};

export const formatTimeToHHMM = (hours: number, minutes: number): string => {
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
};

export const parseHHMM = (
  timeString: string
): { hours: number; minutes: number } | null => {
  if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) return null;
  const [h, m] = timeString.split(":").map(Number);
  if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
    return { hours: h, minutes: m };
  }
  return null;
};

interface MultiSelectDropdownProps {
  name: keyof EventFormData;
  control: Control<EventFormData>;
  options: { value: string; label: string }[];
  placeholder?: string;
  label: string;
  error?: FieldError;
  required?: boolean;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  name,
  control,
  options,
  placeholder = "Select departments",
  label,
  error,
  required,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const selectedValues = Array.isArray(field.value) ? field.value as string[] : [];

        const handleCheckboxChange = (optionValue: string) => {
          const newValues = selectedValues.includes(optionValue)
            ? selectedValues.filter((val) => val !== optionValue)
            : [...selectedValues, optionValue];
          field.onChange(newValues);
        };

        let displayString = placeholder;
        if (selectedValues.length > 0) {
          const firstSelectedOption = options.find(
            (opt) => opt.value === selectedValues[0]
          );
          if (firstSelectedOption) {
            displayString = firstSelectedOption.label;
            if (selectedValues.length > 1) {
              displayString += ` +${selectedValues.length - 1}`;
            }
          } else {
            displayString = `${selectedValues.length} selected`;
          }
        }
        const tooltipText =
          selectedValues.length > 0
            ? options
                .filter((opt) => selectedValues.includes(opt.value))
                .map((opt) => opt.label)
                .join(", ")
            : placeholder;

        return (
          <div className="w-full">
            <label
              htmlFor={String(name)}
              className="block mb-2 text-sm font-medium text-gray-700"
            >
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                id={String(name)}
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                title={tooltipText}
                className={`bg-white rounded-lg px-4 py-0 border-2 w-full text-left flex items-center justify-between transition-all h-[46px] sm:h-[48px] overflow-hidden ${
                  isOpen
                    ? "border-[#154CB3] ring-1 ring-[#154CB3]"
                    : "border-gray-300 hover:border-gray-400"
                } ${error ? "border-red-500" : ""}`}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
              >
                <span
                  className={`text-sm block w-full py-3 pr-2 ${
                    selectedValues.length > 0
                      ? "text-gray-900"
                      : "text-gray-500"
                  } whitespace-nowrap overflow-hidden text-ellipsis`}
                >
                  {displayString}
                </span>
                <svg
                  className={`h-5 w-5 text-gray-500 transition-transform flex-shrink-0 ml-2 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isOpen && (
                <div
                  className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-full max-h-60 overflow-y-auto"
                  role="listbox"
                >
                  {options.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedValues.includes(option.value)}
                        onChange={() => handleCheckboxChange(option.value)}
                        className="h-4 w-4 text-[#154CB3] border-gray-300 rounded focus:ring-[#154CB3]"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {error && (
              <p className="text-red-500 text-xs mt-1">{error.message}</p>
            )}
          </div>
        );
      }}
    />
  );
};

interface CustomDatePickerProps {
  field: ControllerRenderProps<EventFormData, any>;
  label: string;
  error?: FieldError;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
  id?: string;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  field,
  label,
  error,
  placeholder = "Select date",
  minDate,
  maxDate,
  required,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const initialDisplayDate =
    parseYYYYMMDD(field.value as string) ||
    (minDate && new Date() < minDate ? minDate : new Date());
  const [displayMonth, setDisplayMonth] = useState<Date>(initialDisplayDate);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedDateObj = parseYYYYMMDD(field.value as string);

  useEffect(() => {
    const validValueDate = parseYYYYMMDD(field.value as string);
    if (validValueDate && !isOpen) {
      setDisplayMonth(validValueDate);
    } else if (!validValueDate && !isOpen && field.name === "eventDate") {
      setDisplayMonth(minDate && new Date() < minDate ? minDate : new Date());
    }
  }, [field.value, isOpen, minDate, field.name]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const daysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) =>
    new Date(year, month, 1).getDay();

  const handlePrevMonth = () =>
    setDisplayMonth(
      new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1)
    );
  const handleNextMonth = () =>
    setDisplayMonth(
      new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1)
    );

  const handleDayClick = (day: number) => {
    const newSelectedDate = new Date(
      displayMonth.getFullYear(),
      displayMonth.getMonth(),
      day
    );
    field.onChange(formatDateToYYYYMMDD(newSelectedDate));
    setIsOpen(false);
  };

  const renderDays = () => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const numDays = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    const dayElements: React.ReactElement[] = [];

    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    dayElements.push(
      ...dayNames.map((name) => (
        <div
          key={name}
          className="text-center text-xs font-medium text-gray-500 py-1"
        >
          {name}
        </div>
      ))
    );

    for (let i = 0; i < firstDay; i++) {
      dayElements.push(<div key={`empty-${i}`} className="py-1" />);
    }

    for (let day = 1; day <= numDays; day++) {
      const currentDateInLoop = new Date(year, month, day);
      const currentDateStr = formatDateToYYYYMMDD(currentDateInLoop);
      const isSelected =
        selectedDateObj &&
        formatDateToYYYYMMDD(selectedDateObj) === currentDateStr;

      const minDateAtMidnight = minDate
        ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
        : null;
      const maxDateAtMidnight = maxDate
        ? new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())
        : null;
      const currentDateInLoopAtMidnight = new Date(
        currentDateInLoop.getFullYear(),
        currentDateInLoop.getMonth(),
        currentDateInLoop.getDate()
      );

      const isDisabled =
        (minDateAtMidnight &&
          currentDateInLoopAtMidnight < minDateAtMidnight) ||
        (maxDateAtMidnight && currentDateInLoopAtMidnight > maxDateAtMidnight) ||
        false;

      dayElements.push(
        <button
          type="button"
          key={currentDateStr}
          disabled={isDisabled}
          onClick={() => handleDayClick(day)}
          className={`w-full text-center py-2 text-sm rounded transition-colors ${
            isSelected
              ? "bg-[#154CB3] text-white font-semibold"
              : "hover:bg-gray-100"
          } ${
            isDisabled ? "text-gray-300 cursor-not-allowed" : "text-gray-700"
          }`}
        >
          {day}
        </button>
      );
    }
    return dayElements;
  };

  return (
    <div className="w-full">
      <label
        htmlFor={id || field.name}
        className="block mb-2 text-sm font-medium text-gray-700"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          id={id || field.name}
          ref={triggerRef}
          onClick={() => {
            setIsOpen(!isOpen);
            if (isOpen) field.onBlur();
          }}
          className={`bg-white rounded-lg px-4 py-3 border-2 w-full text-left flex items-center justify-between transition-all h-[46px] sm:h-[48px] ${
            isOpen
              ? "border-[#154CB3] ring-1 ring-[#154CB3]"
              : "border-gray-300 hover:border-gray-400"
          } ${error ? "border-red-500" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={`${field.name}-calendar-panel`}
        >
          <span
            className={`text-sm ${
              field.value ? "text-gray-900" : "text-gray-500"
            }`}
          >
            {field.value ? field.value : placeholder}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-calendar-icon lucide-calendar text-gray-500"
          >
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18" />
          </svg>
        </button>
        {isOpen && (
          <div
            id={`${field.name}-calendar-panel`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${field.name}-monthyear`}
            className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-4 w-full sm:w-80"
          >
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-[#154CB3]"
                aria-label="Previous month"
              >
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <div
                id={`${field.name}-monthyear`}
                className="text-sm font-semibold text-gray-800"
              >
                {displayMonth.toLocaleString("default", {
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-[#154CB3]"
                aria-label="Next month"
              >
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
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
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">{renderDays()}</div>
          </div>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
    </div>
  );
};

interface CustomTimePickerProps {
  field: ControllerRenderProps<EventFormData, any>;
  label: string;
  error?: FieldError;
  placeholder?: string;
  required?: boolean;
  id?: string;
}
const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  field,
  label,
  error,
  placeholder = "Select time",
  required,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const parsedInitialTime = parseHHMM(field.value as string);
  const [selectedHour, setSelectedHour] = useState<number>(
    parsedInitialTime?.hours ?? 12
  );
  const [selectedMinute, setSelectedMinute] = useState<number>(
    parsedInitialTime?.minutes ?? 0
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parsedFieldValue = parseHHMM(field.value as string);
    if (parsedFieldValue) {
      setSelectedHour(parsedFieldValue.hours);
      setSelectedMinute(parsedFieldValue.minutes);
    } else if (!field.value) {
      setSelectedHour(12);
      setSelectedMinute(0);
    }
  }, [field.value]);

  useEffect(() => {
    if (isOpen) {
      const hourEl = hourListRef.current?.querySelector(
        `[data-hour="${selectedHour}"]`
      ) as HTMLElement;
      if (hourEl && hourListRef.current) {
        hourListRef.current.scrollTop =
          hourEl.offsetTop -
          hourListRef.current.offsetTop -
          hourListRef.current.clientHeight / 2 +
          hourEl.clientHeight / 2;
      }

      const minuteEl = minuteListRef.current?.querySelector(
        `[data-minute="${selectedMinute}"]`
      ) as HTMLElement;
      if (minuteEl && minuteListRef.current) {
        minuteListRef.current.scrollTop =
          minuteEl.offsetTop -
          minuteListRef.current.offsetTop -
          minuteListRef.current.clientHeight / 2 +
          minuteEl.clientHeight / 2;
      }
    }
  }, [isOpen, selectedHour, selectedMinute]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSetTime = () => {
    field.onChange(formatTimeToHHMM(selectedHour, selectedMinute));
    setIsOpen(false);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 / 5 }, (_, i) => i * 5);

  const renderTimeColumn = (
    items: number[],
    currentDisplayValue: number,
    onSelectValue: (value: number) => void,
    type: "hour" | "minute",
    listRef: React.RefObject<HTMLDivElement | null>
  ) => (
    <div
      ref={listRef}
      className="h-48 overflow-y-auto border-r border-gray-200 last:border-r-0 px-1 flex-1 custom-scrollbar"
      role="listbox"
      aria-label={`${type} selection`}
    >
      {items.map((item) => (
        <button
          type="button"
          key={item}
          data-hour={type === "hour" ? item : undefined}
          data-minute={type === "minute" ? item : undefined}
          onClick={() => onSelectValue(item)}
          className={`w-full text-center py-1.5 text-sm rounded transition-colors block ${
            item === currentDisplayValue
              ? "bg-[#154CB3] text-white font-semibold"
              : "hover:bg-gray-100 text-gray-700"
          }`}
          role="option"
          aria-selected={item === currentDisplayValue}
        >
          {item.toString().padStart(2, "0")}
        </button>
      ))}
    </div>
  );

  return (
    <div className="w-full">
      <label
        htmlFor={id || field.name}
        className="block mb-2 text-sm font-medium text-gray-700"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          id={id || field.name}
          ref={triggerRef}
          onClick={() => {
            setIsOpen(!isOpen);
            if (isOpen) field.onBlur();
          }}
          className={`bg-white rounded-lg px-4 py-3 border-2 w-full text-left flex items-center justify-between transition-all h-[46px] sm:h-[48px] ${
            isOpen
              ? "border-[#154CB3] ring-1 ring-[#154CB3]"
              : "border-gray-300 hover:border-gray-400"
          } ${error ? "border-red-500" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={`${field.name}-time-panel`}
        >
          <span
            className={`text-sm ${
              field.value ? "text-gray-900" : "text-gray-500"
            }`}
          >
            {field.value ? field.value : placeholder}
          </span>
          <svg
            className={`h-5 w-5 text-gray-500 transition-colors ${
              isOpen ? "text-[#154CB3]" : ""
            }`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        {isOpen && (
          <div
            id={`${field.name}-time-panel`}
            role="dialog"
            aria-modal="true"
            className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3 w-48"
          >
            <div className="flex justify-between">
              {renderTimeColumn(
                hours,
                selectedHour,
                (h) => setSelectedHour(h),
                "hour",
                hourListRef
              )}
              {renderTimeColumn(
                minutes,
                selectedMinute,
                (m) => setSelectedMinute(m),
                "minute",
                minuteListRef
              )}
            </div>
            <button
              type="button"
              onClick={handleSetTime}
              className="mt-3 w-full bg-[#154CB3] text-white text-sm py-2 rounded-md hover:bg-[#154cb3eb] transition-colors"
            >
              Set Time
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
    </div>
  );
};

interface EventFormProps {
  onSubmit: SubmitHandler<EventFormData>;
  onSubmitDraft?: SubmitHandler<EventFormData>;
  defaultValues?: Partial<EventFormData>;
  isSubmittingProp: boolean;
  isEditMode: boolean;
  existingImageFileUrl?: string | null;
  existingBannerFileUrl?: string | null;
  existingPdfFileUrl?: string | null;
  isArchived?: boolean;
  isDraft?: boolean;
  isArchiveUpdating?: boolean;
  onToggleArchive?: () => void;
}

const baseButtonClasses =
  "inline-flex items-center justify-center text-sm sm:text-base font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50";
const primaryButtonClasses = `${baseButtonClasses} bg-[#154CB3] text-white hover:bg-[#0f3a7a] focus:ring-[#154CB3] px-4 sm:px-6 py-2 sm:py-2.5 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg`;
const secondaryButtonClasses = `${baseButtonClasses} border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-[#154CB3] px-4 sm:px-5 py-2 sm:py-2.5 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg`;
const toggleTrackClass =
  "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#154CB3]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#154CB3]";

interface FestOption {
  value: string;
  label: string;
  departmentAccess: string[];
  organizingDept: string;
  category: string;
  campusHostedAt: string;
  allowedCampuses: string[];
  allowOutsiders: boolean;
}

const toCanonical = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeStringArray(parsed);
      } catch {
        // Fall through to plain string handling.
      }
    }

    if (trimmed.includes(",")) {
      return Array.from(
        new Set(
          trimmed
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        )
      );
    }

    return [trimmed];
  }

  return [];
};

const normalizeDepartmentAccess = (value: unknown): string[] =>
  Array.from(
    new Set(
      normalizeStringArray(value).map((entry) => {
        const directValueMatch = departmentOptions.find((dept) => dept.value === entry);
        if (directValueMatch) return directValueMatch.value;

        const canonicalEntry = toCanonical(entry);
        const mapped = departmentOptions.find(
          (dept) =>
            toCanonical(dept.value) === canonicalEntry ||
            toCanonical(dept.label) === canonicalEntry
        );

        return mapped?.value || entry;
      })
    )
  );

const normalizeCategoryValue = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const directValueMatch = categoryOptions.find((category) => category.value === trimmed);
  if (directValueMatch) return directValueMatch.value;

  const canonicalEntry = toCanonical(trimmed);
  const mapped = categoryOptions.find(
    (category) =>
      toCanonical(category.value) === canonicalEntry ||
      toCanonical(category.label) === canonicalEntry
  );

  return mapped?.value || "";
};

const normalizeCampusEntry = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const directMatch = christCampuses.find((campus) => campus === trimmed);
  if (directMatch) return directMatch;

  const canonicalEntry = toCanonical(trimmed);
  const mapped = christCampuses.find(
    (campus) => toCanonical(campus) === canonicalEntry
  );

  return mapped || null;
};

const normalizeCampusHostedAt = (value: unknown): string => {
  const first = normalizeStringArray(value)[0];
  if (!first) return "";
  return normalizeCampusEntry(first) || "";
};

const normalizeAllowedCampuses = (value: unknown): string[] =>
  Array.from(
    new Set(
      normalizeStringArray(value)
        .map((entry) => normalizeCampusEntry(entry))
        .filter((entry): entry is string => Boolean(entry))
    )
  );

const normalizeBoolean = (value: unknown): boolean =>
  value === true || value === "true" || value === 1 || value === "1";

const CONTACT_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const CONTACT_EMAIL_MAX_LENGTH = 100;

const normalizeEmailInput = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase();

const isArchivedFest = (fest: any): boolean =>
  normalizeBoolean(fest?.is_archived) || normalizeBoolean(fest?.archived_effective);

const normalizeFestOptionValue = (fest: any): string => {
  const rawValue = fest?.fest_id ?? fest?.id ?? fest?.fest_title ?? fest?.title;
  const normalized = String(rawValue ?? "").trim();
  return normalized || "Untitled Fest";
};

const normalizeFestOptionLabel = (fest: any): string => {
  const normalized = String(fest?.fest_title ?? fest?.title ?? "").trim();
  return normalized || "Untitled Fest";
};

const EVENT_ERROR_SCROLL_ORDER: string[] = [
  "eventTitle",
  "eventDate",
  "endDate",
  "registrationDeadline",
  "eventTime",
  "festEvent",
  "isTeamEvent",
  "minParticipants",
  "maxParticipants",
  "detailedDescription",
  "allowOutsiders",
  "outsiderRegistrationFee",
  "outsiderMaxParticipants",
  "campusHostedAt",
  "allowedCampuses",
  "organizingDept",
  "department",
  "category",
  "provideClaims",
  "imageFile",
  "bannerFile",
  "pdfFile",
  "whatsappLink",
  "location",
  "registrationFee",
  "contactEmail",
  "contactPhone",
  "rules",
  "scheduleItems",
  "prizes",
];

const EVENT_ERROR_SELECTOR_MAP: Record<string, string> = {
  eventTitle: "#eventTitle",
  eventDate: "#eventDate",
  endDate: "#endDate",
  registrationDeadline: "#registrationDeadline",
  eventTime: "#eventTime",
  festEvent: "#festEvent",
  isTeamEvent: "#isTeamEvent",
  minParticipants: "#minParticipants",
  maxParticipants: "#maxParticipants",
  detailedDescription: "#detailedDescription",
  allowOutsiders: "#allowOutsiders",
  outsiderRegistrationFee: "#outsiderRegistrationFee",
  outsiderMaxParticipants: "#outsiderMaxParticipants",
  campusHostedAt: "#campusHostedAt",
  allowedCampuses: "#allowedCampuses-group",
  organizingDept: "#organizingDept",
  department: "#department",
  category: "#category",
  provideClaims: "#provideClaims",
  imageFile: "#imageFile",
  bannerFile: "#bannerFile",
  pdfFile: "#pdfFile",
  whatsappLink: "#whatsappLink",
  location: "#location",
  registrationFee: "#registrationFee",
  contactEmail: "#contactEmail",
  contactPhone: "#contactPhone",
};

const getFirstErrorPath = (errorNode: unknown, prefix = ""): string | null => {
  if (!errorNode || typeof errorNode !== "object") return null;

  if (Array.isArray(errorNode)) {
    for (let index = 0; index < errorNode.length; index += 1) {
      const nestedPath = getFirstErrorPath(
        errorNode[index],
        prefix ? `${prefix}.${index}` : String(index)
      );
      if (nestedPath) return nestedPath;
    }
    return null;
  }

  const nodeRecord = errorNode as Record<string, unknown>;
  if (typeof nodeRecord.message === "string" || typeof nodeRecord.type === "string") {
    return prefix || null;
  }

  for (const key of Object.keys(nodeRecord)) {
    const value = nodeRecord[key];
    const nestedPath = getFirstErrorPath(value, prefix ? `${prefix}.${key}` : key);
    if (nestedPath) return nestedPath;
  }

  return null;
};

export default function EventForm({
  onSubmit,
  onSubmitDraft,
  defaultValues,
  isSubmittingProp,
  isEditMode,
  existingImageFileUrl,
  existingBannerFileUrl,
  existingPdfFileUrl,
  isArchived,
  isDraft,
  isArchiveUpdating,
  onToggleArchive,
}: EventFormProps) {
  const [fetchedFests, setFetchedFests] = useState<FestOption[]>([]);

  useEffect(() => {
    async function fetchFests() {
      try {
        const fests = await getFests();
        if (fests) {
          const options: FestOption[] = fests
            .filter((f: any) => !isArchivedFest(f))
            .map((f: any) => ({
              value: normalizeFestOptionValue(f),
              label: normalizeFestOptionLabel(f),
              departmentAccess: normalizeDepartmentAccess(f.department_access),
              organizingDept:
                typeof f.organizing_dept === "string" ? f.organizing_dept.trim() : "",
              category: normalizeCategoryValue(f.category),
              campusHostedAt: normalizeCampusHostedAt(f.campus_hosted_at),
              allowedCampuses: normalizeAllowedCampuses(f.allowed_campuses),
              allowOutsiders: normalizeBoolean(f.allow_outsiders ?? f.allowOutsiders),
            }));
          setFetchedFests([
            {
              value: "none",
              label: "None",
              departmentAccess: [],
              organizingDept: "",
              category: "",
              campusHostedAt: "",
              allowedCampuses: [],
              allowOutsiders: false,
            },
            ...options,
          ]);
        }
      } catch (error) {
        console.error("Failed to fetch fests:", error);
      }
    }
    fetchFests();
  }, []);

  const router = useRouter();
  const pathname = usePathname();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting: rhfIsSubmitting },
    setValue,
    watch,
    reset,
    trigger,
    getValues,
  } = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema) as unknown as Resolver<EventFormData>,
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      eventTitle: "",
      eventDate: "",
      endDate: "",
      eventTime: "",
      detailedDescription: "",
      department: [],
      category: "",
      organizingDept: "",
      festEvent: "none",
      registrationDeadline: "",
      location: "",
      registrationFee: "",
      isTeamEvent: false,
      maxParticipants: "",
      minParticipants: "",
      contactEmail: "",
      contactPhone: "",
      whatsappLink: "",
      rules: [],
      scheduleItems: [],
      prizes: [],
      provideClaims: false,
      onSpot: false,
      allowOutsiders: false,
      outsiderRegistrationFee: "",
      outsiderMaxParticipants: "",
      campusHostedAt: "",
      allowedCampuses: [],
      imageFile: null,
      bannerFile: null,
      pdfFile: null,
      ...defaultValues,
    },
  });

  const scrollToFirstValidationError = React.useCallback(
    (formErrors: FieldErrors<EventFormData>) => {
      const errorsRecord = formErrors as Record<string, unknown>;
      const prioritizedKey = EVENT_ERROR_SCROLL_ORDER.find(
        (fieldKey) => Boolean(errorsRecord[fieldKey])
      );
      const firstErrorPath = getFirstErrorPath(formErrors);
      const fallbackKey = firstErrorPath ? firstErrorPath.split(".")[0] : null;
      const targetKey = prioritizedKey || fallbackKey;

      const selectors: string[] = [];

      if (targetKey && EVENT_ERROR_SELECTOR_MAP[targetKey]) {
        selectors.push(EVENT_ERROR_SELECTOR_MAP[targetKey]);
      }

      if (firstErrorPath) {
        selectors.push(`[id="${firstErrorPath}"]`);

        if (firstErrorPath.startsWith("scheduleItems.")) {
          const scheduleParts = firstErrorPath.split(".");
          const scheduleIndex = scheduleParts[1] || "0";
          const scheduleField = scheduleParts[2] || "activity";
          selectors.push(`[id="scheduleItems.${scheduleIndex}.${scheduleField}"]`);
          selectors.push(`[id="scheduleItems.${scheduleIndex}.activity"]`);
          selectors.push(`[id="scheduleItems.${scheduleIndex}.time"]`);
        }

        if (firstErrorPath.startsWith("rules.") || firstErrorPath.startsWith("prizes.")) {
          const listParts = firstErrorPath.split(".");
          const listName = listParts[0];
          const listIndex = listParts[1] || "0";
          selectors.push(`[id="${listName}.${listIndex}.value"]`);
        }
      }

      if (targetKey) {
        selectors.push(`[id="${targetKey}"]`);
        selectors.push(`[name="${targetKey}"]`);
      }

      let targetElement: HTMLElement | null = null;
      for (const selector of selectors) {
        const found = document.querySelector<HTMLElement>(selector);
        if (found) {
          targetElement = found;
          break;
        }
      }

      if (!targetElement) return;

      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      const focusableSelector =
        "input,select,textarea,button,[tabindex]:not([tabindex='-1'])";
      const focusTarget = targetElement.matches(focusableSelector)
        ? targetElement
        : targetElement.querySelector<HTMLElement>(focusableSelector);

      if (focusTarget) {
        window.setTimeout(() => {
          focusTarget.focus({ preventScroll: true });
        }, 120);
      }
    },
    []
  );

  const handleInvalidSubmit = React.useCallback(
    (formErrors: FieldErrors<EventFormData>) => {
      console.warn("EventForm: Validation errors present:", formErrors);
      scrollToFirstValidationError(formErrors);
    },
    [scrollToFirstValidationError]
  );

  const handleFormKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLFormElement>) => {
      if (event.key !== "Enter") return;

      const target = event.target as HTMLElement;

      if (target instanceof HTMLTextAreaElement) {
        return;
      }

      if (target instanceof HTMLButtonElement) {
        return;
      }

      if (target instanceof HTMLInputElement) {
        const blockedTypes = new Set([
          "text",
          "email",
          "tel",
          "url",
          "search",
          "number",
          "date",
          "time",
          "datetime-local",
          "password",
        ]);

        if (blockedTypes.has(target.type)) {
          event.preventDefault();
        }
      }
    },
    []
  );

  const { session } = useAuth();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] =
    React.useState(false);
  const [showDeletedSuccessModal, setShowDeletedSuccessModal] =
    React.useState(false);
  const [showRegistrationsClosedModal, setShowRegistrationsClosedModal] =
    React.useState(false);
  const [isOpeningPreview, setIsOpeningPreview] = React.useState(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = React.useState(false);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      defaultValues &&
      (Object.keys(defaultValues).length > 0 || isEditMode)
    ) {
      const transformedDefaults = {
        ...defaultValues,
        isTeamEvent:
          typeof defaultValues.isTeamEvent === "boolean"
            ? defaultValues.isTeamEvent
            : Number(defaultValues.maxParticipants || 1) > 1,
        minParticipants:
          typeof defaultValues.minParticipants === "string"
            ? defaultValues.minParticipants
            : Number(defaultValues.maxParticipants || 1) > 1
            ? "2"
            : "1",
        department: Array.isArray(defaultValues.department)
          ? defaultValues.department
          : [],
        rules: Array.isArray(defaultValues.rules) ? defaultValues.rules : [],
        prizes: Array.isArray(defaultValues.prizes) ? defaultValues.prizes : [],
        scheduleItems: Array.isArray(defaultValues.scheduleItems)
          ? defaultValues.scheduleItems
          : [],
        campusHostedAt: normalizeCampusHostedAt(defaultValues.campusHostedAt),
        allowedCampuses: normalizeAllowedCampuses(defaultValues.allowedCampuses),
      };
      reset(transformedDefaults);
    }
  }, [defaultValues, reset, isEditMode]);

  const watchedEventDate = useWatch({ control, name: "eventDate" });
  const watchedEndDate = useWatch({ control, name: "endDate" });
  const watchedIsTeamEvent = useWatch({ control, name: "isTeamEvent" });
  const watchedMaxParticipants = useWatch({ control, name: "maxParticipants" });
  const watchedMinParticipants = useWatch({ control, name: "minParticipants" });
  const watchedFestEvent = useWatch({ control, name: "festEvent" });
  const lastAutoFilledFestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!watchedIsTeamEvent) {
      setValue("maxParticipants", "1", { shouldValidate: false });
      setValue("minParticipants", "1", { shouldValidate: false });
    } else {
      // Auto-fill to 2 when team event is enabled (1 is just the registrant themselves), if not already set
      if (!watch("minParticipants")) {
        setValue("minParticipants", "2", { shouldValidate: false });
      }
      if (!watch("maxParticipants")) {
        setValue("maxParticipants", "2", { shouldValidate: false });
      }
    }
  }, [watchedIsTeamEvent, setValue, watch]);

  useEffect(() => {
    if (!watchedIsTeamEvent) return;
    void trigger(["minParticipants", "maxParticipants"]);
  }, [watchedIsTeamEvent, watchedMaxParticipants, watchedMinParticipants, trigger]);

  useEffect(() => {
    if (watchedEventDate && !isEditMode && watch("eventDate")) {
      const currentRegDeadline = watch("registrationDeadline");
      const currentEndDate = watch("endDate");
      if (!currentRegDeadline)
        setValue("registrationDeadline", watchedEventDate, {
          shouldValidate: false,
        });
      if (!currentEndDate)
        setValue("endDate", watchedEventDate, { shouldValidate: false });
    }
  }, [watchedEventDate, setValue, isEditMode, watch]);

  useEffect(() => {
    const watchedFestEventValue = String(watchedFestEvent ?? "").trim();

    if (!watchedFestEventValue || watchedFestEventValue.toLowerCase() === "none") {
      // Do not clear user-entered values when fest is empty.
      // This effect should only auto-fill when a fest is selected.
      lastAutoFilledFestRef.current = null;
      return;
    }

    const watchedFestCanonical = toCanonical(watchedFestEventValue);
    const selectedFest = fetchedFests.find(
      (fest) =>
        fest.value === watchedFestEventValue ||
        toCanonical(fest.value) === watchedFestCanonical ||
        toCanonical(fest.label) === watchedFestCanonical
    );
    if (!selectedFest) return;

    const selectedFestKey = toCanonical(
      selectedFest.value || selectedFest.label || watchedFestEventValue
    );

    // Apply auto-fill only once per selected fest to avoid re-overwriting edits.
    if (selectedFestKey && lastAutoFilledFestRef.current === selectedFestKey) {
      return;
    }

    setValue("department", selectedFest.departmentAccess, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("organizingDept", selectedFest.organizingDept, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("category", selectedFest.category, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("campusHostedAt", selectedFest.campusHostedAt, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("allowedCampuses", selectedFest.allowedCampuses, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("allowOutsiders", selectedFest.allowOutsiders, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (selectedFestKey) {
      lastAutoFilledFestRef.current = selectedFestKey;
    }
  }, [watchedFestEvent, fetchedFests, setValue]);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [pendingSuccess, setPendingSuccess] = React.useState<"publish" | "draft" | "delete" | null>(null);
  const [successAction, setSuccessAction] = React.useState<"publish" | "draft">("publish");
  const [wasDraftOnSubmit, setWasDraftOnSubmit] = React.useState(false);
  const [modalVisible, setModalVisible] = React.useState(false);

  const processSubmit: SubmitHandler<EventFormData> = async (data) => {
    try {
      setWasDraftOnSubmit(Boolean(isDraft));
      await onSubmit(data);
      setSuccessAction("publish");
      // Don't show modal yet — let the overlay finish its animation first
      setPendingSuccess("publish");
    } catch (error: any) {
      console.error(
        "EventForm: Error from onSubmit prop:",
        error.message,
        error
      );
    }
  };

  const processDraftSubmit: SubmitHandler<EventFormData> = async (data) => {
    if (!onSubmitDraft) return;

    try {
      await onSubmitDraft(data);
      setSuccessAction("draft");
      setPendingSuccess("draft");
    } catch (error: any) {
      console.error(
        "EventForm: Error from onSubmitDraft prop:",
        error.message,
        error
      );
    }
  };

  const handlePreview = async () => {
    if (isSubmittingProp || rhfIsSubmitting || isDeleting || isOpeningPreview) {
      return;
    }

    setIsOpeningPreview(true);
    try {
      const isValid = await trigger();
      if (!isValid) {
        scrollToFirstValidationError(errors);
        return;
      }

      const formData = getValues();
      const previewData = buildEventPreviewData({
        formData,
        sourcePath: pathname || "/create/event",
        existingImageFileUrl,
        existingBannerFileUrl,
        existingPdfFileUrl,
      });
      const previewDraftKey = saveEventPreviewDraft(previewData);

      const previewUrl = `/event/preview?draft=${encodeURIComponent(previewDraftKey)}`;
      const previewTab = window.open("", "_blank");
      if (!previewTab) {
        window.alert("Preview was blocked. Please allow pop-ups and try again.");
        return;
      }

      previewTab.opener = null;
      previewTab.location.href = previewUrl;
    } catch (previewError) {
      console.error("EventForm: Failed to open preview", previewError);
    } finally {
      setIsOpeningPreview(false);
    }
  };

  // Called when PublishingOverlay finishes sprint + victory animation
  const handleOverlayComplete = React.useCallback(() => {
    if (pendingSuccess === "publish" || pendingSuccess === "draft") {
      setIsModalOpen(true);
      setTimeout(() => setModalVisible(true), 30);
      setPendingSuccess(null);
    } else if (pendingSuccess === "delete") {
      setShowDeletedSuccessModal(true);
      setTimeout(() => setModalVisible(true), 30);
      setPendingSuccess(null);
    }
  }, [pendingSuccess]);

  const handleNavigationToDashboard = () => {
    setModalVisible(false);
    setSuccessAction("publish");
    setWasDraftOnSubmit(false);
    setTimeout(() => {
      setIsNavigating(true);
      router.push("/manage");
    }, 300);
  };

  const handleDeleteRequest = async () => {
    const eventIdentifier = defaultValues?.eventTitle;

    if (!eventIdentifier) {
      console.error("Event title (for ID) is missing. Cannot delete.");
      setShowDeleteConfirmation(false);
      return;
    }

    setIsDeleting(true);
    setShowDeleteConfirmation(false);

    try {
      if (!session || !session.access_token) {
        throw new Error("Authentication session or token not available.");
      }
      const authToken = session.access_token;
      const eventIdSlug = eventIdentifier
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");
      const response = await fetch(
        `${API_URL}/api/events/${eventIdSlug}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        let errorPayload: any = {
          error: `Request failed: ${response.status} ${response.statusText}`,
        };
        try {
          const errorJson = await response.json();
          if (errorJson && errorJson.error) {
            errorPayload = errorJson;
          }
        } catch (jsonError) {
          try {
            const errorText = await response.text();
            if (errorText) {
              errorPayload.error = `Server error: ${errorText.substring(
                0,
                200
              )}${errorText.length > 200 ? "..." : ""}`;
            }
          } catch (textError) {
            console.error("Failed to read error response as text:", textError);
          }
        }
        throw new Error(errorPayload.error);
      }

      let successPayload: any = {
        message:
          "Event deleted successfully (server might have sent non-JSON or empty response).",
      };
      try {
        const successJson = await response.json();
        if (successJson && successJson.message) {
          successPayload = successJson;
        }
      } catch (jsonError) {
        console.warn(
          "Success response from server was not valid JSON, or was empty. Assuming success based on 200 OK."
        );
      }

      console.log(successPayload.message);
      setPendingSuccess("delete");
    } catch (error: any) {
      console.error("Error deleting event:", error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteConfirmation = () => {
    if (!defaultValues?.eventTitle) {
      console.error("Event title is missing. Cannot initiate delete.");
      return;
    }
    setShowDeleteConfirmation(true);
  };

  async function closeRegistration() {
    const eventIdentifier = defaultValues?.eventTitle;

    if (!eventIdentifier) {
      console.error(
        "Event title (for ID) is missing. Cannot close registrations."
      );
      return;
    }

    try {
      const eventIdSlug = eventIdentifier
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");
      const response = await fetch(
        `${API_URL}/api/events/${eventIdSlug}/close`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      if (response.ok) {
        console.log("Registration closed successfully.");
        setShowRegistrationsClosedModal(true);
      } else {
        const errorText = await response.text();
        console.error(
          "Failed to close registration:",
          response.status,
          errorText
        );
      }
    } catch (error) {
      console.error("Error during close registration request:", error);
    }
  }

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.warn("EventForm: Validation errors present:", errors);
    }
  }, [errors]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        actionsDropdownRef.current &&
        !actionsDropdownRef.current.contains(event.target as Node)
      ) {
        setIsActionsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const BackIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="w-4 h-4 sm:w-5 sm:h-5 mr-2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
      />
    </svg>
  );

  return (
    <div className="min-h-screen bg-white relative">
      <PublishingOverlay
        isVisible={isSubmittingProp || rhfIsSubmitting || isDeleting}
        mode={isDeleting ? "deleting" : isEditMode ? "updating" : "publishing"}
        onComplete={handleOverlayComplete}
      />
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Confirm Deletion
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete the event titled "
              <strong>{defaultValues?.eventTitle}</strong>"? This action cannot
              be undone and will also remove all associated registrations.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className={`${secondaryButtonClasses} py-2 px-4`}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRequest}
                className={`${primaryButtonClasses} bg-red-600 hover:bg-red-700 focus:ring-red-500 py-2 px-4`}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Deleted Success Modal */}
      {showDeletedSuccessModal && (
        <div
          className="fixed inset-0 bg-white z-[200] flex items-center justify-center px-4 transition-opacity duration-500 ease-out"
          style={{ opacity: modalVisible ? 1 : 0 }}
        >
          <div
            className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full border border-gray-200 shadow-xl text-center transition-all duration-500 ease-out"
            style={{
              opacity: modalVisible ? 1 : 0,
              transform: modalVisible ? "scale(1) translateY(0)" : "scale(0.9) translateY(20px)",
            }}
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-3">
              Event Deleted
            </h2>
            <p className="text-gray-600 mb-4 text-sm sm:text-base">
              Your event has been successfully deleted. All registrations associated with this event have also been removed.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="text-left">
                  <p className="text-sm text-amber-800 font-medium">Please note</p>
                  <p className="text-xs text-amber-700 mt-1">
                    The event may still appear on the website for a short while due to caching. However, no one will be able to register for this event.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setModalVisible(false);
                setTimeout(() => {
                  setShowDeletedSuccessModal(false);
                  router.push("/manage");
                }, 300);
              }}
              className={`${primaryButtonClasses} w-full py-3`}
            >
              Back to My Events
            </button>
          </div>
        </div>
      )}

      {(isModalOpen || isNavigating || showRegistrationsClosedModal) && (
        <div
          className="fixed inset-0 bg-white z-[100] flex items-center justify-center px-4 transition-opacity duration-500 ease-out"
          style={{ opacity: modalVisible ? 1 : 0 }}
        >
          {isModalOpen && !isNavigating && !showRegistrationsClosedModal && (
            <div
              className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full border border-gray-200 shadow-xl text-center transition-all duration-500 ease-out"
              style={{
                opacity: modalVisible ? 1 : 0,
                transform: modalVisible ? "scale(1) translateY(0)" : "scale(0.9) translateY(20px)",
              }}
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-4">
                {successAction === "draft"
                  ? "Draft Saved!"
                  : `Event ${
                      isEditMode && wasDraftOnSubmit ? "Published!" : isEditMode ? "Updated!" : "Published!"
                    }`}
              </h2>
              <p className="text-gray-600 mb-6 text-sm sm:text-base">
                {successAction === "draft"
                  ? "Your event has been saved as a draft. It is hidden until you publish it."
                  : `Your event has been successfully ${
                      isEditMode && wasDraftOnSubmit ? "published" : isEditMode ? "updated" : "published"
                    }.`}
              </p>
              <button
                onClick={handleNavigationToDashboard}
                className={primaryButtonClasses}
              >
                Back to Dashboard
              </button>
            </div>
          )}
          {showRegistrationsClosedModal && !isNavigating && !isModalOpen && (
            <div
              className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full border border-gray-200 shadow-xl text-center transition-all duration-500 ease-out"
              style={{
                opacity: modalVisible ? 1 : 0,
                transform: modalVisible ? "scale(1) translateY(0)" : "scale(0.9) translateY(20px)",
              }}
            >
              <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-4">
                Registrations Closed
              </h2>
              <p className="text-gray-600 mb-6 text-sm sm:text-base">
                Registrations for this event have been successfully closed.
              </p>
              <button
                onClick={() => {
                  setShowRegistrationsClosedModal(false);
                  handleNavigationToDashboard();
                }}
                className={primaryButtonClasses}
              >
                Back to Dashboard
              </button>
            </div>
          )}
          {isNavigating && (
            <div className="text-center">
              <LoadingIndicator label="Hang tight" />
            </div>
          )}
        </div>
      )}

      {!isNavigating && !isModalOpen && !showRegistrationsClosedModal && (
        <>
          <div className="bg-[#063168] text-white p-4 sm:p-6 md:p-12">
            <div className="max-w-6xl mx-auto">
              <button
                onClick={handleNavigationToDashboard}
                className="flex items-center text-[#FFCC00] mb-4 sm:mb-6 hover:underline text-sm sm:text-base"
              >
                <BackIcon /> Back to dashboard
              </button>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                {isEditMode ? "Edit event" : "Create event"}
              </h1>
              <p className="text-base sm:text-lg text-gray-200 mt-2">
                Fill in the details to{" "}
                {isEditMode ? "edit your event." : "create a new event."}
              </p>
            </div>
          </div>
          <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-12">
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 sm:p-8 md:p-10">
              <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-6 sm:mb-8">
                Event details
              </h2>
              <form
                onSubmit={handleSubmit(processSubmit, handleInvalidSubmit)}
                onKeyDown={handleFormKeyDown}
                className="space-y-6 sm:space-y-8"
                noValidate
              >
                <div>
                  <InputField
                    label="Event title:"
                    name="eventTitle"
                    register={register}
                    error={errors.eventTitle}
                    required
                    placeholder="Enter event title"
                  />
                  {isEditMode && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <span className="font-semibold">⚠️ Note:</span> Changing the title will also update your event&apos;s URL/link.
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Example: &quot;My Event&quot; → <code className="bg-amber-100 px-1 rounded">/event/my-event</code>
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <Controller
                    name="eventDate"
                    control={control}
                    render={({ field, fieldState }) => (
                      <CustomDatePicker
                        id="eventDate"
                        field={field}
                        label="Event date:"
                        error={fieldState.error}
                        required
                        placeholder="YYYY-MM-DD"
                        minDate={new Date()}
                      />
                    )}
                  />
                  <Controller
                    name="endDate"
                    control={control}
                    render={({ field, fieldState }) => (
                      <CustomDatePicker
                        id="endDate"
                        field={field}
                        label="End date:"
                        error={fieldState.error}
                        required
                        placeholder="YYYY-MM-DD"
                        minDate={
                          watchedEventDate && parseYYYYMMDD(watchedEventDate)
                            ? parseYYYYMMDD(watchedEventDate) || new Date()
                            : new Date()
                        }
                      />
                    )}
                  />
                  <Controller
                    name="registrationDeadline"
                    control={control}
                    render={({ field, fieldState }) => (
                      <CustomDatePicker
                        id="registrationDeadline"
                        field={field}
                        label="Registration deadline:"
                        error={fieldState.error}
                        required
                        placeholder="YYYY-MM-DD"
                        maxDate={
                          watchedEndDate && parseYYYYMMDD(watchedEndDate)
                            ? parseYYYYMMDD(watchedEndDate) || undefined
                            : undefined
                        }
                      />
                    )}
                  />
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between h-[46px] sm:h-[48px] mt-0 sm:mt-7">
                    <label
                      htmlFor="onSpot"
                      className="text-sm font-medium text-gray-700"
                    >
                      On-spot registration
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <Controller
                        name="onSpot"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            id="onSpot"
                            checked={!!field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            className="sr-only peer"
                          />
                        )}
                      />
                      <div className={toggleTrackClass}></div>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Controller
                    name="eventTime"
                    control={control}
                    render={({ field, fieldState }) => (
                      <CustomTimePicker
                        id="eventTime"
                        field={field}
                        label="Event time:"
                        error={fieldState.error}
                        required
                        placeholder="HH:MM"
                      />
                    )}
                  />
                  <CustomDropdown
                    name="festEvent"
                    control={control}
                    options={fetchedFests.length > 0 ? fetchedFests : [{ value: "none", label: "None" }]}
                    placeholder="Select fest event (if any)"
                    label="Is this event under any fest? (optional)"
                    error={errors.festEvent}
                  />
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 sm:py-3.5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-3">
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <label
                        htmlFor="isTeamEvent"
                        className="text-sm font-medium text-gray-700 whitespace-nowrap"
                      >
                        Team event
                      </label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <Controller
                          name="isTeamEvent"
                          control={control}
                          render={({ field }) => (
                            <input
                              type="checkbox"
                              id="isTeamEvent"
                              checked={!!field.value}
                              onChange={(e) => field.onChange(e.target.checked)}
                              className="sr-only peer"
                            />
                          )}
                        />
                        <div className={toggleTrackClass}></div>
                      </label>
                    </div>
                    {watchedIsTeamEvent && (
                      <div className="flex flex-col gap-3 w-full">
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                          <div className="flex-1 sm:flex-none">
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                              Min
                            </label>
                            <Controller
                              name="minParticipants"
                              control={control}
                              render={({ field, fieldState }) => (
                                <input
                                  id="minParticipants"
                                  {...field}
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="e.g., 2"
                                  className={`w-full px-3 py-2 text-sm rounded-lg border transition-all ${
                                    fieldState.error
                                      ? "border-red-500 focus:ring-red-500"
                                      : "border-gray-300 focus:ring-[#154CB3]"
                                  } focus:outline-none focus:ring-1 focus:border-transparent`}
                                />
                              )}
                              rules={{
                                validate: (value) => {
                                  if (!watchedIsTeamEvent) return true;
                                  const minRaw = String(value || "").trim();
                                  if (!minRaw) return "Min is required";
                                  if (!/^\d+$/.test(minRaw)) return "Enter a number";
                                  const minValue = Number(minRaw);
                                  if (minValue < 1) return "Min must be 1 or more";
                                  const maxRaw = String(watchedMaxParticipants || "").trim();
                                  if (maxRaw && /^\d+$/.test(maxRaw) && minValue > Number(maxRaw)) {
                                    return "Min ≤ Max";
                                  }
                                  return true;
                                },
                              }}
                            />
                            {errors.minParticipants && (
                              <p className="text-red-500 text-xs mt-1">
                                {errors.minParticipants.message}
                              </p>
                            )}
                          </div>
                          <div className="flex-1 sm:flex-none">
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                              Max
                            </label>
                            <Controller
                              name="maxParticipants"
                              control={control}
                              render={({ field, fieldState }) => (
                                <input
                                  id="maxParticipants"
                                  {...field}
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="e.g., 5"
                                  className={`w-full px-3 py-2 text-sm rounded-lg border transition-all ${
                                    fieldState.error
                                      ? "border-red-500 focus:ring-red-500"
                                      : "border-gray-300 focus:ring-[#154CB3]"
                                  } focus:outline-none focus:ring-1 focus:border-transparent`}
                                />
                              )}
                              rules={{
                                validate: (value) => {
                                  if (!watchedIsTeamEvent) return true;
                                  const maxRaw = String(value || "").trim();
                                  if (!maxRaw) return "Max is required";
                                  if (!/^\d+$/.test(maxRaw)) return "Enter a number";
                                  const maxValue = Number(maxRaw);
                                  if (maxValue < 1) return "Max must be 1 or more";
                                  const minRaw = String(watchedMinParticipants || "").trim();
                                  if (minRaw && /^\d+$/.test(minRaw) && maxValue < Number(minRaw)) {
                                    return "Max ≥ Min";
                                  }
                                  return true;
                                },
                              }}
                            />
                            {errors.maxParticipants && (
                              <p className="text-red-500 text-xs mt-1">
                                {errors.maxParticipants.message}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Preview Display */}
                        {watchedMinParticipants && watchedMaxParticipants && (
                          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-900 font-medium">
                              Preview: <span className="text-[#154CB3]">
                                {watchedMinParticipants === watchedMaxParticipants 
                                  ? `${watchedMinParticipants} member${watchedMinParticipants !== '1' ? 's' : ''}`
                                  : `${watchedMinParticipants}-${watchedMaxParticipants} members`
                                }
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <InputField
                  label="Detailed description:"
                  name="detailedDescription"
                  as="textarea"
                  rows={5}
                  register={register}
                  error={errors.detailedDescription}
                  required
                  placeholder="Provide a detailed description of the event"
                />

                {/* Audience & Access Control Section - Google Style */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 sm:p-7 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-base font-bold text-[#063168] flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zm-2-7a6 6 0 11-12 0 6 6 0 0112 0zM7 9a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      Audience & Access
                    </h3>
                    <p className="text-xs text-gray-600 mt-1 ml-7">Control who can register for your event</p>
                  </div>

                  <div className="space-y-5">
                    {/* Allow Outsiders Toggle */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 transition-all hover:border-blue-300 hover:shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label htmlFor="allowOutsiders" className="text-sm font-semibold text-gray-900 block cursor-pointer">
                            Allow Non-Members to Register
                          </label>
                          <p className="text-xs text-gray-500 mt-1">
                            Permit registration from outside Christ University
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                          <Controller
                            name="allowOutsiders"
                            control={control}
                            render={({ field }) => (
                              <input
                                type="checkbox"
                                id="allowOutsiders"
                                checked={!!field.value}
                                onChange={(e) => field.onChange(e.target.checked)}
                                className="sr-only peer"
                              />
                            )}
                          />
                          <div className={toggleTrackClass}></div>
                        </label>
                      </div>

                      {/* Conditional outsider fields */}
                      {watch("allowOutsiders") && (
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InputField
                              label="Registration Fee (Optional)"
                              name="outsiderRegistrationFee"
                              type="text"
                              register={register}
                              error={errors.outsiderRegistrationFee}
                              placeholder="e.g., 500"
                            />
                            <InputField
                              label="Max Participants (Optional)"
                              name="outsiderMaxParticipants"
                              type="text"
                              register={register}
                              error={errors.outsiderMaxParticipants}
                              placeholder="e.g., 50"
                            />
                          </div>
                          <p className="text-xs text-gray-500 italic">
                            Leave blank to use the standard event settings for non-members
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Campus Restrictions - Always Visible */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <label className="text-sm font-semibold text-gray-900 block">
                            Campus Availability
                          </label>
                          <p className="text-xs text-gray-500 mt-1">
                            Specify where the event takes place and who can attend
                          </p>
                        </div>
                        <span className="text-xs bg-red-100 text-red-800 px-2.5 py-1 rounded-lg font-medium whitespace-nowrap">
                          Required
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Hosted At */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-2">
                            Where is the event Hosted at? <span className="text-red-500">*</span>
                          </label>
                          <Controller
                            name="campusHostedAt"
                            control={control}
                            rules={{ required: "Hosted campus is required" }}
                            render={({ field }) => (
                              <>
                                <select
                                  id="campusHostedAt"
                                  {...field}
                                  className={`w-full px-3.5 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-0 focus:border-transparent bg-white transition-all ${
                                    errors.campusHostedAt ? "border-red-500" : "border-gray-300"
                                  }`}
                                >
                                  <option value="">Select campus</option>
                                  {christCampuses.map((campus) => (
                                    <option key={campus} value={campus}>
                                      {campus}
                                    </option>
                                  ))}
                                </select>
                                {errors.campusHostedAt && (
                                  <p className="text-red-500 text-xs mt-2">
                                    {errors.campusHostedAt.message}
                                  </p>
                                )}
                              </>
                            )}
                          />
                        </div>

                        {/* Who Can Register */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-2">
                            Who can register? <span className="text-red-500">*</span>
                          </label>
                          <Controller
                            name="allowedCampuses"
                            control={control}
                            rules={{
                              validate: (value) =>
                                (Array.isArray(value) && value.length > 0) ||
                                "Select at least one campus",
                            }}
                            render={({ field }) => (
                              <div
                                id="allowedCampuses-group"
                                tabIndex={-1}
                                className={`space-y-1.5 h-[102px] overflow-y-auto pr-2 rounded-md ${
                                  errors.allowedCampuses ? "border border-red-500 p-2" : ""
                                }`}
                              >
                                {christCampuses.map((campus) => (
                                  <label
                                    key={campus}
                                    className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700 hover:text-gray-900 py-0.5 transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={field.value?.includes(campus) || false}
                                      onChange={(e) => {
                                        const current = field.value || [];
                                        if (e.target.checked) {
                                          field.onChange([...current, campus]);
                                        } else {
                                          field.onChange(current.filter((c: string) => c !== campus));
                                        }
                                      }}
                                      className="h-4 w-4 rounded border-gray-300 text-[#154CB3] focus:ring-[#154CB3] cursor-pointer"
                                    />
                                    <span>{campus}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            Select at least one campus that can register for this event.
                          </p>
                          {errors.allowedCampuses && (
                            <p className="text-red-500 text-xs mt-2">
                              {errors.allowedCampuses.message as string}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <datalist id="organizing-dept-list-event">
                  {departmentOptions
                    .filter((d) => d.value !== "all_departments")
                    .map((dept) => (
                      <option key={dept.value} value={dept.label} />
                    ))}
                </datalist>

                <InputField
                  label="Organizing department / committee:"
                  name="organizingDept"
                  list="organizing-dept-list-event"
                  register={register}
                  error={errors.organizingDept}
                  required
                  placeholder="e.g., Department of Computer Science /  Student Welfare Organization"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <MultiSelectDropdown
                    name="department"
                    control={control}
                    options={departmentOptions}
                    placeholder="Select departments"
                    label="Department access:"
                    error={errors.department as FieldError | undefined}
                    required
                  />
                  <CustomDropdown
                    name="category"
                    control={control}
                    options={categoryOptions}
                    placeholder="Select category"
                    label="Category:"
                    error={errors.category}
                    required
                  />
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 sm:py-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-sm font-medium text-gray-700">
                      Are claims provided for this fest?
                    </label>
                    <Controller
                      name="provideClaims"
                      control={control}
                      render={({ field }) => {
                        const claimsEnabled = Boolean(field.value);

                        return (
                          <label
                            htmlFor="provideClaims"
                            className="relative inline-flex items-center cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              id="provideClaims"
                              checked={claimsEnabled}
                              onChange={(e) => field.onChange(e.target.checked)}
                              className="sr-only"
                            />

                            <div
                              className={`relative h-8 w-20 rounded-full border-2 transition-colors ${
                                claimsEnabled
                                  ? "border-green-500 bg-green-50"
                                  : "border-red-500 bg-red-50"
                              }`}
                            >
                              <span
                                className={`absolute top-1/2 -translate-y-1/2 text-[10px] font-semibold tracking-wide ${
                                  claimsEnabled
                                    ? "left-2 text-green-700"
                                    : "right-2 text-red-700"
                                }`}
                              >
                                {claimsEnabled ? "YES" : "NO"}
                              </span>

                              <span
                                className={`absolute top-0.5 left-0.5 flex h-6 w-6 items-center justify-center rounded-full border bg-white transition-transform ${
                                  claimsEnabled
                                    ? "translate-x-[3.25rem] border-green-500 text-green-600"
                                    : "translate-x-0 border-red-500 text-red-600"
                                }`}
                              >
                                {claimsEnabled ? (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2.5}
                                    stroke="currentColor"
                                    className="h-3.5 w-3.5"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M4.5 12.75l6 6 9-13.5"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2.5}
                                    stroke="currentColor"
                                    className="h-3.5 w-3.5"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                )}
                              </span>
                            </div>
                          </label>
                        );
                      }}
                    />
                  </div>
                  {errors.provideClaims && (
                    <p className="text-red-500 text-xs mt-2">
                      {errors.provideClaims.message}
                    </p>
                  )}
                </div>

                <FileInput<EventFormData>
                  label="Event image:"
                  name="imageFile"
                  register={register}
                  error={errors.imageFile as FieldError | undefined}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  required={!isEditMode && !existingImageFileUrl}
                  helpText="JPEG, PNG, WEBP, GIF (max 3MB)"
                  currentFileUrl={existingImageFileUrl}
                />
                <FileInput<EventFormData>
                  label="Event banner: (optional)"
                  name="bannerFile"
                  register={register}
                  error={errors.bannerFile as FieldError | undefined}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  helpText="JPEG, PNG, WEBP, GIF (max 2MB)"
                  currentFileUrl={existingBannerFileUrl}
                />
                <FileInput<EventFormData>
                  label="Event PDF: (optional)"
                  name="pdfFile"
                  register={register}
                  error={errors.pdfFile as FieldError | undefined}
                  accept="application/pdf"
                  helpText="PDF document (max 5MB)"
                  currentFileUrl={existingPdfFileUrl}
                />
                <InputField
                  label="WhatsApp Invite Link: (optional)"
                  name="whatsappLink"
                  type="url"
                  register={register}
                  error={errors.whatsappLink}
                  placeholder="https://chat.whatsapp.com/your-group-invite"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <InputField
                    label="Location / Venue:"
                    name="location"
                    register={register}
                    error={errors.location}
                    required
                    placeholder="e.g., Auditorium, Online"
                  />
                  <InputField
                    label="Registration fee:"
                    name="registrationFee"
                    type="text"
                    inputMode="decimal"
                    register={register}
                    error={errors.registrationFee}
                    placeholder="0 for free event"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <InputField
                    label="Contact email:"
                    name="contactEmail"
                    type="email"
                    autoComplete="new-password"
                    register={register}
                    registerOptions={{
                      required: "Contact email is required",
                      setValueAs: (value) => normalizeEmailInput(value),
                      validate: (value) => {
                        const normalized = normalizeEmailInput(value);

                        if (!normalized) {
                          return "Contact email is required";
                        }

                        if (normalized.length > CONTACT_EMAIL_MAX_LENGTH) {
                          return "Contact email must be 100 characters or fewer";
                        }

                        if (!CONTACT_EMAIL_REGEX.test(normalized)) {
                          return "Enter a valid email like name@gmail.com";
                        }

                        return true;
                      },
                    }}
                    error={errors.contactEmail}
                    required
                    placeholder="event.support@example.com"
                  />
                  <InputField
                    label="Contact phone:"
                    name="contactPhone"
                    type="tel"
                    autoComplete="new-password"
                    register={register}
                    error={errors.contactPhone}
                    required
                    placeholder="10-digit mobile number"
                  />
                </div>

                {/* Custom Fields Section - Moved Up */}
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-6 sm:p-7 shadow-sm">
                  <Controller
                    name="customFields"
                    control={control}
                    render={({ field }) => (
                      <DynamicCustomFieldBuilder
                        fields={(field.value as CustomField[]) || []}
                        onChange={(newFields) => field.onChange(newFields)}
                        maxFields={10}
                      />
                    )}
                  />
                </div>

                <DynamicTextList
                  listName="rules"
                  itemNoun="rule"
                  title="Rules & Guidelines: (optional)"
                  placeholder="Enter a rule or guideline"
                  control={control}
                  register={register}
                  errors={errors}
                />
                <DynamicScheduleList
                  control={control}
                  register={register}
                  errors={errors}
                />
                <DynamicTextList
                  listName="prizes"
                  itemNoun="prize"
                  title="Prizes & Awards: (optional)"
                  placeholder="e.g., Winner: $100, Runner-up: Certificate"
                  control={control}
                  register={register}
                  errors={errors}
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-8 sm:mt-10 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleNavigationToDashboard}
                    disabled={
                      isSubmittingProp ||
                      rhfIsSubmitting ||
                      isDeleting ||
                      isOpeningPreview
                    }
                    className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Cancel
                  </button>
                  
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handlePreview}
                      disabled={
                        isSubmittingProp ||
                        rhfIsSubmitting ||
                        isDeleting ||
                        isOpeningPreview
                      }
                      className="w-full sm:w-auto px-5 py-2.5 border border-[#154CB3] text-[#154CB3] bg-white text-sm font-medium rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isOpeningPreview ? "Opening preview..." : "Preview"}
                    </button>

                    {onSubmitDraft && (
                      <button
                        type="button"
                        onClick={handleSubmit(processDraftSubmit, handleInvalidSubmit)}
                        disabled={
                          isSubmittingProp ||
                          rhfIsSubmitting ||
                          isDeleting ||
                          isOpeningPreview
                        }
                        className="w-full sm:w-auto px-5 py-2.5 border border-amber-400 text-amber-800 bg-amber-50 text-sm font-medium rounded-md hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isSubmittingProp || rhfIsSubmitting
                          ? "Saving Draft..."
                          : "Save as Draft"}
                      </button>
                    )}

                    {isEditMode && (
                      <div className="relative" ref={actionsDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                          disabled={isArchiveUpdating || isSubmittingProp || rhfIsSubmitting || isDeleting}
                          className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 text-gray-700 bg-white text-sm font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                        >
                          <span>More actions</span>
                          <svg className={`w-4 h-4 transition-transform ${isActionsDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        </button>
                        {isActionsDropdownOpen && (
                          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                            {onToggleArchive && !isDraft && (
                              <button
                                type="button"
                                onClick={() => {
                                  onToggleArchive();
                                  setIsActionsDropdownOpen(false);
                                }}
                                disabled={isArchiveUpdating || isSubmittingProp || rhfIsSubmitting || isDeleting}
                                className={`w-full text-left px-4 py-3 text-sm font-medium border-b border-gray-100 first:rounded-t-lg last:border-b-0 last:rounded-b-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 ${
                                  isArchiveUpdating || isSubmittingProp || rhfIsSubmitting || isDeleting
                                    ? "text-gray-500 cursor-not-allowed"
                                    : isArchived
                                    ? "text-emerald-600 hover:bg-emerald-50"
                                    : "text-amber-600 hover:bg-amber-50"
                                }`}
                              >
                                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2h4a1 1 0 110 2h-1v12a2 2 0 01-2 2H7a2 2 0 01-2-2V9H4a1 1 0 110-2h4V5z" />
                                </svg>
                                {isArchiveUpdating ? "Saving..." : isArchived ? "Restore" : "Archive"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                closeRegistration();
                                setIsActionsDropdownOpen(false);
                              }}
                              disabled={isSubmittingProp || rhfIsSubmitting || isDeleting}
                              className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 text-sm font-medium border-b border-gray-100 first:rounded-t-lg last:border-b-0 last:rounded-b-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16H9v-4h4v4zM9 8h4V4H9v4zM7 20h10a2 2 0 002-2V4a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              Close Registrations
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                openDeleteConfirmation();
                                setIsActionsDropdownOpen(false);
                              }}
                              disabled={isDeleting || isSubmittingProp || rhfIsSubmitting}
                              className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 text-sm font-medium last:rounded-b-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              {isDeleting ? "Deleting..." : "Delete Event"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <button
                    type="submit"
                    disabled={
                      isSubmittingProp ||
                      rhfIsSubmitting ||
                      isDeleting ||
                      isOpeningPreview
                    }
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#154CB3] text-white text-sm font-medium rounded-md hover:bg-[#0f3a7a] focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmittingProp || rhfIsSubmitting
                      ? isEditMode
                        ? isDraft
                          ? "Publishing..."
                          : "Updating..."
                        : "Publishing..."
                      : isEditMode
                      ? isDraft
                        ? "Publish Event"
                        : "Update Event"
                      : "Publish Event"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

