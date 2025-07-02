import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Zap
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

  useEffect(() => {
    if (!user || !projectId) return;
    
    fetchProjectData();
  }, [user, projectId]);

  const fetchProjectData = async () => {
    try {
      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user?.id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch generation jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('generation_jobs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);

      // Fetch generated images
      const { data: imagesData, error: imagesError } = await supabase
        .from('generated_images')
        .select('*')
        .eq('project_id', projectId)
        .order('generated_at', { ascending: false })
        .limit(20);

      if (imagesError) throw imagesError;
      setImages(imagesData || []);

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
      
      setProject(prev => prev ? { ...prev, schedule_enabled: !prev.schedule_enabled } : null);
      toast.success(project.schedule_enabled ? 'Schedule paused' : 'Schedule activated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update schedule');
    }
  };

  const stats = {
    activeSchedules: project?.schedule_enabled ? 1 : 0,
    imagesGenerated: images.length,
    queueStatus: jobs.filter(job => job.status === 'pending').length,
    successRate: jobs.length > 0 ? (jobs.filter(job => job.status === 'completed').length / jobs.length) * 100 : 100
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
            <span className="text-sm font-medium text-foreground">AI Image Agent</span>
          </div>
          <h2 className="font-semibold text-foreground truncate">{project.name}</h2>
          <p className="text-xs text-muted-foreground">Runway Gen-4</p>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton 
                    onClick={() => setActiveView(item.key)}
                    className={activeView === item.key ? 'bg-muted text-primary font-medium' : 'hover:bg-muted/50'}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
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
          <p className="text-muted-foreground">Monitor your AI image generation tasks</p>
        </div>
        <Button 
          onClick={toggleSchedule}
          className={project.schedule_enabled ? 'bg-destructive hover:bg-destructive/90' : 'bg-gradient-primary hover:shadow-glow'}
        >
          {project.schedule_enabled ? (
            <>
              <Pause className="mr-2 h-4 w-4" />
              Pause Schedule
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start Schedule
            </>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSchedules}</div>
            <p className="text-xs text-green-500">+12% from last week</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Images Generated</CardTitle>
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
            <div className="text-2xl font-bold">{stats.successRate.toFixed(0)}%</div>
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
            <Button variant="outline" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
            {project.schedule_enabled ? (
              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Every {project.generation_interval_minutes}m for {project.schedule_duration_hours}h
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No active schedules</p>
                <Button onClick={toggleSchedule} size="sm">Start your schedule</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={toggleSchedule} className="w-full justify-start" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              {project.schedule_enabled ? 'Manage Schedule' : 'Create Schedule'}
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Zap className="mr-2 h-4 w-4" />
              Generate Now
            </Button>
            <Button 
              onClick={() => setActiveView('images')}
              className="w-full justify-start" variant="outline"
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
                  <div key={job.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                    <div className={`p-1 rounded-full ${
                      job.status === 'completed' ? 'bg-green-100' :
                      job.status === 'running' ? 'bg-blue-100' :
                      job.status === 'failed' ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                      <Activity className={`h-3 w-3 ${
                        job.status === 'completed' ? 'text-green-600' :
                        job.status === 'running' ? 'text-blue-600' :
                        job.status === 'failed' ? 'text-red-600' : 'text-gray-600'
                      }`} />
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
              <p className="text-center text-muted-foreground py-8">No recent activity</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Generation Queue</CardTitle>
              <CardDescription>{stats.queueStatus} pending</CardDescription>
            </div>
            <Button variant="outline" size="sm">Manage Queue</Button>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Generated Images</h1>
          <p className="text-muted-foreground">View all AI-generated images from this project</p>
        </div>
        <Button className="bg-gradient-primary hover:shadow-glow">
          <Plus className="mr-2 h-4 w-4" />
          Generate New
        </Button>
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {images.map((image) => (
            <Card key={image.id} className="shadow-card border-border/50 overflow-hidden">
              <div className="aspect-square bg-muted">
                <img 
                  src={image.image_url} 
                  alt={image.prompt}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground truncate">{image.prompt}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(image.generated_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Image className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No images generated yet</h3>
          <p className="text-muted-foreground mb-4">Start your schedule or generate manually to see images here</p>
          <Button className="bg-gradient-primary hover:shadow-glow">
            <Zap className="mr-2 h-4 w-4" />
            Generate First Image
          </Button>
        </div>
      )}
    </div>
  );

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'images':
        return <ImagesView />;
      case 'schedules':
        return <div className="p-8 text-center">Schedules view coming soon...</div>;
      case 'queue':
        return <div className="p-8 text-center">Queue view coming soon...</div>;
      case 'settings':
        return <div className="p-8 text-center">Settings view coming soon...</div>;
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
            <div className="p-6">
              {renderActiveView()}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default ProjectDetail;