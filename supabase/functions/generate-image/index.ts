// Version 26 - Clean deployment without generation_job_id column
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Replicate from 'npm:replicate';

// Inline storage utilities
function generateStoragePath(options: {
  userId: string;
  projectId: string;
  projectType: string;
  timestamp?: number;
}): string {
  const { userId, projectId, projectType, timestamp } = options;
  const ts = timestamp || Date.now();

  switch (projectType) {
    case 'image-generation':
      return `${userId}/image-generation/${projectId}/generated_${ts}.png`;
    case 'print-on-shirt':
      return `${userId}/print-on-shirt/${projectId}/design_${ts}.png`;
    case 'journal':
      return `${userId}/journal/${projectId}/journal_${ts}.png`;
    default:
      return `${userId}/${projectType}/${projectId}/content_${ts}.png`;
  }
}

function getBucketName(contentType: string): string {
  switch (contentType) {
    case 'generated':
      return 'generated-images';
    case 'user-input':
      return 'user-bucket-images';
    default:
      return 'generated-images';
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let body: any = {};

  try {
    console.log('=== Image Generation Function Called v26 ===');
    body = await req.json();
    console.log('Request body:', body);

    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN is not set');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration is missing');
    }

    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const replicate = new Replicate({
      auth: REPLICATE_API_TOKEN,
    });

    const { schedule_id, manual_generation = false, job_id = null } = body;

    if (!schedule_id) {
      return new Response(
        JSON.stringify({
          error: 'Missing required field: schedule_id is required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Fetch schedule details directly to bypass RLS issues
    console.log('Fetching schedule:', schedule_id);

    // Direct query with service role to bypass RLS
    const { data: schedules, error: scheduleError } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', schedule_id)
      .limit(1);

    console.log('Schedule fetch result:', { schedules, scheduleError });

    if (scheduleError) {
      console.error('Schedule fetch error:', scheduleError);
      throw new Error(`Failed to fetch schedule: ${scheduleError.message}`);
    }

    if (!schedules || schedules.length === 0) {
      console.log('No schedule found with ID:', schedule_id);
      throw new Error('Schedule not found');
    }

    const schedule = schedules[0];

    console.log('Schedule found:', schedule.name);
    console.log('Schedule prompt:', schedule.prompt);

    const bucketSettings = (schedule.bucket_settings as any) || {};
    const generationSettings = (schedule.generation_settings as any) || {};

    // Check if we've reached the max images limit
    const { count: existingContentCount } = await supabase
      .from('generated_content')
      .select('*', { count: 'exact', head: true })
      .eq('schedule_id', schedule_id)
      .eq('content_type', 'image');

    // Support both field names: max_images and max_images_to_generate
    const maxImages =
      generationSettings.max_images_to_generate ||
      generationSettings.max_images ||
      10;

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
        .eq('id', schedule_id);

      return new Response(
        JSON.stringify({
          success: false,
          message: `Schedule paused: reached max images limit of ${maxImages}`,
          existing_images: existingContentCount,
          max_images: maxImages,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(
      `📊 Image generation progress: ${existingContentCount}/${maxImages} images generated`
    );

    // Create or update generation job
    let generation_job_id = job_id;

    if (!generation_job_id) {
      console.log('Creating new generation job');
      const { data: newJob, error: jobError } = await supabase
        .from('generation_jobs')
        .insert([
          {
            schedule_id: schedule_id,
            user_id: schedule.user_id,
            status: 'processing',
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (jobError) {
        console.error('Job creation error:', jobError);
        throw new Error(`Failed to create generation job: ${jobError.message}`);
      }

      generation_job_id = newJob.id;
    } else {
      // Update existing job to running status
      console.log('Updating existing job:', job_id);
      const { error: updateError } = await supabase
        .from('generation_jobs')
        .update({
          status: 'processing',
        })
        .eq('id', job_id);

      if (updateError) {
        console.error('Job update error:', updateError);
        throw new Error(
          `Failed to update generation job: ${updateError.message}`
        );
      }
    }

    let totalImagesGenerated = 0;
    const generatedImages = [];

    // Check if this schedule uses bucket images for batch generation
    if (bucketSettings.use_bucket_images) {
      console.log(
        '🗂️ Bucket mode: Fetching bucket images for batch generation...'
      );

      // Fetch all bucket images for this task and user
      const { data: bucketImages, error: bucketError } = await supabase
        .from('project_bucket_images')
        .select('*')
        .eq('task_id', schedule.task_id)
        .eq('user_id', schedule.user_id)
        .eq('task_type', 'image-generation')
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
        `📸 Found ${bucketImages.length} bucket images for batch generation`
      );

      // Generate one image for each bucket image
      for (const bucketImage of bucketImages) {
        try {
          console.log(
            `🎨 Generating image ${totalImagesGenerated + 1}/${
              bucketImages.length
            } using bucket image: ${bucketImage.filename}`
          );

          const startTime = Date.now();

          // Use bucket image as reference image in the generation
          const output = await replicate.run(
            'black-forest-labs/flux-kontext-max',
            {
              input: {
                prompt: schedule.prompt,
                input_image: bucketImage.image_url, // Use bucket image as reference
                aspect_ratio: generationSettings.aspect_ratio || '1:1',
                output_format: 'png',
                safety_tolerance: 2,
                prompt_upsampling: generationSettings.prompt_upsampling || true, // Automatic prompt improvement
                ...(generationSettings.seed && {
                  seed: generationSettings.seed,
                }), // Add seed if provided
              },
            }
          );

          const generationTime = (Date.now() - startTime) / 1000;
          console.log(
            `✅ Image generation completed in ${generationTime} seconds`
          );
          console.log('Generated image output:', output);

          // Handle both string URLs and FileOutput objects from Replicate
          let imageUrl: string;
          if (typeof output === 'string') {
            imageUrl = output;
          } else if (output && typeof output === 'object' && 'url' in output) {
            // Check if url is a function (FileOutput) or direct property
            const urlProperty = (output as any).url;
            if (typeof urlProperty === 'function') {
              imageUrl = urlProperty(); // Call the function to get the URL
              console.log('Called FileOutput.url() function:', imageUrl);
            } else {
              imageUrl = urlProperty; // Direct property access
              console.log('Extracted URL from FileOutput property:', imageUrl);
            }
          } else if (
            output &&
            typeof output === 'object' &&
            'toString' in output
          ) {
            // Fallback: try to get URL from toString method
            imageUrl = output.toString();
            console.log('Extracted URL from toString:', imageUrl);
          } else {
            console.error('Unexpected Replicate output format:', output);
            throw new Error('Invalid output from Replicate API');
          }

          if (!imageUrl || typeof imageUrl !== 'string') {
            throw new Error(
              'Could not extract valid URL from Replicate output'
            );
          }

          console.log('Final image URL to download:', imageUrl);

          // Download and store the generated image
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            throw new Error(
              `Failed to download image: ${imageResponse.statusText}`
            );
          }

          const imageBlob = await imageResponse.blob();
          const imageBuffer = await imageBlob.arrayBuffer();

          // Create unique filename for this generation
          const timestamp = Date.now() + totalImagesGenerated; // Add offset to prevent conflicts
          const filename = generateStoragePath({
            userId: schedule.user_id,
            projectId: schedule.task_id,
            projectType: 'image-generation',
            timestamp: timestamp,
          });

          console.log('📤 Uploading image to storage bucket:', filename);
          const bucketName = getBucketName('generated');
          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filename, imageBuffer, {
              contentType: 'image/png',
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw new Error(
              `Failed to upload image to storage: ${uploadError.message}`
            );
          }

          // Get the public URL for the stored image
          const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filename);

          const storedImageUrl = publicUrlData.publicUrl;
          console.log('📥 Image stored successfully at:', storedImageUrl);

          // Save generated content to unified table
          const { data: savedContent, error: contentError } = await supabase
            .from('generated_content')
            .insert([
              {
                user_id: schedule.user_id,
                task_id: schedule.task_id,
                schedule_id: schedule_id,
                task_type: schedule.task_type,
                content_type: 'image',
                title: `Generated from ${bucketImage.filename}`,
                description: schedule.prompt,
                content_url: storedImageUrl,
                generation_status: 'completed',
                metadata: {
                  prompt: schedule.prompt,
                  storage_path: filename,
                  model_used: 'flux-kontext-max',
                  reference_image_url: bucketImage.image_url,
                  reference_image_filename: bucketImage.filename,
                  aspect_ratio: generationSettings.aspect_ratio || '1:1',
                  generation_time_seconds: generationTime,
                  output_format: 'png',
                  bucket_generation: true,
                  generation_settings: generationSettings,
                },
              },
            ])
            .select()
            .single();

          if (contentError) {
            console.error('Content save error:', contentError);
            throw new Error(
              `Failed to save generated content: ${contentError.message}`
            );
          }

          generatedImages.push(savedContent);
          totalImagesGenerated++;
          console.log(
            `✅ Successfully generated and saved image ${totalImagesGenerated}/${bucketImages.length}`
          );
        } catch (error) {
          console.error(
            `❌ Error generating image for bucket image ${bucketImage.filename}:`,
            error
          );
          // Continue with next image instead of failing completely
          continue;
        }
      }
    } else {
      // Original single image generation logic
      console.log(
        '🎨 Single mode: Starting image generation with Replicate...'
      );
      const startTime = Date.now();

      const replicateInput: any = {
        prompt: schedule.prompt,
        aspect_ratio: generationSettings.aspect_ratio || '1:1',
        output_format: 'png',
        safety_tolerance: 2,
        prompt_upsampling: generationSettings.prompt_upsampling || true, // Automatic prompt improvement
      };

      // Add seed if provided for reproducible generation
      if (generationSettings.seed) {
        replicateInput.seed = generationSettings.seed;
      }

      // Add reference image if provided in generation settings
      if (generationSettings.reference_image_url) {
        console.log(
          '🖼️ Reference image URL found:',
          generationSettings.reference_image_url
        );

        // Try to validate the reference image, but don't let validation failures block usage
        try {
          console.log('🔍 Validating reference image accessibility...');
          const imageCheck = await fetch(
            generationSettings.reference_image_url,
            {
              method: 'HEAD',
              signal: AbortSignal.timeout(5000), // 5 second timeout
            }
          );

          if (!imageCheck.ok) {
            console.warn(
              `⚠️ Reference image returned ${imageCheck.status}, but proceeding anyway: ${generationSettings.reference_image_url}`
            );
          } else {
            console.log('✅ Reference image validation successful');
          }
        } catch (error) {
          console.warn(
            '⚠️ Reference image validation failed, but proceeding anyway:',
            error instanceof Error ? error.message : String(error)
          );
        }

        // Always set the reference image regardless of validation result
        replicateInput.input_image = generationSettings.reference_image_url;
        console.log(
          '🎯 Reference image added to Replicate input:',
          generationSettings.reference_image_url
        );
      } else {
        console.log('📝 No reference image URL found in generation settings');
      }

      // Log the complete input being sent to Replicate
      console.log(
        '🚀 Complete Replicate input:',
        JSON.stringify(replicateInput, null, 2)
      );

      const output = await replicate.run('black-forest-labs/flux-kontext-max', {
        input: replicateInput,
      });

      const generationTime = (Date.now() - startTime) / 1000;
      console.log('Image generation completed in', generationTime, 'seconds');
      console.log('Generated image output:', output);

      // Handle string, array, and FileOutput responses from Replicate
      let imageUrl: string;
      if (Array.isArray(output) && output.length > 0) {
        // If it's an array, get the first item and handle it appropriately
        const firstOutput = output[0];
        if (typeof firstOutput === 'string') {
          imageUrl = firstOutput;
        } else if (
          firstOutput &&
          typeof firstOutput === 'object' &&
          'url' in firstOutput
        ) {
          // Check if url is a function (FileOutput) or direct property
          const urlProperty = (firstOutput as any).url;
          if (typeof urlProperty === 'function') {
            imageUrl = urlProperty(); // Call the function to get the URL
            console.log('Called FileOutput.url() function in array:', imageUrl);
          } else {
            imageUrl = urlProperty; // Direct property access
            console.log(
              'Extracted URL from FileOutput property in array:',
              imageUrl
            );
          }
        } else {
          imageUrl = firstOutput.toString();
        }
      } else if (typeof output === 'string') {
        imageUrl = output;
      } else if (output && typeof output === 'object' && 'url' in output) {
        // Check if url is a function (FileOutput) or direct property
        const urlProperty = (output as any).url;
        if (typeof urlProperty === 'function') {
          imageUrl = urlProperty(); // Call the function to get the URL
          console.log('Called FileOutput.url() function:', imageUrl);
        } else {
          imageUrl = urlProperty; // Direct property access
          console.log('Extracted URL from FileOutput property:', imageUrl);
        }
      } else if (output && typeof output === 'object' && 'toString' in output) {
        imageUrl = output.toString();
        console.log('Extracted URL from toString:', imageUrl);
      } else {
        console.error('Unexpected Replicate output format:', output);
        throw new Error('Invalid output from Replicate API');
      }

      console.log('Using image URL:', imageUrl);

      // Download and store the image in Supabase storage
      console.log('Downloading generated image from:', imageUrl);
      const imageResponse = await fetch(imageUrl);

      if (!imageResponse.ok) {
        throw new Error(
          `Failed to download image: ${imageResponse.statusText}`
        );
      }

      const imageBlob = await imageResponse.blob();
      const imageBuffer = await imageBlob.arrayBuffer();

      // Create a unique filename with timestamp and task info
      const timestamp = Date.now();
      const filename = generateStoragePath({
        userId: schedule.user_id,
        projectId: schedule.task_id,
        projectType: 'image-generation',
        timestamp: timestamp,
      });

      console.log('Uploading image to storage bucket:', filename);
      const bucketName = getBucketName('generated');
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filename, imageBuffer, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(
          `Failed to upload image to storage: ${uploadError.message}`
        );
      }

      // Get the public URL for the stored image
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filename);

      const storedImageUrl = publicUrlData.publicUrl;
      console.log('Image stored successfully at:', storedImageUrl);

      // Save generated content to unified table
      console.log('Saving generated content to database...');
      const { data: savedContent, error: contentError } = await supabase
        .from('generated_content')
        .insert([
          {
            user_id: schedule.user_id,
            task_id: schedule.task_id,
            schedule_id: schedule_id,
            task_type: schedule.task_type,
            content_type: 'image',
            title: 'AI Generated Image',
            description: schedule.prompt,
            content_url: storedImageUrl,
            generation_status: 'completed',
            metadata: {
              prompt: schedule.prompt,
              storage_path: filename,
              model_used: 'flux-kontext-max',
              reference_image_url: generationSettings.reference_image_url,
              aspect_ratio: generationSettings.aspect_ratio || '1:1',
              generation_time_seconds: generationTime,
              output_format: 'png',
              generation_settings: generationSettings,
            },
          },
        ])
        .select()
        .single();

      if (contentError) {
        console.error('Content save error:', contentError);
        throw new Error(
          `Failed to save generated content: ${contentError.message}`
        );
      }

      generatedImages.push(savedContent);
      totalImagesGenerated = 1;
    }

    // Update generation job as completed
    console.log(
      `Updating job status to completed (generated ${totalImagesGenerated} images)`
    );
    const { error: jobCompleteError } = await supabase
      .from('generation_jobs')
      .update({
        status: 'completed',
        output_data: {
          images_generated: totalImagesGenerated,
        },
      })
      .eq('id', generation_job_id);

    if (jobCompleteError) {
      console.error('Job completion error:', jobCompleteError);
      // Don't throw here as the image was generated successfully
    }

    // Update schedule's next run time
    const scheduleConfig = (schedule.schedule_config as any) || {};
    const intervalMinutes = scheduleConfig.generation_interval_minutes || 60;
    const nextRun = new Date(Date.now() + intervalMinutes * 60 * 1000);

    const { error: scheduleUpdateError } = await supabase
      .from('schedules')
      .update({
        next_run: nextRun.toISOString(),
      })
      .eq('id', schedule_id);

    if (scheduleUpdateError) {
      console.error('Schedule update error:', scheduleUpdateError);
      // Don't throw here as the image was generated successfully
    }

    console.log('=== Image Generation Completed Successfully ===');

    return new Response(
      JSON.stringify({
        success: true,
        images_generated: totalImagesGenerated,
        images: generatedImages,
        bucket_mode: bucketSettings.use_bucket_images || false,
        job_id: generation_job_id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in generate-image function:', error);

    // Try to update job status to failed if we have a job_id
    if (body?.job_id) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        await supabase
          .from('generation_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', body.job_id);
      } catch (updateError) {
        console.error('Failed to update job status to failed:', updateError);
      }
    }

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
