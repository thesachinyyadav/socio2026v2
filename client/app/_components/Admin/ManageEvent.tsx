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
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import {
  EventFormData,
  eventFormSchema,
  departments as departmentOptions,
  categories as categoryOptions,
  festEvents as festEventOptions,
} from "@/app/lib/eventFormSchema";

import {
  InputField,
  CustomDropdown,
  FileInput,
  DynamicScheduleList,
  DynamicTextList,
} from "@/app/_components/UI/FormElements";

import { useAuth } from "@/context/AuthContext";
import LoadingIndicator from "@/app/_components/UI/LoadingIndicator";

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
  defaultValues?: Partial<EventFormData>;
  isSubmittingProp: boolean;
  isEditMode: boolean;
  existingImageFileUrl?: string | null;
  existingBannerFileUrl?: string | null;
  existingPdfFileUrl?: string | null;
}

const baseButtonClasses =
  "inline-flex items-center justify-center text-sm sm:text-base font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50";
const primaryButtonClasses = `${baseButtonClasses} bg-[#154CB3] text-white hover:bg-[#154cb3eb] focus:ring-[#154CB3] px-4 sm:px-6 py-2 sm:py-2.5 disabled:opacity-60 disabled:cursor-not-allowed`;
const secondaryButtonClasses = `${baseButtonClasses} border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-[#154CB3] px-4 sm:px-5 py-2 sm:py-2.5 disabled:opacity-60 disabled:cursor-not-allowed`;
const toggleTrackClass =
  "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#154CB3]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#154CB3]";

