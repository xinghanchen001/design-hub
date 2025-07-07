import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Settings,
  CheckCircle,
  Key,
  User,
  Bell,
  Palette,
  Database,
  LogOut,
  Trash2,
  Save,
  Loader2,
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

const SettingsView = () => {
  const { project, fetchProjectData } = useOutletContext<{
    project: Project;
    fetchProjectData: () => Promise<void>;
  }>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [projectForm, setProjectForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    prompt: project?.prompt || '',
    reference_image_url: project?.reference_image_url || '',
    generation_interval_minutes: project?.generation_interval_minutes || 30,
    max_images_to_generate: project?.max_images_to_generate || 10,
    schedule_duration_hours: project?.schedule_duration_hours || 24,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    email_notifications: true,
    browser_notifications: false,
    auto_download: false,
    dark_mode: false,
  });

  const handleProjectUpdate = async () => {
    if (!projectForm.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: projectForm.name,
          description: projectForm.description || null,
          prompt: projectForm.prompt || null,
          reference_image_url: projectForm.reference_image_url || null,
          generation_interval_minutes: projectForm.generation_interval_minutes,
          max_images_to_generate: projectForm.max_images_to_generate,
          schedule_duration_hours: projectForm.schedule_duration_hours,
        })
        .eq('id', project.id);

      if (error) throw error;

      await fetchProjectData();
      toast.success('Project settings updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update project settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${project.name}"? This action cannot be undone and will delete all generated images and jobs.`
      )
    )
      return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) throw error;

      toast.success('Project deleted successfully');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete project');
    }
  };

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await signOut();
      navigate('/auth');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Manage your project settings and account preferences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Settings */}
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Project Settings
            </CardTitle>
            <CardDescription>
              Update your project configuration and generation parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={projectForm.name}
                onChange={(e) =>
                  setProjectForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter project name..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={projectForm.description}
                onChange={(e) =>
                  setProjectForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Enter project description..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">AI Prompt</Label>
              <Textarea
                id="prompt"
                value={projectForm.prompt}
                onChange={(e) =>
                  setProjectForm((prev) => ({
                    ...prev,
                    prompt: e.target.value,
                  }))
                }
                placeholder="Enter your AI prompt..."
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference_image_url">Reference Image URL</Label>
              <Input
                id="reference_image_url"
                value={projectForm.reference_image_url}
                onChange={(e) =>
                  setProjectForm((prev) => ({
                    ...prev,
                    reference_image_url: e.target.value,
                  }))
                }
                placeholder="https://example.com/image.jpg"
              />
              {projectForm.reference_image_url && (
                <div className="mt-2">
                  <img
                    src={projectForm.reference_image_url}
                    alt="Reference preview"
                    className="h-20 w-20 object-cover rounded-md border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interval">Interval (minutes)</Label>
                <Input
                  id="interval"
                  type="number"
                  min="1"
                  value={projectForm.generation_interval_minutes}
                  onChange={(e) =>
                    setProjectForm((prev) => ({
                      ...prev,
                      generation_interval_minutes:
                        parseInt(e.target.value) || 30,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_images">Max Images</Label>
                <Input
                  id="max_images"
                  type="number"
                  min="1"
                  value={projectForm.max_images_to_generate}
                  onChange={(e) =>
                    setProjectForm((prev) => ({
                      ...prev,
                      max_images_to_generate: parseInt(e.target.value) || 10,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (hours)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={projectForm.schedule_duration_hours}
                onChange={(e) =>
                  setProjectForm((prev) => ({
                    ...prev,
                    schedule_duration_hours: parseInt(e.target.value) || 24,
                  }))
                }
              />
            </div>

            <Button
              onClick={handleProjectUpdate}
              disabled={isLoading || !projectForm.name.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Project Settings
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">User ID</label>
              <p className="text-sm text-muted-foreground break-all">
                {user?.id || 'Not logged in'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <p className="text-sm text-muted-foreground">
                {user?.email || 'Not available'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Plan</label>
              <Badge variant="secondary">Free</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Available Tokens</label>
                <p className="text-sm text-muted-foreground">Unlimited</p>
              </div>
              <Button variant="outline" size="sm">
                Upgrade Plan
              </Button>
            </div>
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Preferences
            </CardTitle>
            <CardDescription>
              Customize your experience and notification settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">
                  Email Notifications
                </label>
                <p className="text-xs text-muted-foreground">
                  Receive updates about your generations
                </p>
              </div>
              <Switch
                checked={preferences.email_notifications}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({
                    ...prev,
                    email_notifications: checked,
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">
                  Browser Notifications
                </label>
                <p className="text-xs text-muted-foreground">
                  Show desktop notifications
                </p>
              </div>
              <Switch
                checked={preferences.browser_notifications}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({
                    ...prev,
                    browser_notifications: checked,
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Auto Download</label>
                <p className="text-xs text-muted-foreground">
                  Automatically download generated images
                </p>
              </div>
              <Switch
                checked={preferences.auto_download}
                onCheckedChange={(checked) =>
                  setPreferences((prev) => ({
                    ...prev,
                    auto_download: checked,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="shadow-card border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions - proceed with caution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Delete Project</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete this project and all associated data. This
                action cannot be undone.
              </p>
              <Button
                variant="destructive"
                onClick={handleDeleteProject}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Project
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsView;
