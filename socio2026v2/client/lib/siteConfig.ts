/**
 * Central site configuration — avoids hardcoding URLs across the codebase.
 * Set NEXT_PUBLIC_APP_URL in your .env / Vercel env-vars to override.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL!;
