import { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Calendar,
  Image,
  Clock,
  CheckCircle,
  Plus,
  Images,
  Activity,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  prompt: string | null;
  reference_image_url: string | null;
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
  project_name?: string | null;
  model_used?: string;
  generation_time_seconds?: number;
  storage_path?: string | null;
}

const DashboardView = () => {
  const { project, fetchProjectData } = useOutletContext<{
    project: Project;
    fetchProjectData: () => Promise<void>;
  }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !project) return;
    loadDashboardData();
  }, [user, project]);

  const loadDashboardData = async () => {
    try {
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
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);

      // Fetch ALL generated images for this user
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

      const transformedImages = (imagesData || []).map((image) => ({
        ...image,
        project_name: image.projects?.name || null,
      }));

      setImages(transformedImages || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load dashboard data');
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
        .eq('id', project.id);

      if (error) throw error;

      toast.success(
        project.schedule_enabled ? 'Schedule paused' : 'Schedule activated'
      );

      await fetchProjectData();
      await loadDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update schedule');
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
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
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
              onClick={() => navigate('schedules')}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {stats.activeSchedules > 0 ? (
              <div className="space-y-3">
                {userProjects
                  .filter((p) => p.schedule_enabled && p.is_active)
                  .slice(0, 3)
                  .map((activeProject) => (
                    <div
                      key={activeProject.id}
                      className={`flex items-center justify-between p-4 border border-border rounded-lg ${
                        activeProject.id === project.id ? 'bg-muted/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-green-100">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{activeProject.name}</p>
                            {activeProject.id === project.id && (
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

                {stats.activeSchedules > 3 && (
                  <div className="text-center pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('schedules')}
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
                  toggleSchedule();
                } else {
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
              onClick={() => navigate('images')}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('queue')}
            >
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
};

export default DashboardView;
