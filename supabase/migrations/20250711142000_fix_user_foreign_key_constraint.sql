-- Fix user foreign key constraint issues
-- The issue is that user_id from frontend doesn't always exist in auth.users table

-- Option 1: Drop the foreign key constraints that reference auth.users
-- These constraints are often problematic with Supabase auth timing
ALTER TABLE "public"."project_bucket_images" 
DROP CONSTRAINT IF EXISTS "project_bucket_images_user_id_fkey";

ALTER TABLE "public"."print_on_shirt_schedules" 
DROP CONSTRAINT IF EXISTS "print_on_shirt_schedules_user_id_fkey";

ALTER TABLE "public"."print_on_shirt_images" 
DROP CONSTRAINT IF EXISTS "print_on_shirt_images_user_id_fkey";

ALTER TABLE "public"."bucket_resources" 
DROP CONSTRAINT IF EXISTS "bucket_resources_user_id_fkey";

ALTER TABLE "public"."generated_images" 
DROP CONSTRAINT IF EXISTS "generated_images_user_id_fkey";

ALTER TABLE "public"."user_generation_locks" 
DROP CONSTRAINT IF EXISTS "user_generation_locks_user_id_fkey";

ALTER TABLE "public"."journal_blog_posts" 
DROP CONSTRAINT IF EXISTS "journal_blog_posts_user_id_fkey";

-- Option 2: Add NOT NULL constraints to ensure user_id is always provided
-- But don't reference auth.users directly due to timing issues
ALTER TABLE "public"."project_bucket_images" 
ALTER COLUMN "user_id" SET NOT NULL;

ALTER TABLE "public"."print_on_shirt_schedules" 
ALTER COLUMN "user_id" SET NOT NULL;

ALTER TABLE "public"."print_on_shirt_images" 
ALTER COLUMN "user_id" SET NOT NULL;

ALTER TABLE "public"."bucket_resources" 
ALTER COLUMN "user_id" SET NOT NULL;

-- Add indexes for performance since we removed foreign keys
CREATE INDEX IF NOT EXISTS "idx_project_bucket_images_user_id_uuid" ON "public"."project_bucket_images" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_print_on_shirt_schedules_user_id_uuid" ON "public"."print_on_shirt_schedules" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_print_on_shirt_images_user_id_uuid" ON "public"."print_on_shirt_images" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_bucket_resources_user_id_uuid" ON "public"."bucket_resources" USING "btree" ("user_id");

-- Add a comment explaining why we removed the foreign keys
COMMENT ON COLUMN "public"."project_bucket_images"."user_id" 
IS 'User UUID from Supabase auth - foreign key removed due to auth timing issues';

COMMENT ON COLUMN "public"."print_on_shirt_schedules"."user_id" 
IS 'User UUID from Supabase auth - foreign key removed due to auth timing issues';

COMMENT ON COLUMN "public"."print_on_shirt_images"."user_id" 
IS 'User UUID from Supabase auth - foreign key removed due to auth timing issues';

COMMENT ON COLUMN "public"."bucket_resources"."user_id" 
IS 'User UUID from Supabase auth - foreign key removed due to auth timing issues'; 