import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for authentication and database operations.
 * Uses @supabase/ssr for better Next.js integration.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.key';

// Validate that we have proper Supabase configuration
if (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder')) {
  console.warn('⚠️ Warning: Using placeholder Supabase configuration. Please update your environment variables with actual Supabase project values.');
}

// Create Supabase client for browser
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export default supabase;
