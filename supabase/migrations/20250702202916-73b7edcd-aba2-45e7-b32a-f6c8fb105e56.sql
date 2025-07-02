-- Clean up and reset the database for the current AI Image Agent project

-- First, safely drop the foreign key constraint
ALTER TABLE public.generated_images DROP CONSTRAINT IF EXISTS fk_generated_images_generation_job;

-- Clear all existing data to start fresh
DELETE FROM public.generated_images;
DELETE FROM public.generation_jobs;
DELETE FROM public.training_images;
DELETE FROM public.projects;

-- Reset sequences if they exist
DO $$ 
BEGIN
    -- Reset any sequences that might exist (this is safe if they don't exist)
    PERFORM setval(pg_get_serial_sequence('public.projects', 'created_at'), 1, false);
EXCEPTION 
    WHEN others THEN NULL;
END $$;

-- Recreate the foreign key constraint
ALTER TABLE public.generated_images 
ADD CONSTRAINT fk_generated_images_generation_job 
FOREIGN KEY (generation_job_id) REFERENCES public.generation_jobs(id) ON DELETE SET NULL;

-- Create a function to automatically create generation jobs for active schedules
CREATE OR REPLACE FUNCTION public.create_scheduled_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create pending jobs for projects with active schedules that need new jobs
  INSERT INTO public.generation_jobs (project_id, status, scheduled_at)
  SELECT 
    p.id,
    'pending',
    now()
  FROM public.projects p
  WHERE p.schedule_enabled = true 
    AND p.is_active = true
    AND (
      p.last_generation_at IS NULL 
      OR p.last_generation_at < (now() - (p.generation_interval_minutes || ' minutes')::interval)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.generation_jobs gj 
      WHERE gj.project_id = p.id 
      AND gj.status IN ('pending', 'running')
    );
END;
$$;