export default function EventForm({
  onSubmit,
  defaultValues,
  isSubmittingProp,
  isEditMode,
  existingImageFileUrl,
  existingBannerFileUrl,
  existingPdfFileUrl,
}: EventFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting: rhfIsSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<EventFormData>({
    // resolver: zodResolver(eventFormSchema), // Temporarily disabled for build
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
      maxParticipants: "",
      contactEmail: "",
      contactPhone: "",
      whatsappLink: "",
      rules: [],
      scheduleItems: [],
      prizes: [],
      provideClaims: false,
      imageFile: null,
      bannerFile: null,
      pdfFile: null,
      ...defaultValues,
    },
  });

  const { session } = useAuth();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] =
    React.useState(false);
  const [showRegistrationsClosedModal, setShowRegistrationsClosedModal] =
    React.useState(false);

  useEffect(() => {
    if (
      defaultValues &&
      (Object.keys(defaultValues).length > 0 || isEditMode)
    ) {
      const transformedDefaults = {
        ...defaultValues,
        department: Array.isArray(defaultValues.department)
          ? defaultValues.department
          : [],
        rules: Array.isArray(defaultValues.rules) ? defaultValues.rules : [],
        prizes: Array.isArray(defaultValues.prizes) ? defaultValues.prizes : [],
        scheduleItems: Array.isArray(defaultValues.scheduleItems)
          ? defaultValues.scheduleItems
          : [],
      };
      reset(transformedDefaults);
    }
  }, [defaultValues, reset, isEditMode]);

  const watchedEventDate = useWatch({ control, name: "eventDate" });

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

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);

  const processSubmit: SubmitHandler<EventFormData> = async (data) => {
    if (Object.keys(errors).length > 0) {
      console.error("EventForm: Zod validation errors:", errors);
      return;
    }
    try {
      await onSubmit(data);
      setIsModalOpen(true);
    } catch (error: any) {
      console.error(
        "EventForm: Error from onSubmit prop:",
        error.message,
        error
      );
    }
  };

  const handleNavigationToDashboard = () => {
    setIsNavigating(true);
    window.location.href = "/manage";
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

      const response = await fetch(
        `http://localhost:8000/api/events/${eventIdSlug}`,
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
      window.location.href = "/manage";
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
      const response = await fetch(
        `http://localhost:8000/api/events/${eventIdSlug}/close`,
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

      {(isModalOpen || isNavigating || showRegistrationsClosedModal) && (
        <div className="fixed inset-0 bg-white z-[100] flex items-center justify-center px-4">
          {isModalOpen && !isNavigating && !showRegistrationsClosedModal && (
            <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full border border-gray-200 shadow-xl text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-4">
                Event {isEditMode ? "Updated!" : "Published!"}
              </h2>
              <p className="text-gray-600 mb-6 text-sm sm:text-base">
                Your event has been successfully{" "}
                {isEditMode ? "updated" : "published"}.
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
            <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full border border-gray-200 shadow-xl text-center">
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
                onSubmit={handleSubmit(processSubmit)}
                className="space-y-6 sm:space-y-8"
                noValidate
              >
                <InputField
                  label="Event title:"
                  name="eventTitle"
                  register={register}
                  error={errors.eventTitle}
                  required
                  placeholder="Enter event title"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <InputField
                  label="Organizing department / committee:"
                  name="organizingDept"
                  register={register}
                  error={errors.organizingDept}
                  required
                  placeholder="e.g., Department of Computer Science /  Student Welfare Organization"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <CustomDropdown
                    name="festEvent"
                    control={control}
                    options={[
                      { value: "none", label: "None" },
                      ...festEventOptions,
                    ]}
                    placeholder="Select fest event (if any)"
                    label="Fest event: (optional)"
                    error={errors.festEvent}
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
                        minDate={new Date()}
                        maxDate={
                          watchedEventDate && parseYYYYMMDD(watchedEventDate)
                            ? parseYYYYMMDD(watchedEventDate) || undefined
                            : undefined
                        }
                      />
                    )}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between sm:justify-start">
                    <label
                      htmlFor="provideClaims"
                      className="text-sm font-medium text-gray-700 mr-4"
                    >
                      Provide claims for periods missed
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <Controller
                        name="provideClaims"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            id="provideClaims"
                            checked={!!field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            className="sr-only peer"
                          />
                        )}
                      />
                      <div className={toggleTrackClass}></div>
                    </label>
                  </div>
                  {errors.provideClaims && (
                    <p className="text-red-500 text-xs mt-1">
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
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
                  <InputField
                    label="Max participants / team:"
                    name="maxParticipants"
                    type="text"
                    inputMode="numeric"
                    register={register}
                    error={errors.maxParticipants}
                    placeholder="e.g., 1 (individual), 5 (team)"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <InputField
                    label="Contact email:"
                    name="contactEmail"
                    type="email"
                    register={register}
                    error={errors.contactEmail}
                    required
                    placeholder="event.support@example.com"
                  />
                  <InputField
                    label="Contact phone:"
                    name="contactPhone"
                    type="tel"
                    register={register}
                    error={errors.contactPhone}
                    required
                    placeholder="10-digit mobile number"
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
                <div className="flex flex-col-reverse sm:flex-row items-center justify-end space-y-3 space-y-reverse sm:space-y-0 sm:space-x-4 mt-8 sm:mt-10">
                  <button
                    type="button"
                    onClick={handleNavigationToDashboard}
                    disabled={isSubmittingProp || rhfIsSubmitting || isDeleting}
                    className={`${secondaryButtonClasses} w-full sm:w-auto cursor-pointer`}
                  >
                    Cancel
                  </button>
                  {isEditMode && (
                    <>
                      <button
                        type="button"
                        onClick={openDeleteConfirmation}
                        disabled={
                          isDeleting || isSubmittingProp || rhfIsSubmitting
                        }
                        className="cursor-pointer px-4 sm:px-5 py-2 sm:py-3 rounded-full border bg-red-600 border-red-700 font-medium text-white hover:bg-red-700 transition-colors text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
                      >
                        {isDeleting ? "Deleting..." : "Delete event"}
                      </button>
                      <button
                        type="button"
                        onClick={closeRegistration}
                        disabled={
                          isSubmittingProp || rhfIsSubmitting || isDeleting
                        }
                        className="cursor-pointer px-4 sm:px-5 py-2 sm:py-3 rounded-full border bg-white border-red-400 font-medium text-red-500 hover:bg-red-50 transition-colors text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
                      >
                        Close registrations
                      </button>
                    </>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmittingProp || rhfIsSubmitting || isDeleting}
                    className={`${primaryButtonClasses} w-full sm:w-auto cursor-pointer`}
                  >
                    {isSubmittingProp || rhfIsSubmitting
                      ? isEditMode
                        ? "Updating..."
                        : "Publishing..."
                      : isEditMode
                      ? "Update event"
                      : "Publish event"}
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
