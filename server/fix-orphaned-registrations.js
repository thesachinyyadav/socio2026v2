import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://vkappuaapscvteexogtp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixOrphanedRegistrations() {
  console.log('🔧 Fixing Orphaned Registrations...\n');
  
  // Get all registrations
  const { data: allRegs } = await supabase
    .from('registrations')
    .select('registration_id, event_id, created_at');
  
  // Get all event IDs
  const { data: events } = await supabase
    .from('events')
    .select('event_id, title');
  
  const validEventIds = new Set(events.map(e => e.event_id));
  
  console.log(`Total registrations: ${allRegs.length}`);
  console.log(`Valid events: ${validEventIds.size}\n`);
  
  const orphaned = allRegs.filter(r => !validEventIds.has(r.event_id));
  
  if (orphaned.length === 0) {
    console.log('✅ No orphaned registrations found!');
    return;
  }
  
  console.log(`⚠️  Found ${orphaned.length} orphaned registrations:\n`);
  orphaned.forEach(r => {
    console.log(`   - ${r.registration_id} → event_id: "${r.event_id}"`);
  });
  
  console.log('\n📋 Checking if events exist with similar IDs...\n');
  
  for (const orphan of orphaned) {
    const similarEvents = events.filter(e => 
      e.event_id.toLowerCase().includes(orphan.event_id.toLowerCase()) ||
      orphan.event_id.toLowerCase().includes(e.event_id.toLowerCase())
    );
    
    if (similarEvents.length > 0) {
      console.log(`   Orphan: "${orphan.event_id}"`);
      console.log(`   Similar events found:`);
      similarEvents.forEach(e => {
        console.log(`      - "${e.event_id}" (${e.title})`);
      });
      console.log('');
    } else {
      console.log(`   Orphan: "${orphan.event_id}" - No similar events found`);
      console.log('      Event may have been deleted or ID changed\n');
    }
  }
}

fixOrphanedRegistrations();
