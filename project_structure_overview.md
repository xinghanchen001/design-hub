# Project Structure Overview

## Project Type & Technology Stack

This is a **React + TypeScript + Vite** application with **Supabase** backend integration, featuring a modern web development stack with the following key technologies:

- **Frontend Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.1 with SWC for fast builds
- **Backend**: Supabase (PostgreSQL database + Edge Functions)
- **UI Framework**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack React Query for server state
- **Routing**: React Router DOM v6
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS with custom components

## Root Directory Structure

```
/workspace/
├── src/                          # Source code
├── supabase/                     # Supabase backend configuration
├── public/                       # Static assets
├── scripts/                      # Build/deployment scripts
├── .cursor/                      # Cursor IDE configuration
├── package.json                  # Dependencies and scripts
├── vite.config.ts               # Vite build configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── components.json              # shadcn/ui configuration
├── switch-to-production.sh      # Production deployment script
├── switch-to-development.sh     # Development environment script
└── test-storage-structure.js    # Storage testing utility
```

## Source Code Structure (`/src/`)

### Main Application Files
- **`App.tsx`** - Main application component with routing setup
- **`main.tsx`** - Application entry point
- **`index.css`** - Global styles and Tailwind imports
- **`App.css`** - Component-specific styles

### Directory Breakdown

#### `/src/components/`
- **`AuthProvider.tsx`** - Authentication context provider
- **`ThemeToggle.tsx`** - Dark/light theme switcher
- **`ui/`** - Complete shadcn/ui component library (48+ components)
  - Includes: buttons, forms, dialogs, navigation, charts, tables, etc.

#### `/src/pages/`
Core application pages and views:
- **`Index.tsx`** - Landing/home page
- **`Auth.tsx`** - Authentication (login/signup)
- **`CreateProject.tsx`** - Project creation page
- **`CreateImageAgent.tsx`** - Image agent creation
- **`ProjectDetail.tsx`** - Project detail view
- **`NotFound.tsx`** - 404 error page

#### `/src/pages/project/`
Project-specific views (14 different views):
- **`ProjectLayout.tsx`** - Main project layout with navigation
- **`DashboardView.tsx`** - Project dashboard
- **`SchedulesView.tsx`** - Scheduling functionality
- **`QueueView.tsx`** - Queue management
- **`ImagesView.tsx`** - Image management
- **`PrintOnShirtView.tsx`** - Print-on-demand functionality
- **`JournalView.tsx`** - Journal/blog features
- **`SettingsView.tsx`** - Project settings
- **`Output2View.tsx`** - Output management 2
- **`Output3View.tsx`** - Output management 3
- **`BucketView.tsx`** - Storage bucket management
- **`VideoGenerationView.tsx`** - Video generation features
- **`VideoOutputView.tsx`** - Video output management

#### `/src/integrations/supabase/`
- **`client.ts`** - Supabase client configuration
- **`types.ts`** - TypeScript types for database schemas

#### `/src/lib/`
- **`utils.ts`** - Utility functions (likely clsx/tailwind-merge helpers)

#### `/src/hooks/`
- **`use-mobile.tsx`** - Mobile device detection hook
- **`use-toast.ts`** - Toast notification hook

## Backend Structure (`/supabase/`)

### Configuration
- **`config.toml`** - Supabase project configuration

### Database
- **`migrations/`** - Database schema migrations
  - Includes baseline production schema and remote schema updates

### Edge Functions (`/supabase/functions/`)
Serverless functions for backend processing:
- **`generate-image/`** - Image generation functionality
- **`journal-blog-post/`** - Blog post processing
- **`migrate-storage-structure/`** - Storage migration utilities
- **`print-on-shirt-processor-correct/`** - Print-on-demand processing
- **`process-completed-predictions/`** - AI prediction processing
- **`schedule-processor/`** - Schedule management
- **`video-generation-processor/`** - Video generation processing
- **`_shared/`** - Shared utilities and functions

## Key Features & Functionality

Based on the structure, this appears to be a **Creative Content Management Platform** with the following capabilities:

1. **User Authentication** - Complete auth flow with Supabase
2. **Project Management** - Create and manage creative projects
3. **Image Generation** - AI-powered image creation and management
4. **Video Generation** - Video content creation capabilities
5. **Print-on-Demand** - T-shirt/merchandise printing functionality
6. **Content Scheduling** - Automated content scheduling system
7. **Queue Management** - Background job processing
8. **Storage Management** - File and media storage with buckets
9. **Journaling/Blogging** - Content creation and publishing
10. **Multi-output Management** - Various content output formats

## Build & Development Setup

- **Development**: `npm run dev` (Vite dev server on port 8080)
- **Build**: `npm run build` (production build)
- **Build Dev**: `npm run build:dev` (development mode build)
- **Environment Switching**: Shell scripts for production/development
- **Package Manager**: Uses both npm (package-lock.json) and Bun (bun.lockb)

## UI/UX Architecture

- **Design System**: Complete shadcn/ui component library
- **Theming**: Dark/light mode support with next-themes
- **Responsive**: Mobile-first design with responsive hooks
- **Accessibility**: Built-in accessibility features from Radix UI
- **Modern UI**: Contemporary design patterns with Tailwind CSS

This is a sophisticated, full-stack creative platform with robust backend processing capabilities and a polished frontend experience.