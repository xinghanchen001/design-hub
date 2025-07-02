import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Sparkles, Zap, Clock, Image, Settings } from 'lucide-react';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
          {/* Welcome Section */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-foreground">
              Your AI Image Generation
              <span className="bg-gradient-accent bg-clip-text text-transparent"> Dashboard</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Create and manage AI agents that automatically generate images based on your prompts and schedules.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="shadow-card border-border/50 hover:shadow-glow transition-all duration-300 cursor-pointer">
              <CardHeader className="text-center">
                <div className="p-3 rounded-full bg-gradient-primary w-fit mx-auto">
                  <Bot className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle>Create AI Agent</CardTitle>
                <CardDescription>
                  Set up a new automated image generation agent
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-card border-border/50 hover:shadow-glow transition-all duration-300 cursor-pointer">
              <CardHeader className="text-center">
                <div className="p-3 rounded-full bg-gradient-accent w-fit mx-auto">
                  <Image className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle>Generated Images</CardTitle>
                <CardDescription>
                  View and manage your AI-generated image collection
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-card border-border/50 hover:shadow-glow transition-all duration-300 cursor-pointer">
              <CardHeader className="text-center">
                <div className="p-3 rounded-full bg-gradient-primary w-fit mx-auto">
                  <Settings className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle>Agent Settings</CardTitle>
                <CardDescription>
                  Configure schedules, prompts, and generation limits
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mt-12">
            <div className="flex items-start gap-4 p-6 rounded-xl bg-card/50 border border-border/50">
              <Sparkles className="h-8 w-8 text-ai-accent flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Smart Scheduling</h3>
                <p className="text-sm text-muted-foreground">
                  Set up automated generation with custom intervals and duration limits
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-xl bg-card/50 border border-border/50">
              <Zap className="h-8 w-8 text-ai-accent flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Reference Training</h3>
                <p className="text-sm text-muted-foreground">
                  Upload reference images to train your AI for consistent style and quality
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-xl bg-card/50 border border-border/50">
              <Clock className="h-8 w-8 text-ai-accent flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Generation Limits</h3>
                <p className="text-sm text-muted-foreground">
                  Control costs with maximum image generation limits and monitoring
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center space-y-6 py-12">
            <h3 className="text-2xl font-bold text-foreground">Ready to Get Started?</h3>
            <Button 
              size="lg"
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300 px-8 py-6 text-lg"
            >
              Create Your First AI Agent
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
