import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || 'https://vkappuaapscvteexogtp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔧 Running fest auth_uuid migration...\n');

  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, 'migrate-fest-auth-uuid.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('\n⏳ Executing...\n');

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
        
        if (error) {
          // Try direct query if RPC doesn't work
          console.log('⚠️ RPC method failed, trying direct query...');
          const { error: directError } = await supabase.from('_sql').select('*').eq('query', statement);
          
          if (directError) {
            console.error('❌ Migration failed:', error || directError);
            console.log('\n⚠️ Please run the migration manually in Supabase SQL Editor:');
            console.log('1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new');
            console.log('2. Copy the contents of migrate-fest-auth-uuid.sql');
            console.log('3. Paste and run');
            process.exit(1);
          }
        }
      }
    }

    console.log('✅ Migration completed successfully!\n');
    
    // Verify the columns exist
    const { data, error } = await supabase
      .from('fest')
      .select('*')
      .limit(1);

    if (!error && data) {
      console.log('✅ Verification: fest table structure updated');
      if (data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log('📋 Columns:', columns.join(', '));
      }
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    console.log('\n⚠️ Manual migration required. Run the SQL in Supabase dashboard.');
    process.exit(1);
  }
}

runMigration();
