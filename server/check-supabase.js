import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://vkappuaapscvteexogtp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSupabase() {
  console.log('📊 Checking Supabase Data...\n');
  
  // Users
  const { data: users, count: userCount } = await supabase
    .from('users')
    .select('*', { count: 'exact' });
  console.log(`👤 Users: ${userCount}`);
  if (users && users.length > 0) {
    users.slice(0, 3).forEach(u => console.log(`   - ${u.email} (${u.name})`));
  }
  
  // Events
  const { data: events, count: eventCount } = await supabase
    .from('events')
    .select('*', { count: 'exact' });
  console.log(`\n📅 Events: ${eventCount}`);
  if (events && events.length > 0) {
    events.slice(0, 3).forEach(e => console.log(`   - ${e.title}`));
  }
  
  // Registrations
  const { data: regs, count: regCount } = await supabase
    .from('registrations')
    .select('*', { count: 'exact' });
  console.log(`\n📝 Registrations: ${regCount}`);
  
  // Fests
  const { data: fests, count: festCount } = await supabase
    .from('fests')
    .select('*', { count: 'exact' });
  console.log(`\n🎉 Fests: ${festCount}`);
  
  console.log('\n✅ Supabase database check complete!');
}

checkSupabase();
