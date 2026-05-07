const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

const ERROR_RULES: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /(no valid authorization token|invalid or expired token|token validation|authentication required|user not authenticated|session)/i,
    message: "Please sign in again.",
  },
  {
    pattern: /(permission|unauthorized|forbidden|access denied|privileges required|not authorized)/i,
    message: "You do not have permission to perform this action.",
  },
  {
    pattern: /(not found|does not exist|already deleted|missing)/i,
    message: "Item not found - it may have been removed.",
  },
  {
    pattern: /(file too large|size must be less than|max size|payload too large)/i,
    message: "The file is too large. Please choose a smaller file.",
  },
  {
    pattern: /(invalid file type|unsupported file type|not supported)/i,
    message: "That file type is not supported. Please choose another file.",
  },
  {
    pattern: /(network|fetch failed|timeout|econnrefused|ehostunreach|enetunreach)/i,
    message: "No internet connection. Please try again.",
  },
  {
    pattern: /(already exists|duplicate|conflict|already assigned|already submitted|already sent|already used|already updated)/i,
    message: "This item already exists or has already been updated.",
  },
  {
    pattern: /(required|must be|invalid|empty string|missing)/i,
    message: "Please check your input and try again.",
  },
];

function extractErrorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";

  const candidate = error as { message?: unknown; error?: unknown; details?: unknown };
  if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message.trim();
  if (typeof candidate.error === "string" && candidate.error.trim()) return candidate.error.trim();
  if (typeof candidate.details === "string" && candidate.details.trim()) return candidate.details.trim();
  return "";
}

export function getUserFriendlyErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  const rawMessage = extractErrorText(error);
  if (!rawMessage) return fallback;

  for (const rule of ERROR_RULES) {
    if (rule.pattern.test(rawMessage)) {
      return rule.message;
    }
  }

  return fallback;
}
