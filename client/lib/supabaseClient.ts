import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for authentication and database operations.
 * Uses @supabase/ssr for better Next.js integration.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.warn('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to client/.env.local and restart Next.js. Using a placeholder Supabase client until then.');
}

const resolvedSupabaseUrl = supabaseUrl || 'https://placeholder.supabase.co';
const resolvedSupabaseAnonKey = supabaseAnonKey || 'placeholder-anon-key';

// Create Supabase client for browser
export const supabase = createBrowserClient(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
  realtime: {
    // Back off aggressively: 2s → 5s → 15s → 30s → stop retrying after 4 attempts.
    // Prevents WebSocket spam on restricted/offline networks.
    reconnectAfterMs: (tries: number) => ([2000, 5000, 15000, 30000][tries] ?? 1_800_000),
  },
});

export default supabase;
