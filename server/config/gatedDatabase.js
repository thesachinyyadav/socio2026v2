import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// UniversityGated Supabase configuration
const gatedSupabaseUrl = process.env.GATED_SUPABASE_URL;
const gatedServiceKey = process.env.GATED_SUPABASE_SERVICE_ROLE_KEY;

if (!gatedSupabaseUrl || !gatedServiceKey) {
  console.warn('⚠️  GATED_SUPABASE_URL or GATED_SUPABASE_SERVICE_ROLE_KEY not set — Gated integration disabled');
}

// Create Supabase client for Gated DB (lazy — only connects when env vars are present)
const gatedSupabase = (gatedSupabaseUrl && gatedServiceKey)
  ? createClient(gatedSupabaseUrl, gatedServiceKey)
  : null;

/**
 * Check if the Gated integration is available
 */
export function isGatedEnabled() {
  return gatedSupabase !== null;
}

/**
 * Query all rows from a Gated table
 */
export async function gatedQueryAll(table, options = {}) {
  if (!gatedSupabase) throw new Error('Gated integration not configured');

  let query = gatedSupabase.from(table).select(options.select || '*');

  if (options.where) {
    for (const [key, value] of Object.entries(options.where)) {
      query = query.eq(key, value);
    }
  }

  if (options.order) {
    query = query.order(options.order.column, { ascending: options.order.ascending ?? true });
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Query a single row from a Gated table
 */
export async function gatedQueryOne(table, options = {}) {
  if (!gatedSupabase) throw new Error('Gated integration not configured');

  let query = gatedSupabase.from(table).select(options.select || '*');

  if (options.where) {
    for (const [key, value] of Object.entries(options.where)) {
      query = query.eq(key, value);
    }
  }

  const { data, error } = await query.single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

/**
 * Insert into a Gated table
 */
export async function gatedInsert(table, data) {
  if (!gatedSupabase) throw new Error('Gated integration not configured');

  const { data: result, error } = await gatedSupabase
    .from(table)
    .insert(data)
    .select();

  if (error) throw error;
  return result;
}

/**
 * Update rows in a Gated table
 */
export async function gatedUpdate(table, data, where) {
  if (!gatedSupabase) throw new Error('Gated integration not configured');

  let query = gatedSupabase.from(table).update(data);

  for (const [key, value] of Object.entries(where)) {
    query = query.eq(key, value);
  }

  const { data: result, error } = await query.select();
  if (error) throw error;
  return result;
}

/**
 * Upsert into a Gated table
 */
export async function gatedUpsert(table, data, onConflict = 'id') {
  if (!gatedSupabase) throw new Error('Gated integration not configured');

  const { data: result, error } = await gatedSupabase
    .from(table)
    .upsert(data, { onConflict })
    .select();

  if (error) throw error;
  return result;
}

export { gatedSupabase };

export default {
  gatedSupabase,
  isGatedEnabled,
  gatedQueryAll,
  gatedQueryOne,
  gatedInsert,
  gatedUpdate,
  gatedUpsert,
};
