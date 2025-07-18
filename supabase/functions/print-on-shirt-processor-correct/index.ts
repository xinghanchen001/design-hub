import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface ScheduleConfig {
  enabled?: boolean;
  duration_hours?: number;
  schedule_duration_hours?: number;
  interval_minutes?: number;
  generation_interval_minutes?: number;
}

interface GenerationSettings {
  max_images?: number;
  max_images_to_generate?: number;
  aspect_ratio?: string;
  output_format?: string;
  safety_tolerance?: number;
  input_image_1_url?: string;
  input_image_2_url?: string;
}

interface BucketSettings {
  use_bucket_images?: boolean;
  bucket_image_1_ids?: string[];
  bucket_image_2_ids?: string[];
  auto_cleanup?: boolean;
  max_bucket_size?: number;
}

interface ImageMetadata {
  width?: number;
  height?: number;
  format?: string;
  size?: number;
  [key: string]: unknown;
}

interface PrintOnShirtSchedule {
  id: string;
  user_id: string;
  task_id?: string;
  name: string;
  prompt: string;
  task_type: string;
  status: string;
  schedule_config: ScheduleConfig;
  generation_settings: GenerationSettings;
  bucket_settings: BucketSettings;
  created_at: string;
  next_run: string;
}

interface BucketImage {
  id: string;
  filename: string;
  storage_path: string;
  image_url: string;
  file_size: number;
  mime_type: string;
  metadata: ImageMetadata;
  created_at: string;
  updated_at: string;
}

interface ImageCombination {
  image1: BucketImage;
  image2: BucketImage;
  combo_name: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN')!;

  console.log('🔧 Environment check:', {
    hasSupabaseUrl: !!SUPABASE_URL,
    hasSupabaseKey: !!SUPABASE_SERVICE_ROLE_KEY,
    hasReplicateToken: !!REPLICATE_API_TOKEN,
  });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log('=== Print-on-Shirt Processor Function Called ===');

