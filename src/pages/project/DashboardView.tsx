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
import type { Tables } from '@/integrations/supabase/types';

type Project = Tables<'projects'>;
type Schedule = Tables<'schedules'>;
type GenerationJob = Tables<'generation_jobs'>;
type GeneratedContent = Tables<'generated_content'>;

interface ProjectSettings {
  prompt?: string;
  reference_image_url?: string;
  max_images_to_generate?: number;
  schedule_duration_hours?: number;
  generation_interval_minutes?: number;
}

interface ScheduleWithJobs extends Schedule {
  generation_jobs?: GenerationJob[];
}

interface GeneratedContentWithProject extends GeneratedContent {
  schedules?: { name: string; task_type: string };
}

const DashboardView = () => {
  const { project, tasks, fetchProjectData } = useOutletContext<{
    project: Project;
    tasks: any[];
    fetchProjectData: () => Promise<void>;
  }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [images, setImages] = useState<GeneratedContentWithProject[]>([]);
  const [userSchedules, setUserSchedules] = useState<ScheduleWithJobs[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !project || !tasks) return;
    loadDashboardData();
  }, [user, project, tasks]);

  const loadDashboardData = async () => {
    try {
      // Fetch ALL user schedules for schedules view
      const { data: allSchedulesData, error: allSchedulesError } =
        await supabase
          .from('schedules')
          .select(
            `
          *,
          generation_jobs (*)
        `
          )
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });

      if (allSchedulesError) throw allSchedulesError;
      setUserSchedules(allSchedulesData || []);

      // Get schedules for this project to fetch their jobs
      // Use tasks to get task IDs for this project
      const projectTaskIds = tasks?.map((task) => task.id) || [];
      const projectSchedules =
        allSchedulesData?.filter((s) => projectTaskIds.includes(s.task_id)) ||
        [];
      const allJobs = projectSchedules.flatMap((s) => s.generation_jobs || []);
      setJobs(allJobs.slice(0, 10)); // Limit to 10 most recent

      // Fetch ALL generated content for this user
      const { data: contentData, error: contentError } = await supabase
        .from('generated_content')
        .select(
          `
          *,
          schedules:schedule_id (
            name,
            task_type
          )
        `
        )
        .eq('user_id', user?.id)
        .eq('content_type', 'image')
        .eq('generation_status', 'completed')
        .not('content_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (contentError) throw contentError;

      setImages(contentData || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const toggleSchedule = async () => {
    if (!project || !tasks?.length) return;

    try {
      // Get the first schedule for this project's tasks
      const projectTaskIds = tasks.map((task) => task.id);
      const { data: schedules, error: fetchError } = await supabase
        .from('schedules')
        .select('*')
        .in('task_id', projectTaskIds)
        .limit(1);

      if (fetchError) throw fetchError;

      if (!schedules || schedules.length === 0) {
        toast.info('No schedule found for this project');
        navigate('/create-project');
        return;
      }

      const schedule = schedules[0];
      const newStatus = schedule.status === 'active' ? 'paused' : 'active';

      const { error } = await supabase
        .from('schedules')
        .update({ status: newStatus })
        .eq('id', schedule.id);

      if (error) throw error;

      toast.success(
        newStatus === 'paused' ? 'Schedule paused' : 'Schedule activated'
      );

      await fetchProjectData();
      await loadDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update schedule');
    }
  };

  const stats = {
    activeSchedules: userSchedules.filter((s) => s.status === 'active').length,
    imagesGenerated: images.length,
    queueStatus: jobs.filter((job) => job.status === 'queued').length,
    successRate:
      jobs.length > 0
        ? (jobs.filter((job) => job.status === 'completed').length /
            jobs.length) *
          100
        : 100,
  };

  const projectSettings = (project.settings as ProjectSettings) || {};

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
                {userSchedules
                  .filter((s) => s.status === 'active')
                  .slice(0, 3)
                  .map((activeSchedule) => {
                    const scheduleConfig =
                      (activeSchedule.schedule_config as any) || {};
                    const projectTaskIds = tasks?.map((task) => task.id) || [];
                    const isCurrentProject = projectTaskIds.includes(
                      activeSchedule.task_id
                    );

                    return (
                      <div
                        key={activeSchedule.id}
                        className={`flex items-center justify-between p-4 border border-border rounded-lg ${
                          isCurrentProject ? 'bg-muted/30' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-green-100">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {activeSchedule.name}
                              </p>
                              {isCurrentProject && (
                                <Badge variant="outline" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Every {scheduleConfig.interval_minutes || 60}m for{' '}
                              {scheduleConfig.duration_hours || 8}h
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">Active</Badge>
                      </div>
                    );
                  })}

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
                const projectTaskIds = tasks?.map((task) => task.id) || [];
                const hasSchedule = userSchedules.some((s) =>
                  projectTaskIds.includes(s.task_id)
                );
                if (hasSchedule) {
                  toggleSchedule();
                } else {
                  navigate('/create-project');
                }
              }}
              className="w-full justify-start"
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              {(() => {
                const projectTaskIds = tasks?.map((task) => task.id) || [];
                return userSchedules.some((s) =>
                  projectTaskIds.includes(s.task_id)
                )
                  ? 'Toggle Schedule'
                  : 'Create New Schedule';
              })()}
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
                          : job.status === 'processing'
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
                            : job.status === 'processing'
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
                        {new Date(job.created_at || '').toLocaleString()}
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
