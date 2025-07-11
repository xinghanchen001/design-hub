-- Full schema restoration with multi-select enhancements
-- This script recreates the entire schema and adds multi-select bucket functionality

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create helper functions
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
LANGUAGE "plpgsql"
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."update_project_bucket_images_updated_at"() RETURNS "trigger"
LANGUAGE "plpgsql"
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Create projects table
CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'created'::"text" NOT NULL,
    "replicate_model_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "prompt" "text",
    "schedule_enabled" boolean DEFAULT false,
    "schedule_duration_hours" integer,
    "max_images_to_generate" integer,
    "generation_interval_minutes" integer DEFAULT 60,
    "last_generation_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "reference_image_url" "text",
    "use_bucket_images" boolean DEFAULT false,
    "bucket_image_id" "uuid",
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['created'::"text", 'training'::"text", 'completed'::"text", 'failed'::"text"])))
);

-- Create project_bucket_images table
CREATE TABLE IF NOT EXISTS "public"."project_bucket_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "image_url" "text",
    "file_size" integer,
    "mime_type" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Create print_on_shirt_schedules table WITH multi-select columns
CREATE TABLE IF NOT EXISTS "public"."print_on_shirt_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "prompt" "text" NOT NULL,
    "input_image_1_url" "text" NOT NULL,
    "input_image_2_url" "text" NOT NULL,
    "aspect_ratio" "text" DEFAULT '1:1'::"text",
    "schedule_enabled" boolean DEFAULT true,
    "schedule_duration_hours" integer DEFAULT 24,
    "max_images_to_generate" integer DEFAULT 10,
    "generation_interval_minutes" integer DEFAULT 60,
    "last_generation_at" timestamp with time zone,
    "images_generated" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "project_id" "uuid" NOT NULL,
    "use_bucket_images" boolean DEFAULT false,
    "bucket_image_1_id" "uuid",
    "bucket_image_2_id" "uuid",
    -- Multi-select columns for batch generation
    "bucket_image_1_ids" TEXT[],
    "bucket_image_2_ids" TEXT[]
);

-- Create print_on_shirt_images table
CREATE TABLE IF NOT EXISTS "public"."print_on_shirt_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prompt" "text" NOT NULL,
    "input_image_1_url" "text",
    "input_image_2_url" "text",
    "bucket_image_1_id" "uuid",
    "bucket_image_2_id" "uuid",
    "aspect_ratio" "text" DEFAULT '1:1'::"text",
    "prediction_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "image_url" "text",
    "storage_path" "text",
    "error_message" "text",
    "model_used" "text",
    "output_format" "text" DEFAULT 'png'::"text",
    "safety_tolerance" integer DEFAULT 1,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Add primary keys
ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."project_bucket_images"
    ADD CONSTRAINT "project_bucket_images_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."print_on_shirt_schedules"
    ADD CONSTRAINT "print_on_shirt_schedules_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."print_on_shirt_images"
    ADD CONSTRAINT "print_on_shirt_images_pkey" PRIMARY KEY ("id");

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_print_on_shirt_schedules_project_id" ON "public"."print_on_shirt_schedules" USING "btree" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_print_on_shirt_schedules_bucket_image_1_id" ON "public"."print_on_shirt_schedules" USING "btree" ("bucket_image_1_id");
CREATE INDEX IF NOT EXISTS "idx_print_on_shirt_schedules_bucket_image_2_id" ON "public"."print_on_shirt_schedules" USING "btree" ("bucket_image_2_id");

-- New multi-select indexes
CREATE INDEX IF NOT EXISTS "idx_print_on_shirt_schedules_bucket_image_1_ids" ON "public"."print_on_shirt_schedules" USING GIN ("bucket_image_1_ids");
CREATE INDEX IF NOT EXISTS "idx_print_on_shirt_schedules_bucket_image_2_ids" ON "public"."print_on_shirt_schedules" USING GIN ("bucket_image_2_ids");

CREATE INDEX IF NOT EXISTS "idx_project_bucket_images_project_id" ON "public"."project_bucket_images" USING "btree" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_project_bucket_images_user_id" ON "public"."project_bucket_images" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_project_bucket_images_created_at" ON "public"."project_bucket_images" USING "btree" ("created_at" DESC);

-- Add triggers
CREATE OR REPLACE TRIGGER "update_print_on_shirt_schedules_updated_at" 
BEFORE UPDATE ON "public"."print_on_shirt_schedules" 
FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_project_bucket_images_updated_at" 
BEFORE UPDATE ON "public"."project_bucket_images" 
FOR EACH ROW EXECUTE FUNCTION "public"."update_project_bucket_images_updated_at"();

-- Add foreign key constraints
ALTER TABLE ONLY "public"."print_on_shirt_schedules"
    ADD CONSTRAINT "print_on_shirt_schedules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."print_on_shirt_schedules"
    ADD CONSTRAINT "print_on_shirt_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."print_on_shirt_schedules"
    ADD CONSTRAINT "print_on_shirt_schedules_bucket_image_1_id_fkey" FOREIGN KEY ("bucket_image_1_id") REFERENCES "public"."project_bucket_images"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."print_on_shirt_schedules"
    ADD CONSTRAINT "print_on_shirt_schedules_bucket_image_2_id_fkey" FOREIGN KEY ("bucket_image_2_id") REFERENCES "public"."project_bucket_images"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."project_bucket_images"
    ADD CONSTRAINT "project_bucket_images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."project_bucket_images"
    ADD CONSTRAINT "project_bucket_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."print_on_shirt_images"
    ADD CONSTRAINT "print_on_shirt_images_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."print_on_shirt_schedules"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."print_on_shirt_images"
    ADD CONSTRAINT "print_on_shirt_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Add RLS policies
ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."project_bucket_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."print_on_shirt_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."print_on_shirt_images" ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can manage their own projects" ON "public"."projects" USING (("auth"."uid"() = "user_id"));

-- Bucket images policies
CREATE POLICY "Users can only see their own bucket images" ON "public"."project_bucket_images" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can only insert their own bucket images" ON "public"."project_bucket_images" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can only update their own bucket images" ON "public"."project_bucket_images" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can only delete their own bucket images" ON "public"."project_bucket_images" FOR DELETE USING (("auth"."uid"() = "user_id"));

-- Print on shirt schedules policies
CREATE POLICY "Users can insert own print_on_shirt_schedules" ON "public"."print_on_shirt_schedules" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view own print_on_shirt_schedules" ON "public"."print_on_shirt_schedules" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update own print_on_shirt_schedules" ON "public"."print_on_shirt_schedules" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can delete own print_on_shirt_schedules" ON "public"."print_on_shirt_schedules" FOR DELETE USING (("auth"."uid"() = "user_id"));

-- Print on shirt images policies
CREATE POLICY "Users can insert own print_on_shirt_images" ON "public"."print_on_shirt_images" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view own print_on_shirt_images" ON "public"."print_on_shirt_images" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update own print_on_shirt_images" ON "public"."print_on_shirt_images" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can delete own print_on_shirt_images" ON "public"."print_on_shirt_images" FOR DELETE USING (("auth"."uid"() = "user_id"));

-- Comments
COMMENT ON COLUMN "public"."print_on_shirt_schedules"."bucket_image_1_ids" 
IS 'Array of bucket image IDs for reference set 1 (multi-select support)';

COMMENT ON COLUMN "public"."print_on_shirt_schedules"."bucket_image_2_ids" 
IS 'Array of bucket image IDs for reference set 2 (multi-select support)';