    // Get all active print-on-shirt schedules
    console.log('Fetching active print-on-shirt schedules...');
    const { data: schedules, error: schedulesError } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'active')
      .eq('task_type', 'print-on-shirt')
      .lte('next_run', new Date().toISOString())
      .limit(5); // Process max 5 schedules at a time

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      throw new Error(`Failed to fetch schedules: ${schedulesError.message}`);
    }

    console.log(
      `Found ${
        schedules?.length || 0
      } print-on-shirt schedules ready for processing`
    );

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No print-on-shirt schedules ready for processing',
          processed: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    let processedCount = 0;

    for (const schedule of schedules as PrintOnShirtSchedule[]) {
      console.log(`🔍 Processing schedule: ${schedule.name} (${schedule.id})`);

      const scheduleConfig: ScheduleConfig = schedule.schedule_config || {};
      const generationSettings: GenerationSettings =
        schedule.generation_settings || {};
      const bucketSettings: BucketSettings = schedule.bucket_settings || {};

      // Check if we've reached the duration limit - SUPPORT BOTH OLD AND NEW FIELD NAMES
      const scheduleStart = new Date(schedule.created_at);
      const now = new Date();
      const hoursSinceStart =
        (now.getTime() - scheduleStart.getTime()) / (1000 * 60 * 60);

      // Support both old (duration_hours) and new (schedule_duration_hours) field names
      const durationHours =
        scheduleConfig.schedule_duration_hours ||
        scheduleConfig.duration_hours ||
        24;
      if (hoursSinceStart >= durationHours) {
        console.log(
          `⏹️ Schedule ${schedule.name} has reached duration limit (${durationHours} hours)`
        );

        // Disable the schedule
        await supabase
          .from('schedules')
          .update({
            status: 'paused',
          })
          .eq('id', schedule.id);

        continue;
      }

      console.log('📊 Starting print-on-shirt generation process...');

      try {
        // If using bucket images, get the selected images
        if (bucketSettings.use_bucket_images) {
          console.log(`📦 Using bucket images for schedule ${schedule.name}`);

          const bucket1ImageIds = bucketSettings.bucket_image_1_ids || [];
          const bucket2ImageIds = bucketSettings.bucket_image_2_ids || [];

          if (bucket1ImageIds.length === 0 || bucket2ImageIds.length === 0) {
            console.log(
              `⚠️ No bucket images configured for schedule ${schedule.name}`
            );
            continue;
          }

          // Get bucket images
          const { data: bucket1Images, error: bucket1Error } = await supabase
            .from('project_bucket_images')
            .select('*')
            .in('id', bucket1ImageIds)
            .eq('user_id', schedule.user_id);

          const { data: bucket2Images, error: bucket2Error } = await supabase
            .from('project_bucket_images')
            .select('*')
            .in('id', bucket2ImageIds)
            .eq('user_id', schedule.user_id);

          if (bucket1Error || bucket2Error) {
            console.error(
              `❌ Error fetching bucket images:`,
              bucket1Error || bucket2Error
            );
            continue;
          }

          if (!bucket1Images || bucket1Images.length === 0) {
            console.log(
              `⚠️ No bucket1 images found for schedule ${schedule.name}`
            );
            continue;
          }

          if (!bucket2Images || bucket2Images.length === 0) {
            console.log(
              `⚠️ No bucket2 images found for schedule ${schedule.name}`
            );
            continue;
          }

          // Generate combinations
          const combinations: ImageCombination[] = [];
          for (const image1 of bucket1Images) {
            for (const image2 of bucket2Images) {
              combinations.push({
                image1: image1 as BucketImage,
                image2: image2 as BucketImage,
                combo_name: `${image1.filename.split('.')[0]}_${
                  image2.filename.split('.')[0]
                }`,
              });
            }
          }

          console.log(
            `🎯 Generated ${combinations.length} combinations for schedule ${schedule.name}`
          );

          // Process all combinations (user explicitly selected these images)
          const selectedCombinations = combinations;

          for (const combination of selectedCombinations) {
            console.log(`🎨 Processing combination: ${combination.combo_name}`);

            // Call Replicate API
            const replicateResponse = await fetch(
              'https://api.replicate.com/v1/predictions',
              {
                method: 'POST',
                headers: {
                  Authorization: `Token ${REPLICATE_API_TOKEN}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  version: 'flux-kontext-apps/multi-image-kontext-max',
                  input: {
                    prompt: schedule.prompt,
                    input_image_1: combination.image1.image_url,
                    input_image_2: combination.image2.image_url,
                    aspect_ratio: generationSettings.aspect_ratio || '1:1',
                    output_format: generationSettings.output_format || 'png',
                    safety_tolerance: generationSettings.safety_tolerance || 1,
                    seed: Math.floor(Math.random() * 1000000),
                  },
                }),
              }
            );

            if (!replicateResponse.ok) {
              console.error(
                `❌ Replicate API error for combination ${combination.combo_name}:`,
                replicateResponse.status,
                replicateResponse.statusText
              );
              const errorText = await replicateResponse.text();
              console.error('Error details:', errorText);
              continue; // Continue with other combinations
            }

            const predictionData = await replicateResponse.json();
            console.log(
              `✅ Prediction created for ${combination.combo_name}:`,
              predictionData.id
            );

            // Store the generation record in the database
            const { error: insertError } = await supabase
              .from('generated_content')
              .insert({
                schedule_id: schedule.id,
                user_id: schedule.user_id,
                task_id: schedule.task_id,
                task_type: schedule.task_type,
                content_type: 'design',
                generation_status: 'processing',
                external_job_id: predictionData.id,
                metadata: {
                  prediction_id: predictionData.id,
                  combination_name: combination.combo_name,
                  input_image_1_url: combination.image1.image_url,
                  input_image_2_url: combination.image2.image_url,
                  aspect_ratio: generationSettings.aspect_ratio || '1:1',
                  output_format: generationSettings.output_format || 'png',
                  safety_tolerance: generationSettings.safety_tolerance || 1,
                  model_used: 'flux-kontext-apps/multi-image-kontext-max',
                  generation_settings: generationSettings,
                },
              });

            if (insertError) {
              console.error(
                `❌ Error inserting content record for ${combination.combo_name}:`,
                insertError
              );
              continue; // Continue with other combinations
            }
          }

          // Update the schedule's next run time - SUPPORT BOTH OLD AND NEW FIELD NAMES
          const intervalMinutes =
            scheduleConfig.generation_interval_minutes ||
            scheduleConfig.interval_minutes ||
            60;
          const nextRun = new Date(Date.now() + intervalMinutes * 60 * 1000);

          const { error: updateError } = await supabase
            .from('schedules')
            .update({ next_run: nextRun.toISOString() })
            .eq('id', schedule.id);

          if (updateError) {
            console.error(`❌ Error updating schedule:`, updateError);
            throw updateError;
          }

          console.log(`✅ Successfully processed ${schedule.name}`);
          processedCount++;
        } else {
          // Use direct URLs from generation settings
          console.log(
            `🖼️ Using direct image URLs for schedule ${schedule.name}`
          );

          const image1Url = generationSettings.input_image_1_url;
          const image2Url = generationSettings.input_image_2_url;

          if (!image1Url || !image2Url) {
            console.log(`⚠️ Missing image URLs for schedule ${schedule.name}`);
            continue;
          }

          // Call Replicate API
          const replicateResponse = await fetch(
            'https://api.replicate.com/v1/predictions',
            {
              method: 'POST',
              headers: {
                Authorization: `Token ${REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                version: 'flux-kontext-apps/multi-image-kontext-max',
                input: {
                  prompt: schedule.prompt,
                  input_image_1: image1Url,
                  input_image_2: image2Url,
                  aspect_ratio: generationSettings.aspect_ratio || '1:1',
                  output_format: generationSettings.output_format || 'png',
                  safety_tolerance: generationSettings.safety_tolerance || 1,
                  seed: Math.floor(Math.random() * 1000000),
                },
              }),
            }
          );

          if (!replicateResponse.ok) {
            console.error(
              `❌ Replicate API error for schedule ${schedule.name}:`,
              replicateResponse.status,
              replicateResponse.statusText
            );
            continue;
          }

          const predictionData = await replicateResponse.json();
          console.log(`✅ Prediction created:`, predictionData.id);

          // Store the generation record in the database
          const { error: insertError } = await supabase
            .from('generated_content')
            .insert({
              schedule_id: schedule.id,
              user_id: schedule.user_id,
              task_id: schedule.task_id,
              task_type: schedule.task_type,
              content_type: 'design',
              generation_status: 'processing',
              external_job_id: predictionData.id,
              metadata: {
                prediction_id: predictionData.id,
                input_image_1_url: generationSettings.input_image_1_url,
                input_image_2_url: generationSettings.input_image_2_url,
                aspect_ratio: generationSettings.aspect_ratio || '1:1',
                output_format: generationSettings.output_format || 'png',
                safety_tolerance: generationSettings.safety_tolerance || 1,
                model_used: 'flux-kontext-apps/multi-image-kontext-max',
                generation_settings: generationSettings,
              },
            });

          if (insertError) {
            console.error(`❌ Error inserting content record:`, insertError);
            throw insertError;
          }

          // Update the schedule's next run time - SUPPORT BOTH OLD AND NEW FIELD NAMES
          const intervalMinutes =
            scheduleConfig.generation_interval_minutes ||
            scheduleConfig.interval_minutes ||
            60;
          const nextRun = new Date(Date.now() + intervalMinutes * 60 * 1000);

          const { error: updateError } = await supabase
            .from('schedules')
            .update({ next_run: nextRun.toISOString() })
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
      }
    }

    console.log(
      `=== Print-on-Shirt Processor completed: ${processedCount}/${schedules.length} schedules processed successfully ===`
    );

    return new Response(
      JSON.stringify({
        message: 'Print-on-shirt schedules processed successfully',
        processed: processedCount,
        total: schedules.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in print-on-shirt-processor-correct function:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
