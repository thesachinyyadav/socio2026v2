import { formatDateFull } from "@/lib/dateUtils";

const FEST_PREVIEW_STORAGE_PREFIX = "__fest_preview_draft__:";
const FEST_PREVIEW_TTL_MS = 12 * 60 * 60 * 1000;

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const toCleanString = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim() : "";

const toPositiveInt = (value: string | null | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(1, Math.floor(parsed));
  }
  return fallback;
};

const getFallbackFestImage = (): string =>
  process.env.NEXT_PUBLIC_EVENT_BANNER_PLACEHOLDER_URL ||
  process.env.NEXT_PUBLIC_EVENT_IMAGE_PLACEHOLDER_URL ||
  "";

const normalizeTimeline = (
  value: Array<{ time: string; title: string; description: string }> | undefined
): Array<{ time: string; title: string; description: string }> | undefined => {
  const normalized = (value || [])
    .map((item) => ({
      time: toCleanString(item?.time),
      title: toCleanString(item?.title),
      description: toCleanString(item?.description),
    }))
    .filter((item) => item.time || item.title || item.description);

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeSponsors = (
  value: Array<{ name: string; logo_url: string; website?: string }> | undefined
): Array<{ name: string; logo_url: string; website?: string }> | undefined => {
  const normalized = (value || [])
    .map((item) => {
      const name = toCleanString(item?.name);
      const logoUrl = toCleanString(item?.logo_url);
      const website = toCleanString(item?.website);
      return {
        name,
        logo_url: logoUrl,
        website: website || undefined,
      };
    })
    .filter((item) => item.name || item.logo_url || item.website);

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeSocialLinks = (
  value: Array<{ platform: string; url: string }> | undefined
): Array<{ platform: string; url: string }> | undefined => {
  const normalized = (value || [])
    .map((item) => ({
      platform: toCleanString(item?.platform),
      url: toCleanString(item?.url),
    }))
    .filter((item) => item.platform || item.url);

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeFaqs = (
  value: Array<{ question: string; answer: string }> | undefined
): Array<{ question: string; answer: string }> | undefined => {
  const normalized = (value || [])
    .map((item) => ({
      question: toCleanString(item?.question),
      answer: toCleanString(item?.answer),
    }))
    .filter((item) => item.question || item.answer);

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeEventHeads = (
  value: Array<{ email: string; expiresAt: string | null }> | undefined
): Array<{ email: string; expiresAt: string | null }> | undefined => {
  const normalized = (value || [])
    .map((item) => ({
      email: toCleanString(item?.email),
      expiresAt: toCleanString(item?.expiresAt || "") || null,
    }))
    .filter((item) => item.email.length > 0);

  return normalized.length > 0 ? normalized : undefined;
};

const makeDraftStorageKey = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getStorageItemKey = (draftKey: string): string =>
  `${FEST_PREVIEW_STORAGE_PREFIX}${draftKey}`;

interface StoredFestPreviewDraft {
  version: 1;
  createdAt: number;
  data: FestPreviewData;
}

export interface FestPreviewFormInput {
  title: string;
  openingDate: string;
  closingDate: string;
  detailedDescription: string;
  organizingSchool: string;
  organizingDept: string;
  category: string;
  contactEmail: string;
  contactPhone: string;
  eventHeads: Array<{ email: string; expiresAt: string | null }>;
  venue: string;
  timeline: Array<{ time: string; title: string; description: string }>;
  sponsors: Array<{ name: string; logo_url: string; website?: string }>;
  social_links: Array<{ platform: string; url: string }>;
  faqs: Array<{ question: string; answer: string }>;
  isTeamEvent: boolean;
  minParticipants: string;
  maxParticipants: string;
  campusHostedAt: string;
  allowedCampuses: string[];
  allowOutsiders: boolean;
  imageFile: File | null;
}

export interface FestPreviewData {
  id: string;
  sourcePath?: string;
  title: string;
  description: string;
  organizingSchool: string;
  organizingDept: string;
  category?: string;
  openingDate: string;
  closingDate: string;
  venue?: string;
  image: string;
  contactEmail?: string;
  contactPhone?: string;
  eventHeads?: Array<{ email: string; expiresAt: string | null }>;
  timeline?: Array<{ time: string; title: string; description: string }>;
  sponsors?: Array<{ name: string; logo_url: string; website?: string }>;
  socialLinks?: Array<{ platform: string; url: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  isTeamEvent: boolean;
  minParticipants: number;
  maxParticipants: number;
  campusHostedAt?: string;
  allowedCampuses?: string[];
  allowOutsiders: boolean;
}

export interface BuildFestPreviewOptions {
  formData: FestPreviewFormInput;
  sourcePath?: string;
  existingImageFileUrl?: string | null;
}

export const cleanupExpiredFestPreviewDrafts = (): void => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(FEST_PREVIEW_STORAGE_PREFIX)) {
      continue;
    }

    try {
      const rawValue = window.localStorage.getItem(key);
      if (!rawValue) {
        window.localStorage.removeItem(key);
        continue;
      }

      const parsed = JSON.parse(rawValue) as Partial<StoredFestPreviewDraft>;
      if (
        typeof parsed.createdAt !== "number" ||
        now - parsed.createdAt > FEST_PREVIEW_TTL_MS
      ) {
        window.localStorage.removeItem(key);
      }
    } catch {
      window.localStorage.removeItem(key);
    }
  }
};

export const buildFestPreviewData = (
  options: BuildFestPreviewOptions
): FestPreviewData => {
  const { formData, sourcePath, existingImageFileUrl } = options;

  const selectedImageUrl = formData.imageFile
    ? URL.createObjectURL(formData.imageFile)
    : null;

  const imageCandidates = [
    selectedImageUrl,
    toCleanString(existingImageFileUrl || "") || null,
    getFallbackFestImage() || null,
  ];

  const image =
    imageCandidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.trim().length > 0
    ) || "";

  const rawMin = toPositiveInt(formData.minParticipants, formData.isTeamEvent ? 2 : 1);
  const rawMax = toPositiveInt(formData.maxParticipants, formData.isTeamEvent ? 2 : 1);

  const maxParticipants = formData.isTeamEvent
    ? Math.max(2, rawMax, rawMin)
    : 1;
  const minParticipants = formData.isTeamEvent
    ? Math.min(Math.max(2, rawMin), maxParticipants)
    : 1;

  const allowedCampuses = (formData.allowedCampuses || [])
    .map((campus) => toCleanString(campus))
    .filter((campus) => campus.length > 0);

  const normalizedOpeningDate = toCleanString(formData.openingDate);
  const normalizedClosingDate =
    toCleanString(formData.closingDate) || normalizedOpeningDate;

  const previewId =
    toSlug(toCleanString(formData.title)) || `fest-preview-${Date.now()}`;

  return {
    id: previewId,
    sourcePath,
    title: toCleanString(formData.title) || "Untitled Fest",
    description:
      toCleanString(formData.detailedDescription) || "No description provided.",
    organizingSchool: toCleanString(formData.organizingSchool) || "General",
    organizingDept: toCleanString(formData.organizingDept) || "General",
    category: toCleanString(formData.category) || undefined,
    openingDate: formatDateFull(normalizedOpeningDate, "Date TBD"),
    closingDate: formatDateFull(normalizedClosingDate, "Date TBD"),
    venue: toCleanString(formData.venue) || undefined,
    image,
    contactEmail: toCleanString(formData.contactEmail) || undefined,
    contactPhone: toCleanString(formData.contactPhone) || undefined,
    eventHeads: normalizeEventHeads(formData.eventHeads),
    timeline: normalizeTimeline(formData.timeline),
    sponsors: normalizeSponsors(formData.sponsors),
    socialLinks: normalizeSocialLinks(formData.social_links),
    faqs: normalizeFaqs(formData.faqs),
    isTeamEvent: Boolean(formData.isTeamEvent),
    minParticipants,
    maxParticipants,
    campusHostedAt: toCleanString(formData.campusHostedAt) || undefined,
    allowedCampuses: allowedCampuses.length > 0 ? allowedCampuses : undefined,
    allowOutsiders: Boolean(formData.allowOutsiders),
  };
};

export const saveFestPreviewDraft = (draftData: FestPreviewData): string => {
  if (typeof window === "undefined") {
    throw new Error("Preview drafts can only be saved in the browser.");
  }

  cleanupExpiredFestPreviewDrafts();

  const draftKey = makeDraftStorageKey();
  const storedDraft: StoredFestPreviewDraft = {
    version: 1,
    createdAt: Date.now(),
    data: draftData,
  };

  window.localStorage.setItem(
    getStorageItemKey(draftKey),
    JSON.stringify(storedDraft)
  );

  return draftKey;
};

export const getFestPreviewDraft = (draftKey: string): FestPreviewData | null => {
  if (typeof window === "undefined") return null;
  if (!draftKey) return null;

  cleanupExpiredFestPreviewDrafts();

  const storageValue = window.localStorage.getItem(getStorageItemKey(draftKey));
  if (!storageValue) return null;

  try {
    const parsed = JSON.parse(storageValue) as Partial<StoredFestPreviewDraft>;
    if (!parsed || typeof parsed.createdAt !== "number" || !parsed.data) {
      return null;
    }

    if (Date.now() - parsed.createdAt > FEST_PREVIEW_TTL_MS) {
      window.localStorage.removeItem(getStorageItemKey(draftKey));
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
};
