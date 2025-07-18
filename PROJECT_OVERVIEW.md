# Project Overview

## Project Structure

This is a **Content Generation Platform** built with React/TypeScript frontend and Supabase backend. The application allows users to create projects and set up automated schedules for generating various types of content including images, videos, journal posts, and print-on-shirt designs.

### Technology Stack
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI Integration**: Replicate API for image/video generation
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage

## Database Schema

The database consists of several interconnected tables:

### Core Tables

1. **`projects`** - Top-level project containers
   - `id`, `user_id`, `name`, `description`
   - Entry point for organizing content generation

2. **`tasks`** - Individual tasks within projects
   - Links to projects via `project_id`
   - `task_type` enum: `'image-generation'`, `'print-on-shirt'`, `'journal'`, `'video-generation'`
   - Contains task-specific settings

3. **`schedules`** - Automated generation schedules
   - Links to tasks via `task_id`
   - `status` enum: `'active'`, `'paused'`, `'stopped'`
   - Contains `schedule_config`, `generation_settings`, `bucket_settings`
   - `next_run` timestamp for scheduling

4. **`generated_content`** - All generated content
   - Links to both `task_id` and `schedule_id`
   - `content_type` enum: `'image'`, `'design'`, `'text'`, `'combined'`, `'video'`, `'video-generation'`
   - `generation_status` enum: `'pending'`, `'processing'`, `'completed'`, `'failed'`

5. **`generation_jobs`** - Background job tracking
   - `job_type` enum: `'single'`, `'batch'`
   - `status` enum: `'queued'`, `'processing'`, `'completed'`, `'failed'`

6. **`project_bucket_images`** - User-uploaded reference images
   - Stores images uploaded to projects for use in generation

7. **`audit_logs`** - System audit trail

### Key Database Features
- **Row Level Security (RLS)** enabled on all tables
- **Triggers** for `updated_at` timestamps
- **Indexes** optimized for common queries
- **Foreign key constraints** maintaining data integrity

## Cron/Scheduling System

The application implements a sophisticated scheduling system using Supabase Edge Functions:

### Schedule Processor (`supabase/functions/schedule-processor/`)
- **Purpose**: Acts as the main cron processor
- **Functionality**: 
  - Queries `schedules` table for active schedules where `next_run <= NOW()`
  - Creates `generation_jobs` for qualifying schedules
  - Delegates to specific generation functions based on `task_type`
  - Updates `next_run` timestamps for recurring schedules

### Key Scheduling Features
1. **Interval-based Scheduling**: Uses `generation_interval_minutes` in schedule config
2. **Next Run Calculation**: Automatic calculation via database triggers
3. **Status Management**: Schedules can be active, paused, or stopped
4. **Job Queue**: Generation jobs are queued and processed asynchronously

### Schedule Configuration Structure
```typescript
schedule_config: {
  generation_interval_minutes: number,
  duration_hours?: number,
  max_videos?: number
}

generation_settings: {
  // AI model settings
  model_settings: object,
  max_videos?: number
}

bucket_settings: {
  // Image bucket configuration
  use_bucket_images?: boolean,
  batch_generation?: boolean
}
```

## Edge Functions (Backend Services)

The application uses several Supabase Edge Functions:

### 1. `generate-image` - Core Image Generation
- Integrates with Replicate API
- Handles both manual and scheduled generation
- Supports bucket image usage for batch generation
- Manages storage path generation and file uploads

### 2. `schedule-processor` - Main Scheduler
- Processes active schedules
- Creates generation jobs
- Routes to appropriate generation functions

### 3. `process-completed-predictions` - Job Completion Handler
- Processes completed Replicate predictions
- Updates content status and URLs
- Handles file downloads and storage

### 4. `video-generation-processor` - Video Generation
- Handles video generation tasks
- Similar to image generation but for video content

### 5. `print-on-shirt-processor-correct` - Print Design Generation
- Specialized for t-shirt design generation
- Handles design placement and sizing

### 6. `journal-blog-post` - Journal Content Generation
- Generates journal/blog content
- Integrates with AI for text generation

### 7. `migrate-storage-structure` - Data Migration
- Handles storage structure migrations
- Updates legacy data to new formats

## Frontend Architecture

### Project Structure
```
src/
├── components/          # Reusable UI components
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom React hooks
├── integrations/       # External service integrations
│   └── supabase/       # Supabase client and types
├── lib/                # Utility functions
├── pages/              # Route components
│   └── project/        # Project-specific views
└── App.tsx             # Main application component
```

### Key Pages
- **Index**: Main dashboard with project listings
- **CreateProject**: Project creation form
- **CreateImageAgent**: Image generation task setup
- **ProjectLayout**: Nested project views with tabs
  - **DashboardView**: Project overview
  - **SchedulesView**: Schedule management
  - **ImagesView/Output2View**: Generated content views
  - **BucketView**: Reference image management
  - **VideoGenerationView/VideoOutputView**: Video content
  - **PrintOnShirtView**: T-shirt design generation
  - **JournalView**: Journal/blog content
  - **SettingsView**: Project settings

## H Functions

**Note**: After thorough search of the codebase, no specific "H functions" were found. The search covered:
- Function names starting with 'H'
- Variables or constants starting with 'H'
- Utility functions that might be abbreviated as 'H'

The codebase primarily uses:
- **Handler functions** (prefixed with `handle`)
- **Helper functions** (though minimal)
- **Hook functions** (React hooks in `/src/hooks/`)

The main utility function found is `cn()` in `/src/lib/utils.ts` for className merging.

## Key Features

1. **Multi-type Content Generation**: Images, videos, journal posts, t-shirt designs
2. **Automated Scheduling**: Interval-based content generation
3. **Bucket Image System**: Reference images for consistent generation
4. **Project Organization**: Hierarchical project/task structure
5. **Real-time Status Tracking**: Live updates on generation progress
6. **File Management**: Organized storage with consistent naming
7. **User Authentication**: Secure multi-user system
8. **Audit Logging**: Complete action tracking

## Development Workflow

1. **Local Development**: Uses Vite dev server with hot reload
2. **Supabase Integration**: Local Supabase CLI for database management
3. **Type Safety**: Full TypeScript integration with generated Supabase types
4. **Deployment**: Environment switching scripts for development/production

This platform serves as a comprehensive content generation system with sophisticated scheduling, multi-modal AI integration, and enterprise-level features for managing automated content creation workflows.