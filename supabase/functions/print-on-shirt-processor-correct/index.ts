import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface PrintOnShirtSchedule {
  id: string;
  user_id: string;
  project_id?: string;
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
  // Add bucket support
  use_bucket_images?: boolean;
  bucket_image_1_id?: string;
  bucket_image_2_id?: string;
}

interface BucketImage {
  id: string;
  filename: string;
  storage_path: string;
  image_url: string;
  file_size: number;
  mime_type: string;
  metadata: any;
  created_at: string;
  updated_at: string;
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
        // Check if this schedule uses bucket images for batch generation
        if (schedule.use_bucket_images && schedule.project_id) {
          console.log(`🗂️ Bucket mode: Processing ${schedule.name} with bucket images`);
          
          // Fetch all bucket images for this project
          const { data: bucketImages, error: bucketError } = await supabase
            .from('project_bucket_images')
            .select('*')
            .eq('project_id', schedule.project_id)
            .eq('user_id', schedule.user_id)
            .order('created_at', { ascending: false });

          if (bucketError) {
            console.error('Error fetching bucket images:', bucketError);
            throw new Error(`Failed to fetch bucket images: ${bucketError.message}`);
          }

          if (!bucketImages || bucketImages.length === 0) {
            console.log('⚠️ No bucket images found for batch generation');
            throw new Error('No bucket images found for batch generation. Please upload images to the bucket first.');
          }

          console.log(`📸 Found ${bucketImages.length} bucket images for combinations`);

          // Generate all possible combinations of Image 1 × Image 2
          const combinations = [];
          for (const image1 of bucketImages) {
            for (const image2 of bucketImages) {
              if (image1.id !== image2.id) { // Don't combine image with itself
                combinations.push({
                  image1,
                  image2,
                  combo_name: `${image1.filename} × ${image2.filename}`
                });
              }
            }
          }

          console.log(`🔀 Generated ${combinations.length} image combinations`);

          // Limit the number of combinations to prevent overwhelming the system
          const maxCombinations = Math.min(combinations.length, schedule.max_images_to_generate);
          const selectedCombinations = combinations.slice(0, maxCombinations);

          console.log(`🎯 Processing ${selectedCombinations.length} combinations`);

          // Create predictions for each combination
          for (let i = 0; i < selectedCombinations.length; i++) {
            const { image1, image2, combo_name } = selectedCombinations[i];
            
            try {
              console.log(`🎨 Generating combination ${i + 1}/${selectedCombinations.length}: ${combo_name}`);

              const prediction = await fetch(
                'https://api.replicate.com/v1/predictions',
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Token ${replicateApiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    version: 'flux-kontext-apps/multi-image-kontext-max',
                    input: {
                      prompt: schedule.prompt,
                      input_image_1: image1.image_url,
                      input_image_2: image2.image_url,
                      aspect_ratio: schedule.aspect_ratio,
                      output_format: 'png',
                      safety_tolerance: 1,
                    },
                  }),
                }
              );

              if (!prediction.ok) {
                const errorText = await prediction.text();
                console.error(`❌ Replicate API error for ${combo_name}:`, errorText);
                continue; // Skip this combination and continue with others
              }

              const predictionData = await prediction.json();
              console.log(`✅ Prediction created for ${combo_name}:`, predictionData.id);

              // Store the generation record in the database
              const { error: insertError } = await supabase
                .from('print_on_shirt_images')
                .insert({
                  schedule_id: schedule.id,
                  user_id: schedule.user_id,
                  prompt: schedule.prompt,
                  input_image_1_url: image1.image_url,
                  input_image_2_url: image2.image_url,
                  bucket_image_1_id: image1.id,
                  bucket_image_2_id: image2.id,
                  aspect_ratio: schedule.aspect_ratio,
                  prediction_id: predictionData.id,
                  status: 'processing',
                  model_used: 'flux-kontext-apps/multi-image-kontext-max',
                  output_format: 'png',
                  safety_tolerance: 1,
                  generated_at: now.toISOString(),
                });

              if (insertError) {
                console.error(`❌ Error inserting image record for ${combo_name}:`, insertError);
                continue; // Continue with other combinations
              }

              console.log(`✅ Successfully queued generation for ${combo_name}`);
            } catch (error) {
              console.error(`❌ Error processing combination ${combo_name}:`, error);
              continue; // Continue with other combinations
            }
          }

          // Update the schedule's last generation time
          const { error: updateError } = await supabase
            .from('print_on_shirt_schedules')
            .update({ last_generation_at: now.toISOString() })
            .eq('id', schedule.id);

          if (updateError) {
            console.error(`❌ Error updating schedule:`, updateError);
          }

          processedCount++;
          console.log(`✅ Successfully processed ${schedule.name} with ${selectedCombinations.length} combinations`);

        } else {
          // Original single image pair generation logic
          console.log(`🎨 Single mode: Starting image generation for ${schedule.name}`);
          console.log(`📸 Image 1: ${schedule.input_image_1_url}`);
          console.log(`👕 Image 2: ${schedule.input_image_2_url}`);
          console.log(`💭 Prompt: ${schedule.prompt}`);

          const prediction = await fetch(
            'https://api.replicate.com/v1/predictions',
            {
              method: 'POST',
              headers: {
                Authorization: `Token ${replicateApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                version: 'flux-kontext-apps/multi-image-kontext-max',
                input: {
                  prompt: schedule.prompt,
                  input_image_1: schedule.input_image_1_url,
                  input_image_2: schedule.input_image_2_url,
                  aspect_ratio: schedule.aspect_ratio,
                  output_format: 'png',
                  safety_tolerance: 1,
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
        }
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
