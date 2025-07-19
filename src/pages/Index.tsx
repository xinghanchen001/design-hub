import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot,
  Activity,
  Plus,
  Image,
  Shirt,
  FileText,
  Calendar,
  ChevronRight,
  Loader2,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  task_count?: number;
  active_schedules?: number;
}

interface Activity {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'generation' | 'schedule' | 'project';
  project_name?: string;
}

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchRecentActivities();
    }
  }, [user]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    } finally {
      setSigningOut(false);
    }
  };

  const fetchProjects = async () => {
    try {
      // Fetch projects and their task counts
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(
          `
          id,
          name,
          description,
          created_at,
          updated_at
        `
        )
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (projectsError) throw projectsError;

      // For each project, get task counts and active schedules
      const projectsWithCounts = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { count: taskCount } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project.id);

          // Get tasks for this project to query schedules
          const { data: projectTasks } = await supabase
            .from('tasks')
            .select('id')
            .eq('project_id', project.id);

          const taskIds = projectTasks?.map((task) => task.id) || [];

          let scheduleCount = 0;
          if (taskIds.length > 0) {
            const { count } = await supabase
              .from('schedules')
              .select('*', { count: 'exact', head: true })
              .in('task_id', taskIds)
              .eq('status', 'active');
            scheduleCount = count || 0;
          }

          return {
            ...project,
            task_count: taskCount || 0,
            active_schedules: scheduleCount,
          };
        })
      );

      setProjects(projectsWithCounts);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      // Fetch recent generated content with project info
      const { data: recentContent, error } = await supabase
        .from('generated_content')
        .select(
          `
          id,
          title,
          content_type,
          created_at,
          task_id,
          tasks!inner(
            name,
            project_id,
            projects!inner(name)
          )
        `
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      const activities: Activity[] = (recentContent || []).map((content) => ({
        id: content.id,
        title: content.title || `New ${content.content_type}`,
        description: `Generated in ${content.tasks.name}`,
        timestamp: content.created_at,
        type: 'generation' as const,
        project_name: content.tasks.projects.name,
      }));

      setActivities(activities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const getTaskTypeIcon = (taskCount: number) => {
    if (taskCount === 0) return <Plus className="h-4 w-4" />;
    return <Bot className="h-4 w-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading || loadingProjects) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center space-y-4">
          <Bot className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading Design Hub...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <Bot className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Design Hub
              </h1>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              <Button
                variant="outline"
                onClick={handleSignOut}
                size="sm"
                className="md:h-10 md:px-4"
                disabled={signingOut}
              >
                {signingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span className="hidden sm:inline">Sign Out</span>
                    <span className="sm:hidden">Out</span>
                  </>
                )}
              </Button>
              <div className="block sm:hidden">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold">Welcome back!</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Manage your AI-powered design projects. Each project contains image
            generation, print-on-shirt, and journal tasks with their own
            schedules and content buckets.
          </p>
        </div>

        {/* Projects Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-semibold">Your Projects</h3>
          </div>

          {projects.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent className="space-y-4">
                <Bot className="h-16 w-16 text-muted-foreground mx-auto" />
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">No projects yet</h3>
                  <p className="text-muted-foreground">
                    Your projects will appear here once created.
                    <br />
                    Each project includes image generation, print-on-shirt, and
                    journal tasks.
                  </p>
                </div>
                <div className="pt-4">
                  <Button
                    onClick={() => navigate('/create-project')}
                    className="bg-brand-primary hover:bg-brand-primary/90 text-brand-contrast"
                    size="lg"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Create Your First Project
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-lg transition-all duration-200 group"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {project.description || 'No description'}
                        </CardDescription>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {getTaskTypeIcon(project.task_count || 0)}
                        <span>{project.task_count || 0} tasks</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{project.active_schedules || 0} active</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated {formatDate(project.updated_at)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        {activities.length > 0 && (
          <section className="space-y-6">
            <h3 className="text-2xl font-semibold">Recent Activity</h3>
            <Card>
              <CardContent className="p-0">
                {loadingActivities ? (
                  <div className="p-6 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </div>
                ) : (
                  <div className="divide-y">
                    {activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Activity className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium break-words min-w-0 flex-1">
                                {activity.title}
                              </span>
                              {activity.project_name && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs flex-shrink-0"
                                >
                                  {activity.project_name}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {activity.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(activity.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
};

export default Index;
