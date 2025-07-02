import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Sparkles, Zap, Clock, Image, Settings } from 'lucide-react';

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

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchRecentActivities();
    }
  }, [user]);

  const fetchRecentActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('generation_jobs')
        .select(`
          *,
          projects!inner(name, user_id)
        `)
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
              color: 'bg-green-500'
            };
          case 'failed':
            return {
              type: 'error',
              message: job.error_message || `Failed to generate image for "${projectName}"`,
              time: timeAgo,
              color: 'bg-red-500'
            };
          case 'running':
            return {
              type: 'info',
              message: `Generating image for "${projectName}"`,
              time: timeAgo,
              color: 'bg-blue-500'
            };
          case 'pending':
            return {
              type: 'info',
              message: `Scheduled generation added to queue for "${projectName}"`,
              time: timeAgo,
              color: 'bg-green-500'
            };
          default:
            return {
              type: 'info',
              message: `Job created for "${projectName}"`,
              time: timeAgo,
              color: 'bg-gray-500'
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
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center space-y-4">
          <Bot className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading your AI workspace...</p>
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
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-primary">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              AI Image Agent
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user.email}
            </span>
            <Button 
              onClick={signOut}
              variant="outline"
              size="sm"
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
              <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
              <p className="text-muted-foreground">Monitor your AI image generation tasks</p>
            </div>
            <Button 
              onClick={() => navigate('/create-project')}
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
            >
              <Bot className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="shadow-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-gradient-primary">
                    <Bot className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Schedules</p>
                    <p className="text-2xl font-bold text-foreground">0</p>
                    <p className="text-xs text-muted-foreground">12% from last week</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-gradient-accent">
                    <Image className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Images Generated</p>
                    <p className="text-2xl font-bold text-foreground">0</p>
                    <p className="text-xs text-muted-foreground">24% from last week</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-gradient-primary">
                    <Clock className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Queue Status</p>
                    <p className="text-2xl font-bold text-foreground">0</p>
                    <p className="text-xs text-muted-foreground">pending generation</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-gradient-accent">
                    <Zap className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold text-foreground">100%</p>
                    <p className="text-xs text-muted-foreground">0.8% from last week</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Schedules */}
            <div className="lg:col-span-2">
              <Card className="shadow-card border-border/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Active Schedules</CardTitle>
                  <Button variant="outline" size="sm">View All</Button>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2">No active schedules</p>
                    <p className="text-sm text-muted-foreground">Create your first schedule</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="shadow-card border-border/50">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/create-project')}
                >
                  <Bot className="h-4 w-4 mr-2" />
                  Create Schedule
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Zap className="h-4 w-4 mr-2" />
                  Generate Now
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Image className="h-4 w-4 mr-2" />
                  View Gallery
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity and Queue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-card border-border/50">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {activities.length > 0 ? (
                  <div className="space-y-4">
                    {activities.map((activity, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className={`w-2 h-2 ${activity.color} rounded-full mt-2`} />
                        <div className="flex-1">
                          <p className="text-sm text-foreground">{activity.message}</p>
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No recent activity</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Generation Queue</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">0 pending</span>
                  <Button variant="outline" size="sm">Manage Queue</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No items in queue</p>
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
