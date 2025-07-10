import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Replicate from 'npm:replicate';
import {
  generateStoragePath,
  getBucketName,
} from '../_shared/storage-utils.ts';

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

    const { project_id, manual_generation = false, job_id = null } = body;

    if (!project_id) {
      return new Response(
        JSON.stringify({
          error: 'Missing required field: project_id is required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Fetch project details
    console.log('Fetching project:', project_id);
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single();

    if (projectError) {
      console.error('Project fetch error:', projectError);
      throw new Error(`Failed to fetch project: ${projectError.message}`);
    }

    if (!project) {
      throw new Error('Project not found');
    }

    console.log('Project found:', project.name);
    console.log('Project prompt:', project.prompt);
    console.log('Use bucket images:', project.use_bucket_images);

    // Create or update generation job
    let generation_job_id = job_id;

    if (!generation_job_id) {
      console.log('Creating new generation job');
      const { data: newJob, error: jobError } = await supabase
        .from('generation_jobs')
        .insert([
          {
            project_id: project_id,
            status: 'running',
            scheduled_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
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
          status: 'running',
          started_at: new Date().toISOString(),
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

    // Check if this project uses bucket images for batch generation
    if (project.use_bucket_images) {
      console.log(
        '🗂️ Bucket mode: Fetching bucket images for batch generation...'
      );

      // Fetch all bucket images for this project
      const { data: bucketImages, error: bucketError } = await supabase
        .from('project_bucket_images')
        .select('*')
        .eq('project_id', project_id)
        .eq('user_id', project.user_id)
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
                prompt: project.prompt,
                image: bucketImage.image_url, // Use bucket image as reference
                aspect_ratio: '1:1',
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
            userId: project.user_id,
            projectId: project_id,
            projectType: 'project1',
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

          // Save generated image to database
          const { data: savedImage, error: imageError } = await supabase
            .from('generated_images')
            .insert([
              {
                project_id: project_id,
                generation_job_id: generation_job_id,
                image_url: storedImageUrl,
                storage_path: filename,
                prompt: project.prompt,
                reference_image_url: bucketImage.image_url,
                bucket_image_id: bucketImage.id,
                model_used: 'flux-kontext-max',
                aspect_ratio: '1:1',
                generation_time_seconds: generationTime,
              },
            ])
            .select()
            .single();

          if (imageError) {
            console.error('Image save error:', imageError);
            throw new Error(
              `Failed to save generated image: ${imageError.message}`
            );
          }

          generatedImages.push(savedImage);
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
        prompt: project.prompt,
        aspect_ratio: '1:1',
        output_format: 'png',
        safety_tolerance: 2,
      };

      // Add reference image if provided
      if (project.reference_image_url) {
        replicateInput.image = project.reference_image_url;
        console.log('Using reference image:', project.reference_image_url);
      }

      const output = await replicate.run('black-forest-labs/flux-kontext-max', {
        input: replicateInput,
      });

      const generationTime = (Date.now() - startTime) / 1000;
      console.log('Image generation completed in', generationTime, 'seconds');
      console.log('Generated image URL:', output);

      if (!output || typeof output !== 'string') {
        throw new Error('Invalid output from Replicate API');
      }

      // Download and store the image in Supabase storage
      console.log('Downloading generated image from:', output);
      const imageResponse = await fetch(output);

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
        userId: project.user_id,
        projectId: project_id,
        projectType: 'project1',
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

      // Save generated image to database with storage path
      console.log('Saving generated image to database...');
      const { data: savedImage, error: imageError } = await supabase
        .from('generated_images')
        .insert([
          {
            project_id: project_id,
            generation_job_id: generation_job_id,
            image_url: storedImageUrl,
            storage_path: filename,
            prompt: project.prompt,
            reference_image_url: project.reference_image_url,
            model_used: 'flux-kontext-max',
            aspect_ratio: '1:1',
            generation_time_seconds: generationTime,
          },
        ])
        .select()
        .single();

      if (imageError) {
        console.error('Image save error:', imageError);
        throw new Error(
          `Failed to save generated image: ${imageError.message}`
        );
      }

      generatedImages.push(savedImage);
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
        completed_at: new Date().toISOString(),
        images_generated: totalImagesGenerated,
      })
      .eq('id', generation_job_id);

    if (jobCompleteError) {
      console.error('Job completion error:', jobCompleteError);
      // Don't throw here as the image was generated successfully
    }

    // Update project's last generation timestamp
    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({
        last_generation_at: new Date().toISOString(),
      })
      .eq('id', project_id);

    if (projectUpdateError) {
      console.error('Project update error:', projectUpdateError);
      // Don't throw here as the image was generated successfully
    }

    console.log('=== Image Generation Completed Successfully ===');

    return new Response(
      JSON.stringify({
        success: true,
        images_generated: totalImagesGenerated,
        images: generatedImages,
        bucket_mode: project.use_bucket_images || false,
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
            completed_at: new Date().toISOString(),
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
