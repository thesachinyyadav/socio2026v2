import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for authentication and database operations.
 * Uses @supabase/ssr for better Next.js integration.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Configure these variables before running the client.'
  );
}

// Create Supabase client for browser
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export default supabase;
