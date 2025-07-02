import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import Replicate from "https://esm.sh/replicate@0.25.2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body: any = {}
  
  try {
    console.log("=== Image Generation Function Called ===")
    body = await req.json()
    console.log("Request body:", body)
    
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY is not set')
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration is missing')
    }

    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    })

    const { project_id, manual_generation = false, job_id = null } = body

    if (!project_id) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required field: project_id is required" 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Fetch project details
    console.log("Fetching project:", project_id)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single()

    if (projectError) {
      console.error("Project fetch error:", projectError)
      throw new Error(`Failed to fetch project: ${projectError.message}`)
    }

    if (!project) {
      throw new Error('Project not found')
    }

    console.log("Project found:", project.name)
    console.log("Project prompt:", project.prompt)

    // Create or update generation job
    let generation_job_id = job_id
    
    if (!generation_job_id) {
      console.log("Creating new generation job")
      const { data: newJob, error: jobError } = await supabase
        .from('generation_jobs')
        .insert([{
          project_id: project_id,
          status: 'running',
          scheduled_at: new Date().toISOString(),
          started_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (jobError) {
        console.error("Job creation error:", jobError)
        throw new Error(`Failed to create generation job: ${jobError.message}`)
      }
      
      generation_job_id = newJob.id
    } else {
      // Update existing job to running status
      console.log("Updating existing job:", job_id)
      const { error: updateError } = await supabase
        .from('generation_jobs')
        .update({
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', job_id)

      if (updateError) {
        console.error("Job update error:", updateError)
        throw new Error(`Failed to update generation job: ${updateError.message}`)
      }
    }

    // Generate image using Replicate
    console.log("Starting image generation with Replicate...")
    const startTime = Date.now()
    
    const output = await replicate.run(
      "black-forest-labs/flux-kontext-max",
      {
        input: {
          prompt: project.prompt,
          aspect_ratio: "1:1",
          output_format: "png",
          safety_tolerance: 2
        }
      }
    )

    const generationTime = (Date.now() - startTime) / 1000
    console.log("Image generation completed in", generationTime, "seconds")
    console.log("Generated image URL:", output)

    if (!output || typeof output !== 'string') {
      throw new Error('Invalid output from Replicate API')
    }

    // Save generated image to database
    console.log("Saving generated image to database...")
    const { data: savedImage, error: imageError } = await supabase
      .from('generated_images')
      .insert([{
        project_id: project_id,
        generation_job_id: generation_job_id,
        image_url: output,
        prompt: project.prompt,
        model_used: 'flux-kontext-max',
        aspect_ratio: '1:1',
        generation_time_seconds: generationTime
      }])
      .select()
      .single()

    if (imageError) {
      console.error("Image save error:", imageError)
      throw new Error(`Failed to save generated image: ${imageError.message}`)
    }

    // Update generation job as completed
    console.log("Updating job status to completed")
    const { error: jobCompleteError } = await supabase
      .from('generation_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        images_generated: 1
      })
      .eq('id', generation_job_id)

    if (jobCompleteError) {
      console.error("Job completion error:", jobCompleteError)
      // Don't throw here as the image was generated successfully
    }

    // Update project's last generation timestamp
    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({
        last_generation_at: new Date().toISOString()
      })
      .eq('id', project_id)

    if (projectUpdateError) {
      console.error("Project update error:", projectUpdateError)
      // Don't throw here as the image was generated successfully
    }

    console.log("=== Image Generation Completed Successfully ===")

    return new Response(JSON.stringify({ 
      success: true,
      image: savedImage,
      generation_time_seconds: generationTime,
      job_id: generation_job_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error in generate-image function:", error)
    
    // Try to update job status to failed if we have a job_id
    if (body?.job_id) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )
        
        await supabase
          .from('generation_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', body.job_id)
      } catch (updateError) {
        console.error("Failed to update job status to failed:", updateError)
      }
    }

    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})