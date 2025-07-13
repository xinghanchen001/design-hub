import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock, Settings, AlertCircle } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Project = Tables<'projects'>;
type GenerationJob = Tables<'generation_jobs'>;
type Schedule = Tables<'schedules'>;

interface ProjectSettings {
  prompt?: string;
  reference_image_url?: string;
  max_images_to_generate?: number;
  schedule_duration_hours?: number;
  generation_interval_minutes?: number;
}

interface GenerationJobWithSchedule extends GenerationJob {
  schedules?: Schedule;
}

const QueueView = () => {
  const { project, tasks } = useOutletContext<{
    project: Project;
    tasks: any[];
    fetchProjectData: () => Promise<void>;
  }>();
  const { user } = useAuth();

  const [jobs, setJobs] = useState<GenerationJobWithSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !project || !tasks) return;
    loadJobs();
  }, [user, project, tasks]);

  const loadJobs = async () => {
    try {
      // Get task IDs for this project
      const projectTaskIds = tasks?.map((task) => task.id) || [];

      if (projectTaskIds.length === 0) {
        setJobs([]);
        setLoading(false);
        return;
      }

      // Get all schedules for these tasks
      const { data: schedules, error: schedulesError } = await supabase
        .from('schedules')
        .select('id')
        .in('task_id', projectTaskIds);

      if (schedulesError) throw schedulesError;

      if (!schedules || schedules.length === 0) {
        setJobs([]);
        setLoading(false);
        return;
      }

      // Then get all jobs for these schedules
      const scheduleIds = schedules.map((s) => s.id);
      const { data: jobsData, error: jobsError } = await supabase
        .from('generation_jobs')
        .select(
          `
          *,
          schedules (*)
        `
        )
        .in('schedule_id', scheduleIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (jobsError) throw jobsError;

      setJobs(jobsData || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading queue...</p>
        </div>
      </div>
    );
  }

  const pendingJobs = jobs.filter((job) => job.status === 'queued');
  const projectSettings = (project.settings as ProjectSettings) || {};

  return (
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
          <CardDescription>{pendingJobs.length} pending</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.slice(0, 20).map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      {job.schedules?.prompt || projectSettings.prompt ? (
                        <span
                          className="line-clamp-2"
                          title={
                            job.schedules?.prompt || projectSettings.prompt
                          }
                        >
                          {job.schedules?.prompt || projectSettings.prompt}
                        </span>
                      ) : (
                        'No prompt'
                      )}
                    </TableCell>
                    <TableCell>1080p • 1:1</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          job.status === 'completed'
                            ? 'default'
                            : job.status === 'processing'
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
                      <div className="text-sm">
                        <div>
                          {new Date(job.created_at || '').toLocaleDateString()}
                        </div>
                        <div className="text-muted-foreground">
                          {new Date(job.created_at || '').toLocaleTimeString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm">
                          <Settings className="h-3 w-3" />
                        </Button>
                        {job.status === 'failed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            title={job.error_message || 'Job failed'}
                          >
                            <AlertCircle className="h-3 w-3" />
                          </Button>
                        )}
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

      {/* Queue Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Jobs
                </p>
                <p className="text-2xl font-bold">{jobs.length}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <div className="h-4 w-4 bg-blue-600 rounded" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Pending
                </p>
                <p className="text-2xl font-bold">
                  {jobs.filter((j) => j.status === 'queued').length}
                </p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Completed
                </p>
                <p className="text-2xl font-bold">
                  {jobs.filter((j) => j.status === 'completed').length}
                </p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                <div className="h-4 w-4 bg-green-600 rounded" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Failed
                </p>
                <p className="text-2xl font-bold">
                  {jobs.filter((j) => j.status === 'failed').length}
                </p>
              </div>
              <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QueueView;
