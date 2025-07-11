// Debug script to check prediction status
// Run this in your browser console on the project page

async function debugPredictions() {
  console.log('🔍 Checking prediction status...');
  
  try {
    // Create Supabase client directly with correct anon key
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    
    const supabaseUrl = 'https://sphgdlqoabzsyhtyopim.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwaGdkbHFvYWJ6c3lodHlvcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc3MjEsImV4cCI6MjA2NjQ2MzcyMX0.uXtmbccpR_lZ-lywL1qogPmAePFRb8YnUkuAAv35Q5s';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('✅ Supabase client created with correct key');

    // Check active schedules
    console.log('\n📋 Checking active schedules...');
    const { data: schedules, error: schedulesError } = await supabase
      .from('print_on_shirt_schedules')
      .select('*')
      .eq('schedule_enabled', true);

    if (schedulesError) {
      console.error('❌ Error fetching schedules:', schedulesError);
      return;
    }

    console.log(`📊 Found ${schedules?.length || 0} active schedules:`);
    schedules?.forEach((schedule, i) => {
      console.log(`   ${i + 1}. ${schedule.name}`);
      console.log(`      - Multi-select: ${schedule.use_bucket_images ? 'Yes' : 'No'}`);
      console.log(`      - Image Set 1: ${schedule.bucket_image_1_ids?.length || 0} images`);
      console.log(`      - Image Set 2: ${schedule.bucket_image_2_ids?.length || 0} images`);
      console.log(`      - Last generation: ${schedule.last_generation_at || 'Never'}`);
    });

    // Check print on shirt images (predictions)
    console.log('\n🎨 Checking predictions...');
    const { data: images, error: imagesError } = await supabase
      .from('print_on_shirt_images')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(10);

    if (imagesError) {
      console.error('❌ Error fetching images:', imagesError);
      return;
    }

    console.log(`🖼️ Found ${images?.length || 0} predictions:`);
    const statusCounts = {};
    images?.forEach((image, i) => {
      statusCounts[image.status] = (statusCounts[image.status] || 0) + 1;
      console.log(`   ${i + 1}. Status: ${image.status} | Prediction ID: ${image.prediction_id}`);
      if (image.status === 'completed' && image.generated_image_url) {
        console.log(`      ✅ Generated image URL: ${image.generated_image_url}`);
      }
      if (image.status === 'failed' && image.error_message) {
        console.log(`      ❌ Error: ${image.error_message}`);
      }
    });

    console.log('\n📊 Status Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    // Check bucket images
    console.log('\n🗂️ Checking bucket images...');
    const { data: bucketImages, error: bucketError } = await supabase
      .from('project_bucket_images')
      .select('*')
      .limit(5);

    if (bucketError) {
      console.error('❌ Error fetching bucket images:', bucketError);
      return;
    }

    console.log(`📸 Found ${bucketImages?.length || 0} bucket images`);

    // Check cron jobs (if accessible)
    console.log('\n⏰ Trying to check cron jobs...');
    try {
      const { data: cronJobs, error: cronError } = await supabase.rpc('get_cron_jobs');
      if (cronError) {
        console.log('   ⚠️ Cannot access cron jobs (expected with anon key)');
      } else {
        console.log(`   📋 Found ${cronJobs?.length || 0} cron jobs`);
      }
    } catch (e) {
      console.log('   ⚠️ Cannot access cron jobs (expected with anon key)');
    }

    // Manual trigger test
    console.log('\n🔧 To manually trigger the completed predictions check, run:');
    console.log('   manualTriggerCheck()');
    
    // Store supabase client globally for manual trigger
    window.debugSupabase = supabase;

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

async function manualTriggerCheck() {
  console.log('🚀 Manually triggering completed predictions check...');
  
  try {
    // Try to get auth token from localStorage (various possible keys)
    const possibleTokenKeys = [
      'supabase.auth.token',
      'sb-sphgdlqoabzsyhtyopim-auth-token',
      'supabase-auth-token'
    ];
    
    let authToken = null;
    for (const key of possibleTokenKeys) {
      const token = localStorage.getItem(key);
      if (token) {
        try {
          const parsed = JSON.parse(token);
          authToken = parsed.access_token || parsed.token || token;
          if (authToken) break;
        } catch {
          authToken = token;
          break;
        }
      }
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      console.log('   ✅ Found auth token');
    } else {
      console.log('   ⚠️ No auth token found, using anon access');
    }

    const response = await fetch('https://sphgdlqoabzsyhtyopim.supabase.co/functions/v1/process-completed-predictions', {
      method: 'POST',
      headers: headers
    });

    const result = await response.json();
    console.log('✅ Manual trigger result:', result);
    
    // Refresh data after trigger
    setTimeout(() => {
      console.log('\n🔄 Refreshing data after manual trigger...');
      debugPredictions();
    }, 2000);
    
  } catch (error) {
    console.error('❌ Manual trigger error:', error);
  }
}

// Run the debug function
debugPredictions(); 