-- Restore proper RLS policies on database tables
-- The storage bucket issue has been fixed, now restore table security

-- Re-enable RLS on all tables
ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."project_bucket_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."print_on_shirt_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."print_on_shirt_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bucket_resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."generation_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."generated_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_generation_locks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."training_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."journal_blog_posts" ENABLE ROW LEVEL SECURITY;

-- Drop overly broad policies and create proper user-specific ones
-- Projects policies
DROP POLICY IF EXISTS "Users can manage their own projects" ON "public"."projects";
CREATE POLICY "Users can manage their own projects" ON "public"."projects" 
  USING (auth.uid() = user_id);

-- Project bucket images policies  
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."project_bucket_images";
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "public"."project_bucket_images";
DROP POLICY IF EXISTS "Enable update for authenticated users" ON "public"."project_bucket_images";
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON "public"."project_bucket_images";
DROP POLICY IF EXISTS "Service role full access" ON "public"."project_bucket_images";

CREATE POLICY "Users can view their own bucket images" ON "public"."project_bucket_images"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bucket images" ON "public"."project_bucket_images"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bucket images" ON "public"."project_bucket_images"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bucket images" ON "public"."project_bucket_images"
  FOR DELETE USING (auth.uid() = user_id);

-- Print on shirt schedules policies
DROP POLICY IF EXISTS "Users can insert own print_on_shirt_schedules" ON "public"."print_on_shirt_schedules";
DROP POLICY IF EXISTS "Users can view own print_on_shirt_schedules" ON "public"."print_on_shirt_schedules";
DROP POLICY IF EXISTS "Users can update own print_on_shirt_schedules" ON "public"."print_on_shirt_schedules";
DROP POLICY IF EXISTS "Users can delete own print_on_shirt_schedules" ON "public"."print_on_shirt_schedules";

CREATE POLICY "Users can manage their own schedules" ON "public"."print_on_shirt_schedules"
  USING (auth.uid() = user_id);

-- Print on shirt images policies
DROP POLICY IF EXISTS "Users can insert own print_on_shirt_images" ON "public"."print_on_shirt_images";
DROP POLICY IF EXISTS "Users can view own print_on_shirt_images" ON "public"."print_on_shirt_images";
DROP POLICY IF EXISTS "Users can update own print_on_shirt_images" ON "public"."print_on_shirt_images";
DROP POLICY IF EXISTS "Users can delete own print_on_shirt_images" ON "public"."print_on_shirt_images";

CREATE POLICY "Users can manage their own print images" ON "public"."print_on_shirt_images"
  USING (auth.uid() = user_id);

-- Service role policies
CREATE POLICY "Service role full access to project bucket images" ON "public"."project_bucket_images"
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to print schedules" ON "public"."print_on_shirt_schedules"
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to print images" ON "public"."print_on_shirt_images"
  USING (auth.role() = 'service_role'); 