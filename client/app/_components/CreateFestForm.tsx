"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../context/AuthContext"; // Adjust path as needed
import {
  christCampuses,
  organizingSchools,
  getDepartmentOptionsForSchool,
  inferSchoolFromDepartment,
  CLUBS_AND_CENTRES_SCHOOL,
  departments as allDepartments,
} from "../lib/eventFormSchema";
import toast from "react-hot-toast";
import PublishingOverlay from "./UI/PublishingOverlay";
const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");
const ALLOWED_FEST_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MAX_EMAIL_LENGTH = 100;
const PHONE_REGEX = /^\+?[\d\s-]{10,14}$/;

const normalizeEmail = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase();

const isValidEmail = (value: unknown): boolean =>
  EMAIL_REGEX.test(normalizeEmail(value));

const normalizePhone = (value: unknown): string => String(value ?? "").trim();

const readApiBodySafely = async (response: Response): Promise<any> => {
  const rawText = await response.text();
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch {
    return { message: rawText };
  }
};

const extractApiErrorMessage = (
  response: Response,
  body: any,
  fallbackMessage: string
): string => {
  if (body && typeof body === "object") {
    const candidates = [
      body.error,
      body.message,
      typeof body.details === "string" ? body.details : null,
      body.detail,
    ];
    const firstMessage = candidates.find(
      (candidate) => typeof candidate === "string" && candidate.trim().length > 0
    );

    if (firstMessage) {
      return firstMessage;
    }
  }

  const statusLabel = [response.status, response.statusText]
    .filter(Boolean)
    .join(" ");
  return statusLabel
    ? `${fallbackMessage} (${statusLabel})`
    : fallbackMessage;
};

const toDateTimeLocalInputValue = (value: string | null): string => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 16);
};

const FEST_TEAM_SETTINGS_KEY = "__team_event_settings__";

interface FestTeamSettings {
  isTeamEvent: boolean;
  minParticipants: string;
  maxParticipants: string;
}

const parseFestCustomFields = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};



const upsertTeamSettingsInCustomFields = (
  customFields: unknown,
  teamSettings: FestTeamSettings
): any[] => {
  const parsedFields = parseFestCustomFields(customFields).filter(
    (field) =>
      !(
        field &&
        typeof field === "object" &&
        !Array.isArray(field) &&
        field.key === FEST_TEAM_SETTINGS_KEY
      )
  );

  if (!teamSettings.isTeamEvent) {
    return parsedFields;
  }

  return [
    ...parsedFields,
    {
      key: FEST_TEAM_SETTINGS_KEY,
      value: {
        isTeamEvent: true,
        minParticipants: teamSettings.minParticipants,
        maxParticipants: teamSettings.maxParticipants,
      },
    },
  ];
};

const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseYYYYMMDD = (dateString: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
  const date = new Date(dateString + "T00:00:00");
  const [year, month, day] = dateString.split("-").map(Number);
  if (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  ) {
    return date;
  }
  return null;
};

const deriveFestStatusFromDates = (
  openingDateValue: string,
  closingDateValue: string
): "upcoming" | "ongoing" | "past" => {
  const openingDate = parseYYYYMMDD(openingDateValue);
  const closingDate = parseYYYYMMDD(closingDateValue) || openingDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (openingDate && today < openingDate) {
    return "upcoming";
  }

  if (closingDate && today > closingDate) {
    return "past";
  }

  return "ongoing";
};

interface CustomDateInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  minDate?: Date;
  required?: boolean;
}

