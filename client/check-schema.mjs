import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const tables = ['events', 'fests', 'users', 'registrations', 'attendance_status', 'qr_scan_logs', 'notifications'];
  
  for (const table of tables) {
    console.log(`\nChecking table: ${table}`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    
    if (error) {
      console.error(`Error querying ${table}:`, error.message);
    } else {
      console.log(`Success querying ${table}. Columns found:`);
      if (data && data.length > 0) {
        console.log(Object.keys(data[0]).join(', '));
      } else {
        console.log("Table is empty, cannot infer columns from data.");
        // Try to insert a dummy row or fetch from REST API schema if needed
      }
    }
  }
}

checkTables();
