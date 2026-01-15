"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../context/AuthContext"; // Adjust path as needed
import { createBrowserClient } from "@supabase/ssr";
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
          aria-expanded={isOpen}
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
  errors: Record<string, string | undefined>;
  setFormData: React.Dispatch<React.SetStateAction<CreateFestState>>;
  validateField: (
    name: string,
    value: string | string[] | { index: number; eventHead: string }
  ) => void;
}
interface CreateFestState {
  title: string;
  openingDate: string;
  closingDate: string;
  detailedDescription: string;
  department: string[];
  category: string;
  contactEmail: string;
  contactPhone: string;
  eventHeads: string[];
  organizingDept: string;
}

function DepartmentAndCategoryInputs({
  formData,
  errors,
  setFormData,
  validateField,
}: DepartmentAndCategoryInputsProps) {
  const [isDepartmentDropdownOpen, setIsDepartmentDropdownOpen] =
    useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const departmentDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const departmentTriggerRef = useRef<HTMLDivElement>(null);
  const categoryTriggerRef = useRef<HTMLDivElement>(null);

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
    setFormData((prev) => ({ ...prev, department: newDepartments }));
    validateField("department", newDepartments);
  };
  const handleCategorySelect = (value: string) => {
    setFormData((prev) => ({ ...prev, category: value }));
    validateField("category", value);
    setIsCategoryDropdownOpen(false);
  };

  const departments = [
    {
      value: "all_departments",
      label: "All Departments",
    },
    {
      value: "dept_english_cultural_studies",
      label: "Department of English and Cultural Studies",
    },
    { value: "dept_languages", label: "Department of Languages" },
    { value: "dept_media_studies", label: "Department of Media Studies" },
    {
      value: "dept_performing_arts_theatre_music",
      label: "Department of Performing Arts, Theatre Studies and Music",
    },
    {
      value: "dept_philosophy_theology",
      label: "Department of Philosophy and Theology",
    },
    {
      value: "dept_business_management",
      label: "Department of Business and Management",
    },
    { value: "dept_hotel_management", label: "Department of Hotel Management" },
    {
      value: "dept_tourism_management",
      label: "Department of Tourism Management",
    },
    { value: "dept_commerce", label: "Department of Commerce" },
    {
      value: "dept_professional_studies",
      label: "Department of Professional Studies",
    },
    {
      value: "dept_civil_engineering",
      label: "Department of Civil Engineering",
    },
    {
      value: "dept_computer_science_engineering",
      label: "Department of Computer Science and Engineering",
    },
    {
      value: "dept_electrical_electronics_engineering",
      label: "Department of Electrical and Electronics Engineering",
    },
    {
      value: "dept_electronics_communication_engineering",
      label: "Department of Electronics and Communication Engineering",
    },
    {
      value: "dept_mechanical_automobile_engineering",
      label: "Department of Mechanical and Automobile Engineering",
    },
    {
      value: "dept_sciences_humanities_eng",
      label: "Department of Sciences and Humanities",
    },
    {
      value: "dept_computer_science_sci",
      label: "Department of Computer Science",
    },
    { value: "dept_chemistry", label: "Department of Chemistry" },
    { value: "dept_life_sciences", label: "Department of Life Sciences" },
    { value: "dept_mathematics", label: "Department of Mathematics" },
    {
      value: "dept_physics_electronics",
      label: "Department of Physics and Electronics",
    },
    {
      value: "dept_statistics_data_science",
      label: "Department of Statistics and Data Science",
    },
    { value: "dept_economics", label: "Department of Economics" },
    {
      value: "dept_international_studies_political_science_history",
      label:
        "Department of International Studies, Political Science, and History",
    },
    {
      value: "dept_sociology_social_work",
      label: "Department of Sociology and Social Work",
    },
    { value: "dept_liberal_arts", label: "Department of Liberal Arts" },
  ];
  
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
        <div
          id="department-trigger"
          ref={departmentTriggerRef}
          onClick={toggleDepartmentDropdown}
          role="combobox"
          aria-expanded={isDepartmentDropdownOpen}
          aria-haspopup="listbox"
          aria-controls="department-listbox"
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
        </div>
        {isDepartmentDropdownOpen && (
          <div
            id="department-listbox"
            ref={departmentDropdownRef}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-y-auto max-h-60 w-full"
            role="listbox"
          >
            {departments.map((dept) => (
              <div
                key={dept.value}
                onClick={() => handleDepartmentChange(dept.value)}
                role="option"
                aria-selected={formData.department.includes(dept.value)}
                className="p-1 hover:bg-gray-100 cursor-pointer transition-colors focus:outline-none focus:bg-gray-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleDepartmentChange(dept.value);
                  }
                }}
              >
                <div
                  onClick={(e) => {
                    if (
                      e.target !== e.currentTarget &&
                      (e.target as HTMLElement).closest(
                        'input[type="checkbox"]'
                      )
                    ) {
                      return;
                    }
                    handleDepartmentChange(dept.value);
                  }}
                  role="option"
                  aria-selected={formData.department.includes(dept.value)}
                  className="px-4 py-3 hover:bg-gray-100 cursor-pointer transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleDepartmentChange(dept.value);
                    }
                  }}
                >
                  <div className="flex items-center pointer-events-none">
                    <input
                      type="checkbox"
                      id={`department_checkbox_${dept.value}`}
                      checked={formData.department.includes(dept.value)}
                      onChange={() => {
                        handleDepartmentChange(dept.value);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="h-4 w-4 text-[#154CB3] border-gray-300 rounded focus:ring-2 focus:ring-offset-1 focus:ring-[#154CB3]"
                      aria-labelledby={`department_label_${dept.value}`}
                    />
                    <label
                      id={`department_label_${dept.value}`}
                      className="ml-2 text-sm text-gray-700 select-none"
                    >
                      {dept.label}
                    </label>
                  </div>
                </div>
              </div>
            ))}
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
        <div
          id="category-trigger"
          ref={categoryTriggerRef}
          onClick={toggleCategoryDropdown}
          role="combobox"
          aria-expanded={isCategoryDropdownOpen}
          aria-haspopup="listbox"
          aria-controls="category-listbox"
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
        </div>
        {isCategoryDropdownOpen && (
          <div
            id="category-listbox"
            ref={categoryDropdownRef}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-y-auto max-h-60 w-full"
            role="listbox"
          >
            <div
              onClick={() => handleCategorySelect("")}
              role="option"
              aria-selected={!formData.category}
              className={`px-4 py-3 text-sm font-medium hover:bg-gray-100 cursor-pointer transition-colors ${
                !formData.category
                  ? "bg-blue-50 text-[#154CB3]"
                  : "text-gray-700"
              }`}
            >
              Select category
            </div>
            {categories.map((cat) => (
              <div
                key={cat.value}
                onClick={() => handleCategorySelect(cat.value)}
                role="option"
                aria-selected={formData.category === cat.value}
                className={`px-4 py-3 text-sm font-medium hover:bg-gray-100 cursor-pointer transition-colors ${
                  formData.category === cat.value
                    ? "bg-blue-50 text-[#154CB3]"
                    : "text-gray-700"
                }`}
              >
                {cat.label}
              </div>
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
  detailedDescription?: string;
  department?: string[];
  category?: string;
  contactEmail?: string;
  contactPhone?: string;
  eventHeads?: string[];
  scheduleItems?: { time: string; activity: string }[];
  rules?: string[];
  prizes?: string[];
  organizingDept?: string;
  isEditMode?: boolean;
  existingImageFileUrl?: string | null;
  existingBannerFileUrl?: string | null;
  existingPdfFileUrl?: string | null;
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

function CreateFestForm(props?: CreateFestProps) {
  // If props are passed (from edit page), use them; otherwise use defaults
  const title = props?.title || "";
  const openingDate = props?.openingDate || "";
  const closingDate = props?.closingDate || "";
  const detailedDescription = props?.detailedDescription || "";
  const department: string[] = props?.department || [];
  const category = props?.category || "";
  const contactEmail = props?.contactEmail || "";
  const contactPhone = props?.contactPhone || "";
  const organizingDept = props?.organizingDept || "";
  const initialEventHeads: string[] = props?.eventHeads || [];
  // New props for edit mode
  const isEditMode = props?.isEditMode || false;
  const existingImageFileUrl = props?.existingImageFileUrl || null;
  const existingBannerFileUrl = props?.existingBannerFileUrl || null;
  const existingPdfFileUrl = props?.existingPdfFileUrl || null;
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formData, setFormData] = useState<CreateFestState>({
    title,
    openingDate,
    closingDate,
    detailedDescription,
    department,
    category,
    contactEmail,
    contactPhone,
    organizingDept,
    eventHeads: initialEventHeads,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false); // Used for delete operation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingFestData, setIsLoadingFestData] = useState(false);

  const { session } = useAuth();
  const currentDateRef = useRef(new Date());
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    currentDateRef.current = today;
  }, []);

  const pathname = usePathname();
  const isEditModeFromPath = pathname.startsWith("/edit/fest");
  const festIdFromPath = isEditModeFromPath ? pathname.split("/").pop() : null;

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
          if (!response.ok) {
            if (response.status === 404) {
              throw new Error("Fest not found.");
            }
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to fetch fest details.");
          }
          const data = await response.json();
          if (data.fest) {
            setFormData({
              title: data.fest.fest_title || "",
              openingDate: data.fest.opening_date
                ? formatDateToYYYYMMDD(new Date(data.fest.opening_date))
                : "",
              closingDate: data.fest.closing_date
                ? formatDateToYYYYMMDD(new Date(data.fest.closing_date))
                : "",
              detailedDescription: data.fest.description || "",
              department: data.fest.department_access || [],
              category: data.fest.category || "",
              contactEmail: data.fest.contact_email || "",
              contactPhone: data.fest.contact_phone || "",
              eventHeads: data.fest.event_heads || [],
              organizingDept: data.fest.organizing_dept || "",
            });
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
        `${API_URL}/api/fests/${festIdFromPath}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete fest");
      }
      window.location.href = "/manage";
    } catch (error: any) {
      setErrors({ submit: error.message || "Failed to delete fest." });
      setIsNavigating(false);
    }
  };

  const validateField = useCallback(
    (
      name: string,
      value: string | string[] | { index: number; eventHead: string }
    ) => {
      const newErrors: Record<string, string | undefined> = { ...errors };
      const currentDate = new Date(currentDateRef.current);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?[\d\s-]{10,14}$/;

      if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        "index" in value &&
        "eventHead" in value
      ) {
        const { index, eventHead } = value;
        if (eventHead.trim() === "") delete newErrors[`eventHead_${index}`];
        else if (!emailRegex.test(eventHead))
          newErrors[`eventHead_${index}`] = "Invalid email format.";
        else if (eventHead.length > 100)
          newErrors[`eventHead_${index}`] = "Max 100 chars.";
        else delete newErrors[`eventHead_${index}`];
      } else {
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
                if (inputDate < parseYYYYMMDD(formData.openingDate)!)
                  newErrors[name] = "Must be on/after opening date";
                else delete newErrors[name];
              } else delete newErrors[name];
            }
            if (
              name === "openingDate" &&
              formData.closingDate &&
              parseYYYYMMDD(value as string) &&
              parseYYYYMMDD(formData.closingDate) &&
              parseYYYYMMDD(value as string)! >
                parseYYYYMMDD(formData.closingDate)!
            ) {
              newErrors.closingDate =
                "Closing date must be on/after opening date";
            } else if (
              name === "closingDate" &&
              formData.openingDate &&
              parseYYYYMMDD(value as string) &&
              parseYYYYMMDD(formData.openingDate) &&
              parseYYYYMMDD(value as string)! <
                parseYYYYMMDD(formData.openingDate)!
            ) {
              newErrors.closingDate =
                "Closing date must be on/after opening date";
            } else if (
              name === "openingDate" &&
              newErrors.closingDate ===
                "Closing date must be on/after opening date" &&
              parseYYYYMMDD(value as string) &&
              parseYYYYMMDD(formData.closingDate) &&
              parseYYYYMMDD(value as string)! <=
                parseYYYYMMDD(formData.closingDate)!
            ) {
              delete newErrors.closingDate;
            }
            break;
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
            if (!(value as string).trim())
              newErrors.contactEmail = "Contact email is required";
            else if (!emailRegex.test(value as string))
              newErrors.contactEmail = "Invalid email format";
            else delete newErrors.contactEmail;
            break;
          case "contactPhone":
            if (!(value as string).trim())
              newErrors.contactPhone = "Contact phone is required";
            else if (!phoneRegex.test(value as string))
              newErrors.contactPhone = "Must be 10-14 digits";
            else delete newErrors.contactPhone;
            break;
          case "organizingDept":
            if (!(value as string).trim())
              newErrors.organizingDept = "Organizing department is required";
            else if ((value as string).length > 100)
              newErrors.organizingDept = "Max 100 characters";
            else delete newErrors.organizingDept;
            break;
        }
      }
      setErrors(newErrors);
    },
    [errors, formData.openingDate, formData.closingDate, isEditMode] // Use prop isEditMode here
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors((prev) => ({ ...prev, submit: undefined }));

    const currentValidationErrors: Record<string, string | undefined> = {};
    const fieldsToValidate: (keyof CreateFestState)[] = [
      "title",
      "openingDate",
      "closingDate",
      "detailedDescription",
      "department",
      "category",
      "contactEmail",
      "contactPhone",
      "organizingDept",
    ];

    const validateSync = (name: string, value: any) => {
      const currentDate = new Date(currentDateRef.current);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?[\d\s-]{10,14}$/;
      let errorMsg: string | undefined = undefined;
      switch (name) {
        case "title":
          if (!String(value).trim()) errorMsg = "Fest title is required";
          else if (String(value).length > 100) errorMsg = "Max 100 characters";
          break;
        case "openingDate":
        case "closingDate":
          const dateType = name === "openingDate" ? "Opening" : "Closing";
          if (!String(value).trim()) errorMsg = `${dateType} date is required`;
          else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))
            errorMsg = "Format YYYY-MM-DD";
          else {
            const inputDate = parseYYYYMMDD(String(value));
            if (!inputDate) errorMsg = "Invalid date value";
            else if (
              inputDate < currentDate &&
              !isEditMode &&
              name === "openingDate"
            )
              errorMsg = `${dateType} must be on or after today`;
            else if (
              name === "closingDate" &&
              formData.openingDate &&
              parseYYYYMMDD(formData.openingDate)
            ) {
              if (inputDate < parseYYYYMMDD(formData.openingDate)!)
                errorMsg = "Must be on/after opening date";
            }
          }
          if (
            name === "openingDate" &&
            formData.closingDate &&
            parseYYYYMMDD(String(value)) &&
            parseYYYYMMDD(formData.closingDate) &&
            parseYYYYMMDD(String(value))! > parseYYYYMMDD(formData.closingDate)!
          ) {
            if (!currentValidationErrors.closingDate)
              currentValidationErrors.closingDate =
                "Closing date must be on/after opening date";
          }
          break;
        case "detailedDescription":
          if (!String(value).trim()) errorMsg = "Description is required";
          else if (String(value).length > 1000)
            errorMsg = "Max 1000 characters";
          break;
        case "department":
          if (!Array.isArray(value) || value.length === 0)
            errorMsg = "Select at least one department";
          break;
        case "category":
          if (!String(value).trim()) errorMsg = "Category is required";
          break;
        case "contactEmail":
          if (!String(value).trim()) errorMsg = "Contact email is required";
          else if (!emailRegex.test(String(value)))
            errorMsg = "Invalid email format";
          break;
        case "contactPhone":
          if (!String(value).trim()) errorMsg = "Contact phone is required";
          else if (!phoneRegex.test(String(value)))
            errorMsg = "Must be 10-14 digits";
          break;
        case "organizingDept":
          if (!String(value).trim())
            errorMsg = "Organizing department is required";
          else if (String(value).length > 100) errorMsg = "Max 100 characters";
          break;
      }
      if (errorMsg) currentValidationErrors[name] = errorMsg;
    };

    fieldsToValidate.forEach((field) => validateSync(field, formData[field]));
    formData.eventHeads.forEach((head, index) => {
      if (head.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(head)) {
        currentValidationErrors[`eventHead_${index}`] = "Invalid email format.";
      } else if (head.length > 100) {
        currentValidationErrors[`eventHead_${index}`] = "Max 100 chars.";
      }
    });

    if (!imageFile && !isEditMode && !existingImageFileUrl) {
      currentValidationErrors.imageFile = "Fest image is required";
    } else if (imageFile) {
      if (imageFile.size > 3 * 1024 * 1024)
        currentValidationErrors.imageFile = "Image file must be less than 3MB";
      else if (!["image/jpeg", "image/png"].includes(imageFile.type))
        currentValidationErrors.imageFile = "Invalid file type. JPG/PNG only.";
    }

    if (
      Object.keys(currentValidationErrors).some(
        (key) => currentValidationErrors[key] !== undefined
      )
    ) {
      setErrors(currentValidationErrors);
      setErrors((prev) => ({
        ...prev,
        submit: "Please correct the errors in the form.",
      }));
      return;
    }

    setIsSubmitting(true);
    let uploadedFestImageUrl: string | null = null;

    if (imageFile && supabase) {
      setIsUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("file", imageFile);
        
        // Use the server's file upload API instead of Supabase storage
        const uploadResponse = await fetch(`${API_URL}/api/upload/fest-image`, {
          method: 'POST',
          body: formData,
          headers: {
            // No Content-Type header as it's set automatically for FormData
            'Authorization': `Bearer ${session?.access_token}`
          },
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image to server');
        }
        
        const uploadResult = await uploadResponse.json();
        
        if (!uploadResult || !uploadResult.url) {
          throw new Error("Failed to get URL for the uploaded image.");
        }
        
        // Use the URL returned from our server API
        uploadedFestImageUrl = uploadResult.url;
      } catch (uploadError: any) {
        setErrors((prev) => ({
          ...prev,
          submit: `Image upload failed: ${uploadError.message}. Please try again.`,
        }));
        setIsSubmitting(false);
        setIsUploadingImage(false);
        return;
      }
      setIsUploadingImage(false);
    } else if (isEditMode && existingImageFileUrl && !imageFile) {
    } else if (!imageFile && !isEditMode) {
      setErrors((prev) => ({
        ...prev,
        submit: "Fest image is required for new fests.",
      }));
      setIsSubmitting(false);
      return;
    }

    try {
      if (!session) throw new Error("You must be logged in.");

      const payload: any = {
        festTitle: formData.title,
        openingDate: formData.openingDate,
        closingDate: formData.closingDate,
        detailedDescription: formData.detailedDescription,
        departmentAccess: formData.department,
        category: formData.category,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        eventHeads: formData.eventHeads.filter((head) => head.trim() !== ""),
        organizingDept: formData.organizingDept,
      };

      if (uploadedFestImageUrl || existingImageFileUrl) {
        payload.festImageUrl = uploadedFestImageUrl || existingImageFileUrl;
      }

      let response;
      if (isEditMode && festIdFromPath) {
        response = await fetch(
          `${API_URL}/api/fests/${festIdFromPath}`,
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
        response = await fetch(`${API_URL}/api/fests`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            `Failed to ${isEditMode ? "update" : "create"} fest.` // Use prop isEditMode here
        );
      }

      setIsModalOpen(true);
    } catch (error: any) {
      setErrors((prev) => ({ ...prev, submit: error.message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      if (file.size > 3 * 1024 * 1024)
        setErrors((prev) => ({ ...prev, imageFile: "Max 3MB" }));
      else if (!["image/jpeg", "image/png"].includes(file.type))
        setErrors((prev) => ({ ...prev, imageFile: "JPG/PNG only" }));
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
  const handleInputBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => validateField(e.target.id, e.target.value);
  const handleDateChange = (
    name: "openingDate" | "closingDate",
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    validateField(name, value);
  };
  const handleDateBlur = (name: "openingDate" | "closingDate") =>
    validateField(name, formData[name]);
  const handleEventHeadChange = (index: number, value: string) => {
    const newEventHeads = [...formData.eventHeads];
    newEventHeads[index] = value;
    setFormData((prev) => ({ ...prev, eventHeads: newEventHeads }));
  };
  const handleEventHeadBlur = (index: number) =>
    validateField(`eventHead_${index}`, {
      index,
      eventHead: formData.eventHeads[index],
    });
  const addEventHead = () => {
    if (formData.eventHeads.length < 5)
      setFormData((prev) => ({
        ...prev,
        eventHeads: [...prev.eventHeads, ""],
      }));
  };
  const removeEventHead = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      eventHeads: prev.eventHeads.filter((_, i) => i !== index),
    }));
    setErrors((prev) => {
      const newE = { ...prev };
      delete newE[`eventHead_${index}`];
      return newE;
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

  const finalIsEditMode = isEditMode || isEditModeFromPath;

  const showMainLoader = (isLoadingFestData && finalIsEditMode) || isNavigating;
  const mainLoaderText = isLoadingFestData
    ? "Loading fest details..."
    : isNavigating
    ? "Deleting fest..."
    : "";

  return (
    <div className="min-h-screen bg-white relative">
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center px-4 transition-opacity duration-300 ease-in-out"
          style={{ opacity: isModalOpen ? 1 : 0 }}
        >
          <div
            className="bg-white rounded-xl p-6 sm:p-8 max-w-lg w-full shadow-2xl transform transition-all duration-300 ease-out"
            style={{
              opacity: isModalOpen ? 1 : 0,
              transform: isModalOpen ? "scale(1)" : "scale(0.95)",
            }}
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
                Fest {finalIsEditMode ? "Updated" : "Published"}!
              </h2>
              <p
                id="modal-description"
                className="text-gray-500 mb-8 text-sm sm:text-base px-4"
              >
                Your fest has been successfully{" "}
                {finalIsEditMode ? "updated" : "published"}.<br />
                What would you like to do next?
              </p>
            </div>
            <div className="flex flex-col sm:flex-row-reverse sm:justify-center gap-3">
              {!finalIsEditMode && (
                <Link
                  href={`/create/event`}
                  className="w-full sm:w-auto px-6 py-3 bg-[#FFCC00] text-[#063168] rounded-lg font-medium hover:bg-opacity-90 transition-all duration-150 ease-in-out text-center text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:ring-offset-2 flex items-center justify-center"
                  onClick={() => setIsModalOpen(false)}
                >
                  Add an event to fest
                </Link>
              )}
              <Link
                href="/manage"
                className="w-full sm:w-auto px-6 py-3 bg-transparent text-[#154CB3] rounded-lg font-medium hover:bg-blue-50 transition-all duration-150 ease-in-out text-center text-sm sm:text-base border-2 border-[#154CB3] focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2"
                onClick={() => setIsModalOpen(false)}
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
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 md:p-10 shadow-sm">
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
                      aria-invalid={!!errors.title}
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
                    aria-invalid={!!errors.detailedDescription}
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
                <DepartmentAndCategoryInputs
                  formData={formData}
                  errors={errors}
                  setFormData={setFormData}
                  validateField={validateField}
                />
                <div>
                  <label
                    htmlFor="organizingDept"
                    className="block mb-2 text-sm font-medium text-gray-700"
                  >
                    Organizing department:{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="organizingDept"
                    placeholder="Enter organizing department"
                    value={formData.organizingDept}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    required
                    aria-invalid={!!errors.organizingDept}
                    aria-describedby={
                      errors.organizingDept ? "organizingDept-error" : undefined
                    }
                    className={`w-full px-4 py-3 sm:py-3.5 rounded-lg border ${
                      errors.organizingDept
                        ? "border-red-500"
                        : "border-gray-300"
                    } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all text-sm sm:text-base`}
                  />
                  {errors.organizingDept && (
                    <p
                      id="organizingDept-error"
                      className="text-red-500 text-xs mt-1"
                    >
                      {errors.organizingDept}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Fest image: <span className="text-red-500">*</span> (max
                    3MB, JPG/PNG)
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
                          className="text-blue-600 hover:text-blue-800 underline text-sm font-medium mb-3 inline-block"
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
                      accept="image/jpeg,image/png"
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
                      aria-invalid={!!errors.contactEmail}
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
                      aria-invalid={!!errors.contactPhone}
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
                <div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6">
                    <div className="flex items-center mb-4 sm:mb-0">
                      <div className="bg-[#FFCC00] rounded-full w-8 h-8 flex items-center justify-center mr-3 shrink-0">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="size-4 text-[#063168]"
                        >
                          <path d="M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.156 11.763c.16-.629.44-1.21.813-1.72a2.5 2.5 0 0 0-2.725 1.377c-.136.287.102.58.418.58h1.449c.01-.077.025-.156.045-.237ZM12.847 11.763c.02.08.036.16.046.237h1.446c.316 0 .554-.293.417-.579a2.5 2.5 0 0 0-2.722-1.378c.374.51.653 1.09.813 1.72ZM14 7.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM3.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM5 13c-.552 0-1.013-.455-.876-.99a4.002 4.002 0 0 1 7.753 0c.136.535-.324.99-.877.99H5Z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-[#063168]">
                          Event heads: (optional, max 5)
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500">
                          Add event head emails
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={addEventHead}
                      disabled={formData.eventHeads.length >= 5}
                      className="bg-[#063168] p-3 rounded-full text-white cursor-pointer"
                    >
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </button>
                  </div>
                  {formData.eventHeads.map((eventHead, index) => (
                    <div key={index} className="mb-4 relative">
                      <input
                        type="email"
                        placeholder="Enter event head email"
                        value={eventHead}
                        onChange={(e) =>
                          handleEventHeadChange(index, e.target.value)
                        }
                        onBlur={() => handleEventHeadBlur(index)}
                        aria-invalid={!!errors[`eventHead_${index}`]}
                        aria-describedby={
                          errors[`eventHead_${index}`]
                            ? `eventHead-error-${index}`
                            : undefined
                        }
                        className={`w-full px-4 py-3 sm:py-3.5 rounded-lg border pr-10 ${
                          errors[`eventHead_${index}`]
                            ? "border-red-500"
                            : "border-gray-300"
                        } focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all text-sm sm:text-base`}
                      />
                      <button
                        type="button"
                        onClick={() => removeEventHead(index)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 rounded-full cursor-pointer"
                        aria-label={`Remove event head ${index + 1}`}
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
                      {errors[`eventHead_${index}`] && (
                        <p
                          id={`eventHead-error-${index}`}
                          className="text-red-500 text-xs mt-1"
                        >
                          {errors[`eventHead_${index}`]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {errors.submit && (
                  <p className="text-red-500 text-sm mt-4 bg-red-50 p-3 rounded-md">
                    {errors.submit}
                  </p>
                )}
                <div className="flex items-center justify-end space-x-3 mt-8 sm:mt-10 pt-6 border-t border-gray-200">
                  <Link
                    href="/manage"
                    className="px-4 sm:px-5 py-2 sm:py-3 rounded-full border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                  >
                    Cancel
                  </Link>
                  {finalIsEditMode && (
                    <button
                      type="button"
                      onClick={deleteFest}
                      disabled={isNavigating || isSubmitting}
                      className="cursor-pointer px-4 sm:px-5 py-2 sm:py-3 rounded-full border bg-[#f93232] border-red-400 font-medium text-white hover:bg-[#f93232de] transition-colors text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isNavigating && (
                        <svg
                          className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
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
                      )}
                      {isNavigating ? "Deleting..." : "Delete fest"}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      isNavigating ||
                      (imageFile && !supabase && !finalIsEditMode) ||
                      false
                    }
                    className={`cursor-pointer px-4 sm:px-6 py-2 sm:py-3 bg-[#154CB3] text-white rounded-full font-medium hover:bg-[#154cb3eb] transition-colors text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                      isSubmitting ||
                      isNavigating ||
                      (imageFile && !supabase && !finalIsEditMode)
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    {(isSubmitting || isUploadingImage) && (
                      <svg
                        className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
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
                    )}
                    {isUploadingImage
                      ? "Uploading image..."
                      : isSubmitting
                      ? finalIsEditMode
                        ? "Updating..."
                        : "Publishing..."
                      : finalIsEditMode
                      ? "Update fest"
                      : "Publish fest"}
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

export default CreateFestForm;