const CustomDateInput: React.FC<CustomDateInputProps> = ({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder = "Select date",
  minDate,
  required,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const initialDisplayDate =
    parseYYYYMMDD(value) ||
    (minDate && new Date() < minDate ? minDate : new Date());
  const [displayMonth, setDisplayMonth] = useState<Date>(initialDisplayDate);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedDateObj = parseYYYYMMDD(value);

  useEffect(() => {
    const validValueDate = parseYYYYMMDD(value);
    if (validValueDate && !isOpen) {
      setDisplayMonth(validValueDate);
    } else if (!validValueDate && !isOpen) {
      const fallbackDate =
        minDate && new Date() < minDate ? minDate : new Date();
      setDisplayMonth(
        new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), 1)
      );
    }
  }, [value, isOpen, minDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        if (onBlur) onBlur();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onBlur]);

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
    onChange(formatDateToYYYYMMDD(newSelectedDate));
    setIsOpen(false);
    if (onBlur) onBlur();
  };

  const renderDays = () => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const numDays = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    const dayElements = [];
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
    for (let i = 0; i < firstDay; i++)
      dayElements.push(<div key={`empty-${i}`} className="py-1"></div>);
    for (let day = 1; day <= numDays; day++) {
      const currentDateInLoop = new Date(year, month, day);
      const currentDateStr = formatDateToYYYYMMDD(currentDateInLoop);
      const isSelected =
        selectedDateObj &&
        formatDateToYYYYMMDD(selectedDateObj) === currentDateStr;
      const minDateAtMidnight = minDate
        ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
        : null;
      const currentDateInLoopAtMidnight = new Date(
        currentDateInLoop.getFullYear(),
        currentDateInLoop.getMonth(),
        currentDateInLoop.getDate()
      );
      const isDisabled =
        (minDateAtMidnight && currentDateInLoopAtMidnight < minDateAtMidnight) || false;
      dayElements.push(
        <button
          type="button"
          key={day}
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
    <div>
      <label
        htmlFor={id + "-trigger"}
        className="block mb-2 text-sm font-medium text-gray-700"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <button
          type="button"
          id={id + "-trigger"}
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          className={`bg-white rounded-lg px-4 py-3 border-2 w-full text-left flex items-center justify-between transition-all ${
            isOpen
              ? "border-[#154CB3] ring-1 ring-[#154CB3]"
              : "border-gray-200 hover:border-gray-400"
          } ${error ? "border-red-500" : ""}`}
          aria-haspopup="dialog"
          aria-controls={id + "-calendar"}
        >
          <span
            className={`text-sm ${value ? "text-gray-900" : "text-gray-500"}`}
          >
            {value ? value : placeholder}
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
            id={id + "-calendar"}
            ref={dropdownRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={id + "-monthyear"}
            className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-[120] p-4 w-[20rem] max-w-[calc(100vw-2rem)]"
          >
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-[#154CB3]"
                aria-label="Previous month"
              >
                <svg
                  className="h-6 w-6"
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
                id={id + "-monthyear"}
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
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

interface DepartmentAndCategoryInputsProps {
  formData: { department: string[]; category: string };
  availableDepartments: { value: string; label: string }[];
  errors: Record<string, string | undefined>;
  setFormData: React.Dispatch<React.SetStateAction<CreateFestState>>;
  validateField: (
    name: string,
    value: string | string[]
  ) => void;
}
interface CreateFestState {
  title: string;
  openingDate: string;
  closingDate: string;
  isTeamEvent: boolean;
  minParticipants: string;
  maxParticipants: string;
  detailedDescription: string;
  department: string[];
  category: string;
  contactEmail: string;
  contactPhone: string;
  subHeads: { email: string; expiresAt: string | null }[];
  organizingSchool: string;
  organizingDept: string;
  venue: string;
  status: "draft" | "upcoming" | "ongoing" | "completed" | "cancelled" | "past";
  registration_deadline: string;
  timeline: { time: string; title: string; description: string }[];
  sponsors: { name: string; logo_url: string; website?: string }[];
  social_links: { platform: string; url: string }[];
  faqs: { question: string; answer: string }[];
  campusHostedAt: string;
  allowedCampuses: string[];
  departmentHostedAt: string;
  allowedDepartments: string[];
  allowOutsiders: boolean;
  customFields: any[];
}

function DepartmentAndCategoryInputs({
  formData,
  availableDepartments,
  errors,
  setFormData,
  validateField,
}: DepartmentAndCategoryInputsProps) {
  const [isDepartmentDropdownOpen, setIsDepartmentDropdownOpen] =
    useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const departmentDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const departmentTriggerRef = useRef<HTMLButtonElement>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        departmentDropdownRef.current &&
        !departmentDropdownRef.current.contains(event.target as Node) &&
        departmentTriggerRef.current &&
        !departmentTriggerRef.current.contains(event.target as Node)
      )
        setIsDepartmentDropdownOpen(false);
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node) &&
        categoryTriggerRef.current &&
        !categoryTriggerRef.current.contains(event.target as Node)
      )
        setIsCategoryDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDepartmentDropdown = () => {
    setIsDepartmentDropdownOpen(!isDepartmentDropdownOpen);
    setIsCategoryDropdownOpen(false);
  };
  const toggleCategoryDropdown = () => {
    setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
    setIsDepartmentDropdownOpen(false);
  };

  const handleDepartmentChange = (dept: string) => {
    const newDepartments = formData.department.includes(dept)
      ? formData.department.filter((d) => d !== dept)
      : [...formData.department, dept];
    setFormData((prev) => ({
      ...prev,
      department: newDepartments,
      allowedDepartments: newDepartments,
    }));
    validateField("department", newDepartments);
  };
  const handleCategorySelect = (value: string) => {
    setFormData((prev) => ({ ...prev, category: value }));
    validateField("category", value);
    setIsCategoryDropdownOpen(false);
  };

  const departments = availableDepartments;
  
  const categories = [
    { value: "technology", label: "Technology" },
    { value: "academic", label: "Academic" },
    { value: "sports", label: "Sports" },
    { value: "cultural", label: "Cultural" },
    { value: "workshop", label: "Workshop" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="relative">
        <label
          htmlFor="department-trigger"
          className="block mb-2 text-sm font-medium text-gray-700"
        >
          Department accessibility: <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-2 min-h-[18px]">
          Departments allowed to access this fest
        </p>
        <button
          type="button"
          id="department-trigger"
          ref={departmentTriggerRef}
          onClick={toggleDepartmentDropdown}
          aria-haspopup="listbox"
          aria-controls="department-listbox"
          title="Select departments"
          className={`bg-white rounded-lg px-4 py-3 border-2 w-full text-left flex items-center justify-between transition-all cursor-pointer ${
            isDepartmentDropdownOpen
              ? "border-[#154CB3] ring-1 ring-[#154CB3]"
              : "border-gray-200 hover:border-gray-400"
          } ${errors.department ? "border-red-500" : ""}`}
        >
          <span className="text-sm text-gray-900 truncate max-w-[calc(100%-2rem)]">
            {formData.department.length > 0
              ? formData.department
                  .map(
                    (deptValue) =>
                      departments.find((d) => d.value === deptValue)?.label ||
                      deptValue
                  )
                  .join(", ")
              : "Select departments"}
          </span>
          <svg
            className={`h-5 w-5 text-gray-500 transform transition-transform ${
              isDepartmentDropdownOpen ? "rotate-180" : ""
            }`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        {isDepartmentDropdownOpen && (
          <div
            id="department-listbox"
            ref={departmentDropdownRef}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-y-auto max-h-60 w-full"
          >
            {departments.map((dept) => {
              const isSelected = formData.department.includes(dept.value);
              return (
                <button
                  key={dept.value}
                  type="button"
                  onClick={() => handleDepartmentChange(dept.value)}
                  title={`Toggle ${dept.label}`}
                  className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-blue-50 text-[#154CB3]"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="flex items-center">
                    <span
                      className={`mr-2 inline-flex h-4 w-4 items-center justify-center rounded border ${
                        isSelected
                          ? "border-[#154CB3] bg-[#154CB3] text-white"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {dept.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {errors.department && (
          <p className="text-red-500 text-xs mt-1">{errors.department}</p>
        )}
      </div>
      <div className="relative">
        <label
          htmlFor="category-trigger"
          className="block mb-2 text-sm font-medium text-gray-700"
        >
          Category: <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-2 min-h-[18px]">Classify this fest for discovery</p>
        <button
          type="button"
          id="category-trigger"
          ref={categoryTriggerRef}
          onClick={toggleCategoryDropdown}
          aria-haspopup="listbox"
          aria-controls="category-listbox"
          title="Select category"
          className={`bg-white rounded-lg px-4 py-3 border-2 w-full text-left flex items-center justify-between transition-all cursor-pointer ${
            isCategoryDropdownOpen
              ? "border-[#154CB3] ring-1 ring-[#154CB3]"
              : "border-gray-200 hover:border-gray-400"
          } ${errors.category ? "border-red-500" : ""}`}
        >
          <span className="text-sm text-gray-900 truncate max-w-[calc(100%-2rem)]">
            {categories.find((c) => c.value === formData.category)?.label ||
              "Select category"}
          </span>
          <svg
            className={`h-5 w-5 text-gray-500 transform transition-transform ${
              isCategoryDropdownOpen ? "rotate-180" : ""
            }`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        {isCategoryDropdownOpen && (
          <div
            id="category-listbox"
            ref={categoryDropdownRef}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-y-auto max-h-60 w-full"
          >
            <button
              type="button"
              onClick={() => handleCategorySelect("")}
              className={`px-4 py-3 text-sm font-medium hover:bg-gray-100 cursor-pointer transition-colors ${
                !formData.category
                  ? "bg-blue-50 text-[#154CB3]"
                  : "text-gray-700"
              }`}
            >
              Select category
            </button>
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => handleCategorySelect(cat.value)}
                className={`px-4 py-3 text-sm font-medium hover:bg-gray-100 cursor-pointer transition-colors ${
                  formData.category === cat.value
                    ? "bg-blue-50 text-[#154CB3]"
                    : "text-gray-700"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
        {errors.category && (
          <p className="text-red-500 text-xs mt-1">{errors.category}</p>
        )}
      </div>
    </div>
  );
}

interface CreateFestProps {
  title?: string;
  openingDate?: string;
  closingDate?: string;
  isTeamEvent?: boolean;
  minParticipants?: string;
  maxParticipants?: string;
  detailedDescription?: string;
  department?: string[];
  category?: string;
  contactEmail?: string;
  contactPhone?: string;
  subHeads?: { email: string; expiresAt: string | null }[];
  scheduleItems?: { time: string; activity: string }[];
  rules?: string[];
  prizes?: string[];
  organizingSchool?: string;
  organizingDept?: string;
  isEditMode?: boolean;
  existingImageFileUrl?: string | null;
  existingBannerFileUrl?: string | null;
  existingPdfFileUrl?: string | null;
  isDraft?: boolean;
  venue?: string;
  status?: "draft" | "upcoming" | "ongoing" | "completed" | "cancelled" | "past";
  registration_deadline?: string;
  timeline?: { time: string; title: string; description: string }[];
  sponsors?: { name: string; logo_url: string; website?: string }[];
  social_links?: { platform: string; url: string }[];
  faqs?: { question: string; answer: string }[];
  customFields?: any[];
}

const FullPageSpinner: React.FC<{ text: string }> = ({ text }) => (
  <div className="fixed inset-0 bg-white z-[110] flex items-center justify-center">
    <div className="text-center">
      <svg
        className="animate-spin h-10 w-10 text-[#154CB3] mx-auto mb-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <p className="text-lg font-medium text-gray-700">{text}</p>
    </div>
  </div>
);

interface WorkflowStage {
  role: string;
  label: string;
  desc: string;
  blocking: boolean;
  required?: boolean;
  enabled?: boolean;
}

interface BudgetItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

const DEFAULT_WORKFLOW_STAGES: WorkflowStage[] = [
  { role: 'hod',      label: 'HOD',             desc: 'Head of Dept — matched by dept + campus',   blocking: true, required: true,  enabled: true },
  { role: 'dean',     label: 'Dean',             desc: 'Dean of School — matched by school + campus', blocking: true, required: true,  enabled: true },
  { role: 'cfo',      label: 'CFO / Campus Dir', desc: 'Finance & campus oversight',                blocking: true, required: false, enabled: true },
  { role: 'accounts', label: 'Finance Officer',  desc: 'Accounts Office — matched by campus',       blocking: true, required: false, enabled: true },
];

interface ApprovalsSetupViewProps {
  organizingSchool: string;
  organizingDept: string;
  festId: string | null;
  approvalExists: boolean | null;
  isSubmitting: boolean;
  initialBudgetItems?: BudgetItem[];
  onSubmitForApproval: (customStages: WorkflowStage[], budgetItems: BudgetItem[]) => void;
  onUpdateWorkflow: (customStages: WorkflowStage[], budgetItems: BudgetItem[]) => void;
  onBackToDetails: () => void;
  session: any;
}

function ApprovalsSetupView({
  organizingSchool,
  organizingDept,
  festId,
  approvalExists,
  isSubmitting,
  initialBudgetItems,
  onSubmitForApproval,
  onUpdateWorkflow,
  onBackToDetails,
}: ApprovalsSetupViewProps) {
  const [stages, setStages] = React.useState<WorkflowStage[]>(DEFAULT_WORKFLOW_STAGES);
  const [draggedRole, setDraggedRole] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{ role: string | null; position: 'before' | 'after'; section: 'pre' | 'post' } | null>(null);
  const [budgetItems, setBudgetItems] = React.useState<BudgetItem[]>(initialBudgetItems ?? []);

  React.useEffect(() => {
    if (initialBudgetItems && initialBudgetItems.length > 0) {
      setBudgetItems(initialBudgetItems.map(b => ({ ...b, id: b.id || crypto.randomUUID() })));
    }
  }, [initialBudgetItems]);

  const cfoEnabled   = stages.find(s => s.role === 'cfo')?.enabled !== false;
  const needsBudget  = stages.some(s => (s.role === 'cfo' || s.role === 'accounts') && s.enabled !== false);

  function toggleStage(role: string, enabled: boolean) {
    setStages(prev => {
      let updated = prev.map(s => s.role === role ? { ...s, enabled } : s);
      // CFO on → Finance Officer must also be on and locked; CFO off → Finance can toggle freely
      if (role === 'cfo' && enabled) {
        updated = updated.map(s => s.role === 'accounts' ? { ...s, enabled: true } : s);
      }
      return updated;
    });
  }

  function addBudgetRow() {
    setBudgetItems(prev => [...prev, { id: crypto.randomUUID(), name: '', quantity: 1, unitPrice: 0 }]);
  }

  function removeBudgetRow(id: string) {
    setBudgetItems(prev => prev.filter(b => b.id !== id));
  }

  function updateBudgetRow(id: string, field: keyof Omit<BudgetItem, 'id'>, value: string) {
    setBudgetItems(prev => prev.map(b => {
      if (b.id !== id) return b;
      if (field === 'name') return { ...b, name: value };
      const num = parseFloat(value) || 0;
      return { ...b, [field]: num };
    }));
  }

  const budgetTotal = budgetItems.reduce((sum, b) => sum + b.quantity * b.unitPrice, 0);

  const preLiveStages  = stages.filter(s => s.blocking);
  const postLiveStages = stages.filter(s => !s.blocking);

  const isPreLiveOnly = (role: string) => role === 'hod' || role === 'dean';

  function handleDragStart(e: React.DragEvent, role: string) {
    setDraggedRole(role);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', role);
  }

  function handleDragOverItem(e: React.DragEvent, role: string, section: 'pre' | 'post') {
    e.stopPropagation();
    if (draggedRole && isPreLiveOnly(draggedRole) && section === 'post') return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropTarget({ role, position, section });
  }

  function handleDropOnItem(e: React.DragEvent, targetRole: string, targetSection: 'pre' | 'post') {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedRole || !dropTarget) return;
    if (isPreLiveOnly(draggedRole) && targetSection === 'post') { setDraggedRole(null); setDropTarget(null); return; }
    const sourceStage = stages.find(s => s.role === draggedRole);
    if (!sourceStage || draggedRole === targetRole) { setDraggedRole(null); setDropTarget(null); return; }
    const targetBlocking = targetSection === 'pre';
    const withoutDragged = stages.filter(s => s.role !== draggedRole);
    const targetIdx = withoutDragged.findIndex(s => s.role === targetRole);
    if (targetIdx === -1) { setDraggedRole(null); setDropTarget(null); return; }
    const insertAt = dropTarget.position === 'after' ? targetIdx + 1 : targetIdx;
    const spliced = [
      ...withoutDragged.slice(0, insertAt),
      { ...sourceStage, blocking: targetBlocking },
      ...withoutDragged.slice(insertAt),
    ];
    setStages([...spliced.filter(s => s.blocking), ...spliced.filter(s => !s.blocking)]);
    setDraggedRole(null);
    setDropTarget(null);
  }

  function handleDragOverEmpty(e: React.DragEvent, section: 'pre' | 'post') {
    if (draggedRole && isPreLiveOnly(draggedRole) && section === 'post') return;
    e.preventDefault();
    setDropTarget({ role: null, position: 'after', section });
  }

  function handleDropOnEmpty(e: React.DragEvent, section: 'pre' | 'post') {
    e.preventDefault();
    if (!draggedRole) return;
    if (isPreLiveOnly(draggedRole) && section === 'post') return;
    const sourceStage = stages.find(s => s.role === draggedRole);
    if (!sourceStage) return;
    const targetBlocking = section === 'pre';
    const updated = stages.map(s => s.role === draggedRole ? { ...s, blocking: targetBlocking } : s);
    setStages([...updated.filter(s => s.blocking), ...updated.filter(s => !s.blocking)]);
    setDraggedRole(null);
    setDropTarget(null);
  }

  function handleDragEnd() {
    setDraggedRole(null);
    setDropTarget(null);
  }

  function moveToPostLive(role: string) {
    setStages(prev => {
      const updated = prev.map(s => s.role === role ? { ...s, blocking: false } : s);
      return [...updated.filter(s => s.blocking), ...updated.filter(s => !s.blocking)];
    });
  }

  function moveToPreLive(role: string) {
    setStages(prev => {
      const updated = prev.map(s => s.role === role ? { ...s, blocking: true } : s);
      return [...updated.filter(s => s.blocking), ...updated.filter(s => !s.blocking)];
    });
  }

  function renderSectionList(sectionStages: WorkflowStage[], section: 'pre' | 'post', emptyText: string) {
    const accentColor = section === 'pre' ? '#3b82f6' : '#a855f7';
    const isEmpty = sectionStages.length === 0;
    const isEmptyDropTarget = dropTarget?.section === section && dropTarget?.role === null;
    return (
      <div
        className={`min-h-[60px] space-y-0.5 rounded-lg transition-colors ${isEmptyDropTarget ? 'bg-blue-50/50' : ''}`}
        onDragOver={(e) => isEmpty && handleDragOverEmpty(e, section)}
        onDrop={(e) => isEmpty && handleDropOnEmpty(e, section)}
        onDragLeave={(e) => {
          if (isEmpty && !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
            setDropTarget(null);
          }
        }}
      >
        {isEmpty ? (
          <div className={`border-2 border-dashed rounded-lg p-4 text-center text-xs transition-colors ${
            isEmptyDropTarget ? 'border-blue-400 text-blue-500 bg-blue-50' : 'border-gray-200 text-gray-400'
          }`}>
            {emptyText}
          </div>
        ) : (
          sectionStages.map((s, i) => {
            const isDragging = draggedRole === s.role;
            const isDropBefore = dropTarget?.role === s.role && dropTarget.position === 'before';
            const isDropAfter = dropTarget?.role === s.role && dropTarget.position === 'after';
            const isLocked = s.role === 'accounts' && cfoEnabled;
            return (
              <div key={s.role}>
                {/* Insertion line — before */}
                <div className={`h-0.5 rounded-full mx-1 transition-all ${isDropBefore ? 'bg-blue-500 mb-1' : 'bg-transparent mb-0'}`} style={isDropBefore ? { backgroundColor: accentColor } : {}} />

                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, s.role)}
                  onDragOver={(e) => handleDragOverItem(e, s.role, section)}
                  onDrop={(e) => handleDropOnItem(e, s.role, section)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 bg-white cursor-grab active:cursor-grabbing select-none transition-all ${
                    isDragging ? 'opacity-30 scale-[0.98]' : 'opacity-100'
                  } border-gray-200 hover:border-gray-300 hover:shadow-sm`}
                >
                  {/* Drag handle */}
                  <svg className="w-4 h-4 text-gray-300 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                  </svg>

                  {/* Step number */}
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    section === 'pre' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {i + 1}
                  </span>

                  {/* Label + desc */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800">{s.label}</p>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    {s.required ? (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium select-none">
                        Required
                      </span>
                    ) : (
                      <label
                        className={`relative inline-flex items-center ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        title={isLocked ? 'Finance Officer is locked ON while CFO is enabled' : 'Toggle this approval on/off'}
                      >
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={s.enabled !== false}
                          disabled={isLocked}
                          onChange={() => !isLocked && toggleStage(s.role, s.enabled === false)}
                        />
                        <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#154CB3]" />
                      </label>
                    )}
                    {!s.required && (
                      <button
                        type="button"
                        title={section === 'pre' ? 'Move to Post-Live' : 'Move to Pre-Live'}
                        onClick={() => section === 'pre' ? moveToPostLive(s.role) : moveToPreLive(s.role)}
                        className="text-xs text-gray-400 hover:text-gray-600 shrink-0 px-1 py-0.5 rounded hover:bg-gray-100 transition-colors"
                      >
                        {section === 'pre' ? '↓' : '↑'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Insertion line — after (only for last item or when dropping after) */}
                <div className={`h-0.5 rounded-full mx-1 transition-all ${isDropAfter ? 'bg-blue-500 mt-1' : 'bg-transparent mt-0'}`} style={isDropAfter ? { backgroundColor: accentColor } : {}} />
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 md:p-10">
      <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-1">Approvals</h2>
      <p className="text-sm text-gray-500 mb-6">
        Drag to reorder stages. HOD and Dean are mandatory. CFO and Finance Officer can be toggled off if not required.
      </p>

      {organizingSchool && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
          <span className="text-sm text-blue-800">
            <span className="font-semibold">School:</span> {organizingSchool}
            {organizingDept && <span className="text-blue-600"> · {organizingDept}</span>}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Pre-Live Section */}
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <h3 className="text-sm font-bold text-blue-800">Stage 1 — Pre-Live</h3>
            <span className="text-xs text-blue-500 ml-auto">Blocks publishing</span>
          </div>
          <p className="text-xs text-blue-600 mb-3">These approvals must complete before your fest goes live.</p>
          {renderSectionList(preLiveStages, 'pre', 'Drag stages here to require approval before going live')}
        </div>

        {/* Post-Live Section */}
        <div className="rounded-xl border-2 border-purple-200 bg-purple-50/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
            <h3 className="text-sm font-bold text-purple-800">Stage 2 — Post-Live</h3>
            <span className="text-xs text-purple-500 ml-auto">Operational</span>
          </div>
          <p className="text-xs text-purple-600 mb-3">These run in parallel after the fest is live.</p>
          {renderSectionList(postLiveStages, 'post', 'Drag stages here for post-live operational tasks')}
        </div>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6 text-xs text-amber-800">
        <span className="font-semibold">Routing:</span> HOD is auto-assigned by dept + campus · Dean by school + campus · CFO & Finance by campus. Use ↓/↑ to move between sections.
      </div>

      {/* Budget Estimate — required when CFO or Finance Officer is included */}
      {needsBudget && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-800">Budget Estimate</h3>
            <span className="text-xs text-gray-500">Required for CFO / Finance review</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            List your expected expenses. This is submitted with the approval request.
          </p>

          <div className="grid grid-cols-[1fr_72px_96px_88px_32px] gap-2 mb-1 px-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Item</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-center">Qty</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Unit (₹)</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Total (₹)</span>
            <span />
          </div>

          <div className="space-y-2">
            {budgetItems.map(b => (
              <div key={b.id} className="grid grid-cols-[1fr_72px_96px_88px_32px] gap-2 items-center">
                <input
                  type="text"
                  placeholder="e.g. Sound system rental"
                  value={b.name}
                  onChange={e => updateBudgetRow(b.id, 'name', e.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                />
                <input
                  type="number"
                  min="1"
                  value={b.quantity}
                  onChange={e => updateBudgetRow(b.id, 'quantity', e.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={b.unitPrice}
                  onChange={e => updateBudgetRow(b.id, 'unitPrice', e.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                />
                <span className="text-sm text-gray-700 text-right tabular-nums">
                  {(b.quantity * b.unitPrice).toLocaleString('en-IN')}
                </span>
                <button
                  type="button"
                  onClick={() => removeBudgetRow(b.id)}
                  className="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-base leading-none"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}

            {budgetItems.length === 0 && (
              <div className="text-center py-5 text-sm text-gray-400 border border-dashed border-gray-200 rounded">
                No items added yet.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={addBudgetRow}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              + Add item
            </button>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-0.5">Total estimate</p>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">₹{budgetTotal.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onBackToDetails}
          className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
        >
          ← Back to Fest Details
        </button>

        {approvalExists ? (
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <button
              type="button"
              onClick={() => onUpdateWorkflow(stages.filter(s => s.required || s.enabled !== false), budgetItems)}
              disabled={isSubmitting || !festId}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#154CB3] text-white text-sm font-semibold rounded-md hover:bg-[#0f3a7a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isSubmitting ? 'Saving...' : 'Update Workflow'}
            </button>
            <a
              href={`/approvals/${festId}?type=fest`}
              className="w-full sm:w-auto px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors text-center"
            >
              View Approval Status
            </a>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSubmitForApproval(stages.filter(s => s.required || s.enabled !== false), budgetItems)}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#154CB3] text-white text-sm font-semibold rounded-md hover:bg-[#0f3a7a] focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
        )}
      </div>
    </div>
  );
}

function CreateFestForm(props?: CreateFestProps) {
  // If props are passed (from edit page), use them; otherwise use defaults
  const title = props?.title || "";
  const openingDate = props?.openingDate || "";
  const closingDate = props?.closingDate || "";
  const isTeamEvent = false;
  const minParticipants = "1";
  const maxParticipants = "1";
  const detailedDescription = props?.detailedDescription || "";
  const department: string[] = props?.department || [];
  const category = props?.category || "";
  const contactEmail = normalizeEmail(props?.contactEmail || "");
  const contactPhone = normalizePhone(props?.contactPhone || "");
  const organizingSchool =
    props?.organizingSchool || inferSchoolFromDepartment(props?.organizingDept || "");
  const organizingDept = props?.organizingDept || "";
  const initialSubHeads: { email: string; expiresAt: string | null }[] =
    (props?.subHeads || []).map((sh) => ({
      email: normalizeEmail(sh.email),
      expiresAt: sh.expiresAt || null,
    }));
  const customFields = parseFestCustomFields(props?.customFields);
  // New props for edit mode
  const isEditMode = props?.isEditMode || false;
  const existingImageFileUrl = props?.existingImageFileUrl || null;

  // New fest enhancement fields
  const venue = props?.venue || "";
  const status = deriveFestStatusFromDates(openingDate, closingDate);
  const registration_deadline = "";
  const timeline = props?.timeline || [];
  const sponsors = props?.sponsors || [];
  const social_links = props?.social_links || [];
  const faqs = props?.faqs || [];
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDraftFest, setIsDraftFest] = useState(Boolean(props?.isDraft));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formData, setFormData] = useState<CreateFestState>({
    title,
    openingDate,
    closingDate,
    isTeamEvent,
    minParticipants,
    maxParticipants,
    detailedDescription,
    department,
    category,
    contactEmail,
    contactPhone,
    organizingSchool,
    organizingDept,
    subHeads: initialSubHeads,
    venue,
    status,
    registration_deadline,
    timeline,
    sponsors,
    social_links,
    faqs,
    campusHostedAt: "",
    allowedCampuses: [],
    departmentHostedAt: "",
    allowedDepartments: [],
    allowOutsiders: false,
    customFields,
  });
  const [activeView, setActiveView] = useState<"details" | "approvals">("details");
  const [savedFestId, setSavedFestId] = useState<string | null>(null);
  const [approvalExists, setApprovalExists] = useState(false);
  const [approvalPhase1Complete, setApprovalPhase1Complete] = useState(false);
  const [existingBudgetItems, setExistingBudgetItems] = useState<BudgetItem[]>([]);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [isLoadingFestData, setIsLoadingFestData] = useState(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);
  const isOpeningPreview = false;

  const [successAction, setSuccessAction] = useState<"publish" | "draft">("publish");
  const [wasDraftOnSubmit, setWasDraftOnSubmit] = useState(false);
  const [pendingFestSuccess, setPendingFestSuccess] = useState(false);
  const [festModalVisible, setFestModalVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false); // Used for delete operation
  const [isSubmitting, setIsSubmitting] = useState(false);


  const { session } = useAuth();
  const currentDateRef = useRef(new Date());
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    currentDateRef.current = today;
  }, []);

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditModeFromPath = pathname.startsWith("/edit/fest");
  const festIdFromPath = isEditModeFromPath ? pathname.split("/").pop() : null;
  const finalIsEditMode = isEditMode || isEditModeFromPath;

  useEffect(() => {
    if (searchParams.get("tab") === "approvals") {
      setActiveView("approvals");
    }
  }, [searchParams]);

  const departmentOptionsForSelectedSchool = useMemo(() => {
    const selectedSchool = String(formData.organizingSchool || "").trim();
    return getDepartmentOptionsForSchool(selectedSchool);
  }, [formData.organizingSchool]);

  const clubsAndCentresDepartmentOptions = useMemo(
    () => getDepartmentOptionsForSchool(CLUBS_AND_CENTRES_SCHOOL),
    []
  );

  useEffect(() => {
    const selectedSchool = String(formData.organizingSchool || "").trim();
    if (!selectedSchool) return;

    // Department access is open to all schools — only reset organizingDept if it
    // no longer belongs to the newly selected school.
    const allowedDepartmentLabels = new Set(
      departmentOptionsForSelectedSchool.map((option) => option.label)
    );

    setFormData((prev) => {
      const nextOrganizingDept =
        selectedSchool === CLUBS_AND_CENTRES_SCHOOL ||
        allowedDepartmentLabels.has(prev.organizingDept)
          ? prev.organizingDept
          : "";

      if (nextOrganizingDept === prev.organizingDept) return prev;

      return { ...prev, organizingDept: nextOrganizingDept };
    });
  }, [formData.organizingSchool, departmentOptionsForSelectedSchool]);

  useEffect(() => {
    if (typeof props?.isDraft === "boolean") {
      setIsDraftFest(props.isDraft);
    }
  }, [props?.isDraft]);

  useEffect(() => {
    if (isEditModeFromPath && festIdFromPath && session?.access_token) {
      // Use isEditModeFromPath here
      const fetchFestData = async () => {
        setIsLoadingFestData(true);
        setErrors({});
        try {
          const response = await fetch(
            `${API_URL}/api/fests/${festIdFromPath}`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );
          const responseBody = await readApiBodySafely(response);

          if (!response.ok) {
            if (response.status === 404) {
              throw new Error("Fest not found.");
            }
            throw new Error(
              extractApiErrorMessage(
                response,
                responseBody,
                "Failed to fetch fest details."
              )
            );
          }

          const data = responseBody;
          if (data?.fest) {
            const subHeadsData = data.fest.sub_heads || [];
            const transformedSubHeads = subHeadsData.map((sh: any) => ({
              email: normalizeEmail(sh.email || ""),
              expiresAt: sh.expiresAt || null,
            }));

            const parsedCustomFields = parseFestCustomFields(data.fest.custom_fields);
            const loadedOpeningDate = data.fest.opening_date
              ? formatDateToYYYYMMDD(new Date(data.fest.opening_date))
              : "";
            const loadedClosingDate = data.fest.closing_date
              ? formatDateToYYYYMMDD(new Date(data.fest.closing_date))
              : "";

            setFormData({
              title: data.fest.fest_title || "",
              openingDate: loadedOpeningDate,
              closingDate: loadedClosingDate,
              isTeamEvent: false,
              minParticipants: "1",
              maxParticipants: "1",
              detailedDescription: data.fest.description || "",
              department: data.fest.department_access || [],
              category: data.fest.category || "",
              contactEmail: normalizeEmail(data.fest.contact_email || ""),
              contactPhone: normalizePhone(data.fest.contact_phone || ""),
              subHeads: transformedSubHeads,
              organizingSchool:
                data.fest.organizing_school ||
                inferSchoolFromDepartment(data.fest.organizing_dept || ""),
              organizingDept: data.fest.organizing_dept || "",
              venue: data.fest.venue || "",
              status: deriveFestStatusFromDates(loadedOpeningDate, loadedClosingDate),
              registration_deadline: "",
              timeline: data.fest.timeline || [],
              sponsors: data.fest.sponsors || [],
              social_links: data.fest.social_links || [],
              faqs: data.fest.faqs || [],
              campusHostedAt: data.fest.campus_hosted_at || "",
              allowedCampuses: data.fest.allowed_campuses || [],
              departmentHostedAt: data.fest.department_hosted_at || "",
              allowedDepartments: data.fest.department_access || [],
              allowOutsiders: data.fest.allow_outsiders === true || data.fest.allow_outsiders === 'true' || false,
              customFields: parsedCustomFields,
            });
            setIsDraftFest(
              data.fest.is_draft === true ||
                data.fest.is_draft === 1 ||
                data.fest.is_draft === "1" ||
                data.fest.is_draft === "true"
            );
          } else {
            throw new Error("Fest data not found in response.");
          }
        } catch (error: any) {
          setErrors((prev) => ({
            ...prev,
            submit: error.message || "Could not load fest data.",
          }));
        } finally {
          setIsLoadingFestData(false);
        }
      };
      fetchFestData();
    }
  }, [isEditModeFromPath, festIdFromPath, session, pathname]); // Use isEditModeFromPath here

  useEffect(() => {
    if (!finalIsEditMode || !festIdFromPath || !session?.access_token) return;
    setSavedFestId(festIdFromPath);
    fetch(`${API_URL}/api/approvals/${festIdFromPath}?type=fest`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          setApprovalExists(false);
          setApprovalPhase1Complete(false);
          return;
        }
        setApprovalExists(true);
        const data = await r.json().catch(() => ({}));
        const stages = Array.isArray(data?.approval?.stages) ? data.approval.stages : [];
        const blocking = stages.filter((s: any) => s?.blocking);
        const phase1Complete =
          blocking.length > 0 &&
          blocking.every((s: any) => s?.status === "approved" || s?.status === "skipped");
        setApprovalPhase1Complete(phase1Complete);
        if (Array.isArray(data?.approval?.budget_items)) {
          setExistingBudgetItems(data.approval.budget_items);
        }
      })
      .catch(() => {
        setApprovalExists(false);
        setApprovalPhase1Complete(false);
      });
  }, [finalIsEditMode, festIdFromPath, session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const derivedStatus = deriveFestStatusFromDates(
      formData.openingDate,
      formData.closingDate
    );

    setFormData((prev) =>
      prev.status === derivedStatus ? prev : { ...prev, status: derivedStatus }
    );
  }, [formData.openingDate, formData.closingDate]);

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

  const deleteFest = async () => {
    if (
      !festIdFromPath ||
      !window.confirm(
        "Are you sure you want to delete this fest? This action cannot be undone."
      )
    ) {
      return;
    }
    setIsNavigating(true);
    setErrors({});
    try {
      const response = await fetch(
        `/api/fests/${festIdFromPath}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      const responseBody = await readApiBodySafely(response);

      if (!response.ok) {
        throw new Error(
          extractApiErrorMessage(response, responseBody, "Failed to delete fest")
        );
      }
      router.replace("/manage");
    } catch (error: any) {
      setErrors({ submit: error.message || "Failed to delete fest." });
      setIsNavigating(false);
    }
  };

  const validateField = useCallback(
    (
      name: string,
      value: string | string[]
    ) => {
      const newErrors: Record<string, string | undefined> = { ...errors };
      const currentDate = new Date(currentDateRef.current);

      switch (name) {
          case "title":
            if (!(value as string).trim())
              newErrors.title = "Fest title is required";
            else if ((value as string).length > 100)
              newErrors.title = "Max 100 characters";
            else delete newErrors.title;
            break;
          case "openingDate":
          case "closingDate":
            const dateType = name === "openingDate" ? "Opening" : "Closing";
            if (!(value as string).trim())
              newErrors[name] = `${dateType} date is required`;
            else if (!/^\d{4}-\d{2}-\d{2}$/.test(value as string))
              newErrors[name] = "Format YYYY-MM-DD";
            else {
              const inputDate = parseYYYYMMDD(value as string);
              if (!inputDate) newErrors[name] = "Invalid date value";
              else if (
                inputDate < currentDate &&
                !isEditMode && // Use prop isEditMode here
                name === "openingDate"
              )
                newErrors[name] = `${dateType} must be on or after today`;
              else if (
                name === "closingDate" &&
                formData.openingDate &&
                parseYYYYMMDD(formData.openingDate)
              ) {
                if (inputDate < parseYYYYMMDD(formData.openingDate)!) {
                  newErrors[name] = "Must be on/after opening date";
                }
              }
            }

            if (
              name === "openingDate" &&
              formData.closingDate &&
              parseYYYYMMDD(String(value)) &&
              parseYYYYMMDD(formData.closingDate) &&
              parseYYYYMMDD(String(value))! > parseYYYYMMDD(formData.closingDate)!
            ) {
              newErrors.closingDate =
                "Closing date must be on/after opening date";
            } else if (
              name === "closingDate" &&
              formData.openingDate &&
              parseYYYYMMDD(String(value)) &&
              parseYYYYMMDD(formData.openingDate) &&
              parseYYYYMMDD(String(value))! <
                parseYYYYMMDD(formData.openingDate)!
            ) {
              newErrors.closingDate =
                "Closing date must be on/after opening date";
            } else if (
              name === "openingDate" &&
              newErrors.closingDate ===
                "Closing date must be on/after opening date" &&
              parseYYYYMMDD(String(value)) &&
              parseYYYYMMDD(formData.closingDate) &&
              parseYYYYMMDD(String(value))! <=
                parseYYYYMMDD(formData.closingDate)!
            ) {
              delete newErrors.closingDate;
            }
            break;
          case "minParticipants": {
            if (!formData.isTeamEvent) {
              delete newErrors.minParticipants;
              break;
            }

            const minRaw = String(value || "").trim();
            if (!minRaw) {
              newErrors.minParticipants = "Min is required";
              break;
            }
            if (!/^\d+$/.test(minRaw)) {
              newErrors.minParticipants = "Enter a number";
              break;
            }

            const minValue = Number(minRaw);
            if (minValue < 2) {
              newErrors.minParticipants = "Min 2 for teams";
              break;
            }

            const maxRaw = String(formData.maxParticipants || "").trim();
            if (maxRaw && /^\d+$/.test(maxRaw) && minValue > Number(maxRaw)) {
              newErrors.minParticipants = "Min ≤ Max";
              break;
            }

            delete newErrors.minParticipants;
            break;
          }
          case "maxParticipants": {
            if (!formData.isTeamEvent) {
              delete newErrors.maxParticipants;
              break;
            }

            const maxRaw = String(value || "").trim();
            if (!maxRaw) {
              newErrors.maxParticipants = "Max is required";
              break;
            }
            if (!/^\d+$/.test(maxRaw)) {
              newErrors.maxParticipants = "Enter a number";
              break;
            }

            const maxValue = Number(maxRaw);
            if (maxValue < 2) {
              newErrors.maxParticipants = "Max 2 for teams";
              break;
            }

            const minRaw = String(formData.minParticipants || "").trim();
            if (minRaw && /^\d+$/.test(minRaw) && maxValue < Number(minRaw)) {
              newErrors.maxParticipants = "Max ≥ Min";
              break;
            }

            delete newErrors.maxParticipants;
            break;
          }
          case "detailedDescription":
            if (!(value as string).trim())
              newErrors.detailedDescription = "Description is required";
            else if ((value as string).length > 1000)
              newErrors.detailedDescription = "Max 1000 characters";
            else delete newErrors.detailedDescription;
            break;
          case "department":
            if ((value as string[]).length === 0)
              newErrors.department = "Select at least one department";
            else delete newErrors.department;
            break;
          case "category":
            if (!(value as string).trim())
              newErrors.category = "Category is required";
            else delete newErrors.category;
            break;
          case "contactEmail":
            if (!normalizeEmail(value))
              newErrors.contactEmail = "Contact email is required";
            else if (!isValidEmail(value))
              newErrors.contactEmail = "Invalid email format";
            else if (normalizeEmail(value).length > MAX_EMAIL_LENGTH)
              newErrors.contactEmail = "Max 100 chars.";
            else delete newErrors.contactEmail;
            break;
          case "contactPhone":
            if (!normalizePhone(value))
              newErrors.contactPhone = "Contact phone is required";
            else if (!PHONE_REGEX.test(normalizePhone(value)))
              newErrors.contactPhone = "Must be 10-14 digits";
            else delete newErrors.contactPhone;
            break;
          case "organizingSchool":
            if (!(value as string).trim()) {
              newErrors.organizingSchool = "Organizing school is required";
            } else {
              delete newErrors.organizingSchool;
            }
            break;
          case "organizingDept":
            if (!(value as string).trim())
              newErrors.organizingDept = "Organizing department is required";
            else if ((value as string).length > 100)
              newErrors.organizingDept = "Max 100 characters";
            else if (
              formData.organizingSchool &&
              formData.organizingSchool !== CLUBS_AND_CENTRES_SCHOOL
            ) {
              const allowedLabels = new Set(
                getDepartmentOptionsForSchool(formData.organizingSchool).map(
                  (option) => option.label
                )
              );
              if (!allowedLabels.has(String(value).trim())) {
                newErrors.organizingDept = "Select a department from the selected school";
              } else {
                delete newErrors.organizingDept;
              }
            }
            else delete newErrors.organizingDept;
            break;
          case "campusHostedAt":
            if (!(value as string).trim())
              newErrors.campusHostedAt = "Hosted campus is required";
            else delete newErrors.campusHostedAt;
            break;
          case "allowedCampuses":
            if (!Array.isArray(value) || value.length === 0)
              newErrors.allowedCampuses = "Select at least one campus";
            else delete newErrors.allowedCampuses;
            break;
        }
      setErrors(newErrors);
    },
    [
      errors,
      formData.openingDate,
      formData.closingDate,
      formData.isTeamEvent,
      formData.minParticipants,
      formData.maxParticipants,
      formData.organizingSchool,
      isEditMode,
    ] // Use prop isEditMode here
  );

  const getValidationErrors = useCallback(
    (options?: { validateImage?: boolean }) => {
      const shouldValidateImage = options?.validateImage ?? true;
      const currentValidationErrors: Record<string, string | undefined> = {};
      const fieldsToValidate: (keyof CreateFestState)[] = [
        "title",
        "openingDate",
        "closingDate",
        "minParticipants",
        "maxParticipants",
        "detailedDescription",
        "department",
        "category",
        "contactEmail",
        "contactPhone",
        "organizingSchool",
        "organizingDept",
        "campusHostedAt",
        "allowedCampuses",
      ];

      const validateSync = (name: string, value: any) => {
        const currentDate = new Date(currentDateRef.current);
        let errorMsg: string | undefined = undefined;

        switch (name) {
          case "title":
            if (!String(value).trim()) errorMsg = "Fest title is required";
            else if (String(value).length > 100) errorMsg = "Max 100 characters";
            break;
          case "openingDate":
          case "closingDate": {
            const dateType = name === "openingDate" ? "Opening" : "Closing";
            if (!String(value).trim()) errorMsg = `${dateType} date is required`;
            else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
              errorMsg = "Format YYYY-MM-DD";
            } else {
              const inputDate = parseYYYYMMDD(String(value));
              if (!inputDate) errorMsg = "Invalid date value";
              else if (
                inputDate < currentDate &&
                !isEditMode &&
                name === "openingDate"
              ) {
                errorMsg = `${dateType} must be on or after today`;
              } else if (
                name === "closingDate" &&
                formData.openingDate &&
                parseYYYYMMDD(formData.openingDate)
              ) {
                if (inputDate < parseYYYYMMDD(formData.openingDate)!) {
                  errorMsg = "Must be on/after opening date";
                }
              }
            }

            if (
              name === "openingDate" &&
              formData.closingDate &&
              parseYYYYMMDD(String(value)) &&
              parseYYYYMMDD(formData.closingDate) &&
              parseYYYYMMDD(String(value))! > parseYYYYMMDD(formData.closingDate)!
            ) {
              if (!currentValidationErrors.closingDate) {
                currentValidationErrors.closingDate =
                  "Closing date must be on/after opening date";
              }
            }
            break;
          }
          case "minParticipants": {
            if (!formData.isTeamEvent) break;
            const minRaw = String(value || "").trim();
            if (!minRaw) {
              errorMsg = "Min is required";
              break;
            }
            if (!/^\d+$/.test(minRaw)) {
              errorMsg = "Enter a number";
              break;
            }
            const minValue = Number(minRaw);
            if (minValue < 2) {
              errorMsg = "Min 2 for teams";
              break;
            }
            const maxRaw = String(formData.maxParticipants || "").trim();
            if (maxRaw && /^\d+$/.test(maxRaw) && minValue > Number(maxRaw)) {
              errorMsg = "Min ≤ Max";
            }
            break;
          }
          case "maxParticipants": {
            if (!formData.isTeamEvent) break;
            const maxRaw = String(value || "").trim();
            if (!maxRaw) {
              errorMsg = "Max is required";
              break;
            }
            if (!/^\d+$/.test(maxRaw)) {
              errorMsg = "Enter a number";
              break;
            }
            const maxValue = Number(maxRaw);
            if (maxValue < 2) {
              errorMsg = "Max 2 for teams";
              break;
            }
            const minRaw = String(formData.minParticipants || "").trim();
            if (minRaw && /^\d+$/.test(minRaw) && maxValue < Number(minRaw)) {
              errorMsg = "Max ≥ Min";
            }
            break;
          }
          case "detailedDescription":
            if (!String(value).trim()) errorMsg = "Description is required";
            else if (String(value).length > 1000) errorMsg = "Max 1000 characters";
            break;
          case "department":
            if (!Array.isArray(value) || value.length === 0) {
              errorMsg = "Select at least one department";
            }
            break;
          case "category":
            if (!String(value).trim()) errorMsg = "Category is required";
            break;
          case "contactEmail":
            if (!normalizeEmail(value)) errorMsg = "Contact email is required";
            else if (!isValidEmail(value)) errorMsg = "Invalid email format";
            else if (normalizeEmail(value).length > MAX_EMAIL_LENGTH)
              errorMsg = "Max 100 chars.";
            break;
          case "contactPhone":
            if (!normalizePhone(value)) errorMsg = "Contact phone is required";
            else if (!PHONE_REGEX.test(normalizePhone(value)))
              errorMsg = "Must be 10-14 digits";
            break;
          case "organizingSchool":
            if (!String(value).trim()) {
              errorMsg = "Organizing school is required";
            }
            break;
          case "organizingDept":
            if (!String(value).trim()) errorMsg = "Organizing department is required";
            else if (String(value).length > 100) errorMsg = "Max 100 characters";
            else if (
              formData.organizingSchool &&
              formData.organizingSchool !== CLUBS_AND_CENTRES_SCHOOL
            ) {
              const allowedLabels = new Set(
                getDepartmentOptionsForSchool(formData.organizingSchool).map(
                  (option) => option.label
                )
              );
              if (!allowedLabels.has(String(value).trim())) {
                errorMsg = "Select a department from the selected school";
              }
            }
            break;
          case "campusHostedAt":
            if (!String(value).trim()) errorMsg = "Hosted campus is required";
            break;
          case "allowedCampuses":
            if (!Array.isArray(value) || value.length === 0) {
              errorMsg = "Select at least one campus";
            }
            break;
        }

        if (errorMsg) currentValidationErrors[name] = errorMsg;
      };

      fieldsToValidate.forEach((field) => validateSync(field, formData[field]));

      if (shouldValidateImage) {
        if (!imageFile && !isEditMode && !existingImageFileUrl) {
          currentValidationErrors.imageFile = "Fest image is required";
        } else if (imageFile) {
          if (imageFile.size > 3 * 1024 * 1024) {
            currentValidationErrors.imageFile = "Image file must be less than 3MB";
          } else if (!ALLOWED_FEST_IMAGE_TYPES.includes(imageFile.type)) {
            currentValidationErrors.imageFile =
              "Invalid file type. JPG/PNG/WEBP/GIF only.";
          }
        }
      }

      return currentValidationErrors;
    },
    [formData, imageFile, isEditMode, existingImageFileUrl]
  );

  const scrollToFirstFestError = useCallback(
    (validationErrors: Record<string, string | undefined>) => {
      const keysWithErrors = Object.keys(validationErrors).filter(
        (key) => Boolean(validationErrors[key])
      );
      if (!keysWithErrors.length) return;

      const priorityOrder = [
        "title",
        "openingDate",
        "closingDate",
        "detailedDescription",
        "campusHostedAt",
        "allowedCampuses",
        "organizingSchool",
        "organizingDept",
        "department",
        "category",
        "imageFile",
        "contactEmail",
        "contactPhone",
      ];

      const firstKey =
        priorityOrder.find((key) => keysWithErrors.includes(key)) ||
        keysWithErrors[0];

      let selector = `#${firstKey}`;
      if (firstKey === "openingDate") selector = "#openingDate-trigger";
      if (firstKey === "closingDate") selector = "#closingDate-trigger";
      if (firstKey === "department") selector = "#department-trigger";
      if (firstKey === "category") selector = "#category-trigger";
      if (firstKey === "allowedCampuses") selector = "#allowedCampuses-group";
      if (firstKey === "organizingSchool") selector = "#organizingSchool";
      if (firstKey === "imageFile") selector = "#image-upload-input";

      const targetElement = document.querySelector<HTMLElement>(selector);
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

  const submitFest = async (saveAsDraft: boolean, quiet = false): Promise<string | null> => {
    setErrors((prev) => ({ ...prev, submit: undefined }));
    const currentValidationErrors = getValidationErrors({ validateImage: true });

    if (
      Object.keys(currentValidationErrors).some(
        (key) => currentValidationErrors[key] !== undefined
      )
    ) {
      setErrors({
        ...currentValidationErrors,
        submit: "Please correct the errors in the form.",
      });
      requestAnimationFrame(() => {
        scrollToFirstFestError(currentValidationErrors);
      });
      return null;
    }

    if (!quiet) {
      setIsSubmitting(true);
      setWasDraftOnSubmit(Boolean(!saveAsDraft && finalIsEditMode && isDraftFest));
    }
    let uploadedFestImageUrl: string | null = null;

    if (imageFile) {
      if (!quiet) setIsUploadingImage(true);
      try {
        const uploadFormData = new FormData();
        uploadFormData.append("file", imageFile);

        // Use the server's file upload API instead of Supabase storage
        const uploadResponse = await fetch(`${API_URL}/api/upload/fest-image`, {
          method: 'POST',
          body: uploadFormData,
          headers: {
            // No Content-Type header as it's set automatically for FormData
            'Authorization': `Bearer ${session?.access_token}`
          },
        });

        const uploadData = await readApiBodySafely(uploadResponse);

        if (!uploadResponse.ok) {
          throw new Error(
            extractApiErrorMessage(
              uploadResponse,
              uploadData,
              "Failed to upload image to server"
            )
          );
        }

        if (!uploadData || !uploadData.url) {
          throw new Error("Upload succeeded but no URL returned. Please contact support.");
        }

        // Use the URL returned from our server API
        uploadedFestImageUrl = uploadData.url;
        console.log(`✅ Fest image uploaded successfully: ${uploadedFestImageUrl}`);
      } catch (uploadError: any) {
        const errorMessage = uploadError.message || 'Unknown upload error';
        setErrors((prev) => ({
          ...prev,
          submit: `Image upload failed: ${errorMessage}`,
        }));
        if (!quiet) {
          setIsSubmitting(false);
          setIsUploadingImage(false);
        }
        return null;
      }
      if (!quiet) setIsUploadingImage(false);
    } else if (!imageFile && !isEditMode && !existingImageFileUrl) {
      setErrors((prev) => ({
        ...prev,
        submit: "Fest image is required for new fests.",
      }));
      if (!quiet) setIsSubmitting(false);
      return null;
    }

    try {
      if (!session) throw new Error("You must be logged in.");

      const normalizedTeamMin = formData.isTeamEvent
        ? Math.max(2, Number(formData.minParticipants || "2"))
        : 1;
      const normalizedTeamMax = formData.isTeamEvent
        ? Math.max(
            normalizedTeamMin,
            Math.max(2, Number(formData.maxParticipants || "2"))
          )
        : 1;

      const customFieldsWithTeamSettings = upsertTeamSettingsInCustomFields(
        formData.customFields,
        {
          isTeamEvent: formData.isTeamEvent,
          minParticipants: String(normalizedTeamMin),
          maxParticipants: String(normalizedTeamMax),
        }
      );

      // Determine the final image URL:
      // - If a new file was uploaded, use the new URL
      // - If in edit mode with no new file, keep the existing URL
      // - Otherwise null (new fest with no image - already caught above)
      const finalImageUrl = uploadedFestImageUrl ?? (isEditMode ? existingImageFileUrl : null);
      const isPublishingDraft = !saveAsDraft && finalIsEditMode && isDraftFest;
      const normalizedContactEmail = normalizeEmail(formData.contactEmail);
      const normalizedContactPhone = normalizePhone(formData.contactPhone);
      const sanitizedSubHeads = formData.subHeads
        .map((sh) => ({
          email: normalizeEmail(sh.email),
          expiresAt: sh.expiresAt || null,
        }))
        .filter((sh) => sh.email !== "");

      console.log(`[Fest Submit] isEditMode=${isEditMode}, uploadedFestImageUrl=${uploadedFestImageUrl}, existingImageFileUrl=${existingImageFileUrl}, finalImageUrl=${finalImageUrl}`);

      const payload: any = {
        festTitle: formData.title,
        openingDate: formData.openingDate,
        closingDate: formData.closingDate,
        participants_per_team: normalizedTeamMax,
        min_participants: normalizedTeamMin,
        detailedDescription: formData.detailedDescription,
        departmentAccess:
          formData.allowedDepartments.length > 0
            ? formData.allowedDepartments
            : formData.department,
        category: formData.category,
        contactEmail: normalizedContactEmail,
        contactPhone: normalizedContactPhone,
        subHeads: sanitizedSubHeads,
        organizingSchool: formData.organizingSchool,
        organizingDept: formData.organizingDept,
        createdBy: session.user.email,
        venue: formData.venue,
        status: deriveFestStatusFromDates(
          formData.openingDate,
          formData.closingDate
        ),
        registration_deadline: null,
        timeline: formData.timeline,
        sponsors: formData.sponsors,
        social_links: formData.social_links,
        faqs: formData.faqs,
        campus_hosted_at: formData.campusHostedAt || null,
        allowed_campuses: formData.allowedCampuses || [],
        department_hosted_at: formData.departmentHostedAt || null,
        allow_outsiders: formData.allowOutsiders,
        custom_fields: customFieldsWithTeamSettings,
        // Always include festImageUrl so backend always updates the DB column
        festImageUrl: finalImageUrl,
        is_draft: saveAsDraft,
        ...(isPublishingDraft ? { send_notifications: true } : {}),
      };

      let response;
      if (finalIsEditMode && festIdFromPath) {
        response = await fetch(
          `/api/fests/${festIdFromPath}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(payload),
          }
        );
      } else {
        response = await fetch(`/api/fests`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const responseData = await readApiBodySafely(response);

      if (!response.ok) {
        throw new Error(
          extractApiErrorMessage(
            response,
            responseData,
            `Failed to ${isEditMode ? "update" : "create"} fest.` // Use prop isEditMode here
          )
        );
      }

      // Handle response - check if fest_id changed
      if (responseData?.fest) {
        setIsDraftFest(
          responseData.fest.is_draft === true ||
            responseData.fest.is_draft === 1 ||
            responseData.fest.is_draft === "1" ||
            responseData.fest.is_draft === "true"
        );
      }
      
      // If the fest_id changed (title was updated), show success message and redirect to new URL
      if (finalIsEditMode && responseData.id_changed && responseData.fest_id) {
        const oldId = festIdFromPath;
        const newId = responseData.fest_id;
        console.log(`Fest ID changed from '${oldId}' to '${newId}', redirecting...`);
        const successLabel = saveAsDraft
          ? "saved as draft"
          : isPublishingDraft
            ? "published"
            : "updated";

        toast.success(
          `Fest ${successLabel} successfully! The fest link has changed from /fest/${oldId} to /fest/${newId}`,
          { duration: 5000 }
        );

        router.replace(`/edit/fest/${newId}`);
        return responseData.fest_id as string;
      } else if (finalIsEditMode) {
        // Show regular success message for edit
        toast.success(
          saveAsDraft
            ? "Fest draft saved successfully!"
            : isPublishingDraft
              ? "Fest published successfully!"
              : "Fest updated successfully!",
          { duration: 3000 }
        );
      }

      const resultFestId: string | null =
        responseData?.fest?.fest_id ||
        responseData?.fest_id ||
        festIdFromPath ||
        null;

      // Defer modal until overlay animation finishes (only for normal publish/edit flow)
      if (!quiet && (!saveAsDraft || finalIsEditMode)) {
        setSuccessAction(saveAsDraft ? "draft" : "publish");
        setPendingFestSuccess(true);
      }

      return resultFestId;
    } catch (error: any) {
      setErrors((prev) => ({
        ...prev,
        submit: error?.message || "Something went wrong while saving the fest.",
      }));
      return null;
    } finally {
      if (!quiet) {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitFest(false);
  };

  const handleGoAheadForApprovals = () => {
    const currentValidationErrors = getValidationErrors({ validateImage: true });
    if (Object.keys(currentValidationErrors).some((k) => currentValidationErrors[k] !== undefined)) {
      setErrors({ ...currentValidationErrors, submit: "Please correct the errors in the form." });
      requestAnimationFrame(() => scrollToFirstFestError(currentValidationErrors));
      return;
    }
    setErrors((prev) => ({ ...prev, submit: undefined }));
    setActiveView('approvals');
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  const handleSubmitForApproval = async (customStages: WorkflowStage[], budgetItems: BudgetItem[]) => {
    if (!session?.access_token) return;
    setIsSubmittingApproval(true);
    try {
      let festId = savedFestId || festIdFromPath;
      if (!festId) {
        festId = await submitFest(true, true);
        if (!festId) return;
        setSavedFestId(festId);
      }
      const res = await fetch(`${API_URL}/api/approvals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ itemId: festId, type: 'fest', customStages, budgetItems }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to submit for approval');
      toast.success('Submitted for approval.', { duration: 3000 });
      router.push(`/approvals/${festId}?type=fest`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit for approval');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleUpdateWorkflow = async (customStages: WorkflowStage[], budgetItems: BudgetItem[]) => {
    const festId = savedFestId || festIdFromPath;
    if (!festId || !session?.access_token) return;
    setIsSubmittingApproval(true);
    try {
      const res = await fetch(`${API_URL}/api/approvals/${festId}/workflow?type=fest`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ customStages, budgetItems }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update workflow');
      toast.success('Workflow updated.', { duration: 3000 });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update workflow');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleSaveDraft = async () => {
    await submitFest(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      if (file.size > 3 * 1024 * 1024)
        setErrors((prev) => ({ ...prev, imageFile: "Max 3MB" }));
      else if (!ALLOWED_FEST_IMAGE_TYPES.includes(file.type))
        setErrors((prev) => ({ ...prev, imageFile: "JPG/PNG/WEBP/GIF only" }));
      else
        setErrors((prev) => {
          const newE = { ...prev };
          delete newE.imageFile;
          return newE;
        });
    } else {
      setImageFile(null);
      if (!isEditMode || (isEditMode && !existingImageFileUrl)) {
        setErrors((prev) => ({
          ...prev,
          imageFile: "Fest image is required",
        }));
      } else {
        setErrors((prev) => {
          const newE = { ...prev };
          delete newE.imageFile;
          return newE;
        });
      }
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleTeamEventToggle = (enabled: boolean) => {
    setFormData((prev) => {
      if (!enabled) {
        return {
          ...prev,
          isTeamEvent: false,
          minParticipants: "1",
          maxParticipants: "1",
        };
      }

      const nextMin = Math.max(2, Number(prev.minParticipants || "2"));
      const nextMax = Math.max(nextMin, Math.max(2, Number(prev.maxParticipants || "2")));

      return {
        ...prev,
        isTeamEvent: true,
        minParticipants: String(nextMin),
        maxParticipants: String(nextMax),
      };
    });

    if (!enabled) {
      setErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors.minParticipants;
        delete nextErrors.maxParticipants;
        return nextErrors;
      });
    }
  };

  const handleTeamParticipantChange = (
    field: "minParticipants" | "maxParticipants",
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTeamParticipantBlur = (
    field: "minParticipants" | "maxParticipants"
  ) => {
    validateField(field, formData[field]);
  };

  const handleInputBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;

    if (id === "contactEmail") {
      const normalized = normalizeEmail(value);
      setFormData((prev) => ({ ...prev, contactEmail: normalized }));
      validateField(id, normalized);
      return;
    }

    if (id === "contactPhone") {
      const normalized = normalizePhone(value);
      setFormData((prev) => ({ ...prev, contactPhone: normalized }));
      validateField(id, normalized);
      return;
    }

    validateField(id, value);
  };
  const handleDateChange = (
    name: "openingDate" | "closingDate",
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    validateField(name, value);
  };
  const handleDateBlur = (name: "openingDate" | "closingDate") =>
    validateField(name, formData[name]);
  const handleSubHeadChange = (index: number, value: string) => {
    const updated = [...formData.subHeads];
    updated[index] = { ...updated[index], email: value };
    setFormData((prev) => ({ ...prev, subHeads: updated }));
  };
  const handleSubHeadExpirationChange = (index: number, value: string | null) => {
    const updated = [...formData.subHeads];
    updated[index] = { ...updated[index], expiresAt: value };
    setFormData((prev) => ({ ...prev, subHeads: updated }));
    setErrors((prev) => {
      const next = { ...prev };
      const hasEmail = normalizeEmail(updated[index].email) !== "";
      if (hasEmail && !value) {
        next[`subHeadExpiry_${index}`] = "Expiry date and time is required.";
      } else {
        delete next[`subHeadExpiry_${index}`];
      }
      return next;
    });
  };
  const handleSubHeadBlur = (index: number) => {
    const normalized = normalizeEmail(formData.subHeads[index].email);
    setFormData((prev) => {
      const updated = [...prev.subHeads];
      updated[index] = { ...updated[index], email: normalized };
      return { ...prev, subHeads: updated };
    });
  };
  const addSubHead = () => {
    if (formData.subHeads.length < 5)
      setFormData((prev) => ({
        ...prev,
        subHeads: [...prev.subHeads, { email: "", expiresAt: null }],
      }));
  };
  const removeSubHead = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      subHeads: prev.subHeads.filter((_, i) => i !== index),
    }));
    setErrors((prev) => {
      const nextErrors: Record<string, string | undefined> = {};
      Object.entries(prev).forEach(([key, message]) => {
        if (!message) return;
        const emailMatch = key.match(/^subHead_(\d+)$/);
        if (emailMatch) {
          const ci = Number(emailMatch[1]);
          if (ci === index) return;
          nextErrors[ci > index ? `subHead_${ci - 1}` : key] = message;
          return;
        }
        const expiryMatch = key.match(/^subHeadExpiry_(\d+)$/);
        if (expiryMatch) {
          const ci = Number(expiryMatch[1]);
          if (ci === index) return;
          nextErrors[ci > index ? `subHeadExpiry_${ci - 1}` : key] = message;
          return;
        }
        nextErrors[key] = message;
      });
      return nextErrors;
    });
  };

  const minOpeningDate = new Date(currentDateRef.current);
  minOpeningDate.setHours(0, 0, 0, 0);
  const minClosingDate =
    formData.openingDate && parseYYYYMMDD(formData.openingDate)
      ? new Date(parseYYYYMMDD(formData.openingDate)!)
      : new Date(minOpeningDate);

  if (minClosingDate < currentDateRef.current && !isEditMode)
    minClosingDate.setDate(currentDateRef.current.getDate());
  minClosingDate.setHours(0, 0, 0, 0);

  const showMainLoader = (isLoadingFestData && finalIsEditMode) || isNavigating;
  const mainLoaderText = isLoadingFestData
    ? "Loading fest details..."
    : isNavigating
    ? "Deleting fest..."
    : "";

  return (
    <div className="min-h-screen bg-white relative">
      <PublishingOverlay
        isVisible={isSubmitting || isNavigating || isUploadingImage}
        mode={isNavigating ? "deleting" : isUploadingImage ? "uploading" : finalIsEditMode ? "updating" : "publishing"}
        onComplete={() => {
          if (pendingFestSuccess) {
            setIsModalOpen(true);
            setTimeout(() => setFestModalVisible(true), 30);
            setPendingFestSuccess(false);
          }
        }}
      />
      {isModalOpen && (
        <div
          className={`fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center px-4 transition-opacity duration-500 ease-out ${
            festModalVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className={`bg-white rounded-xl p-6 sm:p-8 max-w-lg w-full shadow-2xl transform transition-all duration-500 ease-out ${
              festModalVisible
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-90 translate-y-5"
            }`}
            role="alertdialog"
            aria-labelledby="modal-title"
            aria-describedby="modal-description"
          >
            <div className="flex flex-col items-center text-center">
              <div className="mb-5">
                <svg
                  className="w-16 h-16 text-green-500 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>
              <h2
                id="modal-title"
                className="text-2xl sm:text-3xl font-semibold text-[#063168] mb-3"
              >
                {successAction === "draft"
                  ? "Draft Saved!"
                  : `Fest ${finalIsEditMode ? (wasDraftOnSubmit ? "Published" : "Updated") : "Published"}!`}
              </h2>
              <p
                id="modal-description"
                className="text-gray-500 mb-8 text-sm sm:text-base px-4"
              >
                {successAction === "draft"
                  ? "Your fest has been saved as a draft. It is hidden until you publish it."
                  : (
                    <>
                      Your fest has been successfully{" "}
                      {finalIsEditMode ? (wasDraftOnSubmit ? "published" : "updated") : "published"}.<br />
                      What would you like to do next?
                    </>
                  )}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row-reverse sm:justify-center gap-3">
              {!finalIsEditMode && successAction !== "draft" && (
                <Link
                  href={`/create/event`}
                  className="w-full sm:w-auto px-6 py-3 bg-[#FFCC00] text-[#063168] rounded-lg font-medium hover:bg-opacity-90 transition-all duration-150 ease-in-out text-center text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:ring-offset-2 flex items-center justify-center"
                  onClick={(e) => {
                    e.preventDefault();
                    setFestModalVisible(false);
                    setTimeout(() => {
                      setIsModalOpen(false);
                      router.replace("/create/event");
                    }, 300);
                  }}
                >
                  Add an event to fest
                </Link>
              )}
              <Link
                href="/manage"
                className="w-full sm:w-auto px-6 py-3 bg-transparent text-[#154CB3] rounded-lg font-medium hover:bg-blue-50 transition-all duration-150 ease-in-out text-center text-sm sm:text-base border-2 border-[#154CB3] focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2"
                onClick={(e) => {
                  e.preventDefault();
                  setFestModalVisible(false);
                  setTimeout(() => {
                    setIsModalOpen(false);
                    router.replace("/manage");
                  }, 300);
                }}
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}

      {showMainLoader ? (
        <FullPageSpinner text={mainLoaderText} />
      ) : (
        <>
          <div className="bg-[#063168] text-white p-4 sm:p-6 md:p-12">
            <div className="max-w-6xl mx-auto">
              <Link
                href="/manage"
                className="flex items-center text-[#FFCC00] mb-4 sm:mb-6 hover:underline"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5 mr-2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                  />
                </svg>
                Back to dashboard
              </Link>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                {finalIsEditMode ? "Edit fest" : "Create fest"}
              </h1>
              <p className="text-base sm:text-lg text-gray-200 mt-2">
                Fill in the details to{" "}
                {finalIsEditMode ? "edit your" : "create a new"} fest.
              </p>
            </div>
          </div>
          <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-12">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible">
              {/* Tab header */}
              <div className="flex border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveView('details')}
                  className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors focus:outline-none ${
                    activeView === 'details'
                      ? 'text-[#154CB3] border-b-2 border-[#154CB3] bg-blue-50/40'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Fest Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('approvals')}
                  className={`flex-1 py-4 px-6 text-sm font-semibold transition-colors focus:outline-none ${
                    activeView === 'approvals'
                      ? 'text-[#154CB3] border-b-2 border-[#154CB3] bg-blue-50/40'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Approvals
                </button>
              </div>

              {activeView === 'approvals' ? (
                <ApprovalsSetupView
                  organizingSchool={formData.organizingSchool}
                  organizingDept={formData.organizingDept}
                  festId={savedFestId || festIdFromPath || null}
                  approvalExists={approvalExists}
                  isSubmitting={isSubmittingApproval}
                  initialBudgetItems={existingBudgetItems}
                  onSubmitForApproval={handleSubmitForApproval}
                  onUpdateWorkflow={handleUpdateWorkflow}
                  onBackToDetails={() => setActiveView('details')}
                  session={session}
                />
              ) : (
              <div className="p-6 sm:p-8 md:p-10">
              <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-6 sm:mb-8">
                Fest details
              </h2>
              <form
                onSubmit={handleSubmit}
                className="space-y-6 sm:space-y-8"
                noValidate
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <div>
                    <label
                      htmlFor="title"
                      className="block mb-2 text-sm font-medium text-gray-700"
                    >
                      Fest title: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="title"
                      placeholder="Enter fest title"
                      value={formData.title}
                      onChange={handleInputChange}
                      onBlur={handleInputBlur}
                      required
                      aria-describedby={
                        errors.title ? "title-error" : undefined
                      }
                      className={`w-full px-4 py-3 sm:py-3.5 rounded-lg border ${
                        errors.title ? "border-red-500" : "border-gray-300"
                      } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all text-sm sm:text-base`}
                    />
                    {errors.title && (
                      <p id="title-error" className="text-red-500 text-xs mt-1">
                        {errors.title}
                      </p>
                    )}
                    {finalIsEditMode && (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800">
                          <span className="font-semibold">⚠️ Note:</span> Changing the title will also update your fest&apos;s URL/link.
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          Example: &quot;My Fest&quot; → <code className="bg-amber-100 px-1 rounded">/fest/my-fest</code>
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <CustomDateInput
                      id="openingDate"
                      label="Opening date:"
                      value={formData.openingDate}
                      onChange={(v) => handleDateChange("openingDate", v)}
                      error={errors.openingDate}
                      minDate={finalIsEditMode ? undefined : minOpeningDate}
                      placeholder="YYYY-MM-DD"
                      required
                    />
                    <CustomDateInput
                      id="closingDate"
                      label="Closing date:"
                      value={formData.closingDate}
                      onChange={(v) => handleDateChange("closingDate", v)}
                      error={errors.closingDate}
                      minDate={
                        finalIsEditMode
                          ? formData.openingDate
                            ? parseYYYYMMDD(formData.openingDate) ?? undefined
                            : undefined
                          : minClosingDate
                      }
                      placeholder="YYYY-MM-DD"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="detailedDescription"
                    className="block mb-2 text-sm font-medium text-gray-700"
                  >
                    Detailed description:{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="detailedDescription"
                    rows={5}
                    placeholder="Provide a detailed description of the fest"
                    value={formData.detailedDescription}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    required
                    aria-describedby={
                      errors.detailedDescription
                        ? "description-error"
                        : undefined
                    }
                    className={`w-full px-4 py-3 sm:py-3.5 rounded-lg border ${
                      errors.detailedDescription
                        ? "border-red-500"
                        : "border-gray-300"
                    } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all text-sm sm:text-base`}
                  />
                  {errors.detailedDescription && (
                    <p
                      id="description-error"
                      className="text-red-500 text-xs mt-1"
                    >
                      {errors.detailedDescription}
                    </p>
                  )}
                </div>

                {/* Audience & Access Control Section - Google Style */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 sm:p-7 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-base font-bold text-[#063168] flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zm-2-7a6 6 0 11-12 0 6 6 0 0112 0zM7 9a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      Audience & Access
                    </h3>
                    <p className="text-xs text-gray-600 mt-1 ml-7">Control who can register for your fest</p>
                  </div>

                  <div className="space-y-5">
                    {/* Allow Outsiders Toggle */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 transition-all hover:border-blue-300 hover:shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-semibold text-gray-900 block cursor-pointer">
                            Allow Non-Members to Register
                          </label>
                          <p className="text-xs text-gray-500 mt-1">
                            Permit registration from outside Christ University
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                          <input
                            type="checkbox"
                            checked={formData.allowOutsiders}
                            onChange={(e) => setFormData(prev => ({ ...prev, allowOutsiders: e.target.checked }))}
                            aria-label="Allow outsider registrations"
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#154CB3] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#154CB3]"></div>
                        </label>
                      </div>
                      {formData.allowOutsiders && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <strong>Note:</strong> Events under this fest will not need individual CSO approval — the fest-level approval covers all child events.
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
                            Specify where the fest takes place and who can attend
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
                            Where is the fest Hosted at? <span className="text-red-500">*</span>
                          </label>
                          <select
                            id="campusHostedAt"
                            value={formData.campusHostedAt}
                            onChange={(e) => {
                              const selectedCampus = e.target.value;
                              setFormData(prev => ({ ...prev, campusHostedAt: selectedCampus }));
                              validateField("campusHostedAt", selectedCampus);
                            }}
                            onBlur={(e) => validateField("campusHostedAt", e.target.value)}
                            aria-label="Fest hosted campus"
                            className={`w-full px-3.5 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-0 focus:border-transparent bg-white transition-all ${
                              errors.campusHostedAt ? "border-red-500" : "border-gray-300"
                            }`}
                          >
                            <option value="">Select campus</option>
                            {christCampuses.map((campus) => (
                              <option key={campus} value={campus}>{campus}</option>
                            ))}
                          </select>
                          {errors.campusHostedAt && (
                            <p className="text-red-500 text-xs mt-2">{errors.campusHostedAt}</p>
                          )}
                        </div>

                        {/* Who Can Register */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-2">
                            Who can register? <span className="text-red-500">*</span>
                          </label>
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
                                  checked={formData.allowedCampuses.includes(campus)}
                                  onChange={(e) => {
                                    const current = formData.allowedCampuses;
                                    let updatedCampuses: string[];
                                    if (e.target.checked) {
                                      updatedCampuses = [...current, campus];
                                    } else {
                                      updatedCampuses = current.filter(c => c !== campus);
                                    }
                                    setFormData(prev => ({ ...prev, allowedCampuses: updatedCampuses }));
                                    validateField("allowedCampuses", updatedCampuses);
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-[#154CB3] focus:ring-[#154CB3] cursor-pointer"
                                />
                                <span>{campus}</span>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Select at least one campus that can register for this fest.
                          </p>
                          {errors.allowedCampuses && (
                            <p className="text-red-500 text-xs mt-2">{errors.allowedCampuses}</p>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <div>
                    <label
                      htmlFor="organizingSchool"
                      className="block mb-2 text-sm font-medium text-gray-700"
                    >
                      Organizing school: <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="organizingSchool"
                      value={formData.organizingSchool}
                      onChange={(e) => {
                        const selectedSchool = e.target.value;
                        setFormData((prev) => ({ ...prev, organizingSchool: selectedSchool }));
                        validateField("organizingSchool", selectedSchool);
                      }}
                      onBlur={(e) => validateField("organizingSchool", e.target.value)}
                      className={`w-full px-4 py-3 sm:py-3.5 rounded-lg border ${
                        errors.organizingSchool ? "border-red-500" : "border-gray-300"
                      } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all text-sm sm:text-base bg-white`}
                    >
                      <option value="">Select organizing school</option>
                      {organizingSchools.map((school) => (
                        <option key={school.value} value={school.value}>
                          {school.label}
                        </option>
                      ))}
                    </select>
                    {errors.organizingSchool && (
                      <p className="text-red-500 text-xs mt-1">{errors.organizingSchool}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="organizingDept"
                      className="block mb-2 text-sm font-medium text-gray-700"
                    >
                      Organizing department: <span className="text-red-500">*</span>
                    </label>
                    {formData.organizingSchool === CLUBS_AND_CENTRES_SCHOOL ? (
                      <>
                        <datalist id="organizing-dept-list">
                          {clubsAndCentresDepartmentOptions.map((dept) => (
                            <option key={dept.value} value={dept.label} />
                          ))}
                        </datalist>
                        <input
                          type="text"
                          id="organizingDept"
                          list="organizing-dept-list"
                          placeholder="Type club or centre name"
                          value={formData.organizingDept}
                          onChange={handleInputChange}
                          onBlur={handleInputBlur}
                          required
                          aria-describedby={
                            errors.organizingDept ? "organizingDept-error" : undefined
                          }
                          className={`w-full px-4 py-3 sm:py-3.5 rounded-lg border ${
                            errors.organizingDept
                              ? "border-red-500"
                              : "border-gray-300"
                          } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all text-sm sm:text-base`}
                        />
                      </>
                    ) : (
                      <select
                        id="organizingDept"
                        value={formData.organizingDept}
                        onChange={(e) => {
                          const selectedDepartment = e.target.value;
                          setFormData((prev) => ({ ...prev, organizingDept: selectedDepartment }));
                          validateField("organizingDept", selectedDepartment);
                        }}
                        onBlur={(e) => validateField("organizingDept", e.target.value)}
                        disabled={!formData.organizingSchool}
                        className={`w-full px-4 py-3 sm:py-3.5 rounded-lg border ${
                          errors.organizingDept
                            ? "border-red-500"
                            : "border-gray-300"
                        } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all text-sm sm:text-base bg-white disabled:bg-gray-100 disabled:text-gray-500`}
                      >
                        <option value="">
                          {formData.organizingSchool
                            ? "Select organizing department"
                            : "Select organizing school first"}
                        </option>
                        {departmentOptionsForSelectedSchool.map((dept) => (
                          <option key={dept.value} value={dept.label}>
                            {dept.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {errors.organizingDept && (
                      <p
                        id="organizingDept-error"
                        className="text-red-500 text-xs mt-1"
                      >
                        {errors.organizingDept}
                      </p>
                    )}
                  </div>
                </div>

                <DepartmentAndCategoryInputs
                  formData={formData}
                  availableDepartments={allDepartments}
                  errors={errors}
                  setFormData={setFormData}
                  validateField={validateField}
                />

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Fest image: <span className="text-red-500">*</span> (max
                    3MB, JPG/PNG/WEBP/GIF)
                  </label>
                  <div className="border border-dashed border-gray-400 rounded-xl p-6 sm:p-8 text-center hover:border-gray-500 transition-colors">
                    {/* Display existing file info if in edit mode, an existing image URL is provided, and no new file has been selected yet */}
                    {finalIsEditMode && existingImageFileUrl && !imageFile && (
                      <div className="mb-4 text-center">
                        <p className="text-s text-gray-600 mb-1 break-all p-2 rounded">
                          {(existingImageFileUrl as string).split("/").pop()?.split("?")[0]}
                        </p>
                        <a
                          href={existingImageFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#154CB3] hover:text-blue-800 underline text-sm font-medium mb-3 inline-block"
                        >
                          View current file
                        </a>
                      </div>
                    )}

                    {/* Display selected new file info, OR the upload prompt (SVG + text) */}
                    {imageFile ? (
                      <p className="text-gray-700 font-medium mb-3 text-sm sm:text-base">
                        New file selected: {imageFile.name}
                      </p>
                    ) : (
                      <>
                        <p className="text-gray-500 mb-4 text-sm sm:text-base">
                          {finalIsEditMode && existingImageFileUrl
                            ? ""
                            : "JPEG, PNG, WEBP, GIF (max 3MB)"}
                        </p>
                      </>
                    )}

                    <input
                      type="file"
                      id="image-upload-input"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleFileChange}
                      className="hidden"
                      required={!finalIsEditMode && !existingImageFileUrl}
                      aria-describedby={
                        errors.imageFile ? "imageFile-error" : undefined
                      }
                    />
                    <label
                      htmlFor="image-upload-input"
                      className="bg-[#154CB3] cursor-pointer text-white text-sm py-2 px-4 rounded-full font-medium hover:bg-[#154cb3eb] transition-colors focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2"
                    >
                      {imageFile || (finalIsEditMode && existingImageFileUrl)
                        ? "Change Image"
                        : "Choose File"}
                    </label>
                    {errors.imageFile && (
                      <p
                        id="imageFile-error"
                        className="text-red-500 text-xs mt-2"
                      >
                        {errors.imageFile}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <div>
                    <label
                      htmlFor="contactEmail"
                      className="block mb-2 text-sm font-medium text-gray-700"
                    >
                      Contact email: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="contactEmail"
                      placeholder="Provide contact email address"
                      value={formData.contactEmail}
                      onChange={handleInputChange}
                      onBlur={handleInputBlur}
                      required
                      aria-describedby={
                        errors.contactEmail ? "contactEmail-error" : undefined
                      }
                      className={`w-full px-4 py-3 sm:py-3.5 rounded-lg border ${
                        errors.contactEmail
                          ? "border-red-500"
                          : "border-gray-300"
                      } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all text-sm sm:text-base`}
                    />
                    {errors.contactEmail && (
                      <p
                        id="contactEmail-error"
                        className="text-red-500 text-xs mt-1"
                      >
                        {errors.contactEmail}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="contactPhone"
                      className="block mb-2 text-sm font-medium text-gray-700"
                    >
                      Contact phone: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      id="contactPhone"
                      placeholder="Provide contact number"
                      value={formData.contactPhone}
                      onChange={handleInputChange}
                      onBlur={handleInputBlur}
                      required
                      aria-describedby={
                        errors.contactPhone ? "contactPhone-error" : undefined
                      }
                      className={`w-full px-4 py-3 sm:py-3.5 rounded-lg border ${
                        errors.contactPhone
                          ? "border-red-500"
                          : "border-gray-300"
                      } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all text-sm sm:text-base`}
                    />
                    {errors.contactPhone && (
                      <p
                        id="contactPhone-error"
                        className="text-red-500 text-xs mt-1"
                      >
                        {errors.contactPhone}
                      </p>
                    )}
                  </div>
                </div>
                {/* Sub Heads Section */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#e8eef8]">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-4 text-[#063168]">
                          <path d="M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.156 11.763c.16-.629.44-1.21.813-1.72a2.5 2.5 0 0 0-2.725 1.377c-.136.287.102.58.418.58h1.449c.01-.077.025-.156.045-.237ZM12.847 11.763c.02.08.036.16.046.237h1.446c.316 0 .554-.293.417-.579a2.5 2.5 0 0 0-2.722-1.378c.374.51.653 1.09.813 1.72ZM14 7.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM3.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM5 13c-.552 0-1.013-.455-.876-.99a4.002 4.002 0 0 1 7.753 0c.136.535-.324.99-.877.99H5Z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-[#063168]">
                          Sub heads (optional, max 5)
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                          Sub heads can create events under this fest only.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={addSubHead}
                      disabled={formData.subHeads.length >= 5}
                      aria-label="Add sub head"
                      title="Add sub head"
                      className="bg-[#063168] px-4 py-2.5 rounded-full text-white cursor-pointer text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add Sub Head
                    </button>
                  </div>

                  {formData.subHeads.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                      No sub heads added yet.
                    </div>
                  )}

                  <div className="space-y-4">
                    {formData.subHeads.map((subHead, index) => (
                      <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Sub Head {index + 1}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeSubHead(index)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                            aria-label={`Remove sub head ${index + 1}`}
                          >
                            Remove
                          </button>
                        </div>

                        <label
                          htmlFor={`sub-head-email-${index}`}
                          className="block text-xs font-semibold text-gray-600 mb-1.5"
                        >
                          Sub head email
                        </label>
                        <input
                          id={`sub-head-email-${index}`}
                          type="email"
                          placeholder="name@christuniversity.in"
                          value={subHead.email}
                          onChange={(e) => handleSubHeadChange(index, e.target.value)}
                          onBlur={() => handleSubHeadBlur(index)}
                          className={`w-full px-4 py-2.5 rounded-lg border ${
                            errors[`subHead_${index}`] ? "border-red-500" : "border-gray-300"
                          } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all text-sm bg-white`}
                        />
                        {errors[`subHead_${index}`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`subHead_${index}`]}</p>
                        )}

                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                            <div>
                              <label
                                htmlFor={`sub-head-expiration-${index}`}
                                className="block text-xs font-semibold text-gray-600 mb-1.5"
                              >
                                Access expiry <span className="text-red-500">*</span>
                              </label>
                              <input
                                id={`sub-head-expiration-${index}`}
                                type="datetime-local"
                                value={toDateTimeLocalInputValue(subHead.expiresAt)}
                                onChange={(e) => {
                                  if (!e.target.value) {
                                    handleSubHeadExpirationChange(index, null);
                                    return;
                                  }
                                  const parsed = new Date(e.target.value);
                                  handleSubHeadExpirationChange(
                                    index,
                                    Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
                                  );
                                }}
                                onBlur={() => handleSubHeadBlur(index)}
                                aria-label={`Sub head ${index + 1} expiration date and time`}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                              />
                              {errors[`subHeadExpiry_${index}`] && (
                                <p className="text-red-500 text-xs mt-1">{errors[`subHeadExpiry_${index}`]}</p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 lg:justify-end">
                              {["1 week", "1 month", "3 months"].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => {
                                    const date = new Date();
                                    if (preset === "1 week") date.setDate(date.getDate() + 7);
                                    else if (preset === "1 month") date.setMonth(date.getMonth() + 1);
                                    else if (preset === "3 months") date.setMonth(date.getMonth() + 3);
                                    handleSubHeadExpirationChange(index, date.toISOString());
                                  }}
                                  className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 hover:bg-gray-100 transition-colors text-gray-600"
                                >
                                  {preset}
                                </button>
                              ))}
                              {subHead.expiresAt && (
                                <button
                                  type="button"
                                  onClick={() => handleSubHeadExpirationChange(index, null)}
                                  className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-red-300 hover:bg-red-50 transition-colors text-red-600"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                          {subHead.expiresAt && !Number.isNaN(new Date(subHead.expiresAt).getTime()) ? (
                            <p className="text-xs text-green-600 mt-2">
                              Access expires: {new Date(subHead.expiresAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          ) : (
                            <p className="text-xs text-red-600 mt-2">
                              Expiry is required for each sub head.
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Fest Details Section */}
                <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-200">
                  <div className="flex items-center gap-3 mb-6">
                    <h3 className="text-lg font-semibold text-gray-800">Additional Fields</h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium border border-gray-200">
                      Optional
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-6 -mt-4">
                    These fields are optional and can be used to add extra details about your fest.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Venue */}
                    <div>
                      <label htmlFor="venue" className="block mb-2 text-sm font-medium text-gray-700">
                        Venue
                      </label>
                      <input
                        type="text"
                        id="venue"
                        placeholder="Enter fest venue"
                        value={formData.venue}
                        onChange={(e) => setFormData(prev => ({ ...prev, venue: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all text-sm"
                      />
                    </div>

                    {/* Status (auto from dates) */}
                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700">
                        Status (Auto from dates)
                      </label>
                      <div className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-slate-50 flex items-center justify-between text-sm">
                        <span className="text-gray-700">
                          {formData.status === "upcoming"
                            ? "Before opening date"
                            : formData.status === "ongoing"
                              ? "Within fest duration"
                              : "After closing date"}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${
                            formData.status === "upcoming"
                              ? "bg-emerald-100 text-emerald-700"
                              : formData.status === "ongoing"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {formData.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Upcoming: before opening date, Ongoing: between opening and closing, Past: after closing.
                      </p>
                    </div>
                  </div>

                  {/* Social Links */}
                  <div className="mb-6">
                    <label className="block mb-2 text-sm font-medium text-gray-700">Social Links</label>
                    {formData.social_links.map((link, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <select
                          value={link.platform}
                          onChange={(e) => {
                            const newLinks = [...formData.social_links];
                            newLinks[index] = { ...newLinks[index], platform: e.target.value };
                            setFormData(prev => ({ ...prev, social_links: newLinks }));
                          }}
                          aria-label={`Social platform ${index + 1}`}
                          className="w-32 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                        >
                          <option value="instagram">Instagram</option>
                          <option value="twitter">Twitter</option>
                          <option value="facebook">Facebook</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="youtube">YouTube</option>
                          <option value="website">Website</option>
                        </select>
                        <input
                          type="url"
                          placeholder="https://..."
                          value={link.url}
                          onChange={(e) => {
                            const newLinks = [...formData.social_links];
                            newLinks[index] = { ...newLinks[index], url: e.target.value };
                            setFormData(prev => ({ ...prev, social_links: newLinks }));
                          }}
                          aria-label={`Social link URL ${index + 1}`}
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newLinks = formData.social_links.filter((_, i) => i !== index);
                            setFormData(prev => ({ ...prev, social_links: newLinks }));
                          }}
                          aria-label={`Remove social link ${index + 1}`}
                          title={`Remove social link ${index + 1}`}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5">
                            <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, social_links: [...prev.social_links, { platform: "instagram", url: "" }] }))}
                      className="mt-2 px-3 py-1.5 text-sm font-medium text-[#154CB3] border border-[#154CB3] rounded-full hover:bg-blue-50 transition-colors"
                    >
                      + Add Social Link
                    </button>
                  </div>

                  {/* FAQs */}
                  <div className="mb-6">
                    <label className="block mb-2 text-sm font-medium text-gray-700">FAQs</label>
                    {formData.faqs.map((faq, index) => (
                      <div key={index} className="mb-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              placeholder="Question"
                              value={faq.question}
                              onChange={(e) => {
                                const newFaqs = [...formData.faqs];
                                newFaqs[index] = { ...newFaqs[index], question: e.target.value };
                                setFormData(prev => ({ ...prev, faqs: newFaqs }));
                              }}
                              aria-label={`FAQ question ${index + 1}`}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                            />
                            <textarea
                              placeholder="Answer"
                              value={faq.answer}
                              onChange={(e) => {
                                const newFaqs = [...formData.faqs];
                                newFaqs[index] = { ...newFaqs[index], answer: e.target.value };
                                setFormData(prev => ({ ...prev, faqs: newFaqs }));
                              }}
                              rows={2}
                              aria-label={`FAQ answer ${index + 1}`}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newFaqs = formData.faqs.filter((_, i) => i !== index);
                              setFormData(prev => ({ ...prev, faqs: newFaqs }));
                            }}
                            aria-label={`Remove FAQ ${index + 1}`}
                            title={`Remove FAQ ${index + 1}`}
                            className="p-2 text-gray-400 hover:text-red-500"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5">
                              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, faqs: [...prev.faqs, { question: "", answer: "" }] }))}
                      className="mt-2 px-3 py-1.5 text-sm font-medium text-[#154CB3] border border-[#154CB3] rounded-full hover:bg-blue-50 transition-colors"
                    >
                      + Add FAQ
                    </button>
                  </div>

                  {/* Sponsors */}
                  <div className="mb-6">
                    <label className="block mb-2 text-sm font-medium text-gray-700">Sponsors</label>
                    {formData.sponsors.map((sponsor, index) => (
                      <div key={index} className="mb-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              placeholder="Sponsor Name"
                              value={sponsor.name}
                              onChange={(e) => {
                                const newSponsors = [...formData.sponsors];
                                newSponsors[index] = { ...newSponsors[index], name: e.target.value };
                                setFormData(prev => ({ ...prev, sponsors: newSponsors }));
                              }}
                              aria-label={`Sponsor ${index + 1} name`}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="url"
                                placeholder="Logo URL"
                                value={sponsor.logo_url}
                                onChange={(e) => {
                                  const newSponsors = [...formData.sponsors];
                                  newSponsors[index] = { ...newSponsors[index], logo_url: e.target.value };
                                  setFormData(prev => ({ ...prev, sponsors: newSponsors }));
                                }}
                                aria-label={`Sponsor ${index + 1} logo URL`}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                              />
                              <input
                                type="url"
                                placeholder="Website (optional)"
                                value={sponsor.website || ""}
                                onChange={(e) => {
                                  const newSponsors = [...formData.sponsors];
                                  newSponsors[index] = { ...newSponsors[index], website: e.target.value };
                                  setFormData(prev => ({ ...prev, sponsors: newSponsors }));
                                }}
                                aria-label={`Sponsor ${index + 1} website`}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newSponsors = formData.sponsors.filter((_, i) => i !== index);
                              setFormData(prev => ({ ...prev, sponsors: newSponsors }));
                            }}
                            aria-label={`Remove sponsor ${index + 1}`}
                            title={`Remove sponsor ${index + 1}`}
                            className="p-2 text-gray-400 hover:text-red-500"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5">
                              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, sponsors: [...prev.sponsors, { name: "", logo_url: "", website: "" }] }))}
                      className="mt-2 px-3 py-1.5 text-sm font-medium text-[#154CB3] border border-[#154CB3] rounded-full hover:bg-blue-50 transition-colors"
                    >
                      + Add Sponsor
                    </button>
                  </div>

                  {/* Timeline */}
                  <div className="mb-6">
                    <label className="block mb-2 text-sm font-medium text-gray-700">Timeline</label>
                    {formData.timeline.map((item, index) => (
                      <div key={index} className="mb-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="Time (e.g., 10:00 AM)"
                                value={item.time}
                                onChange={(e) => {
                                  const newTimeline = [...formData.timeline];
                                  newTimeline[index] = { ...newTimeline[index], time: e.target.value };
                                  setFormData(prev => ({ ...prev, timeline: newTimeline }));
                                }}
                                aria-label={`Timeline item ${index + 1} time`}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                              />
                              <input
                                type="text"
                                placeholder="Title"
                                value={item.title}
                                onChange={(e) => {
                                  const newTimeline = [...formData.timeline];
                                  newTimeline[index] = { ...newTimeline[index], title: e.target.value };
                                  setFormData(prev => ({ ...prev, timeline: newTimeline }));
                                }}
                                aria-label={`Timeline item ${index + 1} title`}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) => {
                                const newTimeline = [...formData.timeline];
                                newTimeline[index] = { ...newTimeline[index], description: e.target.value };
                                setFormData(prev => ({ ...prev, timeline: newTimeline }));
                              }}
                              aria-label={`Timeline item ${index + 1} description`}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newTimeline = formData.timeline.filter((_, i) => i !== index);
                              setFormData(prev => ({ ...prev, timeline: newTimeline }));
                            }}
                            aria-label={`Remove timeline item ${index + 1}`}
                            title={`Remove timeline item ${index + 1}`}
                            className="p-2 text-gray-400 hover:text-red-500"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5">
                              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, timeline: [...prev.timeline, { time: "", title: "", description: "" }] }))}
                      className="mt-2 px-3 py-1.5 text-sm font-medium text-[#154CB3] border border-[#154CB3] rounded-full hover:bg-blue-50 transition-colors"
                    >
                      + Add Timeline Item
                    </button>
                  </div>
                </div>

                {errors.submit && (
                  <p className="text-red-500 text-sm mt-4 bg-red-50 p-3 rounded-md">
                    {errors.submit}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-8 sm:mt-10 pt-6 border-t border-gray-200">
                  <Link
                    href="/manage"
                    className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors cursor-pointer text-center inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2"
                  >
                    Cancel
                  </Link>
                  
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {!(finalIsEditMode && isDraftFest && !(approvalExists && approvalPhase1Complete)) && (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          disabled={isSubmitting || isNavigating || isOpeningPreview}
                          className="w-full sm:w-auto px-5 py-2.5 border border-amber-400 text-amber-800 bg-amber-50 text-sm font-medium rounded-md hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {isSubmitting ? "Saving Draft..." : "Save as Draft"}
                        </button>
                      </>
                    )}

                    {finalIsEditMode && !(finalIsEditMode && isDraftFest && !(approvalExists && approvalPhase1Complete)) && (
                      <div className="relative" ref={actionsDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                          disabled={isNavigating || isSubmitting || isOpeningPreview}
                          className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 text-gray-700 bg-white text-sm font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                        >
                          <span>More actions</span>
                          <svg className={`w-4 h-4 transition-transform ${isActionsDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        </button>
                        {isActionsDropdownOpen && (
                          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                            <button
                              type="button"
                              onClick={() => {
                                deleteFest();
                                setIsActionsDropdownOpen(false);
                              }}
                              disabled={isNavigating || isSubmitting || isOpeningPreview}
                              className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 text-sm font-medium border-b border-gray-100 first:rounded-t-lg last:border-b-0 last:rounded-b-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              {isNavigating ? "Deleting..." : "Delete Fest"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {finalIsEditMode && isDraftFest && !(approvalExists && approvalPhase1Complete) ? (
                    <button
                      type="button"
                      onClick={() => setActiveView('approvals')}
                      className="w-full sm:w-auto px-6 py-2.5 bg-[#154CB3] text-white text-sm font-medium rounded-md hover:bg-[#0f3a7a] focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2 transition-colors"
                    >
                      Go to Approvals Tab
                    </button>
                  ) : finalIsEditMode ? (
                    <button
                      type="submit"
                      disabled={isSubmitting || isNavigating || isOpeningPreview}
                      className="w-full sm:w-auto px-6 py-2.5 bg-[#154CB3] text-white text-sm font-medium rounded-md hover:bg-[#0f3a7a] focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                    >
                      {(isSubmitting || isUploadingImage) && (
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      <span>
                        {isUploadingImage ? "Uploading image..." : isSubmitting ? (isDraftFest ? "Publishing..." : "Updating...") : isDraftFest ? "Publish Fest" : "Update Fest"}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoAheadForApprovals}
                      disabled={isNavigating}
                      className="w-full sm:w-auto px-6 py-2.5 bg-[#154CB3] text-white text-sm font-semibold rounded-md hover:bg-[#0f3a7a] focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Go ahead for Approvals →
                    </button>
                  )}
                </div>
              </form>
              </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CreateFestForm;

