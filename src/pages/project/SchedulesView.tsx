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

const SchedulesView = () => {
  const navigate = useNavigate();
  const { project, fetchProjectData } = useOutletContext<{
    project: Project;
    fetchProjectData: () => Promise<void>;
  }>();
  const { user } = useAuth();

  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadUserProjects();
  }, [user, project]);

  const loadUserProjects = async () => {
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      setUserProjects(projectsData || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load projects');
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
        {userProjects.length > 0 ? (
          userProjects.map((userProject) => (
            <Card key={userProject.id} className="shadow-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        userProject.schedule_enabled && userProject.is_active
                          ? 'bg-green-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    <h3 className="text-lg font-semibold">
                      {userProject.name}
                    </h3>
                    {userProject.id === project.id && (
                      <Badge variant="secondary" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                      <span className="text-sm font-medium">
                        {userProject.schedule_enabled && userProject.is_active
                          ? 'Active'
                          : 'Paused'}
                      </span>
                      <Switch
                        checked={
                          userProject.schedule_enabled && userProject.is_active
                        }
                        onCheckedChange={async () => {
                          try {
                            const { error } = await supabase
                              .from('projects')
                              .update({
                                schedule_enabled: !(
                                  userProject.schedule_enabled &&
                                  userProject.is_active
                                ),
                                is_active: !(
                                  userProject.schedule_enabled &&
                                  userProject.is_active
                                ),
                              })
                              .eq('id', userProject.id);

                            if (error) throw error;

                            // Refresh data
                            await Promise.all([
                              loadUserProjects(),
                              fetchProjectData(),
                            ]);
                            toast.success(
                              userProject.schedule_enabled &&
                                userProject.is_active
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
                            `Are you sure you want to delete "${userProject.name}"? All generated images and jobs will also be deleted.`
                          )
                        )
                          return;

                        try {
                          const { error } = await supabase
                            .from('projects')
                            .delete()
                            .eq('id', userProject.id);

                          if (error) throw error;

                          toast.success('Schedule deleted successfully');

                          // If we deleted the current project, navigate to first remaining project or home
                          if (userProject.id === project.id) {
                            const remaining = userProjects.filter(
                              (p) => p.id !== userProject.id
                            );
                            if (remaining.length > 0) {
                              navigate(`/project/${remaining[0].id}/dashboard`);
                            } else {
                              navigate('/');
                            }
                          } else {
                            await loadUserProjects(); // Refresh the list
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
                    Every {userProject.generation_interval_minutes}m
                  </div>
                  <div>
                    <Images className="h-3 w-3 inline mr-1" />
                    Max: {userProject.max_images_to_generate || 'Unlimited'}
                  </div>
                  <div>
                    <Zap className="h-3 w-3 inline mr-1" />
                    Duration: {userProject.schedule_duration_hours}h
                  </div>
                  <div>
                    <Activity className="h-3 w-3 inline mr-1" />
                    {userProject.reference_image_url
                      ? 'With reference'
                      : 'Text-to-image'}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium mb-2">Prompt</p>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg line-clamp-2">
                    {userProject.prompt || 'No prompt set'}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Created:{' '}
                    {new Date(userProject.created_at).toLocaleDateString()}
                    {userProject.schedule_enabled &&
                      userProject.is_active &&
                      userProject.last_generation_at && (
                        <span className="ml-4">
                          Next run:{' '}
                          {new Date(
                            new Date(userProject.last_generation_at).getTime() +
                              userProject.generation_interval_minutes * 60000
                          ).toLocaleString()}
                        </span>
                      )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        userProject.schedule_enabled && userProject.is_active
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {userProject.schedule_enabled && userProject.is_active
                        ? 'Active'
                        : 'Paused'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(`/project/${userProject.id}/dashboard`)
                      }
                    >
                      View Details
                    </Button>
                  </div>
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
};

export default SchedulesView;
