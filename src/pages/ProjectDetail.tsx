import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Bot,
  Plus,
  Settings,
  Image,
  Shirt,
  FileText,
  Video,
  Calendar,
  Activity,
  ChevronRight,
  Edit,
  Trash2,
  Play,
  Pause,
  BarChart3,
  Loader2,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface Task {
  id: string;
  name: string;
  description: string | null;
  task_type:
    | 'image-generation'
    | 'print-on-shirt'
    | 'journal'
    | 'video-generation';
  status: 'active' | 'paused' | 'archived';
  settings: any;
  created_at: string;
  updated_at: string;
  project_id: string;
  schedules_count?: number;
  generated_content_count?: number;
  active_schedules?: number;
}

interface ProjectStats {
  total_tasks: number;
  total_generated_content: number;
  active_schedules: number;
  total_schedules: number;
}

const ProjectDetail = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    total_tasks: 0,
    total_generated_content: 0,
    active_schedules: 0,
    total_schedules: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showEditProjectDialog, setShowEditProjectDialog] = useState(false);
  const [createTaskForm, setCreateTaskForm] = useState({
    name: '',
    description: '',
    task_type: 'image-generation' as
      | 'image-generation'
      | 'print-on-shirt'
      | 'journal',
  });
  const [editProjectForm, setEditProjectForm] = useState({
    name: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !projectId) return;
    fetchProjectData();
  }, [user, projectId]);

  const fetchProjectData = async () => {
    try {
      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user?.id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);
      setEditProjectForm({
        name: projectData.name,
        description: projectData.description || '',
      });

      // Fetch tasks for this project
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // For each task, get counts of schedules and generated content
      const tasksWithCounts = await Promise.all(
        (tasksData || []).map(async (task) => {
          const { count: schedulesCount } = await supabase
            .from('schedules')
            .select('*', { count: 'exact', head: true })
            .eq('task_id', task.id);

          const { count: activeSchedulesCount } = await supabase
            .from('schedules')
            .select('*', { count: 'exact', head: true })
            .eq('task_id', task.id)
            .eq('status', 'active');

          const { count: contentCount } = await supabase
            .from('generated_content')
            .select('*', { count: 'exact', head: true })
            .eq('task_id', task.id);

          return {
            ...task,
            schedules_count: schedulesCount || 0,
            generated_content_count: contentCount || 0,
            active_schedules: activeSchedulesCount || 0,
          };
        })
      );

      setTasks(tasksWithCounts);

      // Calculate project stats
      const totalTasks = tasksWithCounts.length;
      const totalGeneratedContent = tasksWithCounts.reduce(
        (sum, task) => sum + (task.generated_content_count || 0),
        0
      );
      const activeSchedules = tasksWithCounts.reduce(
        (sum, task) => sum + (task.active_schedules || 0),
        0
      );
      const totalSchedules = tasksWithCounts.reduce(
        (sum, task) => sum + (task.schedules_count || 0),
        0
      );

      setStats({
        total_tasks: totalTasks,
        total_generated_content: totalGeneratedContent,
        active_schedules: activeSchedules,
        total_schedules: totalSchedules,
      });
    } catch (error: any) {
      console.error('Error fetching project data:', error);
      toast.error('Failed to load project data');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !project) return;

    if (!createTaskForm.name.trim()) {
      toast.error('Please enter a task name');
      return;
    }

    setSubmitting(true);
    try {
      const taskData = {
        name: createTaskForm.name.trim(),
        description: createTaskForm.description.trim() || null,
        task_type: createTaskForm.task_type,
        project_id: project.id,
        user_id: user.id,
        status: 'active' as const,
        settings: {},
      };

      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();

      if (error) throw error;

      toast.success('Task created successfully!');
      setShowCreateTaskDialog(false);
      setCreateTaskForm({
        name: '',
        description: '',
        task_type: 'image-generation',
      });

      // Navigate to task configuration page
      navigate(`/task/${newTask.id}/configure`);
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast.error(error.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: editProjectForm.name.trim(),
          description: editProjectForm.description.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id);

      if (error) throw error;

      toast.success('Project updated successfully!');
      setShowEditProjectDialog(false);
      fetchProjectData(); // Refresh data
    } catch (error: any) {
      console.error('Error updating project:', error);
      toast.error(error.message || 'Failed to update project');
    } finally {
      setSubmitting(false);
    }
  };

  const getTaskTypeIcon = (taskType: string) => {
    switch (taskType) {
      case 'image-generation':
        return <Image className="h-4 w-4" />;
      case 'print-on-shirt':
        return <Shirt className="h-4 w-4" />;
      case 'journal':
        return <FileText className="h-4 w-4" />;
      case 'video-generation':
        return <Video className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getTaskTypeLabel = (taskType: string) => {
    switch (taskType) {
      case 'image-generation':
        return 'Image Generation';
      case 'print-on-shirt':
        return 'Print on Shirt';
      case 'journal':
        return 'Journal';
      case 'video-generation':
        return 'Video Generation';
      default:
        return taskType;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center space-y-4">
          <Bot className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center space-y-4">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Project not found</h2>
          <p className="text-muted-foreground">
            The project you're looking for doesn't exist or you don't have
            access to it.
          </p>
          <Button onClick={() => navigate('/')}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-muted-foreground hover:text-primary px-2"
              >
                <Bot className="h-4 w-4" />
                Design Hub
              </Button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Projects</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{project.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setShowEditProjectDialog(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Project
            </Button>
            <Button
              onClick={() => setShowCreateTaskDialog(true)}
              className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Project Info Bar */}
        <div className="border-t bg-muted/20">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-xl font-bold">{project.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {project.description || 'No description'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Bot className="h-4 w-4" />
                  <span>{stats.total_tasks} tasks</span>
                </div>
                <div className="flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  <span>{stats.total_generated_content} generated</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{stats.active_schedules} active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Project Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Tasks</p>
                  <p className="text-2xl font-bold">{stats.total_tasks}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                  <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Generated Content
                  </p>
                  <p className="text-2xl font-bold">
                    {stats.total_generated_content}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                  <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Active Schedules
                  </p>
                  <p className="text-2xl font-bold">{stats.active_schedules}</p>
                  <p className="text-xs text-muted-foreground">
                    of {stats.total_schedules} total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900">
                  <BarChart3 className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">99%</p>
                  <p className="text-xs text-muted-foreground">
                    across all tasks
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Tasks</h2>
            {tasks.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowCreateTaskDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            )}
          </div>

          {tasks.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent className="space-y-4">
                <Bot className="h-16 w-16 text-muted-foreground mx-auto" />
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">No tasks yet</h3>
                  <p className="text-muted-foreground">
                    Add your first AI task to start generating content
                  </p>
                </div>
                <Button
                  onClick={() => setShowCreateTaskDialog(true)}
                  className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Task
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className="cursor-pointer hover:shadow-lg transition-all duration-200 group"
                  onClick={() => navigate(`/task/${task.id}`)}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          {getTaskTypeIcon(task.task_type)}
                          <CardTitle className="text-lg group-hover:text-primary transition-colors">
                            {task.name}
                          </CardTitle>
                          <Badge
                            variant={
                              task.status === 'active' ? 'default' : 'secondary'
                            }
                            className="text-xs"
                          >
                            {task.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {task.active_schedules || 0} active
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {task.generated_content_count || 0} generated
                          </span>
                        </div>
                        <CardDescription className="text-sm">
                          {getTaskTypeLabel(task.task_type)} •{' '}
                          {task.description || 'No description'}
                        </CardDescription>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-xs text-muted-foreground">
                      Created {formatDate(task.created_at)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Create Task Dialog */}
      <Dialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new AI task to your project
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Task Name *</Label>
              <Input
                id="task-name"
                value={createTaskForm.name}
                onChange={(e) =>
                  setCreateTaskForm({ ...createTaskForm, name: e.target.value })
                }
                placeholder="e.g., Product Images"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-type">Task Type *</Label>
              <Select
                value={createTaskForm.task_type}
                onValueChange={(value: any) =>
                  setCreateTaskForm({ ...createTaskForm, task_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image-generation">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Image Generation
                    </div>
                  </SelectItem>
                  <SelectItem value="print-on-shirt">
                    <div className="flex items-center gap-2">
                      <Shirt className="h-4 w-4" />
                      Print on Shirt
                    </div>
                  </SelectItem>
                  <SelectItem value="journal">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Journal
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={createTaskForm.description}
                onChange={(e) =>
                  setCreateTaskForm({
                    ...createTaskForm,
                    description: e.target.value,
                  })
                }
                placeholder="Describe what this task will do..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateTaskDialog(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !createTaskForm.name.trim()}
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </div>
                ) : (
                  'Create Task'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog
        open={showEditProjectDialog}
        onOpenChange={setShowEditProjectDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update your project information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditProject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                value={editProjectForm.name}
                onChange={(e) =>
                  setEditProjectForm({
                    ...editProjectForm,
                    name: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={editProjectForm.description}
                onChange={(e) =>
                  setEditProjectForm({
                    ...editProjectForm,
                    description: e.target.value,
                  })
                }
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditProjectDialog(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !editProjectForm.name.trim()}
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </div>
                ) : (
                  'Update Project'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetail;
