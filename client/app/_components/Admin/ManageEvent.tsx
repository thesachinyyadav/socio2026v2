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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

import {
  EventFormData,
  VolunteerAssignment,
  eventFormSchema,
  departments as departmentOptions,
  organizingSchools,
  getDepartmentOptionsForSchool,
  inferSchoolFromDepartment,
  CLUBS_AND_CENTRES_SCHOOL,
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
import { Info, Plus, UsersRound, X } from "lucide-react";

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

const formatHHMMTo12Hour = (timeString?: string): string => {
  const parsed = parseHHMM(timeString || "");
  if (!parsed) return "";
  const period = parsed.hours >= 12 ? "PM" : "AM";
  const hour12 = parsed.hours % 12 === 0 ? 12 : parsed.hours % 12;
  return `${hour12}:${parsed.minutes.toString().padStart(2, "0")} ${period}`;
};

const normalizeRegisterNumber = (value: unknown): string =>
  String(value ?? "").trim().toUpperCase();

const computeVolunteerExpiresAt = (
  endDate?: string,
  endTime?: string
): string | null => {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(endDate || "").trim());
  const timeMatch = /^([0-1]?[0-9]|2[0-3]):([0-5]\d)(:\d{2})?$/.exec(String(endTime || "").trim());
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch.map(Number);
  const [, hour, minute] = timeMatch;
  const expiry = new Date(
    Date.UTC(year, month - 1, day, Number(hour), Number(minute), 0)
  );
  if (Number.isNaN(expiry.getTime())) return null;

  expiry.setUTCHours(expiry.getUTCHours() + 12);
  return expiry.toISOString();
};

