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

// Custom field schema for event organizers
export const customFieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Label is required"),
  type: z.enum(["text", "url", "email", "number", "select", "textarea"]),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

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
    endDate: z.string().min(1, "End date is required"),
    detailedDescription: z
      .string()
      .min(1, "Description is required")
      .max(1000, "Max 1000 chars"),
    department: z
      .array(z.string())
      .min(1, "At least one department is required"),
    organizingDept: z.string().min(1, "Organizing department is required"),
    category: z.string().min(1, "Category is required"),
    festEvent: z.string().optional(),
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
  );

// TypeScript type inferred from schema
// Note: imageFile, bannerFile, and pdfFile are FileList | null (browser native type)
export type EventFormData = z.infer<typeof eventFormSchema>;
export type ScheduleItem = z.infer<typeof scheduleItemSchema>;

export const departments = [
  {
    value: "all_departments",
    label: "All Departments",
  },
  {
    value: "dept_business_management_bba",
    label: "Department of Business and Management (BBA)",
  },
  {
    value: "dept_business_management_mba",
    label: "Department of Business and Management (MBA)",
  },
  { value: "dept_hotel_management", label: "Department of Hotel Management" },
  { value: "dept_commerce", label: "Department of Commerce" },
  {
    value: "dept_professional_studies",
    label: "Department of Professional Studies",
  },
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
  { value: "dept_theatre_studies", label: "Department of Theatre Studies" },
  { value: "dept_school_of_law", label: "Department of School of Law" },
  { value: "dept_psychology", label: "Department of Psychology" },
  { value: "dept_school_of_education", label: "Department of School of Education" },
  { value: "dept_social_work", label: "Department of Social Work" },
  { value: "dept_chemistry", label: "Department of Chemistry" },
  { value: "dept_computer_science", label: "Department of Computer Science" },
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
    label: "Department of International Studies, Political Science and History",
  },
  { value: "dept_media_studies", label: "Department of Media Studies" },
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
