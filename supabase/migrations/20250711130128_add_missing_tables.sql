-- Add missing tables that the application expects

-- Create generation_jobs table
CREATE TABLE IF NOT EXISTS "public"."generation_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "prompt" "text",
    "reference_image_url" "text",
    "replicate_prediction_id" "text",
    "scheduled_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Create generated_images table  
CREATE TABLE IF NOT EXISTS "public"."generated_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "generation_job_id" "uuid",
    "bucket_image_id" "uuid",
    "image_url" "text",
    "storage_path" "text",
    "prompt" "text",
    "reference_image_url" "text",
    "model_used" "text",
    "prediction_id" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Create user_generation_locks table
CREATE TABLE IF NOT EXISTS "public"."user_generation_locks" (
    "user_id" "uuid" NOT NULL,
    "locked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "generation_job_id" "uuid",
    "project_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Create training_images table
CREATE TABLE IF NOT EXISTS "public"."training_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text",
    "file_size" integer,
    "mime_type" "text"
);

-- Create bucket_resources table
CREATE TABLE IF NOT EXISTS "public"."bucket_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "resource_type" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_size" integer,
    "mime_type" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Create journal_blog_posts table
CREATE TABLE IF NOT EXISTS "public"."journal_blog_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Add primary keys
ALTER TABLE ONLY "public"."generation_jobs"
    ADD CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."generated_images"
    ADD CONSTRAINT "generated_images_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_generation_locks"
    ADD CONSTRAINT "user_generation_locks_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."training_images"
    ADD CONSTRAINT "training_images_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bucket_resources"
    ADD CONSTRAINT "bucket_resources_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."journal_blog_posts"
    ADD CONSTRAINT "journal_blog_posts_pkey" PRIMARY KEY ("id");

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_generation_jobs_project_id" ON "public"."generation_jobs" USING "btree" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_generation_jobs_status" ON "public"."generation_jobs" USING "btree" ("status");
CREATE INDEX IF NOT EXISTS "idx_generation_jobs_scheduled_at" ON "public"."generation_jobs" USING "btree" ("scheduled_at");

CREATE INDEX IF NOT EXISTS "idx_generated_images_project_id" ON "public"."generated_images" USING "btree" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_generated_images_user_id" ON "public"."generated_images" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_generated_images_user_created" ON "public"."generated_images" USING "btree" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_generated_images_bucket_image_id" ON "public"."generated_images" USING "btree" ("bucket_image_id");

CREATE INDEX IF NOT EXISTS "idx_bucket_resources_project_id" ON "public"."bucket_resources" USING "btree" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_bucket_resources_user_id" ON "public"."bucket_resources" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_bucket_resources_resource_type" ON "public"."bucket_resources" USING "btree" ("resource_type");

CREATE INDEX IF NOT EXISTS "idx_journal_blog_posts_user_id" ON "public"."journal_blog_posts" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_journal_blog_posts_created_at" ON "public"."journal_blog_posts" USING "btree" ("created_at" DESC);

-- Add foreign key constraints
ALTER TABLE ONLY "public"."generation_jobs"
    ADD CONSTRAINT "generation_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."generated_images"
    ADD CONSTRAINT "generated_images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."generated_images"
    ADD CONSTRAINT "generated_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."generated_images"
    ADD CONSTRAINT "fk_generated_images_generation_job" FOREIGN KEY ("generation_job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."generated_images"
    ADD CONSTRAINT "generated_images_bucket_image_id_fkey" FOREIGN KEY ("bucket_image_id") REFERENCES "public"."project_bucket_images"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."user_generation_locks"
    ADD CONSTRAINT "user_generation_locks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."user_generation_locks"
    ADD CONSTRAINT "user_generation_locks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");

ALTER TABLE ONLY "public"."user_generation_locks"
    ADD CONSTRAINT "user_generation_locks_generation_job_id_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "public"."generation_jobs"("id");

