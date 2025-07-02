import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

  const generateNow = async () => {
    if (!project) return;
    
    try {
      toast.info('Starting image generation...');
      
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          project_id: projectId,
          manual_generation: true
        }
      });

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
            <Button onClick={generateNow} className="w-full justify-start" variant="outline">
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
        <Button onClick={generateNow} className="bg-gradient-primary hover:shadow-glow">
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
          <Button onClick={generateNow} className="bg-gradient-primary hover:shadow-glow">
            <Zap className="mr-2 h-4 w-4" />
            Generate First Image
          </Button>
        </div>
      )}
    </div>
  );

  const SchedulesView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedules</h1>
          <p className="text-muted-foreground">Create and manage your image generation schedules</p>
        </div>
        <Button className="bg-gradient-primary hover:shadow-glow">
          <Plus className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      <div className="space-y-4">
        {project && (
          <Card className="shadow-card border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${project.schedule_enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <h3 className="text-lg font-semibold">{project.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <AlertCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground mb-4">
                <div>
                  <Clock className="h-3 w-3 inline mr-1" />
                  Every {project.generation_interval_minutes}m
                </div>
                <div>
                  <Images className="h-3 w-3 inline mr-1" />
                  Target: {project.max_images_to_generate || 'Unlimited'} images
                </div>
                <div>1080p • 1:1</div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span>{images.length} / {project.max_images_to_generate || '∞'}</span>
                </div>
                <Progress 
                  value={project.max_images_to_generate ? (images.length / project.max_images_to_generate) * 100 : 0} 
                  className="h-2" 
                />
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Prompt</p>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  {project.prompt || 'No prompt set'}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Created: {new Date(project.created_at).toLocaleDateString()}
                  {project.schedule_enabled && project.last_generation_at && (
                    <span className="ml-4">
                      Next run: {new Date(new Date(project.last_generation_at).getTime() + project.generation_interval_minutes * 60000).toLocaleString()}
                    </span>
                  )}
                </div>
                <Badge variant={project.schedule_enabled ? "default" : "secondary"}>
                  {project.schedule_enabled ? "Active" : "Paused"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const SettingsView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account and application preferences</p>
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
              <Button variant="outline" size="sm">Upgrade Plan</Button>
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
                Your API key is used to authenticate with Replicate's image models
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
            <Button className="w-full bg-gradient-primary hover:shadow-glow">
              Save API Configuration
            </Button>
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
                <p className="text-2xl font-bold text-primary">{project?.schedule_enabled ? 1 : 0}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Total Images</p>
                <p className="text-2xl font-bold text-primary">{images.length}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Queue Items</p>
                <p className="text-2xl font-bold text-primary">{jobs.filter(job => job.status === 'pending').length}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Success Rate</p>
                <p className="text-2xl font-bold text-primary">{stats.successRate.toFixed(0)}%</p>
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
          <h1 className="text-2xl font-bold text-foreground">Generation Queue</h1>
          <p className="text-muted-foreground">Monitor and manage your image generation queue</p>
        </div>
        <Button variant="outline">
          <Settings className="mr-2 h-4 w-4" />
          Manage Queue
        </Button>
      </div>

      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle>Queue Items</CardTitle>
          <CardDescription>{jobs.filter(job => job.status === 'pending').length} pending</CardDescription>
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
                      <Badge variant={
                        job.status === 'completed' ? 'default' :
                        job.status === 'running' ? 'secondary' :
                        job.status === 'failed' ? 'destructive' : 'outline'
                      }>
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
                        <Button variant="outline" size="sm" className="text-destructive">
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
              <h3 className="text-lg font-medium text-foreground mb-2">No items in queue</h3>
              <p className="text-muted-foreground mb-4">Start a schedule or generate manually to see queue items</p>
              <Button onClick={generateNow} className="bg-gradient-primary hover:shadow-glow">
                <Zap className="mr-2 h-4 w-4" />
                Generate Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

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