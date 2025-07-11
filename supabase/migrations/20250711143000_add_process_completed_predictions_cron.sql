-- Add cron job to process completed predictions from Replicate API
-- This will check every 2 minutes for completed image generations

SELECT cron.schedule(
  'process-completed-predictions-job',
  '*/2 * * * *', -- Every 2 minutes
  $$
  SELECT net.http_post(
    url := 'https://sphgdlqoabzsyhtyopim.supabase.co/functions/v1/process-completed-predictions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object()
  );
  $$
); 