import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  Bot,
  Sparkles,
  Zap,
  Clock,
  Image,
  Settings,
  TrendingUp,
  Activity,
} from 'lucide-react';

interface Activity {
  type: string;
  message: string;
  time: string;
  color: string;
}

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [checkingProjects, setCheckingProjects] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      checkForExistingProjects();
    }
  }, [user]);

  const checkForExistingProjects = async () => {
    try {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (error) throw error;

      // If user has projects, redirect to the first project's dashboard
      if (projects && projects.length > 0) {
        navigate(`/project/${projects[0].id}`);
        return;
      }

      // If no projects, fetch activities and show landing page
      fetchRecentActivities();
    } catch (error) {
      console.error('Error checking for projects:', error);
      // Fallback to landing page
      fetchRecentActivities();
    } finally {
      setCheckingProjects(false);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('generation_jobs')
        .select(
          `
          *,
          projects!inner(name, user_id)
        `
        )
        .eq('projects.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      const formattedActivities: Activity[] = data.map((job: any) => {
        const timeAgo = getTimeAgo(new Date(job.created_at));
        const projectName = job.projects.name;

        switch (job.status) {
          case 'completed':
            return {
              type: 'success',
              message: `Successfully generated image for "${projectName}"`,
              time: timeAgo,
              color: 'bg-brand-primary',
            };
          case 'failed':
            return {
              type: 'error',
              message:
                job.error_message ||
                `Failed to generate image for "${projectName}"`,
              time: timeAgo,
              color: 'bg-destructive',
            };
          case 'running':
            return {
              type: 'info',
              message: `Generating image for "${projectName}"`,
              time: timeAgo,
              color: 'bg-brand-secondary',
            };
          case 'pending':
            return {
              type: 'info',
              message: `Scheduled generation added to queue for "${projectName}"`,
              time: timeAgo,
              color: 'bg-brand-primary',
            };
          default:
            return {
              type: 'info',
              message: `Job created for "${projectName}"`,
              time: timeAgo,
              color: 'bg-brand-neutral',
            };
        }
      });

      setActivities(formattedActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60)
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24)
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  if (loading || checkingProjects) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center space-y-4">
          <div className="p-4 rounded-full bg-gradient-primary shadow-glow mx-auto w-fit">
            <Bot className="h-12 w-12 text-white animate-pulse" />
          </div>
          <p className="text-brand-neutral font-medium">
            {loading
              ? 'Loading your AI workspace...'
              : 'Checking your projects...'}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-brand-accent/50 bg-white/80 backdrop-blur-sm shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-primary shadow-warm">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                AI Image Agent
              </h1>
              <p className="text-xs text-brand-neutral">
                Powered by Tryprofound
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-brand-neutral">
                Welcome back
              </p>
              <p className="text-xs text-brand-neutral/70">{user.email}</p>
            </div>
            <Button
              onClick={signOut}
              variant="outline"
              size="sm"
              className="border-brand-primary/20 hover:bg-brand-accent hover:border-brand-primary"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Dashboard Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Dashboard
              </h2>
              <p className="text-brand-neutral mt-1">
                Monitor your AI image generation tasks and schedules
              </p>
            </div>
            <Button
              onClick={() => navigate('/create-project')}
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white border-0"
            >
              <Bot className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="shadow-card border-brand-accent/50 hover:shadow-warm transition-all duration-300 bg-white/90">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-gradient-primary shadow-glow">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-brand-neutral/70 font-medium">
                      Active Schedules
                    </p>
                    <p className="text-2xl font-bold text-brand-neutral">0</p>
                    <div className="flex items-center gap-1 mt-1">
                      <TrendingUp className="h-3 w-3 text-brand-primary" />
                      <p className="text-xs text-brand-primary font-medium">
                        12% from last week
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-brand-accent/50 hover:shadow-warm transition-all duration-300 bg-white/90">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-gradient-warm shadow-warm">
                    <Image className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-brand-neutral/70 font-medium">
                      Images Generated
                    </p>
                    <p className="text-2xl font-bold text-brand-neutral">0</p>
                    <div className="flex items-center gap-1 mt-1">
                      <TrendingUp className="h-3 w-3 text-brand-secondary" />
                      <p className="text-xs text-brand-secondary font-medium">
                        24% from last week
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-brand-accent/50 hover:shadow-warm transition-all duration-300 bg-white/90">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-gradient-primary shadow-glow">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-brand-neutral/70 font-medium">
                      Queue Status
                    </p>
                    <p className="text-2xl font-bold text-brand-neutral">0</p>
                    <p className="text-xs text-brand-neutral/70">
                      pending generation
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-brand-accent/50 hover:shadow-warm transition-all duration-300 bg-white/90">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-gradient-warm shadow-warm">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-brand-neutral/70 font-medium">
                      Success Rate
                    </p>
                    <p className="text-2xl font-bold text-brand-neutral">
                      100%
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <TrendingUp className="h-3 w-3 text-brand-primary" />
                      <p className="text-xs text-brand-primary font-medium">
                        0.8% from last week
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Schedules */}
            <div className="lg:col-span-2">
              <Card className="shadow-card border-brand-accent/50 bg-white/90">
                <CardHeader className="flex flex-row items-center justify-between border-b border-brand-accent/30">
                  <CardTitle className="text-brand-neutral">
                    Active Schedules
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-brand-primary/20 hover:bg-brand-accent text-brand-primary"
                  >
                    View All
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <div className="p-4 rounded-full bg-brand-accent mx-auto w-fit mb-4">
                      <Bot className="h-12 w-12 text-brand-neutral/50" />
                    </div>
                    <p className="text-brand-neutral font-medium mb-2">
                      No active schedules
                    </p>
                    <p className="text-sm text-brand-neutral/70">
                      Create your first schedule to get started
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="shadow-card border-brand-accent/50 bg-white/90">
              <CardHeader className="border-b border-brand-accent/30">
                <CardTitle className="text-brand-neutral">
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                <Button
                  variant="outline"
                  className="w-full justify-start border-brand-primary/20 hover:bg-brand-accent hover:border-brand-primary text-brand-neutral"
                  onClick={() => navigate('/create-project')}
                >
                  <Bot className="h-4 w-4 mr-2" />
                  Create Schedule
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-brand-secondary/20 hover:bg-brand-cream text-brand-neutral"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Generate Now
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start border-brand-primary/20 hover:bg-brand-accent text-brand-neutral"
                >
                  <Image className="h-4 w-4 mr-2" />
                  View Gallery
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity and Queue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-card border-brand-accent/50 bg-white/90">
              <CardHeader className="border-b border-brand-accent/30">
                <CardTitle className="text-brand-neutral flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {activities.length > 0 ? (
                  <div className="space-y-4">
                    {activities.map((activity, index) => (
                      <div
                        key={index}
                        className="flex items-start space-x-3 p-3 rounded-lg bg-brand-accent/30"
                      >
                        <div
                          className={`w-2 h-2 ${activity.color} rounded-full mt-2`}
                        />
                        <div className="flex-1">
                          <p className="text-sm text-brand-neutral font-medium">
                            {activity.message}
                          </p>
                          <p className="text-xs text-brand-neutral/70">
                            {activity.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="p-4 rounded-full bg-brand-accent mx-auto w-fit mb-4">
                      <Clock className="h-12 w-12 text-brand-neutral/50" />
                    </div>
                    <p className="text-brand-neutral font-medium">
                      No recent activity
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card border-brand-accent/50 bg-white/90">
              <CardHeader className="flex flex-row items-center justify-between border-b border-brand-accent/30">
                <CardTitle className="text-brand-neutral">
                  Generation Queue
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-brand-neutral/70 font-medium">
                    0 pending
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-brand-primary/20 hover:bg-brand-accent text-brand-primary"
                  >
                    Manage Queue
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="p-4 rounded-full bg-brand-accent mx-auto w-fit mb-4">
                    <Settings className="h-12 w-12 text-brand-neutral/50" />
                  </div>
                  <p className="text-brand-neutral font-medium">
                    No items in queue
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
