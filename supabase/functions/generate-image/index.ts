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
    console.log('=== Image Generation Function Called ===');
    body = await req.json();
    console.log('Request body:', body);

    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY is not set');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration is missing');
    }

    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
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

    // Fetch schedule details
    console.log('Fetching schedule:', schedule_id);
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', schedule_id)
      .single();

    if (scheduleError) {
      console.error('Schedule fetch error:', scheduleError);
      throw new Error(`Failed to fetch schedule: ${scheduleError.message}`);
    }

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    console.log('Schedule found:', schedule.name);
    console.log('Schedule prompt:', schedule.prompt);

    const bucketSettings = (schedule.bucket_settings as any) || {};
    const generationSettings = (schedule.generation_settings as any) || {};

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

      // Fetch all bucket images for this project and user
      const { data: bucketImages, error: bucketError } = await supabase
        .from('project_bucket_images')
        .select('*')
        .eq('project_id', schedule.project_id)
        .eq('user_id', schedule.user_id)
        .eq('project_type', 'image-generation')
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
                image: bucketImage.image_url, // Use bucket image as reference
                aspect_ratio: generationSettings.aspect_ratio || '1:1',
                output_format: 'png',
                safety_tolerance: 2,
              },
            }
          );

          const generationTime = (Date.now() - startTime) / 1000;
          console.log(
            `✅ Image generation completed in ${generationTime} seconds`
          );
          console.log('Generated image URL:', output);

          if (!output || typeof output !== 'string') {
            throw new Error('Invalid output from Replicate API');
          }

          // Download and store the generated image
          const imageResponse = await fetch(output);
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
            projectId: schedule.project_id,
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
                project_id: schedule.project_id,
                schedule_id: schedule_id,
                project_type: schedule.project_type,
                content_type: 'image',
                title: `Generated from ${bucketImage.filename}`,
                description: schedule.prompt,
                content_url: storedImageUrl,
                generation_status: 'completed',
                metadata: {
                  prompt: schedule.prompt,
                  storage_path: filename,
                  model_used: 'flux-dev',
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
      };

      // Add reference image if provided in generation settings
      if (generationSettings.reference_image_url) {
        replicateInput.image = generationSettings.reference_image_url;
        console.log(
          'Using reference image:',
          generationSettings.reference_image_url
        );
      }

      const output = await replicate.run('black-forest-labs/flux-dev', {
        input: replicateInput,
      });

      const generationTime = (Date.now() - startTime) / 1000;
      console.log('Image generation completed in', generationTime, 'seconds');
      console.log('Generated image output:', output);

      // Handle both string and array responses from Replicate
      let imageUrl: string;
      if (Array.isArray(output) && output.length > 0) {
        imageUrl = output[0];
      } else if (typeof output === 'string') {
        imageUrl = output;
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

      // Create a unique filename with timestamp and project info
      const timestamp = Date.now();
      const filename = generateStoragePath({
        userId: schedule.user_id,
        projectId: schedule.project_id,
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
            project_id: schedule.project_id,
            schedule_id: schedule_id,
            project_type: schedule.project_type,
            content_type: 'image',
            title: 'AI Generated Image',
            description: schedule.prompt,
            content_url: storedImageUrl,
            generation_status: 'completed',
            metadata: {
              prompt: schedule.prompt,
              storage_path: filename,
              model_used: 'flux-dev',
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
        output_metadata: {
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
    const intervalMinutes = scheduleConfig.interval_minutes || 60;
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
