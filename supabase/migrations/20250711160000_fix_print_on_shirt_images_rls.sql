-- Fix RLS policies for print_on_shirt_images table to allow Edge function updates
-- Created: 2025-07-11T16:00:00Z
-- Issue: Edge function can read but not update print_on_shirt_images due to restrictive RLS policies

-- First, check if RLS is enabled and what policies exist
DO $$ 
BEGIN
    RAISE NOTICE 'Current RLS status and policies for print_on_shirt_images:';
END $$;

-- Check current RLS status
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'print_on_shirt_images';

-- Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'print_on_shirt_images';

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can view their own images" ON print_on_shirt_images;
DROP POLICY IF EXISTS "Users can update their own images" ON print_on_shirt_images;
DROP POLICY IF EXISTS "Users can insert their own images" ON print_on_shirt_images;
DROP POLICY IF EXISTS "Users can delete their own images" ON print_on_shirt_images;

-- Create permissive policies that allow service role access
-- Policy for SELECT (viewing)
CREATE POLICY "Allow read access for authenticated users and service role" 
ON print_on_shirt_images FOR SELECT 
TO authenticated, service_role 
USING (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
);

-- Policy for INSERT (creating)
CREATE POLICY "Allow insert for authenticated users and service role" 
ON print_on_shirt_images FOR INSERT 
TO authenticated, service_role 
WITH CHECK (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
);

-- Policy for UPDATE (modifying) - This is the critical one for Edge functions
CREATE POLICY "Allow update for authenticated users and service role" 
ON print_on_shirt_images FOR UPDATE 
TO authenticated, service_role 
USING (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
) 
WITH CHECK (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
);

-- Policy for DELETE
CREATE POLICY "Allow delete for authenticated users and service role" 
ON print_on_shirt_images FOR DELETE 
TO authenticated, service_role 
USING (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
);

-- Ensure RLS is enabled
ALTER TABLE print_on_shirt_images ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to service_role
GRANT ALL ON print_on_shirt_images TO service_role;

-- Verify the new policies
SELECT 
    'AFTER UPDATE' as status,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'print_on_shirt_images'
ORDER BY cmd, policyname;

COMMENT ON TABLE print_on_shirt_images IS 'Updated RLS policies to allow service role access for Edge function updates - 2025-07-11T16:00:00Z'; 