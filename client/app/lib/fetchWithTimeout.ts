/**
 * Utility function to fetch with timeout and retry logic for 5xx errors.
 * Prevents requests from hanging indefinitely.
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @param maxRetries - Maximum number of retries for 5xx errors (default: 1)
 * @returns Fetch response
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000,
  maxRetries: number = 1
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Retry on 5xx errors
        if (response.status >= 500 && attempt < maxRetries) {
          lastError = new Error(`Server error ${response.status}, retrying...`);
          continue;
        }

        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new Error(`Request timeout after ${timeoutMs}ms`);
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      if (attempt < maxRetries) {
        continue;
      }
    }
  }

  throw lastError || new Error("Request failed");
}
