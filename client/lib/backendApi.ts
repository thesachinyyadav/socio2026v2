const PRODUCTION_BACKEND_FALLBACKS = [
  "https://socioserver-snowy.vercel.app",
  "https://sociodevserver.vercel.app",
] as const;

export function normalizeApiBase(value: unknown): string {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/api\/?$/i, "");
}

export function parseJsonSafely(value: string): any | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function resolveBackendApiBase(options?: {
  requestOrigin?: string;
  includeProductionFallbacks?: boolean;
}): string {
  const requestOrigin = normalizeApiBase(options?.requestOrigin);
  const includeProductionFallbacks =
    typeof options?.includeProductionFallbacks === "boolean"
      ? options.includeProductionFallbacks
      : process.env.NODE_ENV === "production";

  const configuredCandidates = [
    process.env.BACKEND_API_URL,
    process.env.SERVER_API_URL,
    process.env.API_URL,
    process.env.NEXT_PUBLIC_SERVER_API_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ]
    .map((value) => normalizeApiBase(value))
    .filter(Boolean);

  const fallbackCandidates = includeProductionFallbacks
    ? PRODUCTION_BACKEND_FALLBACKS.map((value) => normalizeApiBase(value))
    : ["http://localhost:8000"];

  const uniqueCandidates = Array.from(
    new Set([...configuredCandidates, ...fallbackCandidates].filter(Boolean))
  );

  if (!requestOrigin) {
    return uniqueCandidates[0] || "";
  }

  const nonSelfCandidate = uniqueCandidates.find(
    (candidate) => candidate !== requestOrigin
  );

  return nonSelfCandidate || "";
}

export function getApiErrorMessage(
  payload: any,
  rawBody: string,
  fallbackMessage: string
): string {
  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }

  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  const trimmedBody = String(rawBody || "").trim();
  if (trimmedBody) {
    return trimmedBody;
  }

  return fallbackMessage;
}
