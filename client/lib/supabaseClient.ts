import { createClient } from '@supabase/supabase-js';

/**
 * IMPORTANT: This Supabase client is ONLY used for authentication purposes.
 * All data operations should use the SQLite database through the server API.
 * No direct database operations should be performed with Supabase.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.key';

// Validate that we have proper Supabase configuration
if (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder')) {
  console.warn('⚠️ Warning: Using placeholder Supabase configuration. Please update your environment variables with actual Supabase project values.');
}

// Create Supabase client for authentication ONLY
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;