function VolunteerAssignmentSection({
  value,
  onChange,
  endDate,
  endTime,
  assignedByEmail,
  disabled,
}: {
  value: VolunteerAssignment[];
  onChange: (next: VolunteerAssignment[]) => void;
  endDate?: string;
  endTime?: string;
  assignedByEmail?: string | null;
  disabled?: boolean;
}) {
  const [draftRegisterNumber, setDraftRegisterNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const volunteers = Array.isArray(value) ? value : [];
  const expiresAt = React.useMemo(
    () => computeVolunteerExpiresAt(endDate, endTime),
    [endDate, endTime]
  );

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const volunteersRef = React.useRef(volunteers);
  volunteersRef.current = volunteers;

  useEffect(() => {
    const current = volunteersRef.current;
    if (!expiresAt || current.length === 0) return;
    if (current.every((volunteer) => volunteer.expires_at === expiresAt)) return;
    onChangeRef.current(current.map((volunteer) => ({ ...volunteer, expires_at: expiresAt })));
  }, [expiresAt]);

  useEffect(() => {
    if (expiresAt && error === "Select a valid event end date and end time first.") {
      setError(null);
    }
  }, [expiresAt, error]);

  const addVolunteer = () => {
    const registerNumber = normalizeRegisterNumber(draftRegisterNumber);
    const assignedBy = String(assignedByEmail || "").trim();

    if (!registerNumber) {
      setError("Enter a volunteer register number.");
      return;
    }

    if (!/^\d{7}$/.test(registerNumber)) {
      setError("Register number must be exactly 7 digits.");
      return;
    }

    if (!expiresAt) {
      setError("Select a valid event end date and end time first.");
      return;
    }

    if (!assignedBy) {
      setError("Organizer email is unavailable. Please refresh and sign in again.");
      return;
    }

    if (volunteers.some((volunteer) => volunteer.register_number === registerNumber)) {
      setError("This volunteer is already assigned.");
      return;
    }

    onChange([
      ...volunteers,
      {
        register_number: registerNumber,
        expires_at: expiresAt,
        assigned_by: assignedBy,
      },
    ]);
    setDraftRegisterNumber("");
    setError(null);
  };

  const removeVolunteer = (registerNumber: string) => {
    onChange(
      volunteers.filter((volunteer) => volunteer.register_number !== registerNumber)
    );
  };

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label
            htmlFor="volunteer-register-number"
            className="block text-xs font-semibold text-slate-700 mb-2"
          >
            Enter Volunteer Register Number
          </label>
          <input
            id="volunteer-register-number"
            type="text"
            value={draftRegisterNumber}
            disabled={disabled}
            onChange={(event) => {
              setDraftRegisterNumber(event.target.value.toUpperCase());
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addVolunteer();
              }
            }}
            placeholder="e.g., 2540123"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#154CB3]/20 focus:border-[#154CB3] disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="button"
          onClick={addVolunteer}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 mt-0 sm:mt-7 rounded-lg bg-[#154CB3] text-white text-sm font-semibold hover:bg-[#063168] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add Volunteer
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {volunteers.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {volunteers.map((volunteer) => (
            <span
              key={volunteer.register_number}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
            >
              <span className="font-mono" title={`Added by: ${volunteer.assigned_by}`}>
                {volunteer.register_number}
              </span>
              <button
                type="button"
                onClick={() => removeVolunteer(volunteer.register_number)}
                className="text-slate-400 hover:text-red-600 transition-colors"
                aria-label={`Remove volunteer ${volunteer.register_number}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

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
                        className="h-4 w-4 text-[#154CB3] border-gray-300 rounded focus:ring-[#154CB3] cursor-pointer"
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
            className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-[120] p-4 w-[min(20rem,calc(100vw-2rem))]"
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
  const [draftTime, setDraftTime] = useState<string>((field.value as string) || "12:00");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const nativeTimeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (parseHHMM(field.value as string)) {
      setDraftTime(field.value as string);
    } else if (!field.value) {
      setDraftTime("12:00");
    }
  }, [field.value]);

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
    if (!parseHHMM(draftTime)) return;
    field.onChange(draftTime);
    setIsOpen(false);
  };

  const quickTimes = ["09:00", "12:00", "15:00", "18:00"];
  const displayValue = field.value
    ? formatHHMMTo12Hour(field.value as string)
    : placeholder;

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
            {displayValue}
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
            className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-[120] p-3 w-[min(20rem,calc(100vw-3rem))]"
          >
            <div className="space-y-3">
              {/* Quick presets */}
              <div className="grid grid-cols-2 gap-1.5">
                {quickTimes.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => {
                      setDraftTime(time);
                      field.onChange(time);
                      setIsOpen(false);
                    }}
                    className={`rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                      draftTime === time
                        ? "border border-[#154CB3] bg-[#154CB3]/10 text-[#154CB3]"
                        : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {formatHHMMTo12Hour(time)}
                  </button>
                ))}
              </div>

              {/* Clean time picker */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Enter time</p>
                
                <div className="flex items-center justify-center gap-3 mb-4">
                  {/* Hour input */}
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={
                        (() => {
                          const parsed = parseHHMM(draftTime);
                          if (!parsed) return 12;
                          const h = parsed.hours % 12;
                          return h === 0 ? 12 : h;
                        })()
                      }
                      onChange={(e) => {
                        const parsed = parseHHMM(draftTime) || { hours: 12, minutes: 0 };
                        let hour = parseInt(e.target.value) || 1;
                        if (hour > 12) hour = 12;
                        if (hour < 1) hour = 1;
                        setDraftTime(formatTimeToHHMM(hour === 12 ? 0 : hour, parsed.minutes));
                      }}
                      className="w-16 h-16 text-center text-xl font-bold border-2 border-[#154CB3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#154CB3]/20"
                    />
                    <span className="text-xs text-gray-500 mt-1">Hour</span>
                  </div>

                  {/* Colon */}
                  <span className="text-2xl font-bold text-gray-400 mb-4">:</span>

                  {/* Minute display */}
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-xl font-bold text-gray-700">
                      {(parseHHMM(draftTime)?.minutes || 0).toString().padStart(2, "0")}
                    </div>
                    <span className="text-xs text-gray-500 mt-1">Minute</span>
                  </div>

                  {/* AM/PM buttons */}
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = parseHHMM(draftTime) || { hours: 12, minutes: 0 };
                        if (parsed.hours >= 12) {
                          const newHour = parsed.hours - 12;
                          setDraftTime(formatTimeToHHMM(newHour === 0 ? 0 : newHour, parsed.minutes));
                        }
                      }}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded transition-colors ${
                        (parseHHMM(draftTime)?.hours || 0) < 12
                          ? "bg-[#154CB3] text-white border-2 border-[#154CB3]"
                          : "bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = parseHHMM(draftTime) || { hours: 12, minutes: 0 };
                        if (parsed.hours < 12) {
                          const newHour = parsed.hours + 12;
                          setDraftTime(formatTimeToHHMM(newHour === 12 ? 12 : newHour, parsed.minutes));
                        }
                      }}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded transition-colors ${
                        (parseHHMM(draftTime)?.hours || 0) >= 12
                          ? "bg-[#154CB3] text-white border-2 border-[#154CB3]"
                          : "bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>

                {/* Clock icon and time display */}
                <div className="flex items-center justify-between">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="text-sm font-semibold text-[#154CB3]">
                    {formatHHMMTo12Hour(draftTime)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSetTime}
                className="flex-1 px-4 py-2 text-sm font-medium bg-[#154CB3] text-white rounded hover:bg-[#154cb3eb] transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
    </div>
  );
};

export interface WorkflowStage {
  role: string;
  label: string;
  desc: string;
  blocking: boolean;
}

export const STANDALONE_EVENT_STAGES: WorkflowStage[] = [
  { role: 'hod',      label: 'HOD',             desc: 'Head of Department',         blocking: true  },
  { role: 'dean',     label: 'Dean',             desc: 'Dean of the School',         blocking: true  },
  { role: 'cfo',      label: 'CFO / Campus Dir', desc: 'Finance & campus oversight', blocking: true  },
  { role: 'accounts', label: 'Accounts Office',  desc: 'Financial clearance',        blocking: true  },
  { role: 'it',       label: 'IT Support',       desc: 'Technical setup',            blocking: false },
  { role: 'venue',    label: 'Venue',            desc: 'Venue arrangements',         blocking: false },
  { role: 'catering', label: 'Catering',         desc: 'Food & catering vendors',    blocking: false },
  { role: 'stalls',   label: 'Stalls / Misc',    desc: 'Stall allocations',          blocking: false },
];

export interface BudgetItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface OperationalConfig {
  it:       { enabled: boolean; description: string };
  venue:    { enabled: boolean; venue_name: string; date: string; start_time: string; end_time: string };
  catering: { enabled: boolean; approximate_count: string; description: string };
  stalls:   { enabled: boolean; total_stalls: string; canopy_count: string; hardboard_count: string; description: string };
}

const DEFAULT_OPERATIONAL_CONFIG: OperationalConfig = {
  it:       { enabled: false, description: '' },
  venue:    { enabled: false, venue_name: '', date: '', start_time: '', end_time: '' },
  catering: { enabled: false, approximate_count: '', description: '' },
  stalls:   { enabled: false, total_stalls: '', canopy_count: '', hardboard_count: '', description: '' },
};

interface BlockingStageConfig {
  role: string;
  label: string;
  desc: string;
  enabled: boolean;
}

const DEFAULT_BLOCKING_STAGES: BlockingStageConfig[] = [
  { role: 'hod',      label: 'HOD',             desc: 'Head of Department',         enabled: true  },
  { role: 'dean',     label: 'Dean',            desc: 'Dean of the School',         enabled: true  },
  { role: 'cfo',      label: 'CFO / Campus Dir', desc: 'Finance & campus oversight', enabled: false },
  { role: 'accounts', label: 'Accounts Office', desc: 'Financial clearance',        enabled: false },
];

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
  onApprovalConfigChange?: (enabled: boolean, stages: WorkflowStage[], budgetItems: BudgetItem[]) => void;
  onOperationalConfigChange?: (config: OperationalConfig) => void;
  publishBlockedByApproval?: boolean;
}

