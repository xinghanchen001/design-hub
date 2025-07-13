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
  Plus,
  List,
  Sparkles,
  ArrowLeft,
  Home,
  Activity,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import type { Tables } from '@/integrations/supabase/types';

type Project = Tables<'projects'>;
type Task = Tables<'tasks'>;
type Schedule = Tables<'schedules'>;

const ProjectLayout = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({
    imageGeneration: true,
    printOnShirt: true,
    journal: true,
  });

  useEffect(() => {
    if (!user || !projectId) return;
    fetchProjectData();
  }, [user, projectId]);

  const fetchProjectData = async () => {
    try {
      // Fetch project data
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user?.id)
        .single();

      if (projectError) throw projectError;

      // Fetch tasks within this project
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Fetch schedules for tasks in this project
      const taskIds = (tasksData || []).map((task) => task.id);
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select('*')
        .in('task_id', taskIds)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (schedulesError) throw schedulesError;

      setProject(projectData);
      setTasks(tasksData || []);
      setSchedules(schedulesData || []);
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

  // Count active schedules by task type
  const getActiveScheduleCountByType = (taskType: string) => {
    const taskIdsForType = tasks
      .filter((task) => task.task_type === taskType)
      .map((task) => task.id);

    return schedules.filter(
      (schedule) =>
        taskIdsForType.includes(schedule.task_id) &&
        schedule.status === 'active'
    ).length;
  };

  // Get total schedules by task type
  const getTotalScheduleCountByType = (taskType: string) => {
    const taskIdsForType = tasks
      .filter((task) => task.task_type === taskType)
      .map((task) => task.id);

    return schedules.filter((schedule) =>
      taskIdsForType.includes(schedule.task_id)
    ).length;
  };

  // Count tasks by type (keep for backward compatibility)
  const getTaskCountByType = (taskType: string) => {
    return tasks.filter((task) => task.task_type === taskType).length;
  };

  // Get active schedules with detailed information
  const getActiveSchedules = () => {
    return schedules
      .filter((schedule) => schedule.status === 'active')
      .map((schedule) => {
        const task = tasks.find((t) => t.id === schedule.task_id);
        return {
          ...schedule,
          task,
          taskTypeName:
            task?.task_type === 'image-generation'
              ? 'Image Generation'
              : task?.task_type === 'print-on-shirt'
              ? 'Print on Shirt'
              : task?.task_type === 'journal'
              ? 'Journal Blog Post'
              : task?.task_type || 'Unknown',
        };
      });
  };

  // Format interval display
  const formatInterval = (schedule: any) => {
    const config = schedule.schedule_config;
    if (config?.generation_interval_minutes) {
      const minutes = config.generation_interval_minutes;
      if (minutes < 60) {
        return `Every ${minutes} min`;
      } else if (minutes % 60 === 0) {
        return `Every ${minutes / 60}h`;
      } else {
        return `Every ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
      }
    }
    return 'Manual';
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
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Design Hub
            </span>
          </div>
          <h2 className="font-semibold text-foreground truncate">
            {project.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {schedules.filter((s) => s.status === 'active').length} active •{' '}
            {schedules.length} total schedules
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
                          ? 'bg-muted text-foreground font-medium'
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

        {/* Image Generation Schedule Group */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleGroup('imageGeneration')}
          >
            <div className="flex items-center gap-2">
              <Images className="h-4 w-4" />
              <span>Image Generation</span>
              <div className="flex items-center gap-1 ml-1">
                {getActiveScheduleCountByType('image-generation') > 0 && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
                <span className="text-xs text-muted-foreground">
                  ({getActiveScheduleCountByType('image-generation')}/
                  {getTotalScheduleCountByType('image-generation')})
                </span>
              </div>
            </div>
            {expandedGroups.imageGeneration ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </SidebarGroupLabel>
          {expandedGroups.imageGeneration && (
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
                            ? 'bg-muted text-foreground font-medium'
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
                            ? 'bg-muted text-foreground font-medium'
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
                            ? 'bg-muted text-foreground font-medium'
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
                            ? 'bg-muted text-foreground font-medium'
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

        {/* Print on Shirt Schedule Group */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleGroup('printOnShirt')}
          >
            <div className="flex items-center gap-2">
              <Shirt className="h-4 w-4" />
              <span>Print on Shirt</span>
              <div className="flex items-center gap-1 ml-1">
                {getActiveScheduleCountByType('print-on-shirt') > 0 && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
                <span className="text-xs text-muted-foreground">
                  ({getActiveScheduleCountByType('print-on-shirt')}/
                  {getTotalScheduleCountByType('print-on-shirt')})
                </span>
              </div>
            </div>
            {expandedGroups.printOnShirt ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </SidebarGroupLabel>
          {expandedGroups.printOnShirt && (
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
                            ? 'bg-muted text-foreground font-medium'
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
                            ? 'bg-muted text-foreground font-medium'
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
                      to="output2"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-foreground font-medium'
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
                      to="bucket/print-on-shirt"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-foreground font-medium'
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

        {/* Journal Blog Post Schedule Group */}
        <SidebarGroup>
          <SidebarGroupLabel
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleGroup('journal')}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span>Journal Blog Post</span>
              <div className="flex items-center gap-1 ml-1">
                {getActiveScheduleCountByType('journal') > 0 && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
                <span className="text-xs text-muted-foreground">
                  ({getActiveScheduleCountByType('journal')}/
                  {getTotalScheduleCountByType('journal')})
                </span>
              </div>
            </div>
            {expandedGroups.journal ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </SidebarGroupLabel>
          {expandedGroups.journal && (
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
                            ? 'bg-muted text-foreground font-medium'
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
                            ? 'bg-muted text-foreground font-medium'
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
                      to="output3"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-foreground font-medium'
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
                      to="bucket/journal"
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors ml-4
                        ${
                          isActive
                            ? 'bg-muted text-foreground font-medium'
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

        {/* Create Schedule */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="schedules"
                    className={({ isActive }) => `
                      flex items-center gap-2 px-2 py-2 rounded-md transition-colors
                      ${
                        isActive
                          ? 'bg-muted text-foreground font-medium'
                          : 'hover:bg-muted/50'
                      }
                    `}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Schedule</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
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
                          ? 'bg-muted text-foreground font-medium'
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
            {/* Header with Breadcrumb Navigation */}
            <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <SidebarTrigger />

                  {/* Breadcrumb Navigation */}
                  <div className="flex items-center gap-2 text-sm">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/')}
                      className="flex items-center gap-2 text-muted-foreground hover:text-primary px-2 h-8"
                    >
                      <Bot className="h-4 w-4" />
                      Design Hub
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        navigate(`/project/${project.id}/dashboard`)
                      }
                      className="text-muted-foreground hover:text-primary px-2 h-8"
                    >
                      Projects
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                      {project.name}
                    </span>
                  </div>
                </div>

                {/* Project Info */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {/* Active Schedules with Animation and Hover Details */}
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">
                        <div className="relative">
                          <Calendar className="h-4 w-4" />
                          {getActiveSchedules().length > 0 && (
                            <div className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                          )}
                        </div>
                        <span>
                          {
                            schedules.filter((s) => s.status === 'active')
                              .length
                          }{' '}
                          active
                        </span>
                        {getActiveSchedules().length > 0 && (
                          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                        )}
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" align="end">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                          <h4 className="font-semibold">Active Schedules</h4>
                          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                        </div>

                        {getActiveSchedules().length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No schedules are currently running
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {getActiveSchedules().map((schedule) => (
                              <div
                                key={schedule.id}
                                className="flex items-start justify-between p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
                              >
                                <div className="space-y-2 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">
                                      {schedule.name || schedule.taskTypeName}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    <span className="font-medium">
                                      {schedule.taskTypeName}
                                    </span>{' '}
                                    • {formatInterval(schedule)}
                                  </div>
                                  {schedule.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {schedule.description}
                                    </p>
                                  )}
                                  {/* Show prompt from task settings */}
                                  {schedule.task?.settings?.prompt && (
                                    <div className="mt-2">
                                      <p className="text-xs text-muted-foreground font-medium mb-1">
                                        Prompt:
                                      </p>
                                      <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded border">
                                        "{schedule.task.settings.prompt}"
                                      </p>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1 ml-3">
                                  <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                                    Running
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              </div>
            </header>

            {/* Content */}
            <div className="p-6">
              <Outlet
                context={{ project, tasks, schedules, fetchProjectData }}
              />
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default ProjectLayout;
