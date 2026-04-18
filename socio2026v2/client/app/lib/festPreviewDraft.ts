const FEST_PREVIEW_DRAFT_KEY = "fest-preview-draft";

type BuildFestPreviewInput = {
  formData: unknown;
  sourcePath?: string;
  existingImageFileUrl?: string | null;
};

export type FestPreviewDraft = ReturnType<typeof buildFestPreviewData>;

export function buildFestPreviewData(input: BuildFestPreviewInput) {
  return {
    ...input,
    createdAt: Date.now(),
  };
}

export function saveFestPreviewDraft(draft: FestPreviewDraft): string {
  if (typeof window === "undefined") {
    return "server";
  }

  const draftKey = `${FEST_PREVIEW_DRAFT_KEY}-${Date.now().toString(36)}`;
  window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
  return draftKey;
}
