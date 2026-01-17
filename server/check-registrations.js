import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://vkappuaapscvteexogtp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRegistrations() {
  console.log('📝 Checking Registrations in Detail...\n');
  
  const { data: regs, error } = await supabase
    .from('registrations')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Total registrations: ${regs.length}\n`);
  
  regs.forEach((reg, index) => {
    console.log(`${index + 1}. Registration ID: ${reg.registration_id}`);
    console.log(`   Event ID: ${reg.event_id}`);
    console.log(`   User Email: ${reg.user_email}`);
    console.log(`   Type: ${reg.registration_type}`);
    console.log(`   Name: ${reg.individual_name || reg.team_name || 'N/A'}`);
    console.log(`   Created: ${reg.created_at}`);
    console.log('');
  });
}

checkRegistrations();
