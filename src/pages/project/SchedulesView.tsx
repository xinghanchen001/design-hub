import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
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
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Calendar,
  Plus,
  Settings,
  Trash2,
  Clock,
  Images,
  Zap,
  Activity,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Schedule = Tables<'schedules'>;
type Project = Tables<'projects'>;

interface ScheduleWithProject extends Schedule {
  projects: Project;
}

const SchedulesView = () => {
  const navigate = useNavigate();
  const { project, fetchProjectData } = useOutletContext<{
    project: any;
    fetchProjectData: () => Promise<void>;
  }>();
  const { user } = useAuth();

  const [userSchedules, setUserSchedules] = useState<ScheduleWithProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadUserSchedules();
  }, [user, project]);

  const loadUserSchedules = async () => {
    try {
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select(
          `
          *,
          projects (*)
        `
        )
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (schedulesError) throw schedulesError;

      setUserSchedules(schedulesData || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const openSettingsDialog = () => {
    // This should open settings dialog - for now just show toast
    toast.info('Settings dialog functionality needs to be implemented');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading schedules...</p>
        </div>
      </div>
    );
  }

  return (
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
        {userSchedules.length > 0 ? (
          userSchedules.map((schedule) => {
            const scheduleConfig = (schedule.schedule_config as any) || {};
            const generationSettings =
              (schedule.generation_settings as any) || {};
            const isActive = schedule.status === 'active';

            return (
              <Card key={schedule.id} className="shadow-card border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          isActive ? 'bg-green-500' : 'bg-gray-400'
                        }`}
                      />
                      <h3 className="text-lg font-semibold">{schedule.name}</h3>
                      {schedule.project_id === project?.id && (
                        <Badge variant="secondary" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                        <span className="text-sm font-medium">
                          {isActive ? 'Active' : 'Paused'}
                        </span>
                        <Switch
                          checked={isActive}
                          onCheckedChange={async () => {
                            try {
                              const newStatus = isActive ? 'paused' : 'active';
                              const { error } = await supabase
                                .from('schedules')
                                .update({ status: newStatus })
                                .eq('id', schedule.id);

                              if (error) throw error;

                              // Refresh data
                              await Promise.all([
                                loadUserSchedules(),
                                fetchProjectData(),
                              ]);
                              toast.success(
                                isActive
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
                        onClick={openSettingsDialog}
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
                              `Are you sure you want to delete "${schedule.name}"? All generated content for this schedule will also be deleted.`
                            )
                          )
                            return;

                          try {
                            const { error } = await supabase
                              .from('schedules')
                              .delete()
                              .eq('id', schedule.id);

                            if (error) throw error;

                            toast.success('Schedule deleted successfully');
                            await loadUserSchedules();
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
                      Every {scheduleConfig.interval_minutes || 60}m
                    </div>
                    <div>
                      <Images className="h-3 w-3 inline mr-1" />
                      Max: {generationSettings.max_images || 'Unlimited'}
                    </div>
                    <div>
                      <Zap className="h-3 w-3 inline mr-1" />
                      Duration: {scheduleConfig.duration_hours || 8}h
                    </div>
                    <div>
                      <Activity className="h-3 w-3 inline mr-1" />
                      {generationSettings.reference_image_url
                        ? 'With reference'
                        : 'Text-to-image'}
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Prompt</p>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg line-clamp-2">
                      {schedule.prompt || 'No prompt set'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Created:{' '}
                      {new Date(schedule.created_at || '').toLocaleDateString()}
                      {isActive && schedule.last_run && (
                        <span className="ml-4">
                          Next run:{' '}
                          {new Date(
                            new Date(schedule.last_run).getTime() +
                              (scheduleConfig.interval_minutes || 60) * 60000
                          ).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isActive ? 'default' : 'secondary'}>
                        {isActive ? 'Active' : 'Paused'}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate(`/project/${schedule.project_id}/dashboard`)
                        }
                      >
                        View Project
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
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
};

export default SchedulesView;
