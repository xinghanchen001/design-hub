import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== Schedule Processor Function Called ===');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration is missing');
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all active schedules that need processing
    console.log('Fetching active schedules that need processing...');
    const { data: schedules, error: schedulesError } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'active')
      .lte('next_run', new Date().toISOString())
      .limit(5); // Process max 5 schedules at a time

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      throw new Error(`Failed to fetch schedules: ${schedulesError.message}`);
    }

    console.log(
      `Found ${schedules?.length || 0} schedules ready for processing`
    );

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No schedules ready for processing',
          processed: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Process each schedule
    let processedCount = 0;
    const results = [];

    for (const schedule of schedules) {
      try {
        console.log(
          `Processing schedule ${schedule.id} (${schedule.name}) for task type: ${schedule.task_type}`
        );

        // Create a generation job for this schedule
        const { data: newJob, error: jobError } = await supabase
          .from('generation_jobs')
          .insert([
            {
              schedule_id: schedule.id,
              user_id: schedule.user_id,
              task_type: schedule.task_type,
              job_type: 'single',
              status: 'queued',
              created_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (jobError) {
          console.error(
            `Error creating job for schedule ${schedule.id}:`,
            jobError
          );
          results.push({
            schedule_id: schedule.id,
            success: false,
            error: jobError.message,
          });
          continue;
        }

        // Call the appropriate function based on task type
        let generateResult;
        let generateError;

        if (schedule.task_type === 'image-generation') {
          // Check max_images limit before generating
          const maxImages =
            schedule.generation_settings?.max_images_to_generate ||
            schedule.generation_settings?.max_images ||
            10;

          const { count: existingImages } = await supabase
            .from('generated_content')
            .select('*', { count: 'exact', head: true })
            .eq('schedule_id', schedule.id)
            .eq('content_type', 'image');

          if (existingImages && existingImages >= maxImages) {
            console.log(
              `Schedule ${schedule.id} has reached max_images limit (${maxImages}). Skipping generation.`
            );

            // Pause the schedule
            await supabase
              .from('schedules')
              .update({ status: 'paused' })
              .eq('id', schedule.id);

            generateResult = {
              success: true,
              skipped: true,
              reason: `Max images limit reached (${existingImages}/${maxImages})`,
            };
            generateError = null;
          } else {
            console.log(
              `Schedule ${schedule.id}: ${
                existingImages || 0
              }/${maxImages} images generated. Proceeding with generation.`
            );

            // Call the generate-image function
            const result = await supabase.functions.invoke('generate-image', {
              body: {
                schedule_id: schedule.id,
                job_id: newJob.id,
                manual_generation: false,
              },
            });
            generateResult = result.data;
            generateError = result.error;
          }
        } else if (schedule.task_type === 'print-on-shirt') {
          // Check max_images limit before generating
          const maxImages =
            schedule.generation_settings?.max_images_to_generate ||
            schedule.generation_settings?.max_images ||
            10;

          const { count: existingDesigns } = await supabase
            .from('generated_content')
            .select('*', { count: 'exact', head: true })
            .eq('schedule_id', schedule.id)
            .eq('content_type', 'design');

          if (existingDesigns && existingDesigns >= maxImages) {
            console.log(
              `Schedule ${schedule.id} has reached max_images limit (${maxImages}). Skipping generation.`
            );

            // Pause the schedule
            await supabase
              .from('schedules')
              .update({ status: 'paused' })
              .eq('id', schedule.id);

            generateResult = {
              success: true,
              skipped: true,
              reason: `Max images limit reached (${existingDesigns}/${maxImages})`,
            };
            generateError = null;
          } else {
            console.log(
              `Schedule ${schedule.id}: ${
                existingDesigns || 0
              }/${maxImages} designs generated. Proceeding with generation.`
            );

            // Call the print-on-shirt processor function
            const result = await supabase.functions.invoke(
              'print-on-shirt-processor-correct',
              {
                body: {
                  schedule_id: schedule.id,
                  job_id: newJob.id,
                  manual_generation: false,
                },
              }
            );
            generateResult = result.data;
            generateError = result.error;
          }
        } else if (schedule.task_type === 'video-generation') {
          // Check max_videos limit before generating
          const maxVideos = schedule.generation_settings?.max_videos;
          const durationHours = schedule.schedule_config?.duration_hours || 24;

          if (maxVideos && maxVideos > 0) {
            // Check how many videos have been generated within the duration period
            const { data: existingVideos, error: countError } = await supabase
              .from('generated_content')
              .select('id')
              .eq('schedule_id', schedule.id)
              .eq('task_type', 'video-generation')
              .gte(
                'created_at',
                new Date(
                  Date.now() - durationHours * 60 * 60 * 1000
                ).toISOString()
              );

            if (countError) {
              console.error(
                `Error counting existing videos for schedule ${schedule.id}:`,
                countError
              );
              generateResult = { success: false, error: countError.message };
              generateError = countError;
            } else if (existingVideos && existingVideos.length >= maxVideos) {
              console.log(
                `Schedule ${schedule.id} has reached max_videos limit (${maxVideos}). Skipping generation.`
              );
              generateResult = {
                success: true,
                skipped: true,
                reason: `Max videos limit reached (${existingVideos.length}/${maxVideos})`,
              };
              generateError = null;
            } else {
              console.log(
                `Schedule ${schedule.id}: ${
                  existingVideos?.length || 0
                }/${maxVideos} videos generated. Proceeding with generation.`
              );

              // Call the video-generation processor function
              const result = await supabase.functions.invoke(
                'video-generation-processor',
                {
                  body: {
                    schedule_id: schedule.id,
                    generation_job_id: newJob.id,
                    prompt: schedule.prompt,
                    negative_prompt:
                      schedule.generation_settings?.negative_prompt || '',
                    start_image: schedule.generation_settings?.start_image_url,
                    mode: schedule.generation_settings?.mode || 'standard',
                    duration: schedule.generation_settings?.duration || 5,
                    user_id: schedule.user_id,
                    task_id: schedule.task_id,
                  },
                }
              );
              generateResult = result.data;
              generateError = result.error;
            }
          } else {
            // No max_videos limit set, proceed with generation
            console.log(
              `Schedule ${schedule.id}: No max_videos limit set. Proceeding with generation.`
            );

            const result = await supabase.functions.invoke(
              'video-generation-processor',
              {
                body: {
                  schedule_id: schedule.id,
                  generation_job_id: newJob.id,
                  prompt: schedule.prompt,
                  negative_prompt:
                    schedule.generation_settings?.negative_prompt || '',
                  start_image: schedule.generation_settings?.start_image_url,
                  mode: schedule.generation_settings?.mode || 'standard',
                  duration: schedule.generation_settings?.duration || 5,
                  user_id: schedule.user_id,
                  task_id: schedule.task_id,
                },
              }
            );
            generateResult = result.data;
            generateError = result.error;
          }
        } else if (schedule.task_type === 'journal') {
          // For journal, we'll handle it differently since it doesn't generate images
          console.log(
            `Journal processing not applicable for schedule ${schedule.id}`
          );
          generateResult = {
            success: false,
            error: 'Journal processing not applicable in schedule processor',
          };
        } else {
          console.log(`Unknown task type: ${schedule.task_type}`);
          generateResult = {
            success: false,
            error: `Unknown task type: ${schedule.task_type}`,
          };
        }

        if (generateError) {
          console.error(
            `Error generating content for schedule ${schedule.id}:`,
            generateError
          );
          results.push({
            schedule_id: schedule.id,
            success: false,
            error: generateError.message,
          });
        } else if (generateResult?.success) {
          console.log(`Successfully processed schedule ${schedule.id}`);

          // Update schedule's next run time
          const scheduleConfig = (schedule.schedule_config as any) || {};
          const intervalMinutes =
            scheduleConfig.generation_interval_minutes || 60;
          const nextRun = new Date(Date.now() + intervalMinutes * 60 * 1000);

          await supabase
            .from('schedules')
            .update({
              last_run: new Date().toISOString(),
              next_run: nextRun.toISOString(),
            })
            .eq('id', schedule.id);

          processedCount++;
          results.push({
            schedule_id: schedule.id,
            success: true,
            images_generated: generateResult.images_generated || 0,
          });
        } else {
          console.error(
            `Generation failed for schedule ${schedule.id}:`,
            generateResult?.error
          );
          results.push({
            schedule_id: schedule.id,
            success: false,
            error: generateResult?.error || 'Unknown error',
          });
        }
      } catch (error) {
        console.error(`Exception processing schedule ${schedule.id}:`, error);
        results.push({
          schedule_id: schedule.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(
      `=== Scheduler completed: ${processedCount}/${schedules.length} schedules processed successfully ===`
    );

    return new Response(
      JSON.stringify({
        message: `Processed ${processedCount} schedules successfully`,
        processed: processedCount,
        total_schedules: schedules.length,
        results: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in schedule-processor function:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
