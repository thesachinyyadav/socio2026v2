import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://vkappuaapscvteexogtp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('\n🔍 COMPREHENSIVE DATABASE & SYSTEM TEST\n');
console.log('='.repeat(60));

async function testDatabaseConnection() {
  console.log('\n📊 1. Testing Database Connection...');
  try {
    const { data, error, count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    console.log(`   ✅ Database connected successfully`);
    console.log(`   📍 Supabase URL: ${supabaseUrl}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Database connection failed:`, error.message);
    return false;
  }
}

async function testTableSchema() {
  console.log('\n📋 2. Testing Table Schema...');
  
  const tables = [
    'users',
    'events',
    'fest',
    'registrations',
    'attendance_status',
    'notifications',
    'contact_messages'
  ];
  
  const results = {};
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        results[table] = `❌ ${error.message}`;
      } else {
        results[table] = `✅ ${count || 0} rows`;
      }
    } catch (error) {
      results[table] = `❌ ${error.message}`;
    }
  }
  
  for (const [table, result] of Object.entries(results)) {
    console.log(`   ${result.padEnd(30)} - ${table}`);
  }
}

async function testUserRoleColumns() {
  console.log('\n👤 3. Testing User Role Columns...');
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('email, is_organiser, is_support, is_masteradmin, organiser_expires_at, support_expires_at, masteradmin_expires_at')
      .limit(1);
    
    if (error) throw error;
    
    const requiredColumns = ['is_organiser', 'is_support', 'is_masteradmin'];
    const optionalColumns = ['organiser_expires_at', 'support_expires_at', 'masteradmin_expires_at'];
    
    const sampleUser = users[0] || {};
    
    requiredColumns.forEach(col => {
      if (col in sampleUser) {
        console.log(`   ✅ ${col} column exists`);
      } else {
        console.log(`   ❌ ${col} column MISSING - Run migrate-master-admin.sql!`);
      }
    });
    
    optionalColumns.forEach(col => {
      if (col in sampleUser) {
        console.log(`   ✅ ${col} column exists`);
      } else {
        console.log(`   ⚠️  ${col} column MISSING - Run migrate-master-admin.sql!`);
      }
    });
    
  } catch (error) {
    console.error(`   ❌ Error testing columns:`, error.message);
  }
}

async function testDataIntegrity() {
  console.log('\n🔍 4. Testing Data Integrity...');
  
  try {
    // Check for registrations with complete data
    const { data: regs, error: regError } = await supabase
      .from('registrations')
      .select('registration_id, event_id, individual_name, individual_email, team_name, created_at')
      .limit(5);
    
    if (regError) throw regError;
    
    console.log(`   📝 Found ${regs.length} registrations`);
    
    const completeRegs = regs.filter(r => 
      (r.individual_name && r.individual_email) || r.team_name
    );
    const incompleteRegs = regs.filter(r => 
      !r.individual_name && !r.individual_email && !r.team_name
    );
    
    console.log(`   ✅ ${completeRegs.length} registrations have complete data`);
    if (incompleteRegs.length > 0) {
      console.log(`   ⚠️  ${incompleteRegs.length} registrations have NULL names/emails`);
      console.log(`       This is expected for old registrations created before the fix`);
    }
    
    // Check orphaned registrations
    const { data: orphaned, error: orphanError } = await supabase
      .from('registrations')
      .select('registration_id, event_id')
      .not('event_id', 'in', `(select event_id from events)`)
      .limit(10);
    
    if (!orphanError && orphaned && orphaned.length > 0) {
      console.log(`   ⚠️  ${orphaned.length} registrations reference non-existent events`);
    } else {
      console.log(`   ✅ No orphaned registrations found`);
    }
    
  } catch (error) {
    console.error(`   ❌ Data integrity check failed:`, error.message);
  }
}

async function testCounts() {
  console.log('\n📊 5. Database Statistics...');
  
  try {
    const stats = [];
    
    const tables = [
      { name: 'users', label: 'Total Users' },
      { name: 'events', label: 'Total Events' },
      { name: 'fest', label: 'Total Fests' },
      { name: 'registrations', label: 'Total Registrations' },
      { name: 'attendance_status', label: 'Attendance Records' },
      { name: 'notifications', label: 'Notifications' }
    ];
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        stats.push({ label: table.label, count: count || 0 });
      }
    }
    
    // Role counts
    const { data: roleData } = await supabase
      .from('users')
      .select('is_organiser, is_support, is_masteradmin');
    
    if (roleData) {
      const organisers = roleData.filter(u => u.is_organiser).length;
      const support = roleData.filter(u => u.is_support).length;
      const masterAdmins = roleData.filter(u => u.is_masteradmin).length;
      
      stats.push(
        { label: 'Organisers', count: organisers },
        { label: 'Support Staff', count: support },
        { label: 'Master Admins', count: masterAdmins }
      );
    }
    
    stats.forEach(stat => {
      console.log(`   ${stat.label.padEnd(25)}: ${stat.count}`);
    });
    
  } catch (error) {
    console.error(`   ❌ Statistics failed:`, error.message);
  }
}

async function testRecentActivity() {
  console.log('\n⏰ 6. Recent Activity (Last 24 hours)...');
  
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentRegs, count: regCount } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday);
    
    const { data: recentEvents, count: eventCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday);
    
    console.log(`   📝 New Registrations: ${regCount || 0}`);
    console.log(`   📅 New Events: ${eventCount || 0}`);
    
  } catch (error) {
    console.error(`   ❌ Activity check failed:`, error.message);
  }
}

async function runAllTests() {
  const dbConnected = await testDatabaseConnection();
  
  if (!dbConnected) {
    console.log('\n❌ Cannot proceed - database connection failed');
    console.log('   Check your .env file and ensure SUPABASE_SERVICE_ROLE_KEY is set\n');
    return;
  }
  
  await testTableSchema();
  await testUserRoleColumns();
  await testDataIntegrity();
  await testCounts();
  await testRecentActivity();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ TEST COMPLETE\n');
  console.log('Next steps:');
  console.log('1. If any columns are missing, run: migrate-master-admin.sql in Supabase SQL Editor');
  console.log('2. If contact_messages table is missing, the migration will create it');
  console.log('3. Start the server: npm start or node index.js');
  console.log('4. Test the API endpoints at http://localhost:8000');
  console.log('');
}

runAllTests();
