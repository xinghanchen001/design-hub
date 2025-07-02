-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job that runs every minute to process schedules
SELECT cron.schedule(
  'process-schedules', 
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url:='https://sphgdlqoabzsyhtyopim.supabase.co/functions/v1/schedule-processor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwaGdkbHFvYWJ6c3lodHlvcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc3MjEsImV4cCI6MjA2NjQ2MzcyMX0.uXtmbccpR_lZ-lywL1qogPmAePFRb8YnUkuAAv35Q5s"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);