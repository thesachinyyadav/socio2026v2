import { z } from "zod";

const MAX_FILE_SIZE_BANNER = 2 * 1024 * 1024; // 2MB
const MAX_FILE_SIZE_IMAGE = 3 * 1024 * 1024; // 3MB
const MAX_FILE_SIZE_PDF = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ACCEPTED_PDF_TYPES = ["application/pdf"];

const fileSchema = (
  maxSize: number,
  types: string[],
  isRequired: boolean = true
) =>
  z
    .custom<FileList>((val) => {
      // Accept FileList or null/undefined
      if (!val) return !isRequired;
      if (val instanceof FileList) return true;
      return false;
    }, "Expected a FileList")
    .superRefine((files, ctx) => {
      if (isRequired && (!files || files.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "File is required.",
        });
        return;
      }
      if (files && files.length > 0) {
        const file = files[0];
        if (file.size > maxSize) {
          ctx.addIssue({
            code: z.ZodIssueCode.too_big,
            maximum: maxSize,
            type: "array",
            inclusive: true,
            message: `Max file size is ${maxSize / (1024 * 1024)}MB.`,
          });
        }
        if (!types.includes(file.type)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unsupported file type. Accepted: ${types.join(", ")}`,
          });
        }
      }
    })
    .nullable();

export const scheduleItemSchema = z.object({
  time: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  activity: z.string().min(1, "Activity is required").max(200, "Max 200 chars"),
});

export const volunteerAssignmentSchema = z.object({
  register_number: z.string().min(1, "Register number is required"),
  expires_at: z.string().min(1, "Expiry is required"),
  assigned_by: z.string().email("Invalid assigned-by email"),
});

// Custom field schema for event organizers
export const customFieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Label is required"),
  type: z.enum(["text", "url", "email", "number", "select", "textarea"]),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export type DepartmentOption = {
  value: string;
  label: string;
};

export type SchoolDepartmentGroup = {
  school: string;
  departments: DepartmentOption[];
};

export const CLUBS_AND_CENTRES_SCHOOL = "Clubs and Centres";

export const schoolDepartmentGroups: SchoolDepartmentGroup[] = [
  {
    school: "School of Business and Management",
    departments: [
      {
        value: "dept_business_management_bba",
        label: "Department of Business and Management (BBA)",
      },
      {
        value: "dept_business_management_mba",
        label: "Department of Business and Management (MBA)",
      },
      {
        value: "dept_hotel_management",
        label: "Department of Hotel Management",
      },
    ],
  },
  {
    school: "School of Commerce Finance and Accountancy",
    departments: [
      { value: "dept_commerce", label: "Department of Commerce" },
      {
        value: "dept_professional_studies",
        label: "Department of Professional Studies",
      },
    ],
  },
  {
    school: "School of Humanities and Performing Arts",
    departments: [
      {
        value: "dept_english_cultural_studies",
        label: "Department of English and Cultural Studies",
      },
      { value: "dept_music", label: "Department of Music" },
      {
        value: "dept_performing_arts",
        label: "Department of Performing Arts",
      },
      {
        value: "dept_philosophy_theology",
        label: "Department of Philosophy and Theology",
      },
      {
        value: "dept_theatre_studies",
        label: "Department of Theatre Studies",
      },
    ],
  },
  {
    school: "School of Law",
    departments: [{ value: "dept_school_of_law", label: "Department of Law" }],
  },
  {
    school: "School of Psychological Sciences, Education and Social Work",
    departments: [
      { value: "dept_psychology", label: "Department of Psychology" },
      {
        value: "dept_school_of_education",
        label: "Department of Education",
      },
      { value: "dept_social_work", label: "Department of Social Work" },
    ],
  },
  {
    school: "School of Sciences",
    departments: [
      { value: "dept_chemistry", label: "Department of Chemistry" },
      {
        value: "dept_computer_science",
        label: "Department of Computer Science",
      },
      {
        value: "dept_life_sciences",
        label: "Department of Life Sciences",
      },
      { value: "dept_mathematics", label: "Department of Mathematics" },
      {
        value: "dept_physics_electronics",
        label: "Department of Physics and Electronics",
      },
      {
        value: "dept_statistics_data_science",
        label: "Department of Statistics and Data Science",
      },
    ],
  },
  {
    school: "School of Social Sciences",
    departments: [
      { value: "dept_economics", label: "Department of Economics" },
      {
        value: "dept_international_studies_political_science_history",
        label: "Department of International Studies, Political Science and History",
      },
      {
        value: "dept_media_studies",
        label: "Department of Media Studies",
      },
      { value: "dept_sociology", label: "Department of Sociology" },
    ],
  },
  {
    school: CLUBS_AND_CENTRES_SCHOOL,
    departments: [
      {
        value: "clubs_student_welfare_office",
        label: "Student Welfare Office",
      },
      {
        value: "clubs_national_cadet_corps",
        label: "National Cadet Corps",
      },
      {
        value: "clubs_other_centres",
        label: "Other Clubs and Centres",
      },
    ],
  },
];

const toCanonical = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");

const legacyDepartmentSchoolAliases: Record<string, string> = {
  [toCanonical("Department of School of Law")]: "School of Law",
  [toCanonical("Department of School of Education")]:
    "School of Psychological Sciences, Education and Social Work",
};

const departmentsBySchool = new Map(
  schoolDepartmentGroups.map((group) => [group.school, group.departments])
);

const allDepartmentOptions: DepartmentOption[] = schoolDepartmentGroups.flatMap(
  (group) => group.departments
);

export const organizingSchools: DepartmentOption[] = schoolDepartmentGroups.map(
  (group) => ({ value: group.school, label: group.school })
);

export const getDepartmentOptionsForSchool = (
  school: string | null | undefined
): DepartmentOption[] => {
  const normalizedSchool = String(school || "").trim();
  if (!normalizedSchool) return [];
  return departmentsBySchool.get(normalizedSchool) || [];
};

export const inferSchoolFromDepartment = (
  department: string | null | undefined
): string => {
  const normalizedDepartment = String(department || "").trim();
  if (!normalizedDepartment) return "";

  const canonicalDepartment = toCanonical(normalizedDepartment);

  for (const group of schoolDepartmentGroups) {
    const match = group.departments.some(
      (option) =>
        option.value === normalizedDepartment ||
        option.label === normalizedDepartment ||
        toCanonical(option.value) === canonicalDepartment ||
        toCanonical(option.label) === canonicalDepartment
    );

    if (match) {
      return group.school;
    }
  }

  return legacyDepartmentSchoolAliases[canonicalDepartment] || "";
};

export const isValidOrganizingDepartmentForSchool = (
  school: string | null | undefined,
  department: string | null | undefined
): boolean => {
  const normalizedSchool = String(school || "").trim();
  const normalizedDepartment = String(department || "").trim();

  if (!normalizedSchool || !normalizedDepartment) {
    return false;
  }

  if (normalizedSchool === CLUBS_AND_CENTRES_SCHOOL) {
    return normalizedDepartment.length > 0;
  }

  const schoolDepartments = getDepartmentOptionsForSchool(normalizedSchool);
  const canonicalDepartment = toCanonical(normalizedDepartment);

  if (legacyDepartmentSchoolAliases[canonicalDepartment] === normalizedSchool) {
    return true;
  }

  return schoolDepartments.some(
    (option) =>
      option.label === normalizedDepartment ||
      option.value === normalizedDepartment ||
      toCanonical(option.label) === canonicalDepartment ||
      toCanonical(option.value) === canonicalDepartment
  );
};

export const eventFormSchema = z
  .object({
    eventTitle: z
      .string()
      .min(1, "Event title is required")
      .max(100, "Max 100 chars"),
    eventDate: z.string().min(1, "Event date is required"),
    eventTime: z
      .string()
      .regex(
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Invalid time format (HH:MM)"
      ),
    endTime: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val),
        "Invalid time format (HH:MM)"
      ),
    endDate: z.string().min(1, "End date is required"),
    detailedDescription: z
      .string()
      .min(1, "Description is required")
      .max(1000, "Max 1000 chars"),
    department: z
      .array(z.string())
      .min(1, "At least one department is required"),
    organizingSchool: z.string().min(1, "Organizing school is required"),
    organizingDept: z.string().min(1, "Organizing department is required"),
    category: z.string().min(1, "Category is required"),
    festEvent: z.string().min(1, "Please select an option"),
    registrationDeadline: z.string().min(1, "Deadline is required"),
    location: z
      .string()
      .min(1, "Location is required")
      .max(200, "Max 200 chars"),
    registrationFee: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^\d+(\.\d{1,2})?$/.test(val) || val === "0",
        "Invalid fee format. Enter a number (e.g., 0, 50, 100.50)"
      )
      .transform((val) => (val === "" ? undefined : val)),
    isTeamEvent: z.boolean().default(false),
    maxParticipants: z
      .string()
      .optional()
      .refine(
        (val) => !val || (Number(val) > 0 && Number.isInteger(Number(val))),
        "Must be a positive integer"
      )
      .transform((val) => (val === "" ? undefined : val)),
    minParticipants: z
      .string()
      .optional()
      .refine(
        (val) => !val || (Number(val) > 0 && Number.isInteger(Number(val))),
        "Must be a positive integer"
      )
      .transform((val) => (val === "" ? undefined : val)),
    contactEmail: z
      .string()
      .email("Invalid email format")
      .min(1, "Contact email is required"),
    contactPhone: z
      .string()
      .regex(/^\d{10}$/, "Phone number must be 10 digits"),
    whatsappLink: z.string().url("Invalid URL").optional().or(z.literal("")),
    provideClaims: z.boolean().default(false),
    sendNotifications: z.boolean().default(false),
    onSpot: z.boolean().default(false),
    needsVolunteers: z.boolean().default(false),
    volunteers: z.array(volunteerAssignmentSchema).default([]),
    
    // Outsider registration fields
    allowOutsiders: z.boolean().default(false),
    outsiderRegistrationFee: z
      .string()
      .optional()
      .refine(
        (val) => !val || /^\d+(\.\d{1,2})?$/.test(val) || val === "0",
        "Invalid fee format. Enter a number (e.g., 0, 50, 100.50)"
      )
      .transform((val) => (val === "" ? undefined : val)),
    outsiderMaxParticipants: z
      .string()
      .optional()
      .refine(
        (val) => !val || (Number(val) > 0 && Number.isInteger(Number(val))),
        "Must be a positive integer"
      )
      .transform((val) => (val === "" ? undefined : val)),

    // Campus fields (mandatory)
    campusHostedAt: z.string().min(1, "Hosted campus is required"),
    allowedCampuses: z
      .array(z.string())
      .min(1, "Select at least one campus"),

    imageFile: fileSchema(
      MAX_FILE_SIZE_IMAGE,
      ACCEPTED_IMAGE_TYPES,
      false
    ).nullable(),
    bannerFile: fileSchema(
      MAX_FILE_SIZE_BANNER,
      ACCEPTED_IMAGE_TYPES,
      false
    ).nullable(),
    pdfFile: fileSchema(
      MAX_FILE_SIZE_PDF,
      ACCEPTED_PDF_TYPES,
      false
    ).nullable(),

    rules: z
      .array(
        z.object({
          value: z.string().min(1, "Rule cannot be empty"),
        })
      )
      .optional(),
    prizes: z
      .array(
        z.object({
          value: z.string().min(1, "Prize cannot be empty"),
        })
      )
      .optional(),

    scheduleItems: z.array(scheduleItemSchema).optional(),
    eventHeads: z.array(z.string().email("Invalid email format")).optional(),
    customFields: z.array(customFieldSchema).optional(),
  })
  .refine(
    (data) => {
      if (!data.isTeamEvent) return true;
      return !!data.maxParticipants && Number(data.maxParticipants) > 1;
    },
    {
      message: "For team events, max participants per team must be at least 2",
      path: ["maxParticipants"],
    }
  )
  .refine(
    (data) => {
      if (!data.isTeamEvent) return true;
      return !!data.minParticipants && Number(data.minParticipants) > 1;
    },
    {
      message: "For team events, min participants per team must be at least 2",
      path: ["minParticipants"],
    }
  )
  .refine(
    (data) => {
      if (!data.isTeamEvent) return true;
      if (!data.minParticipants || !data.maxParticipants) return true;
      return Number(data.minParticipants) <= Number(data.maxParticipants);
    },
    {
      message: "Min participants per team cannot exceed max participants per team",
      path: ["minParticipants"],
    }
  )
  .refine(
    (data) => {
      if (data.eventDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.eventDate);
      }
      return true;
    },
    {
      message: "End date cannot be before event date",
      path: ["endDate"],
    }
  )
  .refine(
    (data) => {
      if (!data.needsVolunteers) return true;
      return Boolean(data.endTime);
    },
    {
      message: "End time is required when volunteer access is enabled",
      path: ["endTime"],
    }
  )
  .refine(
    (data) => {
      if (!data.eventDate || !data.endDate || data.eventDate !== data.endDate) return true;
      if (!data.endTime) return true;
      return data.endTime >= data.eventTime;
    },
    {
      message: "End time cannot be before event time on the same day",
      path: ["endTime"],
    }
  )
  .refine(
    (data) => {
      if (data.endDate && data.registrationDeadline) {
        // Registration deadline must be on or before the event end date
        return new Date(data.endDate) >= new Date(data.registrationDeadline);
      }
      return true;
    },
    {
      message: "Registration deadline cannot be after the event end date",
      path: ["registrationDeadline"],
    }
  )
  .refine(
    (data) => {
      return isValidOrganizingDepartmentForSchool(
        data.organizingSchool,
        data.organizingDept
      );
    },
    {
      message: "Select a valid organizing department for the selected school",
      path: ["organizingDept"],
    }
  )
  .refine(
    (data) => data.department.length > 0,
    {
      message: "Select at least one department for access",
      path: ["department"],
    }
  );

// TypeScript type inferred from schema
// Note: imageFile, bannerFile, and pdfFile are FileList | null (browser native type)
export type EventFormData = z.infer<typeof eventFormSchema>;
export type VolunteerAssignment = z.infer<typeof volunteerAssignmentSchema>;
export type ScheduleItem = z.infer<typeof scheduleItemSchema>;

export const departments: DepartmentOption[] = [
  {
    value: "all_departments",
    label: "All Departments",
  },
  ...allDepartmentOptions,
];

export const categories = [
  { value: "academic", label: "Academic" },
  { value: "cultural", label: "Cultural" },
  { value: "sports", label: "Sports" },
  { value: "arts", label: "Arts" },
  { value: "literary", label: "Literary" },
  { value: "innovation", label: "Innovation" },
];

// Note: Fest events would be loaded dynamically via API call in components
export const festEvents = [
  { value: "", label: "Select a fest (optional)" },
  // This will be populated dynamically in the component
];

export const campusData = [
  { name: "Central Campus (Main)", lat: 12.93611753346996, lng: 77.60604219692418 },
  { name: "Bannerghatta Road Campus", lat: 12.878129156102318, lng: 77.59588398930113 },
  { name: "Yeshwanthpur Campus", lat: 13.037196562241775, lng: 77.5069922916129 },
  { name: "Kengeri Campus", lat: 12.869504452408306, lng: 77.43640503831412 },
  { name: "Delhi NCR Campus", lat: 28.86394683554733, lng: 77.35636918532354 },
  { name: "Pune Lavasa Campus", lat: 18.6221158344556, lng: 73.48047100149613 },
];

export const christCampuses = campusData.map((c) => c.name);
