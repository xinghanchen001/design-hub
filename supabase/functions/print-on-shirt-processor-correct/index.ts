import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface PrintOnShirtSchedule {
  id: string;
  user_id: string;
  name: string;
  prompt: string;
  input_image_1_url: string;
  input_image_2_url: string;
  aspect_ratio: string;
  generation_interval_minutes: number;
  last_generation_at: string;
  max_images_to_generate: number;
  schedule_enabled: boolean;
  is_active: boolean;
  created_at: string;
  schedule_duration_hours: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      supabaseServiceKey
    );

    console.log('🔄 Processing print-on-shirt schedules...');

    // Get all active print-on-shirt schedules that need processing
    const { data: schedules, error: schedulesError } = await supabase
      .from('print_on_shirt_schedules')
      .select('*')
      .eq('schedule_enabled', true)
      .eq('is_active', true);

    if (schedulesError) {
      console.error('❌ Error fetching schedules:', schedulesError);
      throw schedulesError;
    }

    if (!schedules || schedules.length === 0) {
      console.log('ℹ️ No active print-on-shirt schedules found');
      return new Response(
        JSON.stringify({ message: 'No active schedules found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${schedules.length} active schedule(s)`);

    const replicateApiKey = Deno.env.get('REPLICATE_API_KEY');
    if (!replicateApiKey) {
      throw new Error('Missing REPLICATE_API_KEY');
    }

    let processedCount = 0;

    for (const schedule of schedules as PrintOnShirtSchedule[]) {
      console.log(`🔍 Processing schedule: ${schedule.name} (${schedule.id})`);

      // Check if it's time to generate based on interval
      if (schedule.last_generation_at) {
        const lastGeneration = new Date(schedule.last_generation_at);
        const now = new Date();
        const minutesSinceLastGeneration =
          (now.getTime() - lastGeneration.getTime()) / (1000 * 60);

        console.log(
          `⏱️ Minutes since last generation: ${minutesSinceLastGeneration.toFixed(
            1
          )}`
        );

        if (minutesSinceLastGeneration < schedule.generation_interval_minutes) {
          console.log(
            `⏸️ Skipping ${schedule.name} - not time yet (need ${schedule.generation_interval_minutes} min interval)`
          );
          continue;
        }
      }

      // Check if we've reached the duration limit
      const scheduleStart = new Date(schedule.created_at);
      const now = new Date();
      const hoursSinceStart =
        (now.getTime() - scheduleStart.getTime()) / (1000 * 60 * 60);

      if (hoursSinceStart >= schedule.schedule_duration_hours) {
        console.log(
          `⏹️ Schedule ${schedule.name} has reached duration limit (${schedule.schedule_duration_hours} hours)`
        );

        // Disable the schedule
        await supabase
          .from('print_on_shirt_schedules')
          .update({
            schedule_enabled: false,
            is_active: false,
          })
          .eq('id', schedule.id);

        continue;
      }

      // Count existing images for this schedule
      const { count: existingImageCount } = await supabase
        .from('print_on_shirt_images')
        .select('*', { count: 'exact', head: true })
        .eq('schedule_id', schedule.id);

      if (
        existingImageCount &&
        existingImageCount >= schedule.max_images_to_generate
      ) {
        console.log(
          `📸 Schedule ${schedule.name} has reached max images limit (${schedule.max_images_to_generate})`
        );

        // Disable the schedule
        await supabase
          .from('print_on_shirt_schedules')
          .update({
            schedule_enabled: false,
            is_active: false,
          })
          .eq('id', schedule.id);

        continue;
      }

      try {
        console.log(`🎨 Starting image generation for ${schedule.name}`);
        console.log(`📸 Image 1: ${schedule.input_image_1_url}`);
        console.log(`👕 Image 2: ${schedule.input_image_2_url}`);
        console.log(`💭 Prompt: ${schedule.prompt}`);

        // FIXED: Use the correct Replicate API format with version instead of model
        const prediction = await fetch(
          'https://api.replicate.com/v1/predictions',
          {
            method: 'POST',
            headers: {
              Authorization: `Token ${replicateApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              version: 'flux-kontext-apps/multi-image-kontext-max', // Changed from 'model' to 'version'
              input: {
                prompt: schedule.prompt,
                input_image_1: schedule.input_image_1_url, // Changed from input_images array
                input_image_2: schedule.input_image_2_url, // Added separate input_image_2
                aspect_ratio: schedule.aspect_ratio,
                output_format: 'png',
                safety_tolerance: 1, // Changed from 2 to 1 which is more commonly supported
              },
            }),
          }
        );

        if (!prediction.ok) {
          const errorText = await prediction.text();
          console.error(`❌ Replicate API error:`, errorText);
          throw new Error(`Replicate API error: ${errorText}`);
        }

        const predictionData = await prediction.json();
        console.log(`✅ Prediction created:`, predictionData.id);

        // Store the generation record in the database
        const { error: insertError } = await supabase
          .from('print_on_shirt_images')
          .insert({
            schedule_id: schedule.id,
            user_id: schedule.user_id,
            prompt: schedule.prompt,
            input_image_1_url: schedule.input_image_1_url,
            input_image_2_url: schedule.input_image_2_url,
            aspect_ratio: schedule.aspect_ratio,
            prediction_id: predictionData.id,
            status: 'processing',
            model_used: 'flux-kontext-apps/multi-image-kontext-max',
            output_format: 'png',
            safety_tolerance: 1,
            generated_at: now.toISOString(),
          });

        if (insertError) {
          console.error(`❌ Error inserting image record:`, insertError);
          throw insertError;
        }

        // Update the schedule's last generation time
        const { error: updateError } = await supabase
          .from('print_on_shirt_schedules')
          .update({ last_generation_at: now.toISOString() })
          .eq('id', schedule.id);

        if (updateError) {
          console.error(`❌ Error updating schedule:`, updateError);
          throw updateError;
        }

        processedCount++;
        console.log(`✅ Successfully processed ${schedule.name}`);
      } catch (error) {
        console.error(`❌ Error processing schedule ${schedule.name}:`, error);

        // Store the error in the database
        await supabase.from('print_on_shirt_images').insert({
          schedule_id: schedule.id,
          user_id: schedule.user_id,
          prompt: schedule.prompt,
          input_image_1_url: schedule.input_image_1_url,
          input_image_2_url: schedule.input_image_2_url,
          aspect_ratio: schedule.aspect_ratio,
          status: 'failed',
          error_message: error.message,
          generated_at: now.toISOString(),
        });

        continue;
      }
    }

    console.log(
      `🎉 Completed processing. Generated ${processedCount} new images.`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} schedules`,
        processed_schedules: processedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in print-on-shirt processor:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Check function logs for more information',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
