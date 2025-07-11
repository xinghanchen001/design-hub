-- Add multi-select bucket image support to print_on_shirt_schedules table
-- This migration adds array columns to support selecting multiple images from each reference set

-- Add new array columns for multi-select bucket images
ALTER TABLE public.print_on_shirt_schedules 
ADD COLUMN IF NOT EXISTS bucket_image_1_ids TEXT[],
ADD COLUMN IF NOT EXISTS bucket_image_2_ids TEXT[];

-- Create indexes for the new array columns for better query performance
CREATE INDEX IF NOT EXISTS idx_print_on_shirt_schedules_bucket_image_1_ids 
ON public.print_on_shirt_schedules USING GIN (bucket_image_1_ids);

CREATE INDEX IF NOT EXISTS idx_print_on_shirt_schedules_bucket_image_2_ids 
ON public.print_on_shirt_schedules USING GIN (bucket_image_2_ids);

-- Add comment to document the change
COMMENT ON COLUMN public.print_on_shirt_schedules.bucket_image_1_ids 
IS 'Array of bucket image IDs for reference set 1 (multi-select support)';

COMMENT ON COLUMN public.print_on_shirt_schedules.bucket_image_2_ids 
IS 'Array of bucket image IDs for reference set 2 (multi-select support)'; 