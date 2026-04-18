const EVENT_PREVIEW_DRAFT_KEY = "event-preview-draft";

type BuildEventPreviewInput = {
  formData: unknown;
  sourcePath?: string;
  existingImageFileUrl?: string | null;
  existingBannerFileUrl?: string | null;
  existingPdfFileUrl?: string | null;
};

export type EventPreviewDraft = ReturnType<typeof buildEventPreviewData>;

export function buildEventPreviewData(input: BuildEventPreviewInput) {
  return {
    ...input,
    createdAt: Date.now(),
  };
}

export function saveEventPreviewDraft(draft: EventPreviewDraft): string {
  if (typeof window === "undefined") {
    return "server";
  }

  const draftKey = `${EVENT_PREVIEW_DRAFT_KEY}-${Date.now().toString(36)}`;
  window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
  return draftKey;
}
