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
  Upload,
  X,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Schedule = Tables<'schedules'>;
type Project = Tables<'projects'>;
type Task = Tables<'tasks'>;

interface BucketImage {
  id: string;
  filename: string;
  image_url: string;
  file_size?: number | null;
  content_type?: string | null;
  created_at?: string;
}

interface ScheduleWithTask extends Schedule {
  tasks: Task;
}

interface ScheduleConfig {
  generation_interval_minutes?: number;
  schedule_duration_hours?: number;
}

interface GenerationSettings {
  max_images_to_generate?: number;
  reference_image_url?: string;
}

const SchedulesView = () => {
  const navigate = useNavigate();
  const { project, tasks, fetchProjectData } = useOutletContext<{
    project: Project;
    tasks: Task[];
    fetchProjectData: () => Promise<void>;
  }>();
  const { user } = useAuth();

  const [userSchedules, setUserSchedules] = useState<ScheduleWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<ScheduleWithTask | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: '',
    max_images: 100,
    schedule_duration_hours: 8,
    generation_interval_minutes: 60,
    reference_image_url: '',
  });

  // Bucket image state
  const [bucketImages, setBucketImages] = useState<BucketImage[]>([]);
  const [loadingBucketImages, setLoadingBucketImages] = useState(false);
  const [selectedReferenceImage, setSelectedReferenceImage] =
    useState<BucketImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Helper function to determine where to navigate for creating new schedules
  const getNewScheduleRoute = () => {
    const hasImageGeneration = tasks.some(
      (task) => task.task_type === 'image-generation'
    );
    const hasPrintOnShirt = tasks.some(
      (task) => task.task_type === 'print-on-shirt'
    );
    const hasJournal = tasks.some((task) => task.task_type === 'journal');

    // Prioritize image-generation for the main "New Schedule" button
    if (hasImageGeneration) {
      return `/create-image-agent?projectId=${project.id}`;
    } else if (hasPrintOnShirt) {
      // For now, direct to the project detail page where they can create print-on-shirt schedules
      return `/project/${project.id}/printonshirt`;
    } else if (hasJournal) {
      // For now, direct to the project detail page where they can create journal schedules
      return `/project/${project.id}/journal`;
    } else {
      return '/create-project';
    }
  };

  useEffect(() => {
    if (!user) return;
    loadUserSchedules();
    loadBucketImages();
  }, [user, project, tasks]);

  const loadUserSchedules = async () => {
    if (!project?.id || !tasks?.length) return;

    try {
      // Get task IDs for image-generation tasks only
      const imageGenerationTasks = tasks.filter(
        (task) => task.task_type === 'image-generation'
      );
      const taskIds = imageGenerationTasks.map((task) => task.id);

      if (taskIds.length === 0) {
        setUserSchedules([]);
        setLoading(false);
        return;
      }

      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select(
          `
          *,
          tasks (*)
        `
        )
        .eq('user_id', user?.id)
        .eq('task_type', 'image-generation')
        .in('task_id', taskIds)
        .order('created_at', { ascending: false });

      if (schedulesError) throw schedulesError;

      setUserSchedules(schedulesData || []);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load schedules';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadBucketImages = async () => {
    if (!project?.id || !user?.id) return;

    setLoadingBucketImages(true);
    try {
      // Get all task IDs for image-generation tasks in this project
      const imageGenerationTasks = tasks.filter(
        (task) => task.task_type === 'image-generation'
      );
      const taskIds = imageGenerationTasks.map((task) => task.id);

      if (taskIds.length === 0) {
        setBucketImages([]);
        setLoadingBucketImages(false);
        return;
      }

      const { data: bucketImagesData, error } = await supabase
        .from('project_bucket_images')
        .select('*')
        .eq('user_id', user.id)
        .in('task_id', taskIds)
        .eq('task_type', 'image-generation')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBucketImages(bucketImagesData || []);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load bucket images';
      toast.error(errorMessage);
    } finally {
      setLoadingBucketImages(false);
    }
  };

  const handleReferenceImageUpload = async (file: File) => {
    if (!user?.id || !project?.id) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `reference_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('user-bucket-images')
        .upload(
          `${user.id}/bucket/${project.id}/image-generation/${fileName}`,
          file
        );

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage
        .from('user-bucket-images')
        .getPublicUrl(
          `${user.id}/bucket/${project.id}/image-generation/${fileName}`
        );

      // Find image-generation task
      const imageGenTask = tasks.find(
        (task) => task.task_type === 'image-generation'
      );
      if (!imageGenTask) {
        throw new Error('No image-generation task found in this project');
      }

      // Save to bucket images table
      const { data: bucketImage, error: insertError } = await supabase
        .from('project_bucket_images')
        .insert({
          user_id: user.id,
          task_id: imageGenTask.id,
          task_type: 'image-generation',
          filename: file.name,
          storage_path: `${user.id}/bucket/${project.id}/image-generation/${fileName}`,
          image_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
          metadata: {},
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('Reference image uploaded successfully!');

      // Refresh bucket images and auto-select the new one
      await loadBucketImages();
      if (bucketImage) {
        handleReferenceImageSelect(bucketImage);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to upload image';
      toast.error(errorMessage);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleReferenceImageSelect = (image: BucketImage | null) => {
    setSelectedReferenceImage(image);
    setFormData((prev) => ({
      ...prev,
      reference_image_url: image?.image_url || '',
    }));
  };

  const openSettingsDialog = (schedule: ScheduleWithTask) => {
    setEditingSchedule(schedule);

    const scheduleConfig = (schedule.schedule_config as ScheduleConfig) || {};
    const generationSettings =
      (schedule.generation_settings as GenerationSettings) || {};

    setFormData({
      name: schedule.name,
      description: schedule.description || '',
      prompt: schedule.prompt || '',
      max_images: generationSettings.max_images_to_generate || 100,
      schedule_duration_hours: scheduleConfig.schedule_duration_hours || 8,
      generation_interval_minutes:
        scheduleConfig.generation_interval_minutes || 60,
      reference_image_url: generationSettings.reference_image_url || '',
    });

    // Set selected reference image if it exists in bucket
    if (generationSettings.reference_image_url) {
      const matchingImage = bucketImages.find(
        (img) => img.image_url === generationSettings.reference_image_url
      );
      setSelectedReferenceImage(matchingImage || null);
    } else {
      setSelectedReferenceImage(null);
    }

    setIsEditing(true);
  };

  const handleUpdateSchedule = async () => {
    if (!editingSchedule) return;

    if (!formData.name.trim() || !formData.prompt.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const updateData = {
        name: formData.name,
        description: formData.description || null,
        prompt: formData.prompt,
        schedule_config: {
          schedule_duration_hours: formData.schedule_duration_hours,
          generation_interval_minutes: formData.generation_interval_minutes,
        },
        generation_settings: {
          max_images_to_generate: formData.max_images,
          reference_image_url: formData.reference_image_url || null,
        },
      };

      const { error: updateError } = await supabase
        .from('schedules')
        .update(updateData)
        .eq('id', editingSchedule.id);

      if (updateError) throw updateError;

      // Reset form and editing state
      setFormData({
        name: '',
        description: '',
        prompt: '',
        max_images: 100,
        schedule_duration_hours: 8,
        generation_interval_minutes: 60,
        reference_image_url: '',
      });

      setIsEditing(false);
      setEditingSchedule(null);
      toast.success('Schedule updated successfully');

      // Reload schedules
      await loadUserSchedules();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update schedule';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingSchedule(null);
    setFormData({
      name: '',
      description: '',
      prompt: '',
      max_images: 100,
      schedule_duration_hours: 8,
      generation_interval_minutes: 60,
      reference_image_url: '',
    });
    setSelectedReferenceImage(null);
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
          <h1 className="text-2xl font-bold text-foreground">
            Image Generation Schedules
          </h1>
          <p className="text-muted-foreground">
            Create and manage your AI image generation schedules
          </p>
        </div>
        <Button onClick={() => navigate(getNewScheduleRoute())}>
          <Plus className="mr-2 h-4 w-4" />
          {tasks?.some((task) => task.task_type === 'image-generation')
            ? 'New AI Image Agent'
            : 'New Schedule'}
        </Button>
      </div>

      <div className="space-y-4">
        {userSchedules.length > 0 ? (
          userSchedules.map((schedule) => {
            const scheduleConfig =
              (schedule.schedule_config as ScheduleConfig) || {};
            const generationSettings =
              (schedule.generation_settings as GenerationSettings) || {};
            const isActive = schedule.status === 'active';
            const taskName = schedule.tasks?.name || 'Unknown Task';
            const taskType = schedule.tasks?.task_type || 'unknown';

            const isScheduleBeingEdited =
              isEditing && editingSchedule?.id === schedule.id;

            return (
              <Card key={schedule.id} className="shadow-card border-border/50">
                <CardContent className="p-6">
                  {/* Header Section */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          isActive ? 'bg-green-500' : 'bg-gray-400'
                        }`}
                      />
                      <div className="flex-1">
                        {isScheduleBeingEdited ? (
                          <div className="space-y-2">
                            <Input
                              value={formData.name}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  name: e.target.value,
                                }))
                              }
                              placeholder="Schedule name..."
                              className="text-lg font-semibold border-0 bg-transparent p-0 focus:ring-1 focus:ring-primary"
                            />
                            <p className="text-sm text-muted-foreground">
                              Task: {taskName} ({taskType})
                            </p>
                          </div>
                        ) : (
                          <div>
                            <h3 className="text-lg font-semibold">
                              {schedule.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Task: {taskName} ({taskType})
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!isScheduleBeingEdited && (
                        <>
                          <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                            <span className="text-sm font-medium">
                              {isActive ? 'Active' : 'Paused'}
                            </span>
                            <Switch
                              checked={isActive}
                              onCheckedChange={async () => {
                                try {
                                  const newStatus = isActive
                                    ? 'paused'
                                    : 'active';
                                  const { error } = await supabase
                                    .from('schedules')
                                    .update({ status: newStatus })
                                    .eq('id', schedule.id);

                                  if (error) throw error;

                                  // Refresh data
                                  await Promise.all([
                                    loadUserSchedules(),
                                    fetchProjectData(),
                                  ]);
                                  toast.success(
                                    isActive
                                      ? 'Schedule paused'
                                      : 'Schedule activated'
                                  );
                                } catch (error: unknown) {
                                  const errorMessage =
                                    error instanceof Error
                                      ? error.message
                                      : 'Failed to update schedule';
                                  toast.error(errorMessage);
                                }
                              }}
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openSettingsDialog(schedule)}
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
                                  `Are you sure you want to delete "${schedule.name}"? All generated content for this schedule will also be deleted.`
                                )
                              )
                                return;

                              try {
                                const { error } = await supabase
                                  .from('schedules')
                                  .delete()
                                  .eq('id', schedule.id);

                                if (error) throw error;

                                toast.success('Schedule deleted successfully');
                                await loadUserSchedules();
                              } catch (error: unknown) {
                                const errorMessage =
                                  error instanceof Error
                                    ? error.message
                                    : 'Failed to delete schedule';
                                toast.error(errorMessage);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {isScheduleBeingEdited && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleUpdateSchedule}
                            disabled={isSaving}
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Content Section */}
                  {isScheduleBeingEdited ? (
                    <div className="space-y-4">
                      {/* Edit Form */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`edit-description-${schedule.id}`}>
                            Description (Optional)
                          </Label>
                          <Input
                            id={`edit-description-${schedule.id}`}
                            value={formData.description}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                description: e.target.value,
                              }))
                            }
                            placeholder="Brief description of this schedule"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`edit-max_images-${schedule.id}`}>
                            Max Images
                          </Label>
                          <Input
                            id={`edit-max_images-${schedule.id}`}
                            type="number"
                            min="1"
                            value={formData.max_images}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                max_images: parseInt(e.target.value) || 100,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`edit-prompt-${schedule.id}`}>
                          Generation Prompt *
                        </Label>
                        <Textarea
                          id={`edit-prompt-${schedule.id}`}
                          value={formData.prompt}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              prompt: e.target.value,
                            }))
                          }
                          placeholder="Describe what kind of images you want to generate..."
                          className="min-h-[80px]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Reference Image (Optional)</Label>
                        <div className="space-y-3">
                          {/* Current Selection Display */}
                          {selectedReferenceImage && (
                            <div className="p-3 border border-primary/20 rounded-lg bg-primary/5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border">
                                    <img
                                      src={selectedReferenceImage.image_url}
                                      alt={selectedReferenceImage.filename}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">
                                      Selected Reference
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate max-w-32">
                                      {selectedReferenceImage.filename}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleReferenceImageSelect(null)
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Upload Trigger */}
                          <div className="border-2 border-dashed border-border rounded-lg p-4">
                            <div className="flex flex-col items-center space-y-2">
                              <Upload className="h-8 w-8 text-muted-foreground" />
                              <div className="text-center">
                                <p className="text-sm font-medium">
                                  Upload Reference Image
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Click to upload a new reference image
                                </p>
                              </div>
                              <Label
                                htmlFor={`reference-upload-${schedule.id}`}
                                className="cursor-pointer"
                              >
                                <Button
                                  type="button"
                                  className="pointer-events-none"
                                  size="sm"
                                  disabled={uploadingImage}
                                >
                                  {uploadingImage
                                    ? 'Uploading...'
                                    : 'Choose Image'}
                                </Button>
                                <input
                                  id={`reference-upload-${schedule.id}`}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleReferenceImageUpload(file);
                                    }
                                  }}
                                />
                              </Label>
                            </div>
                          </div>

                          {/* Bucket Images Grid */}
                          {bucketImages.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2">
                                Select from Project Images
                              </p>
                              <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                                {bucketImages.map((image) => {
                                  const isSelected =
                                    selectedReferenceImage?.id === image.id;
                                  return (
                                    <div
                                      key={image.id}
                                      className={`relative group cursor-pointer ${
                                        isSelected ? 'ring-2 ring-primary' : ''
                                      }`}
                                      onClick={() =>
                                        handleReferenceImageSelect(image)
                                      }
                                    >
                                      <div className="aspect-square rounded-lg overflow-hidden bg-muted border">
                                        <img
                                          src={image.image_url}
                                          alt={image.filename}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      {isSelected && (
                                        <div className="absolute inset-0 bg-primary/20 rounded-lg flex items-center justify-center">
                                          <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">
                                            ✓
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`edit-interval-${schedule.id}`}>
                            Generation Interval
                          </Label>
                          <Select
                            value={formData.generation_interval_minutes.toString()}
                            onValueChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                generation_interval_minutes: parseInt(value),
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select interval" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15 minutes</SelectItem>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="60">1 hour</SelectItem>
                              <SelectItem value="120">2 hours</SelectItem>
                              <SelectItem value="240">4 hours</SelectItem>
                              <SelectItem value="480">8 hours</SelectItem>
                              <SelectItem value="720">12 hours</SelectItem>
                              <SelectItem value="1440">24 hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`edit-duration-${schedule.id}`}>
                            Schedule Duration
                          </Label>
                          <Select
                            value={formData.schedule_duration_hours.toString()}
                            onValueChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                schedule_duration_hours: parseInt(value),
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 hour</SelectItem>
                              <SelectItem value="2">2 hours</SelectItem>
                              <SelectItem value="4">4 hours</SelectItem>
                              <SelectItem value="6">6 hours</SelectItem>
                              <SelectItem value="8">8 hours</SelectItem>
                              <SelectItem value="12">12 hours</SelectItem>
                              <SelectItem value="24">24 hours</SelectItem>
                              <SelectItem value="48">48 hours</SelectItem>
                              <SelectItem value="72">72 hours</SelectItem>
                              <SelectItem value="168">1 week</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Display Mode */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mb-4">
                        <div>
                          <Clock className="h-3 w-3 inline mr-1" />
                          Every{' '}
                          {scheduleConfig.generation_interval_minutes || 60}m
                        </div>
                        <div>
                          <Images className="h-3 w-3 inline mr-1" />
                          Max:{' '}
                          {generationSettings.max_images_to_generate ||
                            'Unlimited'}
                        </div>
                        <div>
                          <Zap className="h-3 w-3 inline mr-1" />
                          Duration:{' '}
                          {scheduleConfig.schedule_duration_hours || 8}h
                        </div>
                        <div>
                          <Activity className="h-3 w-3 inline mr-1" />
                          {generationSettings.reference_image_url
                            ? 'With reference'
                            : 'Text-to-image'}
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="text-sm font-medium mb-2">Prompt</p>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg line-clamp-2">
                          {schedule.prompt || 'No prompt set'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Created:{' '}
                          {new Date(
                            schedule.created_at || ''
                          ).toLocaleDateString()}
                          {isActive && schedule.last_run && (
                            <span className="ml-4">
                              Next run:{' '}
                              {new Date(
                                new Date(schedule.last_run).getTime() +
                                  (scheduleConfig.generation_interval_minutes ||
                                    60) *
                                    60000
                              ).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={isActive ? 'default' : 'secondary'}>
                            {isActive ? 'Active' : 'Paused'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate(`/project/${project.id}/dashboard`)
                            }
                          >
                            View Project
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No schedules created yet
            </h3>
            <p className="text-muted-foreground mb-4">
              Create your first AI generation schedule to get started
            </p>
            <Button onClick={() => navigate(getNewScheduleRoute())}>
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
