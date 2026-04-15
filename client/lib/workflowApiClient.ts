const RETRYABLE_STATUS_CODES = new Set([404, 405, 502, 503, 504]);

const KNOWN_WORKFLOW_API_ORIGINS = [
  "https://socioserver-snowy.vercel.app",
  "https://sociodevserver.vercel.app",
] as const;

function normalizeApiOrigin(rawValue: string | undefined): string {
  const value = String(rawValue || "").trim();
  if (!value) {
    return "";
  }

  return value.replace(/\/+$/, "").replace(/(\/api)+$/i, "");
}

function normalizePath(path: string): string {
  const rawPath = String(path || "").trim();
  const withLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

  if (withLeadingSlash === "/api" || withLeadingSlash.startsWith("/api/")) {
    return withLeadingSlash;
  }

  return `/api${withLeadingSlash}`;
}

function shouldRetryWithNextOrigin(statusCode: number): boolean {
  return RETRYABLE_STATUS_CODES.has(statusCode);
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function resolveWorkflowApiOrigins(): string[] {
  const envOrigins = [
    process.env.NEXT_PUBLIC_API_URL,
    process.env.API_URL,
    process.env.SERVER_API_URL,
    process.env.BACKEND_API_URL,
    process.env.NEXT_PUBLIC_SERVER_API_URL,
  ].map((value) => normalizeApiOrigin(value));

  const uniqueOrigins = new Set<string>();

  envOrigins
    .filter((origin) => origin.length > 0)
    .forEach((origin) => uniqueOrigins.add(origin));

  KNOWN_WORKFLOW_API_ORIGINS
    .map((origin) => normalizeApiOrigin(origin))
    .filter((origin) => origin.length > 0)
    .forEach((origin) => uniqueOrigins.add(origin));

  return Array.from(uniqueOrigins);
}

export async function fetchWorkflowApiWithFailover(
  routePath: string,
  options: RequestInit,
  timeoutMs = 20000
): Promise<{ response: Response; apiBaseUrl: string; targetUrl: string }> {
  const apiOrigins = resolveWorkflowApiOrigins();

  if (apiOrigins.length === 0) {
    throw new Error("Workflow API URL is not configured.");
  }

  const normalizedPath = normalizePath(routePath);
  let lastError: Error | null = null;

  for (let index = 0; index < apiOrigins.length; index += 1) {
    const apiBaseUrl = apiOrigins[index];
    const targetUrl = `${apiBaseUrl}${normalizedPath}`;

    try {
      const response = await fetchWithTimeout(
        targetUrl,
        {
          ...options,
          cache: options.cache || "no-store",
        },
        timeoutMs
      );

      const isLastOrigin = index === apiOrigins.length - 1;

      if (response.ok || !shouldRetryWithNextOrigin(response.status) || isLastOrigin) {
        return { response, apiBaseUrl, targetUrl };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Failed to call workflow API");

      if (index === apiOrigins.length - 1) {
        throw lastError;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Unable to reach workflow API.");
}
