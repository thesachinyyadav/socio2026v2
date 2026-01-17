import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://vkappuaapscvteexogtp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStorage() {
  console.log('📦 Checking Supabase Storage Buckets...\n');

  const { data: buckets, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.error('❌ Error listing buckets:', error);
    return;
  }

  console.log('Available buckets:', buckets.map(b => b.name));

  const requiredBuckets = ['event-images', 'event-banners', 'event-pdfs', 'fest-images'];
  const existingBuckets = buckets.map(b => b.name);

  for (const bucket of requiredBuckets) {
    if (existingBuckets.includes(bucket)) {
      console.log(`✅ Bucket '${bucket}' exists.`);
    } else {
      console.log(`❌ Bucket '${bucket}' MISSING. Attempting to create...`);
      try {
        const { data, error: createError } = await supabase.storage.createBucket(bucket, {
            public: true,
            allowedMimeTypes: bucket.includes('pdf') ? ['application/pdf'] : ['image/*'],
            fileSizeLimit: 10485760 // 10MB
        });
        if (createError) {
             console.error(`   Failed to create '${bucket}':`, createError.message);
        } else {
             console.log(`   CREATED '${bucket}' successfully.`);
        }
      } catch (e) {
        console.error(`   Exception creating '${bucket}':`, e.message);
      }
    }
  }
}

checkStorage();
