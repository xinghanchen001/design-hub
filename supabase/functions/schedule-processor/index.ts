import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

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

  try {
    console.log("=== Schedule Processor Function Called ===")
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration is missing')
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // First, create new scheduled jobs for active projects
    console.log("Creating scheduled jobs for active projects...")
    const { error: createJobsError } = await supabase.rpc('create_scheduled_jobs')
    
    if (createJobsError) {
      console.error("Error creating scheduled jobs:", createJobsError)
    } else {
      console.log("Scheduled jobs created successfully")
    }

    // Get all pending jobs
    console.log("Fetching pending jobs...")
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('scheduled_at', { ascending: true })
      .limit(5) // Process max 5 jobs at a time

    if (fetchError) {
      throw new Error(`Failed to fetch pending jobs: ${fetchError.message}`)
    }

    console.log(`Found ${pendingJobs?.length || 0} pending jobs`)

    if (!pendingJobs || pendingJobs.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No pending jobs to process",
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Process each pending job
    let processedCount = 0
    const results = []

    for (const job of pendingJobs) {
      try {
        console.log(`Processing job ${job.id} for project ${job.project_id}`)
        
        // Call the generate-image function
        const { data: generateResult, error: generateError } = await supabase.functions.invoke('generate-image', {
          body: {
            project_id: job.project_id,
            job_id: job.id,
            manual_generation: false
          }
        })

        if (generateError) {
          console.error(`Error generating image for job ${job.id}:`, generateError)
          results.push({
            job_id: job.id,
            success: false,
            error: generateError.message
          })
        } else if (generateResult?.success) {
          console.log(`Successfully processed job ${job.id}`)
          processedCount++
          results.push({
            job_id: job.id,
            success: true,
            image_url: generateResult.image?.image_url
          })
        } else {
          console.error(`Generation failed for job ${job.id}:`, generateResult?.error)
          results.push({
            job_id: job.id,
            success: false,
            error: generateResult?.error || 'Unknown error'
          })
        }
      } catch (error) {
        console.error(`Exception processing job ${job.id}:`, error)
        results.push({
          job_id: job.id,
          success: false,
          error: error.message
        })
      }
    }

    console.log(`=== Scheduler completed: ${processedCount}/${pendingJobs.length} jobs processed successfully ===`)

    return new Response(JSON.stringify({ 
      message: `Processed ${processedCount} jobs successfully`,
      processed: processedCount,
      total_jobs: pendingJobs.length,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error in schedule-processor function:", error)

    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})