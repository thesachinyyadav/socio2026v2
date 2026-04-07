import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for authentication and database operations.
 * Uses @supabase/ssr for better Next.js integration.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.warn('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Using a placeholder Supabase client until env vars are configured.');
}

const resolvedSupabaseUrl = supabaseUrl || 'https://placeholder.supabase.co';
const resolvedSupabaseAnonKey = supabaseAnonKey || 'placeholder-anon-key';

// Create Supabase client for browser
export const supabase = createBrowserClient(resolvedSupabaseUrl, resolvedSupabaseAnonKey);

export default supabase;
