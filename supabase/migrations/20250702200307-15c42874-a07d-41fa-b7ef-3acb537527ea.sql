-- Extend projects table to support AI agent configuration
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS prompt TEXT,
ADD COLUMN IF NOT EXISTS schedule_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS schedule_duration_hours INTEGER,
ADD COLUMN IF NOT EXISTS max_images_to_generate INTEGER,
ADD COLUMN IF NOT EXISTS generation_interval_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS last_generation_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create generation_jobs table for tracking scheduled tasks
CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  images_generated INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

-- Enable RLS on generation_jobs
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for generation_jobs
CREATE POLICY "Users can view generation jobs for their projects" 
ON public.generation_jobs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = generation_jobs.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create generation jobs for their projects" 
ON public.generation_jobs 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = generation_jobs.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update generation jobs for their projects" 
ON public.generation_jobs 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = generation_jobs.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete generation jobs for their projects" 
ON public.generation_jobs 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM projects 
  WHERE projects.id = generation_jobs.project_id 
  AND projects.user_id = auth.uid()
));

-- Create trigger for generation_jobs updated_at
CREATE TRIGGER update_generation_jobs_updated_at
BEFORE UPDATE ON public.generation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_generation_jobs_project_id ON public.generation_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON public.generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_scheduled_at ON public.generation_jobs(scheduled_at);

-- Add more columns to generated_images for better tracking
ALTER TABLE public.generated_images 
ADD COLUMN IF NOT EXISTS generation_job_id UUID,
ADD COLUMN IF NOT EXISTS generation_time_seconds NUMERIC,
ADD COLUMN IF NOT EXISTS model_used TEXT DEFAULT 'flux-kontext-max',
ADD COLUMN IF NOT EXISTS aspect_ratio TEXT,
ADD COLUMN IF NOT EXISTS seed INTEGER;

-- Add foreign key for generation_job_id
ALTER TABLE public.generated_images 
ADD CONSTRAINT fk_generated_images_generation_job 
FOREIGN KEY (generation_job_id) REFERENCES public.generation_jobs(id) ON DELETE SET NULL;