import { useEffect, useState, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CreateVideoGenerationDialog from '@/components/CreateVideoGenerationDialog';
import {
  Video,
  Plus,
  Upload,
  X,
  Settings,
  Trash2,
  Clock,
  Images,
  Zap,
  Activity,
  Save,
  Loader2,
  ImageIcon,
  Folder,
  Check,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Project = Tables<'projects'>;
type Schedule = Tables<'schedules'>;
type BucketImage = Tables<'project_bucket_images'>;
type GeneratedContent = Tables<'generated_content'>;

interface VideoGenerationSchedule extends Schedule {
  // Add stats
  total_videos?: number;
  completed_videos?: number;
  failed_videos?: number;
  // Flattened schedule_config properties
  generation_interval_minutes?: number;
  schedule_duration_hours?: number;
  schedule_enabled?: boolean;
  // Flattened generation_settings properties for video
  max_videos_to_generate?: number;
  start_image_url?: string;
  mode?: 'standard' | 'pro';
  duration?: 5 | 10;
  negative_prompt?: string;
}

interface FormData {
  name: string;
  description: string;
  prompt: string;
  negative_prompt: string;
  start_image_url: string;
  mode: 'standard' | 'pro';
  duration: 5 | 10;
  schedule_enabled: boolean;
  schedule_duration_hours: number;
  max_videos_to_generate: number;
  generation_interval_minutes: number;
  use_bucket_images: boolean;
  bucket_image_ids: string[];
}

const VideoGenerationView = () => {
  const navigate = useNavigate();
  const { project, tasks, fetchProjectData } = useOutletContext<{
    project: Project;
    tasks: any[];
    fetchProjectData: () => Promise<void>;
  }>();
  const { user } = useAuth();

  const [schedules, setSchedules] = useState<VideoGenerationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucketImages, setBucketImages] = useState<BucketImage[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<VideoGenerationSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    prompt: '',
    negative_prompt: '',
    start_image_url: '',
    mode: 'standard',
    duration: 5,
    schedule_enabled: true,
    schedule_duration_hours: 1,
    max_videos_to_generate: 5,
    generation_interval_minutes: 1,
    use_bucket_images: false,
    bucket_image_ids: [],
  });

  useEffect(() => {
    if (user && project) {
      loadSchedules();
      loadBucketImages();
    }
  }, [user, project]);

  const loadSchedules = async () => {
    try {
      // Get task IDs for video-generation tasks in this project
      const videoGenerationTasks =
        tasks?.filter((task) => task.task_type === 'video-generation') || [];
      const taskIds = videoGenerationTasks.map((task) => task.id);

      if (taskIds.length === 0) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      // Fetch schedules with content statistics
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select(
          `
          *,
          generated_content!schedule_id(
            id,
            generation_status
          )
        `
        )
        .eq('user_id', user?.id)
        .in('task_id', taskIds)
        .order('created_at', { ascending: false });

      if (schedulesError) throw schedulesError;

      // Transform data to include statistics and flatten JSON fields
      const schedulesWithStats =
        schedulesData?.map((schedule) => {
          const contents = (schedule as any).generated_content || [];
          const scheduleConfig = (schedule.schedule_config as any) || {};
          const generationSettings =
            (schedule.generation_settings as any) || {};

          return {
            ...schedule,
            // Flatten schedule_config
            generation_interval_minutes: scheduleConfig.interval_minutes,
            schedule_duration_hours: scheduleConfig.duration_hours,
            schedule_enabled: scheduleConfig.enabled,
            // Flatten generation_settings for video
            max_videos_to_generate:
              generationSettings.max_videos || generationSettings.max_images,
            start_image_url:
              generationSettings.start_image_url ||
              generationSettings.input_image_1_url,
            mode: generationSettings.mode || 'standard',
            duration: generationSettings.duration || 5,
            negative_prompt: generationSettings.negative_prompt || '',
            // Add statistics
            total_videos: contents.length,
            completed_videos: contents.filter(
              (content: any) => content.generation_status === 'completed'
            ).length,
            failed_videos: contents.filter(
              (content: any) => content.generation_status === 'failed'
            ).length,
            generated_content: undefined, // Remove the nested data
          };
        }) || [];

      setSchedules(schedulesWithStats);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const loadBucketImages = async () => {
    try {
      const { data: images, error } = await supabase
        .from('project_bucket_images')
        .select('*')
        .eq('user_id', user?.id)
        .eq('task_type', 'video-generation')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBucketImages(images || []);
    } catch (error: any) {
      console.error('Error loading bucket images:', error);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!user || !project) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/bucket/${
        project.id
      }/video-generation/bucket_${Date.now()}_0.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('user-bucket-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('user-bucket-images').getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('project_bucket_images')
        .insert({
          user_id: user.id,
          task_type: 'video-generation',
          filename: file.name,
          storage_path: fileName,
          image_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
        });

      if (dbError) throw dbError;

      toast.success('Start image uploaded successfully');
      loadBucketImages();

      // Set the uploaded image as start image
      setFormData((prev) => ({
        ...prev,
        start_image_url: publicUrl,
        use_bucket_images: true,
      }));
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    }
  };

  const handleSaveSchedule = async () => {
    if (!user || !project) return;

    try {
      setSaving(true);

      // Validate required fields
      if (!formData.name.trim()) {
        toast.error('Please enter a schedule name');
        return;
      }
      if (!formData.prompt.trim()) {
        toast.error('Please enter a video prompt');
        return;
      }
      if (!formData.start_image_url) {
        toast.error('Please provide a start image');
        return;
      }

      // Get or create video-generation task for this project
      let videoTask = tasks?.find(
        (task) => task.task_type === 'video-generation'
      );

      if (!videoTask) {
        // Create video-generation task
        const { data: newTask, error: taskError } = await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            project_id: project.id,
            name: 'Video Generation',
            description: 'AI video generation task',
            task_type: 'video-generation',
            status: 'active',
          })
          .select()
          .single();

        if (taskError) throw taskError;
        videoTask = newTask;
        await fetchProjectData(); // Refresh tasks
      }

      const nextRun = formData.schedule_enabled
        ? new Date(
            Date.now() + formData.generation_interval_minutes * 60 * 1000
          ).toISOString()
        : null;

      const scheduleData = {
        user_id: user.id,
        task_id: videoTask.id,
        task_type: 'video-generation',
        name: formData.name,
        description: formData.description,
        prompt: formData.prompt,
        schedule_config: {
          enabled: formData.schedule_enabled,
          duration_hours: formData.schedule_duration_hours,
          interval_minutes: formData.generation_interval_minutes,
        },
        generation_settings: {
          max_videos: formData.max_videos_to_generate,
          start_image_url: formData.start_image_url,
          mode: formData.mode,
          duration: formData.duration,
          negative_prompt: formData.negative_prompt,
        },
        bucket_settings: {
          use_bucket_images: formData.use_bucket_images,
          bucket_image_ids: formData.bucket_image_ids,
        },
        status: formData.schedule_enabled ? 'active' : 'paused',
        next_run: nextRun,
      };

      const { error: scheduleError } = await supabase
        .from('schedules')
        .insert(scheduleData);

      if (scheduleError) throw scheduleError;

      toast.success('Video generation schedule created successfully!');
      setIsCreating(false);
      setFormData({
        name: '',
        description: '',
        prompt: '',
        negative_prompt: '',
        start_image_url: '',
        mode: 'standard',
        duration: 5,
        schedule_enabled: true,
        schedule_duration_hours: 24,
        max_videos_to_generate: 5,
        generation_interval_minutes: 60,
        use_bucket_images: false,
        bucket_image_ids: [],
      });
      loadSchedules();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast.error(`Failed to save schedule: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleScheduleStatus = async (
    scheduleId: string,
    currentStatus: string
  ) => {
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      const updateData: any = {
        status: newStatus,
      };

      // If activating, set next_run based on the schedule's interval
      if (newStatus === 'active') {
        const schedule = schedules.find((s) => s.id === scheduleId);
        if (schedule?.generation_interval_minutes) {
          updateData.next_run = new Date(
            Date.now() + schedule.generation_interval_minutes * 60000
          ).toISOString();
        }
      } else {
        // If pausing, clear next_run
        updateData.next_run = null;
      }

      const { error } = await supabase
        .from('schedules')
        .update(updateData)
        .eq('id', scheduleId);

      if (error) {
        console.error('Error toggling schedule status:', error);
        throw error;
      }

      toast.success(
        `Schedule ${
          newStatus === 'active' ? 'activated' : 'paused'
        } successfully!`
      );
      loadSchedules(); // Refresh the schedules list
    } catch (error: any) {
      console.error('Error toggling schedule status:', error);
      toast.error(
        `Failed to ${
          currentStatus === 'active' ? 'pause' : 'activate'
        } schedule: ${error.message}`
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Video Generation</h1>
          <p className="text-muted-foreground">
            Create AI videos using Kling v2.1 model
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Video Schedule
        </Button>
      </div>

      {/* Create Schedule Form */}
      {isCreating && (
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div>
              <Label htmlFor="name">Schedule Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="My video schedule"
              />
            </div>

            <div>
              <Label htmlFor="prompt">Video Prompt *</Label>
              <Textarea
                id="prompt"
                value={formData.prompt}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, prompt: e.target.value }))
                }
                placeholder="Describe the video you want to generate..."
                className="min-h-[100px]"
              />
            </div>

            <div>
              <Label htmlFor="negative_prompt">Negative Prompt</Label>
              <Textarea
                id="negative_prompt"
                value={formData.negative_prompt}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    negative_prompt: e.target.value,
                  }))
                }
                placeholder="Things you don't want to see in the video..."
                className="min-h-[80px]"
              />
            </div>

            <div>
              <Label>Start Image *</Label>
              <div className="mt-2 space-y-4">
                {formData.start_image_url ? (
                  <div className="relative">
                    <img
                      src={formData.start_image_url}
                      alt="Start frame"
                      className="h-32 w-auto rounded-lg border"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          start_image_url: '',
                        }))
                      }
                      className="absolute -top-2 -right-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Start Image
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="mode">Quality Mode</Label>
                <Select
                  value={formData.mode}
                  onValueChange={(value: 'standard' | 'pro') =>
                    setFormData((prev) => ({ ...prev, mode: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (720p)</SelectItem>
                    <SelectItem value="pro">Pro (1080p)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="duration">Duration</Label>
                <Select
                  value={String(formData.duration)}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      duration: Number(value) as 5 | 10,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="max_videos">Max Videos</Label>
                <Input
                  id="max_videos"
                  type="number"
                  min="1"
                  max="50"
                  value={formData.max_videos_to_generate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_videos_to_generate: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">Enable Schedule</h4>
                <p className="text-sm text-muted-foreground">
                  Automatically generate videos at intervals
                </p>
              </div>
              <Switch
                checked={formData.schedule_enabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    schedule_enabled: checked,
                  }))
                }
              />
            </div>

            {formData.schedule_enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interval">
                    Generation Interval (minutes)
                  </Label>
                  <Input
                    id="interval"
                    type="number"
                    min="1"
                    value={formData.generation_interval_minutes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        generation_interval_minutes: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="duration_hours">Duration (hours)</Label>
                  <Input
                    id="duration_hours"
                    type="number"
                    min="1"
                    value={formData.schedule_duration_hours}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        schedule_duration_hours: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSaveSchedule}
                disabled={saving}
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Creating...' : 'Create Schedule'}
              </Button>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Schedules */}
      <div className="grid gap-4">
        {schedules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Video className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No video schedules yet
              </h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first video generation schedule to start producing
                AI videos
              </p>
              <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Video Schedule
              </Button>
            </CardContent>
          </Card>
        ) : (
          schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        schedule.status === 'active'
                          ? 'bg-green-500'
                          : 'bg-gray-400'
                      }`}
                    ></div>
                    <h3 className="text-lg font-semibold">{schedule.name}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                      <span className="text-sm font-medium">
                        {schedule.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                      <Switch
                        checked={schedule.status === 'active'}
                        onCheckedChange={() =>
                          toggleScheduleStatus(schedule.id, schedule.status)
                        }
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(`/project/${project.id}/video-output`)
                      }
                      className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                    >
                      <Video className="h-4 w-4 mr-2" />
                      View Videos
                    </Button>
                    <Button variant="outline">
                      <Zap className="h-4 w-4" />
                    </Button>
                    <Button variant="outline">
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mb-4">
                  <div>
                    <Clock className="h-3 w-3 inline mr-1" />
                    Every {schedule.generation_interval_minutes}m
                  </div>
                  <div>
                    <Video className="h-3 w-3 inline mr-1" />
                    Max: {schedule.max_videos_to_generate}
                  </div>
                  <div>
                    <Zap className="h-3 w-3 inline mr-1" />
                    Duration: {schedule.schedule_duration_hours}h
                  </div>
                  <div>
                    <Activity className="h-3 w-3 inline mr-1" />
                    {schedule.mode === 'pro' ? '1080p' : '720p'} •{' '}
                    {schedule.duration}s
                  </div>
                </div>

                {/* Video Stats */}
                <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">Generation Progress</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        navigate(`/project/${project.id}/video-output`)
                      }
                      className="text-xs h-6 px-2"
                    >
                      View Gallery →
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {schedule.completed_videos || 0}
                      </div>
                      <div className="text-muted-foreground">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">
                        {schedule.failed_videos || 0}
                      </div>
                      <div className="text-muted-foreground">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">
                        {schedule.total_videos || 0}
                      </div>
                      <div className="text-muted-foreground">Total</div>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium mb-2">Prompt</p>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg line-clamp-2">
                    {schedule.prompt}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Created:{' '}
                    {new Date(schedule.created_at).toLocaleDateString()}
                  </div>
                  <Badge>
                    {schedule.status === 'active' ? 'Active' : 'Paused'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Video Generation Dialog */}
      <CreateVideoGenerationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        projectId={project.id}
        onSuccess={() => {
          loadSchedules();
        }}
      />
    </div>
  );
};

export default VideoGenerationView;
