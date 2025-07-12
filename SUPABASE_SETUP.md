# Supabase Database Setup Guide

## Overview

Your Supabase database has been successfully set up from scratch following the comprehensive architecture guide for the AI Image Agent platform. This document summarizes what was created and how to use it.

## Database Connection Details

- **Project URL**: `https://pwysjzyhhyfxhbymmklz.supabase.co`
- **Anon Key**: Already configured in `src/integrations/supabase/client.ts`
- **Project ID**: `pwysjzyhhyfxhbymmklz`

## Database Structure

### Core Tables Created

1. **projects**

   - Manages all project types (image-generation, print-on-shirt, journal)
   - Tracks project status, settings, and metadata
   - Full RLS (Row Level Security) enabled

2. **project_bucket_images**

   - Stores reference images for bucket-based generation
   - Organized by project and user
   - Tracks file metadata and storage paths

3. **schedules**

   - Unified scheduling for all project types
   - Supports cron-based and interval scheduling
   - Stores generation settings and bucket configurations

4. **generated_content**

   - Stores all generated content (images, designs, text)
   - Links to source projects and schedules
   - Tracks generation status and metadata

5. **generation_jobs**

   - Manages async job processing
   - Tracks external API job IDs (Replicate)
   - Handles batch and single generation modes

6. **audit_logs**
   - Tracks all important operations
   - Provides audit trail for debugging and compliance

### Storage Buckets

The following storage buckets were created:

- `user-bucket-images` - User uploaded reference images
- `generated-images` - AI-generated images
- `generated-designs` - Print-on-demand designs
- `temp-uploads` - Temporary file uploads

### Database Functions

- `update_updated_at_column()` - Auto-updates timestamps
- `calculate_next_run()` - Calculates next schedule run time
- `update_schedule_status()` - Updates schedule status
- `get_user_project_count()` - Gets project count by type
- `get_active_schedules_for_processing()` - Retrieves schedules ready to run
- `mark_generation_job_completed()` - Marks jobs as complete
- `create_audit_log()` - Creates audit log entries

### Security Features

1. **Row Level Security (RLS)**

   - All tables have RLS enabled
   - Users can only access their own data
   - Proper policies for CRUD operations

2. **Function Security**

   - All functions use `SECURITY DEFINER`
   - Explicit search paths to prevent SQL injection
   - Proper permission controls

3. **Storage Policies**
   - Users can only access their own files
   - Proper bucket isolation by user ID

### Cron Jobs

The following automated jobs were set up:

1. **process-schedules** - Runs every 5 minutes to process active schedules
2. **process-completed-predictions** - Runs every minute to check job completion
3. **cleanup-temp-uploads** - Runs daily at 2 AM to clean old temp files

## Next Steps

### 1. Install Dependencies

```bash
cd creative-image-stream
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file:

```env
VITE_SUPABASE_URL=https://pwysjzyhhyfxhbymmklz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3eXNqenloaHlmeGhieW1ta2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNjY3MjksImV4cCI6MjA2Nzg0MjcyOX0.hXWWxhuH1p7TsHIxpV1YfKg_YHMa0SX9sT8MZQq9s14
```

### 3. Edge Functions Setup

The project needs edge functions for the three workflows:

1. `generate-image` - For AI image generation
2. `print-on-shirt-processor-correct` - For design creation
3. `journal-blog-post` - For content generation
4. `process-completed-predictions` - For job monitoring
5. `schedule-processor` - For schedule orchestration

These need to be deployed to your Supabase project.

### 4. API Keys Configuration

You'll need to configure:

- Replicate API key for AI model access
- Supabase service role key for edge functions

### 5. Start Development

```bash
npm run dev
```

## Type Safety

TypeScript types have been generated and saved to `src/integrations/supabase/types.ts`. These provide full type safety for all database operations.

## Important Notes

1. The database uses ENUMs for type safety - always use the predefined values
2. All timestamps are in UTC
3. File uploads should follow the storage structure pattern
4. Always handle errors gracefully in the frontend
5. Use the provided database functions for complex operations

## Security Recommendations

1. Never expose service role keys in frontend code
2. Always validate user permissions before operations
3. Use RLS policies for all data access
4. Regularly review the security advisors
5. Monitor audit logs for suspicious activity

## Support

For issues or questions:

1. Check Supabase logs for errors
2. Review the security advisors regularly
3. Monitor the cron job execution
4. Check edge function logs for processing errors

This setup provides a robust foundation for the AI Image Agent platform with proper security, scalability, and maintainability.
