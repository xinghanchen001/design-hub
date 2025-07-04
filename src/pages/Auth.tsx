import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { Sparkles, Bot, Zap, Shield, Users, Rocket } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Welcome back!');
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signUp(email, password);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        'Account created! Check your email to verify your account.'
      );
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left side - Hero content */}
        <div className="space-y-8 text-center lg:text-left">
          <div className="space-y-6">
            <div className="flex items-center justify-center lg:justify-start gap-3">
              <div className="p-3 rounded-xl bg-gradient-primary shadow-glow">
                <Bot className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  AI Image Agent
                </h1>
                <p className="text-xs text-brand-neutral">
                  Powered by Tryprofound
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl lg:text-5xl font-bold text-brand-neutral leading-tight">
                Automate Your
                <span className="bg-gradient-warm bg-clip-text text-transparent">
                  {' '}
                  Creative{' '}
                </span>
                Workflow
              </h2>
              <p className="text-lg text-brand-neutral/70 max-w-md mx-auto lg:mx-0">
                Set up AI agents that automatically generate images based on
                your prompts and schedules. Never run out of creative content
                again.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 max-w-md mx-auto lg:mx-0">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-brand-accent/30">
              <div className="p-2 rounded-full bg-brand-primary/10">
                <Sparkles className="h-5 w-5 text-brand-primary" />
              </div>
              <span className="text-brand-neutral font-medium">
                Scheduled Generation
              </span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-brand-cream/50">
              <div className="p-2 rounded-full bg-brand-secondary/10">
                <Zap className="h-5 w-5 text-brand-secondary" />
              </div>
              <span className="text-brand-neutral font-medium">
                AI-Powered Consistency
              </span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-brand-accent/30">
              <div className="p-2 rounded-full bg-brand-primary/10">
                <Bot className="h-5 w-5 text-brand-primary" />
              </div>
              <span className="text-brand-neutral font-medium">
                Reference Training
              </span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-brand-cream/50">
              <div className="p-2 rounded-full bg-brand-secondary/10">
                <Shield className="h-5 w-5 text-brand-secondary" />
              </div>
              <span className="text-brand-neutral font-medium">
                Secure & Private
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-start gap-6 pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-brand-primary">1000+</div>
              <div className="text-sm text-brand-neutral/70">
                Images Generated
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-brand-secondary">50+</div>
              <div className="text-sm text-brand-neutral/70">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-brand-primary">99.9%</div>
              <div className="text-sm text-brand-neutral/70">Uptime</div>
            </div>
          </div>
        </div>

        {/* Right side - Auth form */}
        <Card className="w-full max-w-md mx-auto shadow-card border-brand-accent/50 bg-white/90 backdrop-blur-sm">
          <CardHeader className="space-y-3 text-center border-b border-brand-accent/30 pb-6">
            <CardTitle className="text-2xl font-bold text-brand-neutral">
              Get Started
            </CardTitle>
            <CardDescription className="text-brand-neutral/70">
              Join the creative revolution with AI-powered image generation
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-brand-accent/30">
                <TabsTrigger
                  value="signin"
                  className="data-[state=active]:bg-brand-primary data-[state=active]:text-white"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="data-[state=active]:bg-brand-primary data-[state=active]:text-white"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="signin-email"
                      className="text-brand-neutral font-medium"
                    >
                      Email
                    </Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="transition-smooth border-brand-accent focus:border-brand-primary focus:ring-brand-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="signin-password"
                      className="text-brand-neutral font-medium"
                    >
                      Password
                    </Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="transition-smooth border-brand-accent focus:border-brand-primary focus:ring-brand-primary/20"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white border-0 mt-6"
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Signing in...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Rocket className="h-4 w-4" />
                        Sign In
                      </div>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="signup-email"
                      className="text-brand-neutral font-medium"
                    >
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="transition-smooth border-brand-accent focus:border-brand-primary focus:ring-brand-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="signup-password"
                      className="text-brand-neutral font-medium"
                    >
                      Password
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="transition-smooth border-brand-accent focus:border-brand-primary focus:ring-brand-primary/20"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-warm hover:shadow-warm transition-all duration-300 text-white border-0 mt-6"
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating account...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Create Account
                      </div>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-6 border-t border-brand-accent/30">
              <p className="text-xs text-brand-neutral/60 text-center">
                By creating an account, you agree to our Terms of Service and
                Privacy Policy
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
