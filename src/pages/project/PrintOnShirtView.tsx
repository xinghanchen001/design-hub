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
import {
  Shirt,
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

interface ProjectSettings {
  prompt?: string;
  reference_image_url?: string;
  max_images_to_generate?: number;
  schedule_duration_hours?: number;
  generation_interval_minutes?: number;
}

interface PrintOnShirtSchedule extends Schedule {
  // Add stats
  total_images?: number;
  completed_images?: number;
  failed_images?: number;
  // Flattened schedule_config properties
  generation_interval_minutes?: number;
  schedule_duration_hours?: number;
  schedule_enabled?: boolean;
  // Flattened generation_settings properties
  max_images_to_generate?: number;
  aspect_ratio?: string;
  input_image_1_url?: string;
  input_image_2_url?: string;
}

interface FormData {
  name: string;
  description: string;
  prompt: string;
  input_image_1_url: string;
  input_image_2_url: string;
  aspect_ratio: string;
  schedule_enabled: boolean;
  schedule_duration_hours: number;
  max_images_to_generate: number;
  generation_interval_minutes: number;
  use_bucket_images: boolean;
  bucket_image_1_ids: string[];
  bucket_image_2_ids: string[];
}

const PrintOnShirtView = () => {
  const navigate = useNavigate();
  const { project, tasks, fetchProjectData } = useOutletContext<{
    project: Project;
    tasks: any[];
    fetchProjectData: () => Promise<void>;
  }>();
  const { user } = useAuth();

  const [schedules, setSchedules] = useState<PrintOnShirtSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<PrintOnShirtSchedule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Bucket state - updated for multi-select
  const [bucketImages, setBucketImages] = useState<BucketImage[]>([]);
  const [loadingBucketImages, setLoadingBucketImages] = useState(false);
  const [selectedBucketImages1, setSelectedBucketImages1] = useState<
    BucketImage[]
  >([]);
  const [selectedBucketImages2, setSelectedBucketImages2] = useState<
    BucketImage[]
  >([]);
  const [useBucketImages, setUseBucketImages] = useState(false);

  // File input refs for triggering file upload
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  // Form state - updated for multi-select
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: '',
    input_image_1_url: '',
    input_image_2_url: '',
    aspect_ratio: '1:1',
    schedule_enabled: true,
    schedule_duration_hours: 24,
    max_images_to_generate: 10,
    generation_interval_minutes: 60,
    use_bucket_images: true, // Always true since bucket is the only option
    bucket_image_1_ids: [] as string[],
    bucket_image_2_ids: [] as string[],
  });

  const aspectRatios = [
    { value: '1:1', label: '1:1 (Square)' },
    { value: '16:9', label: '16:9 (Landscape)' },
    { value: '9:16', label: '9:16 (Portrait)' },
    { value: '4:3', label: '4:3 (Classic)' },
    { value: '3:4', label: '3:4 (Vertical)' },
    { value: '3:2', label: '3:2 (Photo)' },
    { value: '2:3', label: '2:3 (Vertical Photo)' },
    { value: 'match_input_image', label: 'Match Input Image' },
  ];

  useEffect(() => {
    if (!user) return;
    loadSchedules();
    loadBucketImages();
  }, [user]);

  const loadSchedules = async () => {
    try {
      // Get task IDs for print-on-shirt tasks in this project
      const printOnShirtTasks =
        tasks?.filter((task) => task.task_type === 'print-on-shirt') || [];
      const taskIds = printOnShirtTasks.map((task) => task.id);

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
            // Flatten generation_settings
            max_images_to_generate: generationSettings.max_images,
            aspect_ratio: generationSettings.aspect_ratio,
            input_image_1_url: generationSettings.input_image_1_url,
            input_image_2_url: generationSettings.input_image_2_url,
            // Add statistics
            total_images: contents.length,
            completed_images: contents.filter(
              (content: any) => content.generation_status === 'completed'
            ).length,
            failed_images: contents.filter(
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
    setLoadingBucketImages(true);
    try {
      // Get task IDs for print-on-shirt tasks in this project
      const printOnShirtTasks =
        tasks?.filter((task) => task.task_type === 'print-on-shirt') || [];
      const taskIds = printOnShirtTasks.map((task) => task.id);

      if (taskIds.length === 0) {
        setBucketImages([]);
        setLoadingBucketImages(false);
        return;
      }

      const { data, error } = await supabase
        .from('project_bucket_images')
        .select('*')
        .in('task_id', taskIds)
        .eq('task_type', 'print-on-shirt')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBucketImages(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load bucket images');
    } finally {
      setLoadingBucketImages(false);
    }
  };

  const handleBucketImageSelect = (image: BucketImage, imageNumber: 1 | 2) => {
    if (imageNumber === 1) {
      const isAlreadySelected = selectedBucketImages1.some(
        (img) => img.id === image.id
      );
      if (isAlreadySelected) {
        // Remove from selection
        const newSelection = selectedBucketImages1.filter(
          (img) => img.id !== image.id
        );
        setSelectedBucketImages1(newSelection);
        setFormData((prev) => ({
          ...prev,
          bucket_image_1_ids: newSelection.map((img) => img.id),
          input_image_1_url:
            newSelection.length > 0 ? newSelection[0].image_url : '',
        }));
      } else {
        // Add to selection
        const newSelection = [...selectedBucketImages1, image];
        setSelectedBucketImages1(newSelection);
        setFormData((prev) => ({
          ...prev,
          bucket_image_1_ids: newSelection.map((img) => img.id),
          input_image_1_url: newSelection[0].image_url,
        }));
      }
    } else {
      const isAlreadySelected = selectedBucketImages2.some(
        (img) => img.id === image.id
      );
      if (isAlreadySelected) {
        // Remove from selection
        const newSelection = selectedBucketImages2.filter(
          (img) => img.id !== image.id
        );
        setSelectedBucketImages2(newSelection);
        setFormData((prev) => ({
          ...prev,
          bucket_image_2_ids: newSelection.map((img) => img.id),
          input_image_2_url:
            newSelection.length > 0 ? newSelection[0].image_url : '',
        }));
      } else {
        // Add to selection
        const newSelection = [...selectedBucketImages2, image];
        setSelectedBucketImages2(newSelection);
        setFormData((prev) => ({
          ...prev,
          bucket_image_2_ids: newSelection.map((img) => img.id),
          input_image_2_url: newSelection[0].image_url,
        }));
      }
    }
  };

  const removeBucketSelection = (image: BucketImage, imageNumber: 1 | 2) => {
    if (imageNumber === 1) {
      const newSelection = selectedBucketImages1.filter(
        (img) => img.id !== image.id
      );
      setSelectedBucketImages1(newSelection);
      setFormData((prev) => ({
        ...prev,
        bucket_image_1_ids: newSelection.map((img) => img.id),
        input_image_1_url:
          newSelection.length > 0 ? newSelection[0].image_url : '',
      }));
    } else {
      const newSelection = selectedBucketImages2.filter(
        (img) => img.id !== image.id
      );
      setSelectedBucketImages2(newSelection);
      setFormData((prev) => ({
        ...prev,
        bucket_image_2_ids: newSelection.map((img) => img.id),
        input_image_2_url:
          newSelection.length > 0 ? newSelection[0].image_url : '',
      }));
    }
  };

  const clearAllBucketSelections = (imageNumber: 1 | 2) => {
    if (imageNumber === 1) {
      setSelectedBucketImages1([]);
      setFormData((prev) => ({
        ...prev,
        bucket_image_1_ids: [],
        input_image_1_url: '',
      }));
    } else {
      setSelectedBucketImages2([]);
      setFormData((prev) => ({
        ...prev,
        bucket_image_2_ids: [],
        input_image_2_url: '',
      }));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Trigger file input for bucket upload
  const triggerFileUpload = (imageNumber: 1 | 2) => {
    if (imageNumber === 1) {
      fileInputRef1.current?.click();
    } else {
      fileInputRef2.current?.click();
    }
  };

  // Handle bucket image upload
  const handleBucketImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    imageNumber: 1 | 2
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `bucket_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;

      // Upload to user-bucket-images
      const { error: uploadError } = await supabase.storage
        .from('user-bucket-images')
        .upload(
          `${user?.id}/bucket/${project.id}/print-on-shirt/${fileName}`,
          file
        );

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage
        .from('user-bucket-images')
        .getPublicUrl(
          `${user?.id}/bucket/${project.id}/print-on-shirt/${fileName}`
        );

      // Save to bucket images table
      const { data: bucketImage, error: insertError } = await supabase
        .from('project_bucket_images')
        .insert({
          user_id: user?.id,
          project_id: project.id,
          task_type: 'print-on-shirt',
          filename: file.name,
          original_filename: file.name,
          image_url: publicUrl,
          file_size: file.size,
          content_type: file.type,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('Image uploaded to bucket successfully!');

      // Refresh bucket images
      await loadBucketImages();

      // Auto-select the uploaded image
      if (bucketImage) {
        handleBucketImageSelect(bucketImage, imageNumber);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image to bucket');
    }

    // Reset file input
    event.target.value = '';
  };

  const handleImageUpload = async (file: File, imageNumber: 1 | 2) => {
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/inputs/${
        project.id
      }/input_${imageNumber}_${Date.now()}.${fileExt}`;

      // Upload to user-images bucket
      const { error: uploadError } = await supabase.storage
        .from('user-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('user-images').getPublicUrl(fileName);

      // Update form data
      setFormData((prev) => ({
        ...prev,
        [`input_image_${imageNumber}_url`]: publicUrl,
      }));

      toast.success(`Image ${imageNumber} uploaded successfully`);
    } catch (error: any) {
      toast.error(error.message || `Failed to upload image ${imageNumber}`);
    }
  };

  const handleSaveSchedule = async () => {
    if (!formData.name.trim() || !formData.prompt.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (
      selectedBucketImages1.length === 0 ||
      selectedBucketImages2.length === 0
    ) {
      toast.error('Please select at least one image from each reference set');
      return;
    }

    setIsSaving(true);
    try {
      // Find or create a print-on-shirt task for this project
      const printOnShirtTask = tasks?.find(
        (task) => task.task_type === 'print-on-shirt'
      );
      if (!printOnShirtTask) {
        toast.error('No print-on-shirt task found in this project');
        return;
      }

      const scheduleData = {
        user_id: user?.id,
        task_id: printOnShirtTask.id,
        task_type: 'print-on-shirt',
        name: formData.name,
        description: formData.description || null,
        prompt: formData.prompt,
        schedule_config: {
          enabled: formData.schedule_enabled,
          duration_hours: formData.schedule_duration_hours,
          interval_minutes: formData.generation_interval_minutes,
        },
        generation_settings: {
          max_images: formData.max_images_to_generate,
          aspect_ratio: formData.aspect_ratio,
          input_image_1_url: formData.input_image_1_url,
          input_image_2_url: formData.input_image_2_url,
        },
        bucket_settings: {
          use_bucket_images: true,
          bucket_image_1_ids: formData.bucket_image_1_ids,
          bucket_image_2_ids: formData.bucket_image_2_ids,
        },
        status: formData.schedule_enabled ? 'active' : 'paused',
        next_run: formData.schedule_enabled ? new Date().toISOString() : null, // Set next_run only if schedule is enabled
      };

      const { data: newSchedule, error: insertError } = await supabase
        .from('schedules')
        .insert(scheduleData)
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('Print on Shirt schedule created successfully!');

      // Reset form
      setFormData({
        name: '',
        description: '',
        prompt: '',
        input_image_1_url: '',
        input_image_2_url: '',
        aspect_ratio: '1:1',
        schedule_enabled: true,
        schedule_duration_hours: 24,
        max_images_to_generate: 10,
        generation_interval_minutes: 60,
        use_bucket_images: true,
        bucket_image_1_ids: [],
        bucket_image_2_ids: [],
      });

      // Reset bucket state
      setSelectedBucketImages1([]);
      setSelectedBucketImages2([]);
      setUseBucketImages(false);

      setIsCreating(false);
      await loadSchedules();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSchedule = (schedule: PrintOnShirtSchedule) => {
    setEditingSchedule(schedule);

    const scheduleConfig = (schedule.schedule_config as any) || {};
    const generationSettings = (schedule.generation_settings as any) || {};
    const bucketSettings = (schedule.bucket_settings as any) || {};

    setFormData({
      name: schedule.name,
      description: schedule.description || '',
      prompt: schedule.prompt || '',
      input_image_1_url: generationSettings.input_image_1_url || '',
      input_image_2_url: generationSettings.input_image_2_url || '',
      aspect_ratio: generationSettings.aspect_ratio || '1:1',
      schedule_enabled: schedule.status === 'active',
      schedule_duration_hours: scheduleConfig.duration_hours || 24,
      max_images_to_generate: generationSettings.max_images || 10,
      generation_interval_minutes: scheduleConfig.interval_minutes || 60,
      use_bucket_images: bucketSettings.use_bucket_images || false,
      bucket_image_1_ids: bucketSettings.bucket_image_1_ids || [],
      bucket_image_2_ids: bucketSettings.bucket_image_2_ids || [],
    });

    // Set bucket images - always enabled
    setUseBucketImages(true);
    if (
      bucketSettings.bucket_image_1_ids &&
      bucketSettings.bucket_image_1_ids.length > 0
    ) {
      const bucketImages1 = bucketImages.filter((img) =>
        bucketSettings.bucket_image_1_ids.includes(img.id)
      );
      setSelectedBucketImages1(bucketImages1);
    }
    if (
      bucketSettings.bucket_image_2_ids &&
      bucketSettings.bucket_image_2_ids.length > 0
    ) {
      const bucketImages2 = bucketImages.filter((img) =>
        bucketSettings.bucket_image_2_ids.includes(img.id)
      );
      setSelectedBucketImages2(bucketImages2);
    }

    setIsEditing(true);
  };

  const handleUpdateSchedule = async () => {
    if (!editingSchedule) return;

    if (!formData.name.trim() || !formData.prompt.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (
      selectedBucketImages1.length === 0 ||
      selectedBucketImages2.length === 0
    ) {
      toast.error('Please select at least one image from each reference set');
      return;
    }

    setIsSaving(true);
    try {
      // Find the print-on-shirt task for this project
      const printOnShirtTask = tasks?.find(
        (task) => task.task_type === 'print-on-shirt'
      );
      if (!printOnShirtTask) {
        toast.error('No print-on-shirt task found in this project');
        return;
      }

      const updateData = {
        task_id: printOnShirtTask.id,
        name: formData.name,
        description: formData.description || null,
        prompt: formData.prompt,
        schedule_config: {
          enabled: formData.schedule_enabled,
          duration_hours: formData.schedule_duration_hours,
          interval_minutes: formData.generation_interval_minutes,
        },
        generation_settings: {
          max_images: formData.max_images_to_generate,
          aspect_ratio: formData.aspect_ratio,
          input_image_1_url: formData.input_image_1_url,
          input_image_2_url: formData.input_image_2_url,
        },
        bucket_settings: {
          use_bucket_images: true,
          bucket_image_1_ids: formData.bucket_image_1_ids,
          bucket_image_2_ids: formData.bucket_image_2_ids,
        },
        status: formData.schedule_enabled ? 'active' : 'paused',
        next_run: formData.schedule_enabled ? new Date().toISOString() : null, // Update next_run when enabling/disabling schedule
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
        input_image_1_url: '',
        input_image_2_url: '',
        aspect_ratio: '1:1',
        schedule_enabled: true,
        schedule_duration_hours: 24,
        max_images_to_generate: 10,
        generation_interval_minutes: 60,
        use_bucket_images: true,
        bucket_image_1_ids: [],
        bucket_image_2_ids: [],
      });

      // Reset bucket state
      setSelectedBucketImages1([]);
      setSelectedBucketImages2([]);
      setUseBucketImages(false);

      setIsEditing(false);
      setEditingSchedule(null);
      toast.success('Schedule updated successfully');

      // Reload schedules
      await loadSchedules();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update schedule');
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
      input_image_1_url: '',
      input_image_2_url: '',
      aspect_ratio: '1:1',
      schedule_enabled: true,
      schedule_duration_hours: 24,
      max_images_to_generate: 10,
      generation_interval_minutes: 60,
      use_bucket_images: true,
      bucket_image_1_ids: [],
      bucket_image_2_ids: [],
    });

    // Reset bucket state
    setSelectedBucketImages1([]);
    setSelectedBucketImages2([]);
    setUseBucketImages(false);
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
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Shirt className="h-8 w-8" />
            Print on Shirt
          </h1>
          <p className="text-muted-foreground">
            Create multi-image combination schedules for print-on-shirt designs
          </p>
        </div>
        <Button
          onClick={() => setIsCreating(true)}
          className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      {/* Generated Images Notification */}
      {schedules.some((s) => s.completed_images && s.completed_images > 0) && (
        <Card className="shadow-card border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <div>
                  <h3 className="text-sm font-medium text-blue-900">
                    🎉 You have{' '}
                    {schedules.reduce(
                      (total, s) => total + (s.completed_images || 0),
                      0
                    )}{' '}
                    generated images ready!
                  </h3>
                  <p className="text-xs text-blue-700">
                    View your print-on-shirt images in the Output2 gallery
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate(`/project/${project.id}/output2`)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                View Gallery
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Schedule Form */}
      {isCreating && (
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle>Create Print on Shirt Schedule</CardTitle>
            <CardDescription>
              Set up automated generation combining two images using FLUX
              Kontext Multi-Image model
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Schedule Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Cool T-Shirt Designs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aspect_ratio">Aspect Ratio</Label>
                <Select
                  value={formData.aspect_ratio}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, aspect_ratio: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select aspect ratio" />
                  </SelectTrigger>
                  <SelectContent>
                    {aspectRatios.map((ratio) => (
                      <SelectItem key={ratio.value} value={ratio.value}>
                        {ratio.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe what this schedule will generate..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Combination Prompt *</Label>
              <Textarea
                id="prompt"
                value={formData.prompt}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, prompt: e.target.value }))
                }
                placeholder="e.g., Put the logo from the first image on the shirt from the second image, make it look professional and stylish"
                rows={4}
              />
            </div>

            {/* Image Selection Section */}
            <div className="space-y-6">
              {/* Batch Generation Information */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">
                      🔄 Batch Generation Mode
                    </h4>
                    <p className="text-sm text-blue-800 mb-2">
                      This schedule will generate images for{' '}
                      <strong>every combination</strong> of selected bucket
                      images:
                    </p>
                    <div className="text-xs text-blue-700 space-y-1">
                      <div>
                        • Set 1: {selectedBucketImages1.length} image
                        {selectedBucketImages1.length !== 1 ? 's' : ''} selected
                      </div>
                      <div>
                        • Set 2: {selectedBucketImages2.length} image
                        {selectedBucketImages2.length !== 1 ? 's' : ''} selected
                      </div>
                      {selectedBucketImages1.length > 0 &&
                        selectedBucketImages2.length > 0 && (
                          <div className="mt-2 font-medium">
                            📊 Total combinations:{' '}
                            {selectedBucketImages1.length} ×{' '}
                            {selectedBucketImages2.length} ={' '}
                            {selectedBucketImages1.length *
                              selectedBucketImages2.length}{' '}
                            images will be generated
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Image 1 */}
                <div className="space-y-4">
                  <Label>
                    Reference Images Set 1 * (Select multiple for batch
                    generation)
                  </Label>

                  {loadingBucketImages ? (
                    <div className="text-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Loading bucket images...
                      </p>
                    </div>
                  ) : bucketImages.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                      <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-2">
                        No images in bucket
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Upload images to your bucket first to select them here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Selected Images Display */}
                      {selectedBucketImages1.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">
                              Selected Images ({selectedBucketImages1.length})
                            </h4>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => clearAllBucketSelections(1)}
                            >
                              Clear All
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                            {selectedBucketImages1.map((image) => (
                              <div key={image.id} className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden bg-muted border-2 border-primary">
                                  <img
                                    src={image.image_url}
                                    alt={image.filename}
                                    className="w-full h-full object-cover"
                                  />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-80 hover:opacity-100"
                                    onClick={() =>
                                      removeBucketSelection(image, 1)
                                    }
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {image.filename}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Available Images Grid */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Available Images (click to select/deselect)
                        </h4>
                        <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                          {/* Upload trigger card */}
                          <div
                            className="relative group cursor-pointer"
                            onClick={() => triggerFileUpload(1)}
                          >
                            <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-dashed border-border/50 hover:border-primary transition-colors flex items-center justify-center">
                              <div className="text-center">
                                <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">
                                  Import
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate text-center">
                              Import from local
                            </p>
                          </div>

                          {bucketImages.map((image) => {
                            const isSelected = selectedBucketImages1.some(
                              (img) => img.id === image.id
                            );
                            return (
                              <div
                                key={image.id}
                                className={`relative group cursor-pointer ${
                                  isSelected ? 'ring-2 ring-primary' : ''
                                }`}
                                onClick={() =>
                                  handleBucketImageSelect(image, 1)
                                }
                              >
                                <div
                                  className={`aspect-square rounded-lg overflow-hidden bg-muted border transition-colors ${
                                    isSelected
                                      ? 'border-primary border-2'
                                      : 'border-border/50 hover:border-primary'
                                  }`}
                                >
                                  <img
                                    src={image.image_url}
                                    alt={image.filename}
                                    className="w-full h-full object-cover"
                                  />
                                  <div
                                    className={`absolute inset-0 transition-colors flex items-center justify-center ${
                                      isSelected
                                        ? 'bg-primary/20'
                                        : 'bg-black/0 group-hover:bg-black/20'
                                    }`}
                                  >
                                    <div
                                      className={`transition-opacity ${
                                        isSelected
                                          ? 'opacity-100'
                                          : 'opacity-0 group-hover:opacity-100'
                                      }`}
                                    >
                                      {isSelected ? (
                                        <div className="bg-primary rounded-full p-1">
                                          <Check className="h-6 w-6 text-white" />
                                        </div>
                                      ) : (
                                        <Check className="h-8 w-8 text-white" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {image.filename}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Image 2 */}
                <div className="space-y-4">
                  <Label>
                    Reference Images Set 2 * (Select multiple for batch
                    generation)
                  </Label>

                  {loadingBucketImages ? (
                    <div className="text-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Loading bucket images...
                      </p>
                    </div>
                  ) : bucketImages.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                      <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-2">
                        No images in bucket
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Upload images to your bucket first to select them here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Selected Images Display */}
                      {selectedBucketImages2.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">
                              Selected Images ({selectedBucketImages2.length})
                            </h4>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => clearAllBucketSelections(2)}
                            >
                              Clear All
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                            {selectedBucketImages2.map((image) => (
                              <div key={image.id} className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden bg-muted border-2 border-primary">
                                  <img
                                    src={image.image_url}
                                    alt={image.filename}
                                    className="w-full h-full object-cover"
                                  />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-80 hover:opacity-100"
                                    onClick={() =>
                                      removeBucketSelection(image, 2)
                                    }
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {image.filename}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Available Images Grid */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Available Images (click to select/deselect)
                        </h4>
                        <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                          {/* Upload trigger card */}
                          <div
                            className="relative group cursor-pointer"
                            onClick={() => triggerFileUpload(2)}
                          >
                            <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-dashed border-border/50 hover:border-primary transition-colors flex items-center justify-center">
                              <div className="text-center">
                                <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">
                                  Import
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate text-center">
                              Import from local
                            </p>
                          </div>

                          {bucketImages.map((image) => {
                            const isSelected = selectedBucketImages2.some(
                              (img) => img.id === image.id
                            );
                            return (
                              <div
                                key={image.id}
                                className={`relative group cursor-pointer ${
                                  isSelected ? 'ring-2 ring-primary' : ''
                                }`}
                                onClick={() =>
                                  handleBucketImageSelect(image, 2)
                                }
                              >
                                <div
                                  className={`aspect-square rounded-lg overflow-hidden bg-muted border transition-colors ${
                                    isSelected
                                      ? 'border-primary border-2'
                                      : 'border-border/50 hover:border-primary'
                                  }`}
                                >
                                  <img
                                    src={image.image_url}
                                    alt={image.filename}
                                    className="w-full h-full object-cover"
                                  />
                                  <div
                                    className={`absolute inset-0 transition-colors flex items-center justify-center ${
                                      isSelected
                                        ? 'bg-primary/20'
                                        : 'bg-black/0 group-hover:bg-black/20'
                                    }`}
                                  >
                                    <div
                                      className={`transition-opacity ${
                                        isSelected
                                          ? 'opacity-100'
                                          : 'opacity-0 group-hover:opacity-100'
                                      }`}
                                    >
                                      {isSelected ? (
                                        <div className="bg-primary rounded-full p-1">
                                          <Check className="h-6 w-6 text-white" />
                                        </div>
                                      ) : (
                                        <Check className="h-8 w-8 text-white" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {image.filename}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Schedule Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Schedule Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="interval">
                    Generation Interval (minutes)
                  </Label>
                  <Input
                    id="interval"
                    type="number"
                    min="30"
                    value={formData.generation_interval_minutes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        generation_interval_minutes:
                          parseInt(e.target.value) || 60,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_images">Max Images to Generate</Label>
                  <Input
                    id="max_images"
                    type="number"
                    min="1"
                    value={formData.max_images_to_generate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        max_images_to_generate: parseInt(e.target.value) || 10,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (hours)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={formData.schedule_duration_hours}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        schedule_duration_hours: parseInt(e.target.value) || 24,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="schedule_enabled"
                  checked={formData.schedule_enabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      schedule_enabled: checked,
                    }))
                  }
                />
                <Label htmlFor="schedule_enabled">
                  Enable schedule immediately after creation
                </Label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleSaveSchedule}
                disabled={isSaving}
                className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Schedule
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsCreating(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Schedule Form */}
      {isEditing && editingSchedule && (
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle>Edit Print on Shirt Schedule</CardTitle>
            <CardDescription>
              Update your automated generation schedule settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Schedule Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Cool T-Shirt Designs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-aspect_ratio">Aspect Ratio</Label>
                <Select
                  value={formData.aspect_ratio}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, aspect_ratio: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select aspect ratio" />
                  </SelectTrigger>
                  <SelectContent>
                    {aspectRatios.map((ratio) => (
                      <SelectItem key={ratio.value} value={ratio.value}>
                        {ratio.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe what this schedule will generate..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-prompt">Combination Prompt *</Label>
              <Textarea
                id="edit-prompt"
                value={formData.prompt}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, prompt: e.target.value }))
                }
                placeholder="e.g., Put the logo from the first image on the shirt from the second image, make it look professional and stylish"
                rows={4}
              />
            </div>

            {/* Image Upload Section */}
            <div className="space-y-6">
              {/* Use Bucket Images Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-use-bucket-images"
                  checked={useBucketImages}
                  onCheckedChange={(checked) => {
                    setUseBucketImages(checked);
                    setFormData((prev) => ({
                      ...prev,
                      use_bucket_images: checked,
                    }));
                    if (checked) {
                      toast.info(
                        'When using bucket images, the schedule will generate one image for each combination of bucket images.'
                      );
                    }
                  }}
                />
                <Label htmlFor="edit-use-bucket-images">
                  Use bucket images for batch generation
                </Label>
              </div>

              {useBucketImages && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Batch Generation Mode:</strong> When enabled, this
                    schedule will generate one image for each possible
                    combination of images from your bucket. Select bucket images
                    below to use as references.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Image 1 */}
                <div className="space-y-4">
                  <Label>
                    Reference Images Set 1 * (Select multiple for batch
                    generation)
                  </Label>

                  {loadingBucketImages ? (
                    <div className="text-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Loading bucket images...
                      </p>
                    </div>
                  ) : bucketImages.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                      <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-2">
                        No images in bucket
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Upload images to your bucket first to select them here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Selected Images Display */}
                      {selectedBucketImages1.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">
                              Selected Images ({selectedBucketImages1.length})
                            </h4>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => clearAllBucketSelections(1)}
                            >
                              Clear All
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                            {selectedBucketImages1.map((image) => (
                              <div key={image.id} className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden bg-muted border-2 border-primary">
                                  <img
                                    src={image.image_url}
                                    alt={image.filename}
                                    className="w-full h-full object-cover"
                                  />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-80 hover:opacity-100"
                                    onClick={() =>
                                      removeBucketSelection(image, 1)
                                    }
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {image.filename}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Available Images Grid */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Available Images (click to select/deselect)
                        </h4>
                        <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                          {bucketImages.map((image) => {
                            const isSelected = selectedBucketImages1.some(
                              (img) => img.id === image.id
                            );
                            return (
                              <div
                                key={image.id}
                                className={`relative group cursor-pointer ${
                                  isSelected ? 'ring-2 ring-primary' : ''
                                }`}
                                onClick={() =>
                                  handleBucketImageSelect(image, 1)
                                }
                              >
                                <div
                                  className={`aspect-square rounded-lg overflow-hidden bg-muted border transition-colors ${
                                    isSelected
                                      ? 'border-primary border-2'
                                      : 'border-border/50 hover:border-primary'
                                  }`}
                                >
                                  <img
                                    src={image.image_url}
                                    alt={image.filename}
                                    className="w-full h-full object-cover"
                                  />
                                  <div
                                    className={`absolute inset-0 transition-colors flex items-center justify-center ${
                                      isSelected
                                        ? 'bg-primary/20'
                                        : 'bg-black/0 group-hover:bg-black/20'
                                    }`}
                                  >
                                    <div
                                      className={`transition-opacity ${
                                        isSelected
                                          ? 'opacity-100'
                                          : 'opacity-0 group-hover:opacity-100'
                                      }`}
                                    >
                                      {isSelected ? (
                                        <div className="bg-primary rounded-full p-1">
                                          <Check className="h-6 w-6 text-white" />
                                        </div>
                                      ) : (
                                        <Check className="h-8 w-8 text-white" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {image.filename}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Image 2 */}
                <div className="space-y-4">
                  <Label>
                    Reference Images Set 2 * (Select multiple for batch
                    generation)
                  </Label>

                  {loadingBucketImages ? (
                    <div className="text-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Loading bucket images...
                      </p>
                    </div>
                  ) : bucketImages.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                      <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-2">
                        No images in bucket
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Upload images to your bucket first to select them here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Selected Images Display */}
                      {selectedBucketImages2.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">
                              Selected Images ({selectedBucketImages2.length})
                            </h4>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => clearAllBucketSelections(2)}
                            >
                              Clear All
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                            {selectedBucketImages2.map((image) => (
                              <div key={image.id} className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden bg-muted border-2 border-primary">
                                  <img
                                    src={image.image_url}
                                    alt={image.filename}
                                    className="w-full h-full object-cover"
                                  />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-80 hover:opacity-100"
                                    onClick={() =>
                                      removeBucketSelection(image, 2)
                                    }
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {image.filename}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Available Images Grid */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Available Images (click to select/deselect)
                        </h4>
                        <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                          {bucketImages.map((image) => {
                            const isSelected = selectedBucketImages2.some(
                              (img) => img.id === image.id
                            );
                            return (
                              <div
                                key={image.id}
                                className={`relative group cursor-pointer ${
                                  isSelected ? 'ring-2 ring-primary' : ''
                                }`}
                                onClick={() =>
                                  handleBucketImageSelect(image, 2)
                                }
                              >
                                <div
                                  className={`aspect-square rounded-lg overflow-hidden bg-muted border transition-colors ${
                                    isSelected
                                      ? 'border-primary border-2'
                                      : 'border-border/50 hover:border-primary'
                                  }`}
                                >
                                  <img
                                    src={image.image_url}
                                    alt={image.filename}
                                    className="w-full h-full object-cover"
                                  />
                                  <div
                                    className={`absolute inset-0 transition-colors flex items-center justify-center ${
                                      isSelected
                                        ? 'bg-primary/20'
                                        : 'bg-black/0 group-hover:bg-black/20'
                                    }`}
                                  >
                                    <div
                                      className={`transition-opacity ${
                                        isSelected
                                          ? 'opacity-100'
                                          : 'opacity-0 group-hover:opacity-100'
                                      }`}
                                    >
                                      {isSelected ? (
                                        <div className="bg-primary rounded-full p-1">
                                          <Check className="h-6 w-6 text-white" />
                                        </div>
                                      ) : (
                                        <Check className="h-8 w-8 text-white" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {image.filename}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Schedule Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Schedule Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-interval">
                    Generation Interval (minutes)
                  </Label>
                  <Input
                    id="edit-interval"
                    type="number"
                    min="1"
                    value={formData.generation_interval_minutes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        generation_interval_minutes:
                          parseInt(e.target.value) || 60,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-max_images">
                    Max Images to Generate
                  </Label>
                  <Input
                    id="edit-max_images"
                    type="number"
                    min="1"
                    value={formData.max_images_to_generate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        max_images_to_generate: parseInt(e.target.value) || 10,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-duration">Duration (hours)</Label>
                  <Input
                    id="edit-duration"
                    type="number"
                    min="1"
                    value={formData.schedule_duration_hours}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        schedule_duration_hours: parseInt(e.target.value) || 24,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-schedule_enabled"
                  checked={formData.schedule_enabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      schedule_enabled: checked,
                    }))
                  }
                />
                <Label htmlFor="edit-schedule_enabled">Enable schedule</Label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleUpdateSchedule}
                disabled={isSaving}
                className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Schedule
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Schedules */}
      <div className="space-y-4">
        {schedules.length > 0 ? (
          schedules.map((schedule) => (
            <Card key={schedule.id} className="shadow-card border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        schedule.status === 'active'
                          ? 'bg-green-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    <h3 className="text-lg font-semibold">{schedule.name}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                      <span className="text-sm font-medium">
                        {schedule.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                      <Switch
                        checked={schedule.status === 'active'}
                        onCheckedChange={async () => {
                          try {
                            const newStatus = !(schedule.status === 'active');
                            const { error } = await supabase
                              .from('schedules')
                              .update({
                                status: newStatus ? 'active' : 'paused',
                              })
                              .eq('id', schedule.id);

                            if (error) throw error;

                            await loadSchedules();
                            toast.success(
                              newStatus
                                ? 'Schedule activated'
                                : 'Schedule paused'
                            );
                          } catch (error: any) {
                            toast.error(
                              error.message || 'Failed to update schedule'
                            );
                          }
                        }}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/project/${project.id}/output2`)}
                      className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      View Images
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const { data: session } =
                            await supabase.auth.getSession();
                          if (!session.session) {
                            toast.error('Please sign in to generate images');
                            return;
                          }

                          toast.info('Starting generation...');

                          const { data, error } =
                            await supabase.functions.invoke(
                              'generate-multi-image-fixed',
                              {
                                body: {
                                  scheduleId: schedule.id,
                                },
                              }
                            );

                          if (error) {
                            console.error('Generation error:', error);
                            toast.error(
                              error.message || 'Failed to generate image'
                            );
                          } else {
                            toast.success('Image generated successfully!');
                            await loadSchedules(); // Refresh to show updated stats
                          }
                        } catch (error: any) {
                          toast.error(
                            error.message || 'Failed to generate image'
                          );
                        }
                      }}
                    >
                      <Zap className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditSchedule(schedule)}
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
                            `Are you sure you want to delete "${schedule.name}"? All generated images from this schedule will also be deleted.`
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
                          await loadSchedules();
                        } catch (error: any) {
                          toast.error(
                            error.message || 'Failed to delete schedule'
                          );
                        }
                      }}
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
                    <Images className="h-3 w-3 inline mr-1" />
                    Max: {schedule.max_images_to_generate}
                  </div>
                  <div>
                    <Zap className="h-3 w-3 inline mr-1" />
                    Duration: {schedule.schedule_duration_hours}h
                  </div>
                  <div>
                    <Activity className="h-3 w-3 inline mr-1" />
                    Multi-Image
                  </div>
                </div>

                {/* Image Stats */}
                <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">Generation Progress</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/project/${project.id}/output2`)}
                      className="text-xs h-6 px-2"
                    >
                      View Gallery →
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {schedule.completed_images || 0}
                      </div>
                      <div className="text-muted-foreground">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">
                        {schedule.failed_images || 0}
                      </div>
                      <div className="text-muted-foreground">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">
                        {schedule.total_images || 0}
                      </div>
                      <div className="text-muted-foreground">Total</div>
                    </div>
                  </div>
                  {schedule.status !== 'active' &&
                    schedule.total_images &&
                    schedule.total_images >=
                      schedule.max_images_to_generate && (
                      <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                        ⏸️ Auto-paused: Reached max limit (
                        {schedule.max_images_to_generate} images).
                        <button
                          onClick={() => handleEditSchedule(schedule)}
                          className="ml-1 underline hover:no-underline"
                        >
                          Increase limit to continue
                        </button>
                      </div>
                    )}
                  {schedule.status !== 'active' &&
                    (!schedule.total_images ||
                      schedule.total_images <
                        schedule.max_images_to_generate) && (
                      <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                        ⏸️ Schedule paused manually. Toggle switch to resume
                        generation.
                      </div>
                    )}
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
                  <Badge
                    variant={
                      schedule.status === 'active' ? 'default' : 'secondary'
                    }
                  >
                    {schedule.status === 'active' ? 'Active' : 'Paused'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-12">
            <Shirt className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No Print on Shirt schedules yet
            </h3>
            <p className="text-muted-foreground mb-4">
              Create your first multi-image combination schedule to get started
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Schedule
            </Button>
          </div>
        )}
      </div>

      {/* Hidden file inputs for bucket upload */}
      <input
        ref={fileInputRef1}
        type="file"
        accept="image/*"
        onChange={(e) => handleBucketImageUpload(e, 1)}
        style={{ display: 'none' }}
      />
      <input
        ref={fileInputRef2}
        type="file"
        accept="image/*"
        onChange={(e) => handleBucketImageUpload(e, 2)}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default PrintOnShirtView;
