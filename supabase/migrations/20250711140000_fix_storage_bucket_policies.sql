-- Fix storage bucket policies for user-images bucket
-- Storage buckets have separate RLS policies from database tables

-- Create the user-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-images',
  'user-images', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Give users authenticated access to folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;

-- Create storage policies for the user-images bucket
-- Allow authenticated users to SELECT their own files
CREATE POLICY "Allow authenticated users to view files in user-images bucket" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'user-images' AND 
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to INSERT files with proper path structure
CREATE POLICY "Allow authenticated users to upload files to user-images bucket" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-images' AND 
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to UPDATE their own files
CREATE POLICY "Allow authenticated users to update their own files in user-images bucket" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'user-images' AND 
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to DELETE their own files  
CREATE POLICY "Allow authenticated users to delete their own files in user-images bucket" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'user-images' AND 
    auth.role() = 'authenticated' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role policies for backend operations
CREATE POLICY "Service role can manage all files in user-images bucket" ON storage.objects
  USING (bucket_id = 'user-images' AND auth.role() = 'service_role'); 