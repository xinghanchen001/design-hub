create extension if not exists "pg_net" with schema "public" version '0.14.0';

create type "public"."content_type" as enum ('image', 'design', 'text', 'combined', 'video', 'video-generation');

create type "public"."generation_status" as enum ('pending', 'processing', 'completed', 'failed');

create type "public"."job_status" as enum ('queued', 'processing', 'completed', 'failed');

create type "public"."job_type" as enum ('single', 'batch');

create type "public"."project_status" as enum ('active', 'paused', 'archived');

create type "public"."schedule_status" as enum ('active', 'paused', 'stopped');

create type "public"."task_type" as enum ('image-generation', 'print-on-shirt', 'journal', 'video-generation');

create table "public"."audit_logs" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid,
    "action" text not null,
    "table_name" text not null,
    "record_id" uuid,
    "old_data" jsonb,
    "new_data" jsonb,
    "created_at" timestamp with time zone default now()
);


alter table "public"."audit_logs" enable row level security;

create table "public"."generated_content" (
    "id" uuid not null default uuid_generate_v4(),
    "task_id" uuid,
    "schedule_id" uuid,
    "user_id" uuid,
    "task_type" text not null,
    "content_type" content_type not null,
    "title" text,
    "description" text,
    "content_url" text,
    "content_text" text,
    "metadata" jsonb default '{}'::jsonb,
    "bucket_image_references" jsonb default '[]'::jsonb,
    "external_job_id" text,
    "generation_status" generation_status default 'pending'::generation_status,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."generated_content" enable row level security;

create table "public"."generation_jobs" (
    "id" uuid not null default uuid_generate_v4(),
    "schedule_id" uuid,
    "user_id" uuid,
    "task_type" text not null,
    "job_type" job_type not null,
    "external_job_id" text,
    "status" job_status default 'queued'::job_status,
    "input_data" jsonb default '{}'::jsonb,
    "output_data" jsonb default '{}'::jsonb,
    "error_message" text,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
);


alter table "public"."generation_jobs" enable row level security;

create table "public"."project_bucket_images" (
    "id" uuid not null default uuid_generate_v4(),
    "task_id" uuid,
    "user_id" uuid,
    "task_type" text not null,
    "filename" text not null,
    "storage_path" text not null,
    "image_url" text not null,
    "file_size" bigint,
    "mime_type" text,
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."project_bucket_images" enable row level security;

create table "public"."projects" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid,
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."projects" enable row level security;

create table "public"."schedules" (
    "id" uuid not null default uuid_generate_v4(),
    "task_id" uuid,
    "user_id" uuid,
    "task_type" text not null,
    "name" text not null,
    "description" text,
    "prompt" text,
    "schedule_config" jsonb default '{}'::jsonb,
    "generation_settings" jsonb default '{}'::jsonb,
    "bucket_settings" jsonb default '{}'::jsonb,
    "status" schedule_status default 'active'::schedule_status,
    "last_run" timestamp with time zone,
    "next_run" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."schedules" enable row level security;

create table "public"."tasks" (
    "id" uuid not null default uuid_generate_v4(),
    "user_id" uuid,
    "name" text not null,
    "description" text,
    "task_type" task_type not null,
    "status" project_status default 'active'::project_status,
    "settings" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "project_id" uuid
);


alter table "public"."tasks" enable row level security;

CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);

CREATE UNIQUE INDEX generated_content_pkey ON public.generated_content USING btree (id);

CREATE UNIQUE INDEX generation_jobs_pkey ON public.generation_jobs USING btree (id);

CREATE INDEX idx_audit_logs_user_action ON public.audit_logs USING btree (user_id, action, created_at);

CREATE INDEX idx_bucket_images_project_type ON public.project_bucket_images USING btree (task_id, task_type);

CREATE INDEX idx_generated_content_project_schedule ON public.generated_content USING btree (task_id, schedule_id);

CREATE INDEX idx_generated_content_status ON public.generated_content USING btree (generation_status);

CREATE INDEX idx_generated_content_task_id ON public.generated_content USING btree (task_id);

CREATE INDEX idx_generation_jobs_schedule_status ON public.generation_jobs USING btree (schedule_id, status);

CREATE INDEX idx_project_bucket_images_task_id ON public.project_bucket_images USING btree (task_id);

CREATE INDEX idx_projects_user_type ON public.tasks USING btree (user_id, task_type);

CREATE INDEX idx_schedules_next_run ON public.schedules USING btree (next_run) WHERE (status = 'active'::schedule_status);

CREATE INDEX idx_schedules_task_id ON public.schedules USING btree (task_id);

CREATE INDEX idx_tasks_project_id ON public.tasks USING btree (project_id);

CREATE UNIQUE INDEX project_bucket_images_pkey ON public.project_bucket_images USING btree (id);

CREATE UNIQUE INDEX projects_new_pkey ON public.projects USING btree (id);

CREATE UNIQUE INDEX projects_pkey ON public.tasks USING btree (id);

CREATE UNIQUE INDEX schedules_pkey ON public.schedules USING btree (id);

alter table "public"."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY using index "audit_logs_pkey";

alter table "public"."generated_content" add constraint "generated_content_pkey" PRIMARY KEY using index "generated_content_pkey";

alter table "public"."generation_jobs" add constraint "generation_jobs_pkey" PRIMARY KEY using index "generation_jobs_pkey";

alter table "public"."project_bucket_images" add constraint "project_bucket_images_pkey" PRIMARY KEY using index "project_bucket_images_pkey";

alter table "public"."projects" add constraint "projects_new_pkey" PRIMARY KEY using index "projects_new_pkey";

alter table "public"."schedules" add constraint "schedules_pkey" PRIMARY KEY using index "schedules_pkey";

alter table "public"."tasks" add constraint "projects_pkey" PRIMARY KEY using index "projects_pkey";

alter table "public"."audit_logs" add constraint "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_user_id_fkey";

alter table "public"."generated_content" add constraint "generated_content_schedule_id_fkey" FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL not valid;

alter table "public"."generated_content" validate constraint "generated_content_schedule_id_fkey";

alter table "public"."generated_content" add constraint "generated_content_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks(id) not valid;

alter table "public"."generated_content" validate constraint "generated_content_task_id_fkey";

alter table "public"."generated_content" add constraint "generated_content_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."generated_content" validate constraint "generated_content_user_id_fkey";

alter table "public"."generation_jobs" add constraint "generation_jobs_schedule_id_fkey" FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE not valid;

alter table "public"."generation_jobs" validate constraint "generation_jobs_schedule_id_fkey";

alter table "public"."generation_jobs" add constraint "generation_jobs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."generation_jobs" validate constraint "generation_jobs_user_id_fkey";

alter table "public"."project_bucket_images" add constraint "project_bucket_images_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks(id) not valid;

alter table "public"."project_bucket_images" validate constraint "project_bucket_images_task_id_fkey";

alter table "public"."project_bucket_images" add constraint "project_bucket_images_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."project_bucket_images" validate constraint "project_bucket_images_user_id_fkey";

alter table "public"."projects" add constraint "projects_new_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."projects" validate constraint "projects_new_user_id_fkey";

alter table "public"."schedules" add constraint "schedules_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks(id) not valid;

alter table "public"."schedules" validate constraint "schedules_task_id_fkey";

alter table "public"."schedules" add constraint "schedules_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."schedules" validate constraint "schedules_user_id_fkey";

alter table "public"."tasks" add constraint "projects_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."tasks" validate constraint "projects_user_id_fkey";

alter table "public"."tasks" add constraint "tasks_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) not valid;

alter table "public"."tasks" validate constraint "tasks_project_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.calculate_next_run(schedule_config jsonb)
 RETURNS timestamp without time zone
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    -- For now, return next hour. Will implement cron parsing later
    RETURN NOW() + INTERVAL '1 hour';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_audit_log(p_user_id uuid, p_action text, p_table_name text, p_record_id uuid, p_old_data jsonb DEFAULT NULL::jsonb, p_new_data jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (p_user_id, p_action, p_table_name, p_record_id, p_old_data, p_new_data)
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_active_schedules_for_processing()
 RETURNS TABLE(schedule_id uuid, project_id uuid, user_id uuid, project_type text, prompt text, generation_settings jsonb, bucket_settings jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.project_id,
        s.user_id,
        s.project_type,
        s.prompt,
        s.generation_settings,
        s.bucket_settings
    FROM public.schedules s
    WHERE s.status = 'active' 
    AND (s.next_run IS NULL OR s.next_run <= NOW());
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_project_count(user_uuid uuid, p_type task_type)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO count_result
    FROM public.projects
    WHERE user_id = user_uuid AND project_type = p_type;
    
    RETURN count_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_generation_job_completed(job_id uuid, output jsonb, success boolean DEFAULT true, error_msg text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    UPDATE public.generation_jobs
    SET 
        status = CASE WHEN success THEN 'completed'::public.job_status ELSE 'failed'::public.job_status END,
        output_data = output,
        error_message = error_msg,
        completed_at = NOW()
    WHERE id = job_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_schedule_next_run()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- If next_run is null and schedule is active, set it to now
  IF NEW.next_run IS NULL AND NEW.status = 'active' THEN
    NEW.next_run = NOW();
  END IF;
  
  -- If status changed from inactive to active and next_run is null, set it to now
  IF (TG_OP = 'UPDATE') AND (OLD.status != 'active' AND NEW.status = 'active') AND NEW.next_run IS NULL THEN
    NEW.next_run = NOW();
  END IF;
  
  -- If status changed to inactive, clear next_run
  IF NEW.status != 'active' THEN
    NEW.next_run = NULL;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_schedule_status(schedule_id uuid, new_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    UPDATE public.schedules 
    SET status = new_status::public.schedule_status,
        updated_at = NOW()
    WHERE id = schedule_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."audit_logs" to "anon";

grant insert on table "public"."audit_logs" to "anon";

grant references on table "public"."audit_logs" to "anon";

grant select on table "public"."audit_logs" to "anon";

grant trigger on table "public"."audit_logs" to "anon";

grant truncate on table "public"."audit_logs" to "anon";

grant update on table "public"."audit_logs" to "anon";

grant delete on table "public"."audit_logs" to "authenticated";

grant insert on table "public"."audit_logs" to "authenticated";

grant references on table "public"."audit_logs" to "authenticated";

grant select on table "public"."audit_logs" to "authenticated";

grant trigger on table "public"."audit_logs" to "authenticated";

grant truncate on table "public"."audit_logs" to "authenticated";

grant update on table "public"."audit_logs" to "authenticated";

grant delete on table "public"."audit_logs" to "service_role";

grant insert on table "public"."audit_logs" to "service_role";

grant references on table "public"."audit_logs" to "service_role";

grant select on table "public"."audit_logs" to "service_role";

grant trigger on table "public"."audit_logs" to "service_role";

grant truncate on table "public"."audit_logs" to "service_role";

grant update on table "public"."audit_logs" to "service_role";

grant delete on table "public"."generated_content" to "anon";

grant insert on table "public"."generated_content" to "anon";

grant references on table "public"."generated_content" to "anon";

grant select on table "public"."generated_content" to "anon";

grant trigger on table "public"."generated_content" to "anon";

grant truncate on table "public"."generated_content" to "anon";

grant update on table "public"."generated_content" to "anon";

grant delete on table "public"."generated_content" to "authenticated";

grant insert on table "public"."generated_content" to "authenticated";

grant references on table "public"."generated_content" to "authenticated";

grant select on table "public"."generated_content" to "authenticated";

grant trigger on table "public"."generated_content" to "authenticated";

grant truncate on table "public"."generated_content" to "authenticated";

grant update on table "public"."generated_content" to "authenticated";

grant delete on table "public"."generated_content" to "service_role";

grant insert on table "public"."generated_content" to "service_role";

grant references on table "public"."generated_content" to "service_role";

grant select on table "public"."generated_content" to "service_role";

grant trigger on table "public"."generated_content" to "service_role";

grant truncate on table "public"."generated_content" to "service_role";

grant update on table "public"."generated_content" to "service_role";

grant delete on table "public"."generation_jobs" to "anon";

grant insert on table "public"."generation_jobs" to "anon";

grant references on table "public"."generation_jobs" to "anon";

grant select on table "public"."generation_jobs" to "anon";

grant trigger on table "public"."generation_jobs" to "anon";

grant truncate on table "public"."generation_jobs" to "anon";

grant update on table "public"."generation_jobs" to "anon";

grant delete on table "public"."generation_jobs" to "authenticated";

grant insert on table "public"."generation_jobs" to "authenticated";

grant references on table "public"."generation_jobs" to "authenticated";

grant select on table "public"."generation_jobs" to "authenticated";

grant trigger on table "public"."generation_jobs" to "authenticated";

grant truncate on table "public"."generation_jobs" to "authenticated";

grant update on table "public"."generation_jobs" to "authenticated";

grant delete on table "public"."generation_jobs" to "service_role";

grant insert on table "public"."generation_jobs" to "service_role";

grant references on table "public"."generation_jobs" to "service_role";

grant select on table "public"."generation_jobs" to "service_role";

grant trigger on table "public"."generation_jobs" to "service_role";

grant truncate on table "public"."generation_jobs" to "service_role";

grant update on table "public"."generation_jobs" to "service_role";

grant delete on table "public"."project_bucket_images" to "anon";

grant insert on table "public"."project_bucket_images" to "anon";

grant references on table "public"."project_bucket_images" to "anon";

grant select on table "public"."project_bucket_images" to "anon";

grant trigger on table "public"."project_bucket_images" to "anon";

grant truncate on table "public"."project_bucket_images" to "anon";

grant update on table "public"."project_bucket_images" to "anon";

grant delete on table "public"."project_bucket_images" to "authenticated";

grant insert on table "public"."project_bucket_images" to "authenticated";

grant references on table "public"."project_bucket_images" to "authenticated";

grant select on table "public"."project_bucket_images" to "authenticated";

grant trigger on table "public"."project_bucket_images" to "authenticated";

grant truncate on table "public"."project_bucket_images" to "authenticated";

grant update on table "public"."project_bucket_images" to "authenticated";

grant delete on table "public"."project_bucket_images" to "service_role";

grant insert on table "public"."project_bucket_images" to "service_role";

grant references on table "public"."project_bucket_images" to "service_role";

grant select on table "public"."project_bucket_images" to "service_role";

grant trigger on table "public"."project_bucket_images" to "service_role";

grant truncate on table "public"."project_bucket_images" to "service_role";

grant update on table "public"."project_bucket_images" to "service_role";

grant delete on table "public"."projects" to "anon";

grant insert on table "public"."projects" to "anon";

grant references on table "public"."projects" to "anon";

grant select on table "public"."projects" to "anon";

grant trigger on table "public"."projects" to "anon";

grant truncate on table "public"."projects" to "anon";

grant update on table "public"."projects" to "anon";

grant delete on table "public"."projects" to "authenticated";

grant insert on table "public"."projects" to "authenticated";

grant references on table "public"."projects" to "authenticated";

grant select on table "public"."projects" to "authenticated";

grant trigger on table "public"."projects" to "authenticated";

grant truncate on table "public"."projects" to "authenticated";

grant update on table "public"."projects" to "authenticated";

grant delete on table "public"."projects" to "service_role";

grant insert on table "public"."projects" to "service_role";

grant references on table "public"."projects" to "service_role";

grant select on table "public"."projects" to "service_role";

grant trigger on table "public"."projects" to "service_role";

grant truncate on table "public"."projects" to "service_role";

grant update on table "public"."projects" to "service_role";

grant delete on table "public"."schedules" to "anon";

grant insert on table "public"."schedules" to "anon";

grant references on table "public"."schedules" to "anon";

grant select on table "public"."schedules" to "anon";

grant trigger on table "public"."schedules" to "anon";

grant truncate on table "public"."schedules" to "anon";

grant update on table "public"."schedules" to "anon";

grant delete on table "public"."schedules" to "authenticated";

grant insert on table "public"."schedules" to "authenticated";

grant references on table "public"."schedules" to "authenticated";

grant select on table "public"."schedules" to "authenticated";

grant trigger on table "public"."schedules" to "authenticated";

grant truncate on table "public"."schedules" to "authenticated";

grant update on table "public"."schedules" to "authenticated";

grant delete on table "public"."schedules" to "service_role";

grant insert on table "public"."schedules" to "service_role";

grant references on table "public"."schedules" to "service_role";

grant select on table "public"."schedules" to "service_role";

grant trigger on table "public"."schedules" to "service_role";

grant truncate on table "public"."schedules" to "service_role";

grant update on table "public"."schedules" to "service_role";

grant delete on table "public"."tasks" to "anon";

grant insert on table "public"."tasks" to "anon";

grant references on table "public"."tasks" to "anon";

grant select on table "public"."tasks" to "anon";

grant trigger on table "public"."tasks" to "anon";

grant truncate on table "public"."tasks" to "anon";

grant update on table "public"."tasks" to "anon";

grant delete on table "public"."tasks" to "authenticated";

grant insert on table "public"."tasks" to "authenticated";

grant references on table "public"."tasks" to "authenticated";

grant select on table "public"."tasks" to "authenticated";

grant trigger on table "public"."tasks" to "authenticated";

grant truncate on table "public"."tasks" to "authenticated";

grant update on table "public"."tasks" to "authenticated";

grant delete on table "public"."tasks" to "service_role";

grant insert on table "public"."tasks" to "service_role";

grant references on table "public"."tasks" to "service_role";

grant select on table "public"."tasks" to "service_role";

grant trigger on table "public"."tasks" to "service_role";

grant truncate on table "public"."tasks" to "service_role";

grant update on table "public"."tasks" to "service_role";

create policy "Users can view own audit logs"
on "public"."audit_logs"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can create own generated content"
on "public"."generated_content"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can delete own generated content"
on "public"."generated_content"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can update own generated content"
on "public"."generated_content"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can view own generated content"
on "public"."generated_content"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can create own generation jobs"
on "public"."generation_jobs"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can update own generation jobs"
on "public"."generation_jobs"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can view own generation jobs"
on "public"."generation_jobs"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can create own bucket images"
on "public"."project_bucket_images"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can delete own bucket images"
on "public"."project_bucket_images"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can update own bucket images"
on "public"."project_bucket_images"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can view own bucket images"
on "public"."project_bucket_images"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can access their own projects"
on "public"."projects"
as permissive
for all
to public
using ((auth.uid() = user_id));


create policy "Users can create own schedules"
on "public"."schedules"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can delete own schedules"
on "public"."schedules"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can update own schedules"
on "public"."schedules"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can view own schedules"
on "public"."schedules"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can create own projects"
on "public"."tasks"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can delete own projects"
on "public"."tasks"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can update own projects"
on "public"."tasks"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can view own projects"
on "public"."tasks"
as permissive
for select
to public
using ((auth.uid() = user_id));


CREATE TRIGGER update_generated_content_updated_at BEFORE UPDATE ON public.generated_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_bucket_images_updated_at BEFORE UPDATE ON public.project_bucket_images FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_new_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_set_schedule_next_run BEFORE INSERT OR UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION set_schedule_next_run();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