function EventApprovalsOperationalSection({
  config,
  onChange,
}: {
  config: OperationalConfig;
  onChange: (c: OperationalConfig) => void;
}) {
  const toggleEnabled = (role: keyof OperationalConfig, enabled: boolean) =>
    onChange({ ...config, [role]: { ...config[role], enabled } });

  const updateField = <R extends keyof OperationalConfig>(
    role: R,
    field: keyof OperationalConfig[R],
    value: string | boolean
  ) => onChange({ ...config, [role]: { ...config[role], [field]: value } });

  return (
    <div>
      <p className="text-sm font-semibold text-gray-800 mb-1">Operational Requests</p>
      <p className="text-xs text-gray-500 mb-4">
        Enable any services you need for this event. Forms are submitted to the relevant teams for coordination.
      </p>
      <div className="space-y-3">
        {/* IT Support */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-800">IT Support</p>
              <p className="text-xs text-gray-400">Technical setup, AV, projectors, network</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={config.it.enabled}
                onChange={(e) => toggleEnabled('it', e.target.checked)} />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#154CB3]" />
            </label>
          </div>
          {config.it.enabled && (
            <div className="px-4 pb-4 pt-3 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-600 mb-1">What do you need?</label>
              <textarea
                rows={2}
                value={config.it.description}
                onChange={(e) => updateField('it', 'description', e.target.value)}
                placeholder="Describe your technical requirements..."
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
          )}
        </div>

        {/* Venue */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-800">Venue Booking</p>
              <p className="text-xs text-gray-400">Hall, auditorium, or room reservation</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={config.venue.enabled}
                onChange={(e) => toggleEnabled('venue', e.target.checked)} />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#154CB3]" />
            </label>
          </div>
          {config.venue.enabled && (
            <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Venue name</label>
                <input
                  type="text"
                  value={config.venue.venue_name}
                  onChange={(e) => updateField('venue', 'venue_name', e.target.value)}
                  placeholder="e.g., Main Auditorium"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={config.venue.date}
                    onChange={(e) => updateField('venue', 'date', e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start time</label>
                  <input
                    type="time"
                    value={config.venue.start_time}
                    onChange={(e) => updateField('venue', 'start_time', e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End time</label>
                  <input
                    type="time"
                    value={config.venue.end_time}
                    onChange={(e) => updateField('venue', 'end_time', e.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Catering */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-800">Catering</p>
              <p className="text-xs text-gray-400">Food, beverages, or vendor stalls</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={config.catering.enabled}
                onChange={(e) => toggleEnabled('catering', e.target.checked)} />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#154CB3]" />
            </label>
          </div>
          {config.catering.enabled && (
            <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Approximate attendee count</label>
                <input
                  type="number"
                  min="1"
                  value={config.catering.approximate_count}
                  onChange={(e) => updateField('catering', 'approximate_count', e.target.value)}
                  placeholder="e.g., 200"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Requirements</label>
                <textarea
                  rows={2}
                  value={config.catering.description}
                  onChange={(e) => updateField('catering', 'description', e.target.value)}
                  placeholder="Dietary needs, meal type, timing..."
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Stalls */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-800">Stalls</p>
              <p className="text-xs text-gray-400">Exhibition stalls, canopy, hardboard</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={config.stalls.enabled}
                onChange={(e) => toggleEnabled('stalls', e.target.checked)} />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#154CB3]" />
            </label>
          </div>
          {config.stalls.enabled && (
            <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total number of stalls</label>
                <input
                  type="number"
                  min="1"
                  value={config.stalls.total_stalls}
                  onChange={(e) => updateField('stalls', 'total_stalls', e.target.value)}
                  placeholder="e.g., 10"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Canopy stalls needed</label>
                  <input
                    type="number"
                    min="0"
                    value={config.stalls.canopy_count}
                    onChange={(e) => updateField('stalls', 'canopy_count', e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hardboard stalls needed</label>
                  <input
                    type="number"
                    min="0"
                    value={config.stalls.hardboard_count}
                    onChange={(e) => updateField('stalls', 'hardboard_count', e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Additional requirements</label>
                <textarea
                  rows={2}
                  value={config.stalls.description}
                  onChange={(e) => updateField('stalls', 'description', e.target.value)}
                  placeholder="Any specific setup needs, location preference..."
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BudgetEstimator({
  items,
  onChange,
}: {
  items: BudgetItem[];
  onChange: (items: BudgetItem[]) => void;
}) {
  const total = items.reduce((s, b) => s + b.quantity * b.unitPrice, 0);

  const addRow = () =>
    onChange([...items, { id: crypto.randomUUID(), name: '', quantity: 1, unitPrice: 0 }]);

  const removeRow = (id: string) => onChange(items.filter(b => b.id !== id));

  const updateRow = (id: string, field: keyof Omit<BudgetItem, 'id'>, value: string) =>
    onChange(items.map(b => {
      if (b.id !== id) return b;
      if (field === 'name') return { ...b, name: value };
      return { ...b, [field]: parseFloat(value) || 0 };
    }));

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-gray-800">Budget Estimate</p>
        <span className="text-xs text-gray-400">Required for CFO / Finance review</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">List your expected expenses. This is submitted with the approval request.</p>

      <div className="grid grid-cols-[1fr_64px_88px_80px_28px] gap-2 mb-1 px-1">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Item</span>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-center">Qty</span>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Unit (₹)</span>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Total (₹)</span>
        <span />
      </div>

      <div className="space-y-2">
        {items.map(b => (
          <div key={b.id} className="grid grid-cols-[1fr_64px_88px_80px_28px] gap-2 items-center">
            <input
              type="text"
              placeholder="e.g. Sound system"
              value={b.name}
              onChange={e => updateRow(b.id, 'name', e.target.value)}
              className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <input
              type="number"
              min="1"
              value={b.quantity}
              onChange={e => updateRow(b.id, 'quantity', e.target.value)}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={b.unitPrice}
              onChange={e => updateRow(b.id, 'unitPrice', e.target.value)}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <span className="text-sm text-gray-700 text-right tabular-nums">
              {(b.quantity * b.unitPrice).toLocaleString('en-IN')}
            </span>
            <button
              type="button"
              onClick={() => removeRow(b.id)}
              className="flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 text-base leading-none"
            >
              ×
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-4 text-sm text-gray-400 border border-dashed border-gray-200 rounded">
            No items yet.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <button type="button" onClick={addRow} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
          + Add item
        </button>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-0.5">Total estimate</p>
          <p className="text-base font-semibold text-gray-900 tabular-nums">₹{total.toLocaleString('en-IN')}</p>
        </div>
      </div>
    </div>
  );
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
  organizingSchool: string;
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
  "endTime",
  "festEvent",
  "needsVolunteers",
  "volunteers",
  "isTeamEvent",
  "minParticipants",
  "maxParticipants",
  "detailedDescription",
  "allowOutsiders",
  "outsiderRegistrationFee",
  "outsiderMaxParticipants",
  "campusHostedAt",
  "organizingSchool",
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
  endTime: "#endTime",
  festEvent: "#festEvent",
  needsVolunteers: "#needsVolunteers",
  volunteers: "#volunteer-register-number",
  isTeamEvent: "#isTeamEvent",
  minParticipants: "#minParticipants",
  maxParticipants: "#maxParticipants",
  detailedDescription: "#detailedDescription",
  allowOutsiders: "#allowOutsiders",
  outsiderRegistrationFee: "#outsiderRegistrationFee",
  outsiderMaxParticipants: "#outsiderMaxParticipants",
  campusHostedAt: "#campusHostedAt",
  organizingSchool: "#organizingSchool",
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
  onApprovalConfigChange,
  onOperationalConfigChange,
  publishBlockedByApproval = false,
}: EventFormProps) {
  const searchParams = useSearchParams();
  const shouldOpenApprovalsTab = searchParams.get("tab") === "approvals";
  const [activeTab, setActiveTab] = useState<'details' | 'approvals'>(
    shouldOpenApprovalsTab ? 'approvals' : 'details'
  );
  const [blockingStages, setBlockingStages] = useState<BlockingStageConfig[]>(DEFAULT_BLOCKING_STAGES);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [festApprovalStages, setFestApprovalStages] = useState<any[]>([]);
  const [operationalConfig, setOperationalConfig] = useState<OperationalConfig>(DEFAULT_OPERATIONAL_CONFIG);
  const [fetchedFests, setFetchedFests] = useState<FestOption[]>([]);
  const { session, userData, isStudentOrganiser, subHeadFestIds } = useAuth();

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
              organizingSchool:
                typeof f.organizing_school === "string"
                  ? f.organizing_school.trim()
                  : inferSchoolFromDepartment(
                      typeof f.organizing_dept === "string" ? f.organizing_dept : ""
                    ),
              organizingDept:
                typeof f.organizing_dept === "string" ? f.organizing_dept.trim() : "",
              category: normalizeCategoryValue(f.category),
              campusHostedAt: normalizeCampusHostedAt(f.campus_hosted_at),
              allowedCampuses: normalizeAllowedCampuses(f.allowed_campuses),
              allowOutsiders: normalizeBoolean(f.allow_outsiders ?? f.allowOutsiders),
            }));
          const filteredOptions = isStudentOrganiser && subHeadFestIds.length > 0
            ? options.filter((o) => subHeadFestIds.includes(o.value))
            : options;

          setFetchedFests([
            {
              value: "none",
              label: "None",
              departmentAccess: [],
              organizingSchool: "",
              organizingDept: "",
              category: "",
              campusHostedAt: "",
              allowedCampuses: [],
              allowOutsiders: false,
            },
            ...filteredOptions,
          ]);
        }
      } catch (error) {
        console.error("Failed to fetch fests:", error);
      }
    }
    fetchFests();
  }, [isStudentOrganiser, subHeadFestIds]);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get("tab") === "approvals") {
      setActiveTab("approvals");
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'approvals') {
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    }
  }, [activeTab]);
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
      endTime: "",
      detailedDescription: "",
      department: [],
      category: "",
      organizingSchool: "",
      organizingDept: "",
      festEvent: "",
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
      needsVolunteers: false,
      volunteers: [],
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

      const entries = Object.values(formErrors).filter(Boolean);
      const firstMsg =
        (entries[0] as FieldError | undefined)?.message ||
        "Please fill in all required fields";
      const extra = entries.length - 1;

      toast.error(
        extra > 0
          ? `${firstMsg} (+${extra} more issue${extra > 1 ? "s" : ""})`
          : firstMsg,
        { duration: 4500 }
      );

      scrollToFirstValidationError(formErrors);
    },
    [scrollToFirstValidationError]
  );

  const handleDraftSave = () => {
    const formData = getValues();
    processDraftSubmit(formData);
  };

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
        needsVolunteers:
          typeof defaultValues.needsVolunteers === "boolean"
            ? defaultValues.needsVolunteers
            : Array.isArray(defaultValues.volunteers) && defaultValues.volunteers.length > 0,
        volunteers: Array.isArray(defaultValues.volunteers)
          ? defaultValues.volunteers
          : [],
        organizingSchool:
          typeof defaultValues.organizingSchool === "string" &&
          defaultValues.organizingSchool.trim().length > 0
            ? defaultValues.organizingSchool.trim()
            : inferSchoolFromDepartment(
                typeof defaultValues.organizingDept === "string"
                  ? defaultValues.organizingDept
                  : ""
              ),
        campusHostedAt: normalizeCampusHostedAt(defaultValues.campusHostedAt),
        allowedCampuses: normalizeAllowedCampuses(defaultValues.allowedCampuses),
      };
      reset(transformedDefaults);
    }
  }, [defaultValues, reset, isEditMode]);

  const watchedEventDate = useWatch({ control, name: "eventDate" });
  const watchedEndDate = useWatch({ control, name: "endDate" });
  const watchedEndTime = useWatch({ control, name: "endTime" });
  const watchedNeedsVolunteers = useWatch({ control, name: "needsVolunteers" });
  const watchedIsTeamEvent = useWatch({ control, name: "isTeamEvent" });
  const watchedMaxParticipants = useWatch({ control, name: "maxParticipants" });
  const watchedMinParticipants = useWatch({ control, name: "minParticipants" });
  const watchedFestEvent = useWatch({ control, name: "festEvent" });
  const watchedOrganizingSchool = useWatch({
    control,
    name: "organizingSchool",
  });
  const lastAutoFilledFestRef = useRef<string | null>(null);

  useEffect(() => {
    if (watchedNeedsVolunteers) return;
    const currentVolunteers = getValues("volunteers");
    if (Array.isArray(currentVolunteers) && currentVolunteers.length > 0) {
      setValue("volunteers", [], { shouldDirty: true, shouldValidate: true });
    }
  }, [watchedNeedsVolunteers, getValues, setValue]);

  const departmentOptionsForSelectedSchool = React.useMemo(() => {
    const selectedSchool = String(watchedOrganizingSchool || "").trim();
    return getDepartmentOptionsForSchool(selectedSchool);
  }, [watchedOrganizingSchool]);

  useEffect(() => {
    const selectedSchool = String(watchedOrganizingSchool || "").trim();
    if (!selectedSchool) return;

    // Department access is open to all schools — do not filter it when organizing school changes.
    // Only reset organizingDept if it no longer belongs to the newly selected school.

    if (selectedSchool === CLUBS_AND_CENTRES_SCHOOL) {
      return;
    }

    const allowedDepartmentLabels = new Set(
      getDepartmentOptionsForSchool(selectedSchool).map((option) => option.label)
    );
    const currentOrganizingDept = String(getValues("organizingDept") || "").trim();

    if (currentOrganizingDept && !allowedDepartmentLabels.has(currentOrganizingDept)) {
      setValue("organizingDept", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [watchedOrganizingSchool, getValues, setValue]);

  useEffect(() => {
    if (!watchedIsTeamEvent) {
      setValue("maxParticipants", "1", { shouldValidate: false });
      setValue("minParticipants", "1", { shouldValidate: false });
      return;
    }

    const currentMin = Number(getValues("minParticipants") || 0);
    const currentMax = Number(getValues("maxParticipants") || 0);

    // Team events require at least 2 members.
    if (!Number.isFinite(currentMin) || currentMin < 2) {
      setValue("minParticipants", "2", { shouldValidate: false });
    }
    if (!Number.isFinite(currentMax) || currentMax < 2) {
      setValue("maxParticipants", "2", { shouldValidate: false });
    }
  }, [watchedIsTeamEvent, setValue, getValues]);

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
    setValue("organizingSchool", selectedFest.organizingSchool, {
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

  const isStandaloneEvent = !watchedFestEvent || String(watchedFestEvent).toLowerCase() === "none";

  useEffect(() => {
    if (!onApprovalConfigChange) return;
    const enabled = blockingStages
      .filter(s => s.enabled)
      .map(s => ({ role: s.role, label: s.label, desc: s.desc, blocking: true as const }));
    onApprovalConfigChange(isStandaloneEvent && enabled.length > 0, enabled, budgetItems);
  }, [blockingStages, budgetItems, isStandaloneEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (onOperationalConfigChange) onOperationalConfigChange(operationalConfig);
  }, [operationalConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch parent fest's approval stages when a fest is selected
  useEffect(() => {
    if (isStandaloneEvent || !watchedFestEvent || !session?.access_token) {
      setFestApprovalStages([]);
      return;
    }
    const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, '');
    fetch(`${base}/api/approvals/${watchedFestEvent}?type=fest`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.approval?.stages) setFestApprovalStages(data.approval.stages); })
      .catch(() => {});
  }, [watchedFestEvent, isStandaloneEvent, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [pendingSuccess, setPendingSuccess] = React.useState<"publish" | "draft" | "delete" | null>(null);
  const [successAction, setSuccessAction] = React.useState<"publish" | "draft">("publish");
  const [wasDraftOnSubmit, setWasDraftOnSubmit] = React.useState(false);
  const [modalVisible, setModalVisible] = React.useState(false);
  const shouldBlockPublishByApproval = Boolean(isEditMode && isDraft && publishBlockedByApproval);

  const processSubmit: SubmitHandler<EventFormData> = async (data) => {
    try {
      const sanitizedData = {
        ...data,
        volunteers: data.needsVolunteers ? data.volunteers || [] : [],
      };
      setWasDraftOnSubmit(Boolean(isDraft));
      await onSubmit(sanitizedData);
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
      const sanitizedData = {
        ...data,
        volunteers: data.needsVolunteers ? data.volunteers || [] : [],
      };
      await onSubmitDraft(sanitizedData);
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
        isVisible={isSubmittingProp || isDeleting}
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
            <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-visible">
              {/* Tab headers */}
              <div className="flex border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors focus:outline-none ${activeTab === 'details' ? 'text-[#154CB3] border-b-2 border-[#154CB3] bg-blue-50/40' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                  Event Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('approvals')}
                  className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors focus:outline-none ${activeTab === 'approvals' ? 'text-[#154CB3] border-b-2 border-[#154CB3] bg-blue-50/40' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                  Approvals
                </button>
              </div>
              <form
                onSubmit={handleSubmit(processSubmit, handleInvalidSubmit)}
                onKeyDown={handleFormKeyDown}
                noValidate
              >
                {/* ── Details tab ── */}
                <div className={`p-6 sm:p-8 md:p-10 space-y-6 sm:space-y-8 ${activeTab !== 'details' ? 'hidden' : ''}`}>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <Controller
                    name="endTime"
                    control={control}
                    render={({ field, fieldState }) => (
                      <CustomTimePicker
                        id="endTime"
                        field={field}
                        label="End time:"
                        error={fieldState.error}
                        required={watchedNeedsVolunteers}
                        placeholder="HH:MM"
                      />
                    )}
                  />
                  <CustomDropdown
                    name="festEvent"
                    control={control}
                    options={fetchedFests.length > 0 ? fetchedFests : [{ value: "none", label: "None" }]}
                    placeholder="Select fest"
                    label="Is this event under any fest?"
                    error={errors.festEvent}
                    required
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#154CB3]">
                        <UsersRound className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#154CB3]">
                          Volunteer Access
                        </p>
                        <label
                          htmlFor="needsVolunteers"
                          className="block text-sm font-semibold text-slate-900 cursor-pointer mt-0.5"
                        >
                          Need volunteers
                        </label>
                        <p className="text-xs text-slate-500 mt-1">
                          Assign trusted students who can scan QR codes for this event.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <Controller
                        name="needsVolunteers"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            id="needsVolunteers"
                            checked={!!field.value}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              field.onChange(checked);
                              if (!checked) {
                                setValue("volunteers", [], {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                              }
                            }}
                            className="sr-only peer"
                          />
                        )}
                      />
                      <div className={toggleTrackClass}></div>
                    </label>
                  </div>

                  {watchedNeedsVolunteers && (
                    <Controller
                      name="volunteers"
                      control={control}
                      render={({ field }) => (
                        <VolunteerAssignmentSection
                          value={Array.isArray(field.value) ? field.value : []}
                          onChange={field.onChange}
                          endDate={watchedEndDate}
                          endTime={watchedEndTime}
                          assignedByEmail={userData?.email || session?.user?.email || ""}
                          disabled={isSubmittingProp || rhfIsSubmitting}
                        />
                      )}
                    />
                  )}
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
                          <div className="flex-1 sm:w-[220px]">
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
                              <p className="text-red-500 text-xs mt-1 leading-tight break-words">
                                {errors.minParticipants.message}
                              </p>
                            )}
                          </div>
                          <div className="flex-1 sm:w-[220px]">
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
                              <p className="text-red-500 text-xs mt-1 leading-tight break-words">
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

                <CustomDropdown
                  name="organizingSchool"
                  control={control}
                  options={organizingSchools}
                  placeholder="Select organizing school"
                  label="Organizing school:"
                  error={errors.organizingSchool}
                  required
                />

                {watchedOrganizingSchool === CLUBS_AND_CENTRES_SCHOOL ? (
                  <>
                    <datalist id="organizing-dept-list-event">
                      {getDepartmentOptionsForSchool(CLUBS_AND_CENTRES_SCHOOL)
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
                      placeholder="Type club or centre name"
                    />
                  </>
                ) : (
                  <CustomDropdown
                    name="organizingDept"
                    control={control}
                    options={departmentOptionsForSelectedSchool.map((dept) => ({
                      value: dept.label,
                      label: dept.label,
                    }))}
                    placeholder={
                      watchedOrganizingSchool
                        ? "Select organizing department"
                        : "Select organizing school first"
                    }
                    label="Organizing department:"
                    error={errors.organizingDept}
                    required
                  />
                )}

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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Are claims provided for this fest?
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Select Yes if this event includes claim support.
                      </p>
                    </div>
                    <Controller
                      name="provideClaims"
                      control={control}
                      render={({ field }) => {
                        const claimsEnabled = Boolean(field.value);

                        return (
                          <div
                            role="radiogroup"
                            aria-label="Claims provided"
                            className="inline-flex items-center rounded-xl border border-gray-300 bg-white p-1 shadow-sm"
                          >
                            <input
                              type="checkbox"
                              id="provideClaims"
                              checked={claimsEnabled}
                              onChange={(e) => field.onChange(e.target.checked)}
                              className="sr-only"
                            />

                            <button
                              type="button"
                              role="radio"
                              aria-checked={claimsEnabled}
                              onClick={() => field.onChange(true)}
                              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                claimsEnabled
                                  ? "bg-green-600 text-white"
                                  : "text-gray-600 hover:bg-gray-100"
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={!claimsEnabled}
                              onClick={() => field.onChange(false)}
                              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                !claimsEnabled
                                  ? "bg-red-600 text-white"
                                  : "text-gray-600 hover:bg-gray-100"
                              }`}
                            >
                              No
                            </button>
                          </div>
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

                </div>{/* end details tab */}

                {/* ── Approvals tab ── */}
                <div className={`p-6 sm:p-8 md:p-10 space-y-6 ${activeTab !== 'approvals' ? 'hidden' : ''}`}>
                  {!isStandaloneEvent ? (
                    /* Under-fest: locked blocking rows + operational toggles */
                    <div className="space-y-6">
                      <div>
                        <p className="text-sm font-semibold text-gray-800 mb-1">Blocking Approval Stages</p>
                        <p className="text-xs text-gray-500 mb-3">
                          These stages are managed by the parent fest. Shown below is the current approval status from that fest.
                        </p>
                        <div className="space-y-2">
                          {[
                            { role: 'hod',      label: 'HOD',             desc: 'Head of Department' },
                            { role: 'dean',     label: 'Dean',            desc: 'Dean of the School' },
                            { role: 'cfo',      label: 'CFO / Campus Dir', desc: 'Finance & campus oversight' },
                            { role: 'accounts', label: 'Accounts Office', desc: 'Financial clearance' },
                          ].map((s) => {
                            const festStage = festApprovalStages.find(fs => fs.role === s.role);
                            const statusMap: Record<string, string> = {
                              approved: 'Approved',
                              pending:  'Pending',
                              rejected: 'Returned',
                              skipped:  'Skipped',
                            };
                            const statusText = festStage ? (statusMap[festStage.status] ?? festStage.status) : '—';
                            return (
                              <div key={s.role} className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 opacity-70 cursor-not-allowed">
                                <div>
                                  <p className="text-sm font-medium text-gray-600">{s.label}</p>
                                  <p className="text-xs text-gray-400">{s.desc}</p>
                                </div>
                                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                                  {statusText}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <EventApprovalsOperationalSection config={operationalConfig} onChange={setOperationalConfig} />
                    </div>
                  ) : (
                    /* Standalone: per-stage toggles for blocking + optional budget + operational */
                    <div className="space-y-6">
                      <div>
                        <p className="text-sm font-semibold text-gray-800 mb-1">Approval Stages</p>
                        <p className="text-xs text-gray-500 mb-3">
                          Toggle off any stages that are not required for this event.
                        </p>
                        <div className="space-y-2">
                          {blockingStages.map((s) => (
                            <div key={s.role} className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 bg-gray-50">
                              <div>
                                <p className="text-sm font-medium text-gray-800">{s.label}</p>
                                <p className="text-xs text-gray-400">{s.desc}</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={s.enabled}
                                  onChange={(e) =>
                                    setBlockingStages(prev =>
                                      prev.map(bs => {
                                        if (bs.role === s.role) return { ...bs, enabled: e.target.checked };
                                        if (s.role === 'cfo' && bs.role === 'accounts' && e.target.checked) return { ...bs, enabled: true };
                                        return bs;
                                      })
                                    )
                                  }
                                />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#154CB3]" />
                              </label>
                            </div>
                          ))}
                        </div>
                        {/* Budget estimator appears when CFO or Accounts is enabled */}
                        {blockingStages.some(s => (s.role === 'cfo' || s.role === 'accounts') && s.enabled) && (
                          <>
                            <BudgetEstimator items={budgetItems} onChange={setBudgetItems} />
                            {budgetItems.length === 0 && (
                              <p className="text-xs text-red-500 mt-1">Budget Estimate is required when CFO or Finance Officer is included.</p>
                            )}
                          </>
                        )}
                      </div>
                      <EventApprovalsOperationalSection config={operationalConfig} onChange={setOperationalConfig} />
                    </div>
                  )}
                </div>{/* end approvals tab */}

                {/* ── Action buttons — always visible ── */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 sm:px-8 md:px-10 py-5 border-t border-gray-200">
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
                    {!shouldBlockPublishByApproval && (
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
                    )}

                    {onSubmitDraft && (
                      <button
                        type="button"
                        onClick={handleDraftSave}
                        className={secondaryButtonClasses}
                        disabled={isSubmittingProp || rhfIsSubmitting || isDeleting}
                      >
                        {isSubmittingProp || rhfIsSubmitting
                          ? "Saving..."
                          : "Save as Draft"}
                      </button>
                    )}

                    {isEditMode && !shouldBlockPublishByApproval && (
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
                  
                  {activeTab === 'details' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('approvals');
                      }}
                      disabled={
                        isSubmittingProp ||
                        rhfIsSubmitting ||
                        isDeleting ||
                        isOpeningPreview
                      }
                      className="w-full sm:w-auto px-6 py-2.5 bg-[#154CB3] text-white text-sm font-medium rounded-md hover:bg-[#0f3a7a] focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSubmittingProp || rhfIsSubmitting ? "Saving..." : "Go ahead for Approvals Tab"}
                    </button>
                  ) : (
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
                  )}
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

