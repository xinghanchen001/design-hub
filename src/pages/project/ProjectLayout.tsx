import { useEffect, useState } from 'react';
import {
  useParams,
  useNavigate,
  Outlet,
  useLocation,
  NavLink,
} from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot,
  Calendar,
  BarChart3,
  Clock,
  AlertCircle,
  Images,
  FileText,
  Settings,
  Shirt,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  Database,
  BookOpen,
  Folder,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Tables } from '@/integrations/supabase/types';

type Project = Tables<'projects'>;

interface ProjectSettings {
  prompt?: string;
  reference_image_url?: string;
  max_images_to_generate?: number;
  schedule_duration_hours?: number;
  generation_interval_minutes?: number;
}

const ProjectLayout = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({
    project1: true,
    project2: true,
    project3: true,
  });

  useEffect(() => {
    if (!user || !projectId) return;
    fetchProjectData();
  }, [user, projectId]);

  const fetchProjectData = async () => {
    try {
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user?.id)
        .single();

      if (projectError) throw projectError;

      // Transform the project data to include settings from JSONB
      const projectWithSettings = {
        ...projectData,
        // Extract settings from JSONB if needed for backward compatibility
        ...((projectData.settings as ProjectSettings) || {}),
      };

      setProject(projectData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load project data');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupKey: keyof typeof expandedGroups) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center space-y-4">
          <Bot className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-muted-foreground">Project not found</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const AppSidebar = () => (
    <Sidebar className="w-60">
      <SidebarContent>
        {/* Project Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-gradient-primary">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">
              AI Image Agent
            </span>
          </div>
          <h2 className="font-semibold text-foreground truncate">
            {project.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {project.project_type === 'image-generation' && 'Image Generation'}
            {project.project_type === 'print-on-shirt' && 'Print on Shirt'}
            {project.project_type === 'journal' && 'Journal'}
          </p>
        </div>

        {/* Dashboard - Standalone */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="dashboard"
                    className={({ isActive }) => `
                      flex items-center gap-2 px-2 py-2 rounded-md transition-colors
                      ${
                        isActive
                          ? 'bg-muted text-primary font-medium'
                          : 'hover:bg-muted/50'
                      }
                    `}
                    end
                  >
                    <ChartColumn className="h-4 w-4" />
                    <span>Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Project 1 - Image Generation */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleGroup('project1')}
          >
            <div className="flex items-center gap-2">
              <Images className="h-4 w-4" />
              <span>Project 1 - Image Generation</span>
            </div>
            {expandedGroups.project1 ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </SidebarGroupLabel>
          {expandedGroups.project1 && (
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="schedules"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }
                      `}
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Schedules</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="queue"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }
                      `}
                    >
                      <Clock className="h-4 w-4" />
                      <span>Generation Queue</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="images"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }
                      `}
                    >
                      <Images className="h-4 w-4" />
                      <span>Generated Images</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="bucket/image-generation"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }
                      `}
                    >
                      <Folder className="h-4 w-4" />
                      <span>Reference Bucket</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Project 2 - Print on Shirt */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleGroup('project2')}
          >
            <div className="flex items-center gap-2">
              <Shirt className="h-4 w-4" />
              <span>Project 2 - Print on Shirt</span>
            </div>
            {expandedGroups.project2 ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </SidebarGroupLabel>
          {expandedGroups.project2 && (
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="printonshirt"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }
                      `}
                    >
                      <Shirt className="h-4 w-4" />
                      <span>Print on Shirt</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="output2"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }
                      `}
                    >
                      <Database className="h-4 w-4" />
                      <span>Output2</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="bucket/print-on-shirt"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }
                      `}
                    >
                      <Folder className="h-4 w-4" />
                      <span>Reference Bucket</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Project 3 - Journal */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleGroup('project3')}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span>Project 3 - Journal</span>
            </div>
            {expandedGroups.project3 ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </SidebarGroupLabel>
          {expandedGroups.project3 && (
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="journal"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }
                      `}
                    >
                      <FileText className="h-4 w-4" />
                      <span>Journal Blog Post</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="output3"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }
                      `}
                    >
                      <Database className="h-4 w-4" />
                      <span>Output3</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="bucket/journal"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }
                      `}
                    >
                      <Folder className="h-4 w-4" />
                      <span>Reference Bucket</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Settings - Standalone */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="settings"
                    className={({ isActive }) => `
                      flex items-center gap-2 px-2 py-2 rounded-md transition-colors
                      ${
                        isActive
                          ? 'bg-muted text-primary font-medium'
                          : 'hover:bg-muted/50'
                      }
                    `}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Theme Toggle */}
        <SidebarGroup>
          <SidebarGroupLabel>Appearance</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2">
              <ThemeToggle />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1">
            {/* Header */}
            <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
              <div className="flex items-center gap-4 px-6 py-4">
                <SidebarTrigger />
                <div className="text-sm text-muted-foreground">
                  demo · 2847 tokens
                </div>
              </div>
            </header>

            {/* Content */}
            <div className="p-6">
              <Outlet context={{ project, fetchProjectData }} />
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default ProjectLayout;
