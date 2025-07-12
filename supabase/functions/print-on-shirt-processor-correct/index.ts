import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface PrintOnShirtSchedule {
  id: string;
  user_id: string;
  project_id?: string;
  name: string;
  prompt: string;
  project_type: string;
  status: string;
  schedule_config: any;
  generation_settings: any;
  bucket_settings: any;
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
      .from('schedules')
      .select('*')
      .eq('project_type', 'print-on-shirt')
      .eq('status', 'active')
      .lte('next_run', new Date().toISOString());

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

      const scheduleConfig = (schedule.schedule_config as any) || {};
      const generationSettings = (schedule.generation_settings as any) || {};
      const bucketSettings = (schedule.bucket_settings as any) || {};

      // Check if we've reached the duration limit
      const scheduleStart = new Date(schedule.created_at);
      const now = new Date();
      const hoursSinceStart =
        (now.getTime() - scheduleStart.getTime()) / (1000 * 60 * 60);

      const durationHours = scheduleConfig.duration_hours || 24;
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

      // Count existing images for this schedule
      const { count: existingContentCount } = await supabase
        .from('generated_content')
        .select('*', { count: 'exact', head: true })
        .eq('schedule_id', schedule.id)
        .eq('content_type', 'design');

      const maxImages = generationSettings.max_images || 10;
      if (existingContentCount && existingContentCount >= maxImages) {
        console.log(
          `📸 Schedule ${schedule.name} has reached max images limit (${maxImages})`
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

      try {
        // Check if this schedule uses bucket images for batch generation
        if (bucketSettings.use_bucket_images && schedule.project_id) {
          console.log(
            `🗂️ Bucket mode: Processing ${schedule.name} with bucket images`
          );

          // Initialize combinations array
          let combinations = [];

          // Check if we have multi-select arrays (new format)
          if (
            bucketSettings.bucket_image_1_ids &&
            bucketSettings.bucket_image_2_ids &&
            bucketSettings.bucket_image_1_ids.length > 0 &&
            bucketSettings.bucket_image_2_ids.length > 0
          ) {
            console.log(
              `🎯 Multi-select mode: ${bucketSettings.bucket_image_1_ids.length} images in set 1, ${bucketSettings.bucket_image_2_ids.length} images in set 2`
            );

            // Fetch selected bucket images for set 1
            const { data: bucketImages1, error: bucketError1 } = await supabase
              .from('project_bucket_images')
              .select('*')
              .in('id', bucketSettings.bucket_image_1_ids)
              .eq('project_id', schedule.project_id);

            // Fetch selected bucket images for set 2
            const { data: bucketImages2, error: bucketError2 } = await supabase
              .from('project_bucket_images')
              .select('*')
              .in('id', bucketSettings.bucket_image_2_ids)
              .eq('project_id', schedule.project_id);

            if (bucketError1 || bucketError2) {
              console.error(
                'Error fetching selected bucket images:',
                bucketError1 || bucketError2
              );
              throw new Error(
                `Failed to fetch selected bucket images: ${
                  (bucketError1 || bucketError2)?.message
                }`
              );
            }

            if (!bucketImages1?.length || !bucketImages2?.length) {
              console.log('⚠️ Some selected bucket images not found');
              throw new Error(
                'Some selected bucket images not found. Please check your selection.'
              );
            }

            console.log(
              `📸 Found ${bucketImages1.length} images in set 1, ${bucketImages2.length} images in set 2`
            );

            // Generate combinations from selected sets: Set 1 × Set 2
            for (const image1 of bucketImages1) {
              for (const image2 of bucketImages2) {
                combinations.push({
                  image1,
                  image2,
                  combo_name: `${image1.filename} × ${image2.filename}`,
                });
              }
            }
          } else {
            // Fallback to old logic - fetch all bucket images for this project
            console.log(
              `🔄 Fallback mode: Using all bucket images for combinations`
            );

            const { data: bucketImages, error: bucketError } = await supabase
              .from('project_bucket_images')
              .select('*')
              .eq('project_id', schedule.project_id)
              .eq('user_id', schedule.user_id)
              .eq('project_type', 'print-on-shirt')
              .order('created_at', { ascending: false });

            if (bucketError) {
              console.error('Error fetching bucket images:', bucketError);
              throw new Error(
                `Failed to fetch bucket images: ${bucketError.message}`
              );
            }

            if (!bucketImages || bucketImages.length === 0) {
              console.log('⚠️ No bucket images found for batch generation');
              throw new Error(
                'No bucket images found for batch generation. Please upload images to the bucket first.'
              );
            }

            console.log(
              `📸 Found ${bucketImages.length} bucket images for combinations`
            );

            // Generate all possible combinations of Image 1 × Image 2
            for (const image1 of bucketImages) {
              for (const image2 of bucketImages) {
                if (image1.id !== image2.id) {
                  // Don't combine image with itself
                  combinations.push({
                    image1,
                    image2,
                    combo_name: `${image1.filename} × ${image2.filename}`,
                  });
                }
              }
            }
          }

          console.log(`🔀 Generated ${combinations.length} image combinations`);

          // Limit the number of combinations to prevent overwhelming the system
          const maxCombinations = Math.min(combinations.length, maxImages);
          const selectedCombinations = combinations.slice(0, maxCombinations);

          console.log(
            `🎯 Processing ${selectedCombinations.length} combinations`
          );

          // Create predictions for each combination
          for (let i = 0; i < selectedCombinations.length; i++) {
            const { image1, image2, combo_name } = selectedCombinations[i];

            try {
              console.log(
                `🎨 Generating combination ${i + 1}/${
                  selectedCombinations.length
                }: ${combo_name}`
              );

              const prediction = await fetch(
                'https://api.replicate.com/v1/models/flux-kontext-apps/multi-image-kontext-max/predictions',
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Token ${replicateApiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    input: {
                      prompt: schedule.prompt,
                      input_image_1: image1.image_url,
                      input_image_2: image2.image_url,
                      aspect_ratio: generationSettings.aspect_ratio || '1:1',
                      output_format: 'png',
                      safety_tolerance: 1,
                    },
                  }),
                }
              );

              if (!prediction.ok) {
                const errorText = await prediction.text();
                console.error(
                  `❌ Replicate API error for ${combo_name}:`,
                  errorText
                );
                continue; // Skip this combination and continue with others
              }

              const predictionData = await prediction.json();
              console.log(
                `✅ Prediction created for ${combo_name}:`,
                predictionData.id
              );

              // Store the generation record in the database
              const { error: insertError } = await supabase
                .from('generated_content')
                .insert({
                  schedule_id: schedule.id,
                  user_id: schedule.user_id,
                  project_id: schedule.project_id,
                  content_type: 'design',
                  prompt: schedule.prompt,
                  generation_status: 'processing',
                  metadata: {
                    prediction_id: predictionData.id,
                    input_image_1_url: image1.image_url,
                    input_image_2_url: image2.image_url,
                    bucket_image_1_id: image1.id,
                    bucket_image_2_id: image2.id,
                    aspect_ratio: generationSettings.aspect_ratio || '1:1',
                    output_format: 'png',
                    safety_tolerance: 1,
                    combo_name: combo_name,
                    model_used: 'flux-kontext-apps/multi-image-kontext-max',
                    generation_settings: generationSettings,
                  },
                });

              if (insertError) {
                console.error(
                  `❌ Error inserting content record for ${combo_name}:`,
                  insertError
                );
                continue; // Continue with other combinations
              }

              console.log(
                `✅ Successfully queued generation for ${combo_name}`
              );
            } catch (error) {
              console.error(
                `❌ Error processing combination ${combo_name}:`,
                error
              );
              continue; // Continue with other combinations
            }
          }

          // Update the schedule's next run time
          const intervalMinutes = scheduleConfig.interval_minutes || 60;
          const nextRun = new Date(Date.now() + intervalMinutes * 60 * 1000);

          const { error: updateError } = await supabase
            .from('schedules')
            .update({ next_run: nextRun.toISOString() })
            .eq('id', schedule.id);

          if (updateError) {
            console.error(`❌ Error updating schedule:`, updateError);
          }

          processedCount++;
          console.log(
            `✅ Successfully processed ${schedule.name} with ${selectedCombinations.length} combinations`
          );
        } else {
          // Original single image pair generation logic
          console.log(
            `🎨 Single mode: Starting image generation for ${schedule.name}`
          );
          console.log(`📸 Image 1: ${generationSettings.input_image_1_url}`);
          console.log(`👕 Image 2: ${generationSettings.input_image_2_url}`);
          console.log(`💭 Prompt: ${schedule.prompt}`);

          const prediction = await fetch(
            'https://api.replicate.com/v1/models/flux-kontext-apps/multi-image-kontext-max/predictions',
            {
              method: 'POST',
              headers: {
                Authorization: `Token ${replicateApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                input: {
                  prompt: schedule.prompt,
                  input_image_1: generationSettings.input_image_1_url,
                  input_image_2: generationSettings.input_image_2_url,
                  aspect_ratio: generationSettings.aspect_ratio || '1:1',
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
            .from('generated_content')
            .insert({
              schedule_id: schedule.id,
              user_id: schedule.user_id,
              project_id: schedule.project_id,
              content_type: 'design',
              prompt: schedule.prompt,
              generation_status: 'processing',
              metadata: {
                prediction_id: predictionData.id,
                input_image_1_url: generationSettings.input_image_1_url,
                input_image_2_url: generationSettings.input_image_2_url,
                aspect_ratio: generationSettings.aspect_ratio || '1:1',
                output_format: 'png',
                safety_tolerance: 1,
                model_used: 'flux-kontext-apps/multi-image-kontext-max',
                generation_settings: generationSettings,
              },
            });

          if (insertError) {
            console.error(`❌ Error inserting content record:`, insertError);
            throw insertError;
          }

          // Update the schedule's next run time
          const intervalMinutes = scheduleConfig.interval_minutes || 60;
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

        // Store the error in the database
        await supabase.from('generated_content').insert({
          schedule_id: schedule.id,
          user_id: schedule.user_id,
          project_id: schedule.project_id,
          content_type: 'design',
          prompt: schedule.prompt,
          generation_status: 'failed',
          metadata: {
            error_message: error.message,
            input_image_1_url: generationSettings.input_image_1_url,
            input_image_2_url: generationSettings.input_image_2_url,
            aspect_ratio: generationSettings.aspect_ratio || '1:1',
          },
        });

        continue;
      }
    }

    console.log(
      `🎉 Completed processing. Generated ${processedCount} new designs.`
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
