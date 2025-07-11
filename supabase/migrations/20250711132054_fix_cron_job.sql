-- Fix cron job to call the correct print-on-shirt processor function

-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing schedule first (ignore errors if they don't exist)
DO $$
BEGIN
    BEGIN
        PERFORM cron.unschedule('process-schedules');
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore error if job doesn't exist
    END;
    
    BEGIN
        PERFORM cron.unschedule('process-print-on-shirt-schedules');
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore error if job doesn't exist
    END;
END $$;

-- Create a cron job that runs every minute to process print-on-shirt schedules
SELECT cron.schedule(
  'process-print-on-shirt-schedules', 
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url:='https://sphgdlqoabzsyhtyopim.supabase.co/functions/v1/print-on-shirt-processor-correct',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwaGdkbHFvYWJ6c3lodHlvcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc3MjEsImV4cCI6MjA2NjQ2MzcyMX0.uXtmbccpR_lZ-lywL1qogPmAePFRb8YnUkuAAv35Q5s"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
