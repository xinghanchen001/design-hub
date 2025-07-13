import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { ArrowLeft, Bot, Folder, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CreateProject = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const submittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Prevent multiple submissions
    if (loading || submittingRef.current) {
      console.log('Submission already in progress, ignoring');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      // Create the project (simple container)
      const projectData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        user_id: user.id,
      };

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single();

      if (projectError) throw projectError;

      // Create 3 default tasks for the project
      const defaultTasks = [
        {
          name: 'Image Generation',
          description:
            'AI-powered image generation with custom prompts and styles',
          task_type: 'image-generation' as const,
          project_id: project.id,
          user_id: user.id,
          status: 'paused' as const,
          settings: {
            model: 'flux-dev',
            prompt: '',
            style: 'photographic',
            aspect_ratio: '1:1',
            max_images: 4,
          },
        },
        {
          name: 'Print on Shirt',
          description: 'Create custom shirt designs and mockups',
          task_type: 'print-on-shirt' as const,
          project_id: project.id,
          user_id: user.id,
          status: 'paused' as const,
          settings: {
            shirt_style: 't-shirt',
            design_placement: 'center',
            print_method: 'dtg',
          },
        },
        {
          name: 'Journal Blog Post',
          description: 'Generate engaging blog content and journal entries',
          task_type: 'journal' as const,
          project_id: project.id,
          user_id: user.id,
          status: 'paused' as const,
          settings: {
            tone: 'informative',
            length: 'medium',
            style: 'blog',
          },
        },
      ];

      const { error: tasksError } = await supabase
        .from('tasks')
        .insert(defaultTasks);

      if (tasksError) throw tasksError;

      toast.success('Project created successfully with 3 AI tasks!');
      navigate(`/project/${project.id}`);
    } catch (error: unknown) {
      console.error('Project creation error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to create project'
      );
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Create New Project</h1>
              <p className="text-muted-foreground">
                Create a project to organize your AI tasks and workflows
              </p>
            </div>
          </div>

          {/* Form */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Folder className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Project Details</CardTitle>
                  <CardDescription>
                    Enter basic information for your new project
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Marketing Campaign 2024"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Choose a descriptive name for your project
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Describe what this project is for..."
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground">
                    Optional description to help you remember the project's
                    purpose
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/')}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !formData.name.trim()}
                    className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Create Project
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Next Steps Info */}
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="p-3 rounded-full bg-primary/10 mx-auto w-fit">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">What's included?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your project will automatically include 3 AI-powered tasks:
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>Image Generation - Create stunning AI artwork</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Print on Shirt - Design custom apparel</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span>Journal Blog Post - Generate written content</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateProject;
