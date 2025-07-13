import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const replicateToken = Deno.env.get('REPLICATE_API_TOKEN')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface VideoGenerationRequest {
  schedule_id: string;
  generation_job_id: string;
  prompt: string;
  negative_prompt?: string;
  start_image: string;
  mode?: 'standard' | 'pro';
  duration?: 5 | 10;
  user_id: string;
  task_id: string;
}

serve(async (req) => {
  try {
    console.log('Video generation processor started');

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body: VideoGenerationRequest = await req.json();
    console.log('Processing video generation request:', {
      schedule_id: body.schedule_id,
      prompt: body.prompt?.substring(0, 100),
      start_image: body.start_image?.substring(0, 100),
      mode: body.mode,
      duration: body.duration,
    });

    // Validate required fields
    if (
      !body.prompt ||
      !body.start_image ||
      !body.schedule_id ||
      !body.user_id ||
      !body.task_id ||
      !body.generation_job_id
    ) {
      console.error('Missing required fields:', {
        prompt: !!body.prompt,
        start_image: !!body.start_image,
        schedule_id: !!body.schedule_id,
        user_id: !!body.user_id,
        task_id: !!body.task_id,
        generation_job_id: !!body.generation_job_id,
      });
      return new Response('Missing required fields', { status: 400 });
    }

    // Create prediction with Replicate Kling v2.1 model
    const prediction = await createReplicatePrediction({
      prompt: body.prompt,
      negative_prompt: body.negative_prompt || '',
      start_image: body.start_image,
      mode: body.mode || 'standard',
      duration: body.duration || 5,
    });

    if (!prediction || !prediction.id) {
      console.error('Failed to create Replicate prediction');
      return new Response('Failed to create prediction', { status: 500 });
    }

    console.log('Replicate prediction created:', prediction.id);

    // Update the generation_jobs table with the prediction ID
    const { error: jobUpdateError } = await supabase
      .from('generation_jobs')
      .update({
        external_job_id: prediction.id,
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', body.generation_job_id);

    if (jobUpdateError) {
      console.error('Error updating generation job:', jobUpdateError);
      // It's not a fatal error for the whole process, but we should log it
    }

    // Store in generated_content table
    const { data: contentData, error: contentError } = await supabase
      .from('generated_content')
      .insert({
        schedule_id: body.schedule_id,
        task_id: body.task_id,
        user_id: body.user_id,
        task_type: 'video-generation',
        content_type: 'video',
        title: `Video: ${body.prompt.substring(0, 50)}...`,
        description: body.prompt,
        generation_status: 'processing',
        metadata: {
          prompt: body.prompt,
          negative_prompt: body.negative_prompt,
          start_image: body.start_image,
          mode: body.mode || 'standard',
          duration: body.duration || 5,
          model: 'kwaivgi/kling-v2.1',
          created_at: new Date().toISOString(),
          prediction_id: prediction.id,
        },
      })
      .select()
      .single();

    if (contentError) {
      console.error('Error inserting generated content:', contentError);
      return new Response('Database error', { status: 500 });
    }

    console.log('Generated content record created:', contentData.id);

    return new Response(
      JSON.stringify({
        success: true,
        prediction_id: prediction.id,
        content_id: contentData.id,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Video generation processor error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});

async function createReplicatePrediction(params: {
  prompt: string;
  negative_prompt: string;
  start_image: string;
  mode: 'standard' | 'pro';
  duration: 5 | 10;
}) {
  console.log('Creating Replicate prediction with Kling v2.1:', params);

  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Token ${replicateToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'kwaivgi/kling-v2.1',
      input: {
        prompt: params.prompt,
        negative_prompt: params.negative_prompt,
        start_image: params.start_image,
        mode: params.mode,
        duration: params.duration,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Replicate API error:', response.status, errorText);
    throw new Error(`Replicate API error: ${response.status} ${errorText}`);
  }

  return await response.json();
}
