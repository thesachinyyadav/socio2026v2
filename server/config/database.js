import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://vkappuaapscvteexogtp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required - using fallback');
}

// Create Supabase client with service role key for full access
const supabase = createClient(supabaseUrl, supabaseServiceKey || 'dummy-key-for-build');

// Initialize database - just verify connection for Supabase
export async function initializeDatabase() {
  try {
    console.log('🔍 Connecting to Supabase...');
    
    // Test connection by querying users table
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Supabase connection successful');
    console.log(`📍 Connected to: ${supabaseUrl}`);
    
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error.message);
    throw error;
  }
}

// Helper function to execute queries - returns all rows
export async function queryAll(table, options = {}) {
  let query = supabase.from(table).select(options.select || '*');
  
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
  
  if (error) {
    throw error;
  }
  
  return data || [];
}

// Helper function to execute queries - returns single row
export async function queryOne(table, options = {}) {
  let query = supabase.from(table).select(options.select || '*');
  
  if (options.where) {
    for (const [key, value] of Object.entries(options.where)) {
      query = query.eq(key, value);
    }
  }
  
  const { data, error } = await query.single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error;
  }
  
  return data || null;
}

// Helper function to insert data
export async function insert(table, data) {
  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select();
  
  if (error) {
    throw error;
  }
  
  return result;
}

// Helper function to update data
export async function update(table, data, where) {
  let query = supabase.from(table).update(data);
  
  for (const [key, value] of Object.entries(where)) {
    query = query.eq(key, value);
  }
  
  const { data: result, error } = await query.select();
  
  if (error) {
    throw error;
  }
  
  return result;
}

// Helper function to upsert data
export async function upsert(table, data, onConflict = 'id') {
  const { data: result, error } = await supabase
    .from(table)
    .upsert(data, { onConflict })
    .select();
  
  if (error) {
    throw error;
  }
  
  return result;
}

// Helper function to delete data
export async function remove(table, where) {
  let query = supabase.from(table).delete();
  
  for (const [key, value] of Object.entries(where)) {
    query = query.eq(key, value);
  }
  
  const { data: result, error } = await query.select();
  
  if (error) {
    throw error;
  }
  
  return result;
}

// Execute raw query (for complex queries) - use Supabase RPC if needed
export async function executeQuery(query, params = []) {
  // For Supabase, we use the query builder instead of raw SQL
  // This is a compatibility layer - convert common patterns
  console.warn('⚠️ executeQuery called - use Supabase query methods instead');
  return [];
}

// Export Supabase client for direct access when needed
export { supabase };

// Default export for compatibility
export default {
  supabase,
  initializeDatabase,
  queryAll,
  queryOne,
  insert,
  update,
  upsert,
  remove,
  executeQuery
};