ALTER TABLE ONLY "public"."training_images"
    ADD CONSTRAINT "training_images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."bucket_resources"
    ADD CONSTRAINT "bucket_resources_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."bucket_resources"
    ADD CONSTRAINT "bucket_resources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."journal_blog_posts"
    ADD CONSTRAINT "journal_blog_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Enable RLS on new tables
ALTER TABLE "public"."generation_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."generated_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_generation_locks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."training_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bucket_resources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."journal_blog_posts" ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
-- Generation jobs policies
CREATE POLICY "Users can view generation jobs for their projects" ON "public"."generation_jobs" FOR SELECT USING ((EXISTS ( SELECT 1 FROM "public"."projects" WHERE (("projects"."id" = "generation_jobs"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));
CREATE POLICY "Users can create generation jobs for their projects" ON "public"."generation_jobs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1 FROM "public"."projects" WHERE (("projects"."id" = "generation_jobs"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));
CREATE POLICY "Users can update generation jobs for their projects" ON "public"."generation_jobs" FOR UPDATE USING ((EXISTS ( SELECT 1 FROM "public"."projects" WHERE (("projects"."id" = "generation_jobs"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));
CREATE POLICY "Users can delete generation jobs for their projects" ON "public"."generation_jobs" FOR DELETE USING ((EXISTS ( SELECT 1 FROM "public"."projects" WHERE (("projects"."id" = "generation_jobs"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));

-- Generated images policies  
CREATE POLICY "Users can view generated images from their projects" ON "public"."generated_images" FOR SELECT USING ((EXISTS ( SELECT 1 FROM "public"."projects" WHERE (("projects"."id" = "generated_images"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));
CREATE POLICY "Users can create generated images for their projects" ON "public"."generated_images" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1 FROM "public"."projects" WHERE (("projects"."id" = "generated_images"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));
CREATE POLICY "Users can delete generated images from their projects" ON "public"."generated_images" FOR DELETE USING ((EXISTS ( SELECT 1 FROM "public"."projects" WHERE (("projects"."id" = "generated_images"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));

-- User generation locks policies
CREATE POLICY "Users can manage their own generation locks" ON "public"."user_generation_locks" USING (("auth"."uid"() = "user_id"));

-- Training images policies
CREATE POLICY "Users can manage their project training images" ON "public"."training_images" USING ((EXISTS ( SELECT 1 FROM "public"."projects" WHERE (("projects"."id" = "training_images"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));
CREATE POLICY "Users can view training images from their projects" ON "public"."training_images" FOR SELECT USING ((EXISTS ( SELECT 1 FROM "public"."projects" WHERE (("projects"."id" = "training_images"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));
CREATE POLICY "Users can create training images for their projects" ON "public"."training_images" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1 FROM "public"."projects" WHERE (("projects"."id" = "training_images"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));
CREATE POLICY "Users can delete training images from their projects" ON "public"."training_images" FOR DELETE USING ((EXISTS ( SELECT 1 FROM "public"."projects" WHERE (("projects"."id" = "training_images"."project_id") AND ("projects"."user_id" = "auth"."uid"())))));

-- Bucket resources policies
CREATE POLICY "Users can create their own resources" ON "public"."bucket_resources" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own resources" ON "public"."bucket_resources" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can delete their own resources" ON "public"."bucket_resources" FOR DELETE USING (("auth"."uid"() = "user_id"));

-- Journal posts policies
CREATE POLICY "Users can create their own journal posts" ON "public"."journal_blog_posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own journal posts" ON "public"."journal_blog_posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can delete their own journal posts" ON "public"."journal_blog_posts" FOR DELETE USING (("auth"."uid"() = "user_id"));

-- Service role policies for backend operations
CREATE POLICY "Service role can manage all images" ON "public"."generated_images" USING (("auth"."role"() = 'service_role'::"text"));
CREATE POLICY "Service role can manage all jobs" ON "public"."generation_jobs" USING (("auth"."role"() = 'service_role'::"text"));
