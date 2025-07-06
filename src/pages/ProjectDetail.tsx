import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot,
  Calendar,
  Image,
  Activity,
  Settings,
  Play,
  Pause,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Images,
  Zap,
  Trash2,
  FileText,
  Send,
  Loader2,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  prompt: string;
  schedule_enabled: boolean;
  schedule_duration_hours: number;
  max_images_to_generate: number;
  generation_interval_minutes: number;
  last_generation_at: string;
  is_active: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

interface GenerationJob {
  id: string;
  status: string;
  scheduled_at: string;
  started_at: string;
  completed_at: string;
  error_message: string;
  images_generated: number;
}

interface GeneratedImage {
  id: string;
  image_url: string;
  prompt: string;
  generated_at: string;
  project_id: string;
  project_name?: string | null; // Project name, null if project deleted
  model_used?: string;
  generation_time_seconds?: number;
}

interface JournalBlogPost {
  id: string;
  title: string;
  system_prompt: string;
  user_prompt: string;
  ai_response: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const ProjectDetail = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [userProjects, setUserProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!user || !projectId) return;

    fetchProjectData();
  }, [user, projectId]);

  const fetchProjectData = async () => {
    try {
      // Fetch current project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user?.id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch ALL user projects for schedules view
      const { data: allProjectsData, error: allProjectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (allProjectsError) throw allProjectsError;
      setUserProjects(allProjectsData || []);

      // Fetch generation jobs for this project
      const { data: jobsData, error: jobsError } = await supabase
        .from('generation_jobs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);

      // Fetch ALL generated images for this user (not just current project)
      const { data: imagesData, error: imagesError } = await supabase
        .from('generated_images')
        .select(
          `
          *,
          projects:project_id (
            name
          )
        `
        )
        .eq('user_id', user?.id)
        .order('generated_at', { ascending: false })
        .limit(50);

      if (imagesError) throw imagesError;

      // Transform the data to include project names
      const transformedImages = (imagesData || []).map((image) => ({
        ...image,
        project_name: image.projects?.name || null, // null if project deleted
      }));

      setImages(transformedImages || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load project data');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const toggleSchedule = async () => {
    if (!project) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ schedule_enabled: !project.schedule_enabled })
        .eq('id', projectId);

      if (error) throw error;

      setProject((prev) =>
        prev ? { ...prev, schedule_enabled: !prev.schedule_enabled } : null
      );
      toast.success(
        project.schedule_enabled ? 'Schedule paused' : 'Schedule activated'
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to update schedule');
    }
  };

  const deleteProject = async () => {
    if (
      !project ||
      !window.confirm(
        'Are you sure you want to delete this schedule? All generated images and jobs will also be deleted.'
      )
    )
      return;

    try {
      setLoading(true);

      // Delete the project (this will cascade delete related images and jobs due to foreign key constraints)
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast.success('Schedule deleted successfully');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete schedule');
    } finally {
      setLoading(false);
    }
  };

  const generateNow = async () => {
    if (!project) return;

    try {
      toast.info('Starting image generation...');

      const { data, error } = await supabase.functions.invoke(
        'generate-image',
        {
          body: {
            project_id: projectId,
            manual_generation: true,
          },
        }
      );

      if (error) throw error;

      if (data?.success) {
        toast.success('Image generated successfully!');
        // Refresh the data
        fetchProjectData();
      } else {
        throw new Error(data?.error || 'Generation failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate image');
    }
  };

  const stats = {
    activeSchedules: userProjects.filter(
      (p) => p.schedule_enabled && p.is_active
    ).length,
    imagesGenerated: images.length,
    queueStatus: jobs.filter((job) => job.status === 'pending').length,
    successRate:
      jobs.length > 0
        ? (jobs.filter((job) => job.status === 'completed').length /
            jobs.length) *
          100
        : 100,
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
          <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const sidebarItems = [
    { title: 'Dashboard', icon: BarChart3, key: 'dashboard' },
    { title: 'Schedules', icon: Calendar, key: 'schedules' },
    { title: 'Generation Queue', icon: Clock, key: 'queue' },
    { title: 'Generated Images', icon: Images, key: 'images' },
    { title: 'Journal Blog Post', icon: FileText, key: 'journal' },
    { title: 'Settings', icon: Settings, key: 'settings' },
  ];

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
          <p className="text-xs text-muted-foreground">Runway Gen-4</p>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    onClick={() => setActiveView(item.key)}
                    className={
                      activeView === item.key
                        ? 'bg-muted text-primary font-medium'
                        : 'hover:bg-muted/50'
                    }
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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

  const DashboardView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your AI image generation tasks
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Schedules
            </CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSchedules}</div>
            <p className="text-xs text-green-500">+12% from last week</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Images Generated
            </CardTitle>
            <Image className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.imagesGenerated}</div>
            <p className="text-xs text-green-500">+24% from last week</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.queueStatus}</div>
            <p className="text-xs text-muted-foreground">pending generation</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.successRate.toFixed(0)}%
            </div>
            <p className="text-xs text-green-500">+0.8% from last week</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Schedules & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Active Schedules</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveView('schedules')}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {stats.activeSchedules > 0 ? (
              <div className="space-y-3">
                {userProjects
                  .filter((p) => p.schedule_enabled && p.is_active)
                  .slice(0, 3) // Show max 3 active schedules
                  .map((activeProject) => (
                    <div
                      key={activeProject.id}
                      className={`flex items-center justify-between p-4 border border-border rounded-lg ${
                        activeProject.id === projectId ? 'bg-muted/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-green-100">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{activeProject.name}</p>
                            {activeProject.id === projectId && (
                              <Badge variant="outline" className="text-xs">
                                Current
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Every {activeProject.generation_interval_minutes}m
                            for {activeProject.schedule_duration_hours}h
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  ))}

                {/* Show "View All" if there are more than 3 active schedules */}
                {stats.activeSchedules > 3 && (
                  <div className="text-center pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveView('schedules')}
                    >
                      View {stats.activeSchedules - 3} more active schedules
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">
                  No active schedules
                </p>
                <Button onClick={() => navigate('/create-project')} size="sm">
                  Create your first schedule
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => {
                if (project.schedule_enabled) {
                  // If schedule is enabled, toggle it off/on
                  toggleSchedule();
                } else {
                  // If no schedule is enabled, create a new schedule
                  navigate('/create-project');
                }
              }}
              className="w-full justify-start"
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              {project.schedule_enabled
                ? 'Toggle Schedule'
                : 'Create New Schedule'}
            </Button>
            <Button
              onClick={() => setActiveView('images')}
              className="w-full justify-start"
              variant="outline"
            >
              <Images className="mr-2 h-4 w-4" />
              View Gallery
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Generation Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length > 0 ? (
              <div className="space-y-3">
                {jobs.slice(0, 5).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-3 p-2 rounded-lg border border-border"
                  >
                    <div
                      className={`p-1 rounded-full ${
                        job.status === 'completed'
                          ? 'bg-green-100'
                          : job.status === 'running'
                          ? 'bg-blue-100'
                          : job.status === 'failed'
                          ? 'bg-red-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      <Activity
                        className={`h-3 w-3 ${
                          job.status === 'completed'
                            ? 'text-green-600'
                            : job.status === 'running'
                            ? 'text-blue-600'
                            : job.status === 'failed'
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{job.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.scheduled_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No recent activity
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Generation Queue</CardTitle>
              <CardDescription>{stats.queueStatus} pending</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              Manage Queue
            </Button>
          </CardHeader>
          <CardContent>
            {stats.queueStatus > 0 ? (
              <div>Queue items would go here</div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No items in queue</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const ImagesView = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          All Generated Images
        </h1>
        <p className="text-muted-foreground">
          View all AI-generated images from all your schedules
        </p>
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {images.map((image) => (
            <Card
              key={image.id}
              className="shadow-card border-border/50 overflow-hidden"
            >
              <div className="aspect-square bg-muted relative">
                <img
                  src={image.image_url}
                  alt={image.prompt}
                  className="w-full h-full object-cover"
                />
                {/* Model badge */}
                {image.model_used && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="text-xs">
                      {image.model_used === 'flux-kontext-max'
                        ? 'Edit'
                        : 'Generate'}
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {/* Project name or "Deleted Schedule" */}
                  <div className="flex items-center gap-2">
                    <Bot className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {image.project_name || '(Deleted Schedule)'}
                    </span>
                  </div>

                  {/* Prompt */}
                  <p
                    className="text-sm text-foreground line-clamp-2"
                    title={image.prompt}
                  >
                    {image.prompt}
                  </p>

                  {/* Date and generation time */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {new Date(image.generated_at).toLocaleDateString()}
                    </span>
                    {image.generation_time_seconds && (
                      <span>{image.generation_time_seconds.toFixed(1)}s</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Image className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            No images generated yet
          </h3>
          <p className="text-muted-foreground">
            Images will appear here automatically when your schedules run
          </p>
        </div>
      )}
    </div>
  );

  const SchedulesView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedules</h1>
          <p className="text-muted-foreground">
            Create and manage your image generation schedules
          </p>
        </div>
        <Button onClick={() => navigate('/create-project')}>
          <Plus className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      <div className="space-y-4">
        {userProjects.length > 0 ? (
          userProjects.map((project) => (
            <Card key={project.id} className="shadow-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        project.schedule_enabled && project.is_active
                          ? 'bg-green-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    <h3 className="text-lg font-semibold">{project.name}</h3>
                    {project.id === projectId && (
                      <Badge variant="secondary" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                      <span className="text-sm font-medium">
                        {project.schedule_enabled && project.is_active
                          ? 'Active'
                          : 'Paused'}
                      </span>
                      <Switch
                        checked={project.schedule_enabled && project.is_active}
                        onCheckedChange={async () => {
                          try {
                            const { error } = await supabase
                              .from('projects')
                              .update({
                                schedule_enabled: !(
                                  project.schedule_enabled && project.is_active
                                ),
                                is_active: !(
                                  project.schedule_enabled && project.is_active
                                ),
                              })
                              .eq('id', project.id);

                            if (error) throw error;

                            // Refresh data
                            fetchProjectData();
                            toast.success(
                              project.schedule_enabled && project.is_active
                                ? 'Schedule paused'
                                : 'Schedule activated'
                            );
                          } catch (error: any) {
                            toast.error(
                              error.message || 'Failed to update schedule'
                            );
                          }
                        }}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Are you sure you want to delete "${project.name}"? All generated images and jobs will also be deleted.`
                          )
                        )
                          return;

                        try {
                          const { error } = await supabase
                            .from('projects')
                            .delete()
                            .eq('id', project.id);

                          if (error) throw error;

                          toast.success('Schedule deleted successfully');

                          // If we deleted the current project, navigate to first remaining project or home
                          if (project.id === projectId) {
                            const remaining = userProjects.filter(
                              (p) => p.id !== project.id
                            );
                            if (remaining.length > 0) {
                              navigate(`/project/${remaining[0].id}`);
                            } else {
                              navigate('/');
                            }
                          } else {
                            fetchProjectData(); // Refresh the list
                          }
                        } catch (error: any) {
                          toast.error(
                            error.message || 'Failed to delete schedule'
                          );
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mb-4">
                  <div>
                    <Clock className="h-3 w-3 inline mr-1" />
                    Every {project.generation_interval_minutes}m
                  </div>
                  <div>
                    <Images className="h-3 w-3 inline mr-1" />
                    Max: {project.max_images_to_generate || 'Unlimited'}
                  </div>
                  <div>
                    <Zap className="h-3 w-3 inline mr-1" />
                    Duration: {project.schedule_duration_hours}h
                  </div>
                  <div>
                    <Activity className="h-3 w-3 inline mr-1" />
                    {project.reference_image_url
                      ? 'With reference'
                      : 'Text-to-image'}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium mb-2">Prompt</p>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg line-clamp-2">
                    {project.prompt || 'No prompt set'}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Created: {new Date(project.created_at).toLocaleDateString()}
                    {project.schedule_enabled &&
                      project.is_active &&
                      project.last_generation_at && (
                        <span className="ml-4">
                          Next run:{' '}
                          {new Date(
                            new Date(project.last_generation_at).getTime() +
                              project.generation_interval_minutes * 60000
                          ).toLocaleString()}
                        </span>
                      )}
                  </div>
                  <Badge
                    variant={
                      project.schedule_enabled && project.is_active
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {project.schedule_enabled && project.is_active
                      ? 'Active'
                      : 'Paused'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No schedules created yet
            </h3>
            <p className="text-muted-foreground mb-4">
              Create your first AI image generation schedule to get started
            </p>
            <Button onClick={() => navigate('/create-project')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Schedule
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const SettingsView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and application preferences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Information */}
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Username</label>
              <p className="text-sm text-muted-foreground">demo</p>
            </div>
            <div>
              <label className="text-sm font-medium">Plan</label>
              <p className="text-sm text-muted-foreground">Free</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Available Tokens</label>
                <p className="text-sm text-muted-foreground">Unlimited</p>
              </div>
              <Button variant="outline" size="sm">
                Upgrade Plan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              API Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Replicate API Key</label>
              <p className="text-xs text-muted-foreground mb-2">
                Your API key is used to authenticate with Replicate's image
                models
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Enter your Replicate API key..."
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">API Status</label>
              <p className="text-sm text-green-600">Configured</p>
            </div>
            <Button className="w-full">Save API Configuration</Button>
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Usage Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Active Schedules</p>
                <p className="text-2xl font-bold text-primary">
                  {project?.schedule_enabled ? 1 : 0}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Total Images</p>
                <p className="text-2xl font-bold text-primary">
                  {images.length}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Queue Items</p>
                <p className="text-2xl font-bold text-primary">
                  {jobs.filter((job) => job.status === 'pending').length}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Success Rate</p>
                <p className="text-2xl font-bold text-primary">
                  {stats.successRate.toFixed(0)}%
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Statistics are updated in real-time as your schedules run
            </p>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                Export Generated Images
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Export Schedule Data
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Import Configuration
              </Button>
            </div>

            <div className="border-t pt-3 space-y-2">
              <Button variant="destructive" className="w-full justify-start">
                Clear Failed Queue Items
              </Button>
              <Button variant="destructive" className="w-full justify-start">
                Delete All Generated Images
              </Button>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Destructive actions cannot be undone
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Information */}
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div>
              <p className="font-medium">Application Version</p>
              <p className="text-muted-foreground">1.0.0</p>
            </div>
            <div>
              <p className="font-medium">API Model</p>
              <p className="text-muted-foreground">Flux Kontext Max</p>
            </div>
            <div>
              <p className="font-medium">Last Updated</p>
              <p className="text-muted-foreground">Just now</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const QueueView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Generation Queue
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage your image generation queue
          </p>
        </div>
        <Button variant="outline">
          <Settings className="mr-2 h-4 w-4" />
          Manage Queue
        </Button>
      </div>

      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle>Queue Items</CardTitle>
          <CardDescription>
            {jobs.filter((job) => job.status === 'pending').length} pending
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.slice(0, 10).map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      {project?.prompt || 'No prompt'}
                    </TableCell>
                    <TableCell>1080p • 1:1</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          job.status === 'completed'
                            ? 'default'
                            : job.status === 'running'
                            ? 'secondary'
                            : job.status === 'failed'
                            ? 'destructive'
                            : 'outline'
                        }
                      >
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Medium</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm">
                          <Settings className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                        >
                          <AlertCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No items in queue
              </h3>
              <p className="text-muted-foreground">
                Queue items will appear here when your schedule creates new
                generation jobs
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const JournalView = () => {
    const [isCreating, setIsCreating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [systemPrompt, setSystemPrompt] = useState(
      'Schreibe diesen Artikel im professionellen Tagesschau-Stil um, mit einer passenden Schlagzeile und Datum. Behalt die wichtigsten Informationen bei, aber mache ihn journalistisch strukturiert und objektiv'
    );
    const [userPrompt, setUserPrompt] = useState('');
    const [expandedPost, setExpandedPost] = useState<string | null>(null);
    const [journalPosts, setJournalPosts] = useState<JournalBlogPost[]>([]);

    const fetchJournalPosts = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) return;

        const response = await fetch(
          'https://sphgdlqoabzsyhtyopim.supabase.co/functions/v1/journal-blog-post',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${session.session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          setJournalPosts(result.data || []);
        }
      } catch (error) {
        console.error('Error fetching journal posts:', error);
      }
    };

    useEffect(() => {
      fetchJournalPosts();
    }, []);

    const handleCreatePost = async () => {
      if (!title.trim() || !systemPrompt.trim() || !userPrompt.trim()) {
        toast.error('Please fill in all fields');
        return;
      }

      setIsLoading(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          toast.error('Please sign in to create a journal post');
          return;
        }

        const response = await fetch(
          'https://sphgdlqoabzsyhtyopim.supabase.co/functions/v1/journal-blog-post',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title,
              systemPrompt,
              userPrompt,
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();
          setJournalPosts([result.data, ...journalPosts]);
          setTitle('');
          setUserPrompt('');
          setIsCreating(false);
          toast.success('Journal post created successfully!');
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to create journal post');
        }
      } catch (error) {
        toast.error('Failed to create journal post');
        console.error('Error creating journal post:', error);
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Journal Blog Post
            </h1>
            <p className="text-muted-foreground">
              Create AI-powered journal blog posts using your fine-tuned model
            </p>
          </div>
          <Button
            onClick={() => setIsCreating(!isCreating)}
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Post
          </Button>
        </div>

        {isCreating && (
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle>Create New Journal Post</CardTitle>
              <CardDescription>
                Use your fine-tuned AI model to generate professional journal
                content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter post title..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">System Prompt</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Enter system prompt..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">User Prompt</label>
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Enter your content to be transformed..."
                  rows={6}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreatePost}
                  disabled={isLoading}
                  className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Generate Post
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {journalPosts.length > 0 ? (
            journalPosts.map((post) => (
              <Card key={post.id} className="shadow-card border-border/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{post.title}</CardTitle>
                      <CardDescription>
                        Created {new Date(post.created_at).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedPost(
                          expandedPost === post.id ? null : post.id
                        )
                      }
                    >
                      {expandedPost === post.id ? 'Collapse' : 'Expand'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-muted/30 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">AI Response:</h4>
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-sm">
                          {post.ai_response}
                        </pre>
                      </div>
                    </div>
                    {expandedPost === post.id && (
                      <div className="space-y-3 border-t pt-4">
                        <div>
                          <h4 className="font-medium text-sm mb-1">
                            System Prompt:
                          </h4>
                          <p className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg">
                            {post.system_prompt}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium text-sm mb-1">
                            User Prompt:
                          </h4>
                          <p className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg">
                            {post.user_prompt}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="shadow-card border-border/50">
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">
                  No journal posts yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Create your first journal post to get started
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'images':
        return <ImagesView />;
      case 'schedules':
        return <SchedulesView />;
      case 'queue':
        return <QueueView />;
      case 'journal':
        return <JournalView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

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
            <div className="p-6">{renderActiveView()}</div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default ProjectDetail;
