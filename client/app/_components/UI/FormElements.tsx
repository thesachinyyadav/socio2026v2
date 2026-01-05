"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  UseFormRegister,
  FieldError,
  Control,
  Controller,
  useFieldArray,
  FieldErrors,
  FieldValues,
  Path,
  ControllerRenderProps,
} from "react-hook-form";
import {
  EventFormData,
  ScheduleItem as ScheduleItemType,
} from "@/app/lib/eventFormSchema";

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

interface CustomTimePickerProps {
  field: ControllerRenderProps<any, string>;
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
  const parsedInitialTime = parseHHMM(field.value);
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
    const parsedFieldValue = parseHHMM(field.value);
    if (parsedFieldValue) {
      setSelectedHour(parsedFieldValue.hours);
      setSelectedMinute(parsedFieldValue.minutes);
    } else {
      if (!field.value) {
        setSelectedHour(12);
        setSelectedMinute(0);
      }
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
      {label && (
        <label
          htmlFor={id || field.name}
          className="block mb-2 text-sm font-medium text-gray-700"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
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
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-clock-icon lucide-clock text-gray-500"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
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

interface InputFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  name: Path<EventFormData>;
  register: UseFormRegister<EventFormData>;
  error?: FieldError;
  required?: boolean;
  as?: "input" | "textarea";
  rows?: number;
}

export function InputField({
  label,
  name,
  register,
  error,
  required,
  as = "input",
  rows,
  ...props
}: InputFieldProps) {
  const commonClasses = `w-full px-3 py-2 sm:px-4 sm:py-3 rounded-lg border ${
    error ? "border-red-500" : "border-gray-300"
  } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all text-sm sm:text-base`;
  const InputComponent = as === "textarea" ? "textarea" : "input";

  return (
    <div>
      {label && (
        <label
          htmlFor={name}
          className="block mb-2 text-sm font-medium text-gray-700"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <InputComponent
        id={name}
        {...register(name)}
        {...props}
        rows={as === "textarea" ? rows : undefined}
        className={commonClasses}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
    </div>
  );
}

interface Option {
  value: string;
  label: string;
}
interface CustomDropdownProps {
  name: Path<EventFormData>;
  control: Control<EventFormData>;
  options: Option[];
  placeholder: string;
  label?: string;
  error?: FieldError;
  required?: boolean;
}

export function CustomDropdown({
  name,
  control,
  options,
  placeholder,
  label,
  error,
  required,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      )
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: required ? `${label || placeholder} is required` : false,
      }}
      render={({ field: { onChange, value } }) => (
        <div className="relative w-full" ref={dropdownRef}>
          {label && (
            <label
              htmlFor={name}
              className="block mb-2 text-sm font-medium text-gray-700"
            >
              {label} {required && <span className="text-red-500">*</span>}
            </label>
          )}
          <div
            id={name}
            className={`bg-white rounded-lg px-3 py-2 sm:px-4 sm:py-3 border ${
              error ? "border-red-500" : "border-gray-300"
            } transition-all hover:border-[#154CB3] cursor-pointer`}
            onClick={() => setIsOpen(!isOpen)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setIsOpen(!isOpen);
            }}
            role="button"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            tabIndex={0}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-sm ${
                  value ? "text-gray-900" : "text-gray-500"
                } truncate max-w-[140px] sm:max-w-[160px]`}
              >
                {options.find((opt) => opt.value === value)?.label ||
                  placeholder}
              </span>
              <svg
                className={`h-4 w-4 text-[#154CB3] transform transition-transform ${
                  isOpen ? "rotate-180" : ""
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
            </div>
          </div>
          {isOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-y-auto max-h-60"
              role="listbox"
            >
              {placeholder === "Select fest event" && name === "festEvent" && (
                <div
                  className={`px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium hover:bg-gray-100 cursor-pointer transition-colors ${
                    !value ? "bg-blue-50 text-[#154CB3]" : "text-gray-900"
                  }`}
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onChange("");
                      setIsOpen(false);
                    }
                  }}
                  role="option"
                  aria-selected={!value}
                  tabIndex={0}
                >
                  {placeholder} (Clear selection)
                </div>
              )}
              {options.map((option) => (
                <div
                  key={option.value}
                  className={`px-3 py-2 sm:px-4 sm:py-3 text-sm font-medium hover:bg-gray-100 cursor-pointer transition-colors ${
                    value === option.value
                      ? "bg-blue-50 text-[#154CB3]"
                      : "text-gray-900"
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onChange(option.value);
                      setIsOpen(false);
                    }
                  }}
                  role="option"
                  aria-selected={value === option.value}
                  tabIndex={0}
                >
                  {option.label}
                </div>
              ))}
            </div>
          )}
          {error && (
            <p className="text-red-500 text-xs mt-1">{error.message}</p>
          )}
        </div>
      )}
    />
  );
}

interface FileInputProps<T extends FieldValues> {
  label: string;
  name: Path<T>;
  register: UseFormRegister<T>;
  error?: FieldError;
  accept?: string;
  required?: boolean;
  helpText?: string;
  currentFileUrl?: string | null;
}
export function FileInput<T extends FieldValues>({
  label,
  name,
  register,
  error,
  accept,
  required,
  helpText,
  currentFileUrl,
}: FileInputProps<T>) {
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { onChange: rhfOnChange, ...restRegisterProps } = register(name, {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setFileName(e.target.files?.[0]?.name || null);
    },
  });

  const displayFileName =
    fileName ||
    (currentFileUrl ? currentFileUrl.split("/").pop()?.split("?")[0] : null) ||
    helpText ||
    "Drag & drop or click to upload";

  const chooseFileButtonClasses =
    "inline-flex items-center justify-center text-sm font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 " +
    "bg-[#154CB3] text-white hover:bg-[#154cb3eb] focus:ring-[#154CB3] " +
    "px-4 py-1.5 sm:py-2 cursor-pointer";

  return (
    <div>
      <label className="block mb-2 text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="border border-dashed border-gray-500 rounded-lg p-6 sm:p-8 py-10 sm:py-14 text-center">
        <p className="text-gray-500 mb-4 text-sm sm:text-base truncate max-w-full px-2">
          {displayFileName}
        </p>
        {currentFileUrl && !fileName && (
          <a
            href={currentFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-xs mb-2 block"
          >
            View current file
          </a>
        )}
        <input
          type="file"
          id={name as string}
          accept={accept}
          {...restRegisterProps}
          onChange={(e) => {
            rhfOnChange(e);
            setFileName(e.target.files?.[0]?.name || null);
          }}
          className="hidden"
          ref={(e) => {
            (register(name) as any).ref(e);
            (fileInputRef as any).current = e;
          }}
        />
        <label htmlFor={name as string} className={chooseFileButtonClasses}>
          Choose file
        </label>
        {fileName && (
          <button
            type="button"
            onClick={() => {
              setFileName(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
              const syntheticEvent = {
                target: { files: null, name },
              } as unknown as React.ChangeEvent<HTMLInputElement>;
              rhfOnChange(syntheticEvent);
            }}
            className="text-xs text-red-500 hover:underline ml-2"
          >
            Clear
          </button>
        )}
        {error && <p className="text-red-500 text-xs mt-2">{error.message}</p>}
      </div>
    </div>
  );
}

interface DynamicScheduleListProps {
  control: Control<EventFormData>;
  register: UseFormRegister<EventFormData>;
  errors: FieldErrors<EventFormData>;
}
export function DynamicScheduleList({
  control,
  register,
  errors,
}: DynamicScheduleListProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "scheduleItems",
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <div className="flex items-center mb-4 sm:mb-0">
          <div className="bg-[#FFCC00] rounded-full w-8 h-8 flex items-center justify-center mr-3 shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-calendar-check2-icon lucide-calendar-check-2"
            >
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <path d="M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
              <path d="M3 10h18" />
              <path d="m16 20 2 2 4-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#063168]">
              Schedule: (optional)
            </h3>
            <p className="text-sm text-gray-500">
              Mention schedule items below
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => append({ time: "", activity: "" } as ScheduleItemType)}
          className="bg-[#063168] p-3 rounded-full text-white cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
      {fields.map((item, index) => (
        <div
          key={item.id}
          className="flex flex-row items-start gap-3 sm:gap-4 mb-4"
        >
          <div className="w-1/3 sm:w-1/4">
            <Controller
              name={`scheduleItems.${index}.time`}
              control={control}
              render={({ field, fieldState: { error } }) => (
                <CustomTimePicker
                  id={`scheduleItems.${index}.time`}
                  field={field}
                  label=""
                  error={error}
                  placeholder="HH:MM"
                />
              )}
            />
          </div>
          <div className="flex-1">
            <InputField
              label=""
              name={`scheduleItems.${index}.activity`}
              register={register}
              error={errors.scheduleItems?.[index]?.activity}
              placeholder="Activity description"
            />
          </div>
          <button
            type="button"
            onClick={() => remove(index)}
            className="p-1.5 sm:p-2 mt-1 sm:mt-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="Remove schedule item"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="size-5"
            >
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        </div>
      ))}
      {errors.scheduleItems && !Array.isArray(errors.scheduleItems) && (
        <p className="text-red-500 text-xs mt-1">
          {errors.scheduleItems.message}
        </p>
      )}
    </div>
  );
}

interface DynamicTextListProps {
  listName: "rules" | "prizes";
  itemNoun: string;
  title: string;
  placeholder: string;
  inputType?: "text";
  control: Control<EventFormData>;
  register: UseFormRegister<EventFormData>;
  errors: FieldErrors<EventFormData>;
}

export function DynamicTextList({
  listName,
  itemNoun,
  title,
  placeholder,
  inputType = "text",
  control,
  register,
  errors,
}: DynamicTextListProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: listName,
    keyName: "id",
  });

  let listIcon;
  if (listName === "rules") {
    listIcon = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lucide lucide-gavel-icon lucide-gavel"
      >
        <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8" />
        <path d="m16 16 6-6" />
        <path d="m8 8 6-6" />
        <path d="m9 7 8 8" />
        <path d="m21 11-8-8" />
      </svg>
    );
  } else if (listName === "prizes") {
    listIcon = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lucide lucide-trophy-icon lucide-trophy"
      >
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <div className="flex items-center mb-4 sm:mb-0">
          <div className="bg-[#FFCC00] rounded-full w-8 h-8 flex items-center justify-center mr-3 shrink-0">
            {listIcon}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#063168]">
              {title}
            </h3>
            <p className="text-sm text-gray-500">Mention {itemNoun}s below</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            append(
              { value: "" },
              {
                shouldFocus: false,
              }
            )
          }
          className="bg-[#063168] p-3 rounded-full text-white cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
      {fields.map((item, index) => (
        <div key={item.id} className="mb-4 relative flex items-start gap-2">
          <div className="flex-grow flex flex-col sm:flex-row gap-2">
            <div className="w-full">
              {" "}
              <InputField
                label=""
                name={`${listName}.${index}.value` as Path<EventFormData>}
                type={inputType}
                register={register}
                error={
                  errors[listName]?.[index]?.value as FieldError | undefined
                }
                placeholder={placeholder}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => remove(index)}
            className="p-1.5 sm:p-2 mt-1 sm:mt-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            aria-label={`Remove ${itemNoun}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="size-5"
            >
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        </div>
      ))}
      {errors[listName] && !Array.isArray(errors[listName]) && (
        <p className="text-red-500 text-xs mt-1">{errors[listName]?.message}</p>
      )}
    </div>
  );
}
