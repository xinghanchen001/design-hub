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

interface BucketImage {
  id: string;
  filename: string;
  storage_path: string;
  image_url: string;
  file_size: number;
  mime_type: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

interface PrintOnShirtSchedule {
  id: string;
  project_id: string; // Add project_id as required field
  name: string;
  description: string | null;
  prompt: string;
  input_image_1_url: string;
  input_image_2_url: string;
  aspect_ratio: string;
  schedule_enabled: boolean;
  schedule_duration_hours: number;
  max_images_to_generate: number;
  generation_interval_minutes: number;
  last_generation_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Add bucket support
  use_bucket_images?: boolean;
  bucket_image_1_id?: string;
  bucket_image_2_id?: string;
  // Add stats
  total_images?: number;
  completed_images?: number;
  failed_images?: number;
}

const PrintOnShirtView = () => {
  const navigate = useNavigate();
  const { project, fetchProjectData } = useOutletContext<{
    project: Project;
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

  // Bucket state
  const [bucketImages, setBucketImages] = useState<BucketImage[]>([]);
  const [loadingBucketImages, setLoadingBucketImages] = useState(false);
  const [selectedBucketImage1, setSelectedBucketImage1] =
    useState<BucketImage | null>(null);
  const [selectedBucketImage2, setSelectedBucketImage2] =
    useState<BucketImage | null>(null);
  const [imageMode1, setImageMode1] = useState<'upload' | 'bucket'>('upload');
  const [imageMode2, setImageMode2] = useState<'upload' | 'bucket'>('upload');
  const [useBucketImages, setUseBucketImages] = useState(false);

  // Form state
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
    use_bucket_images: false,
    bucket_image_1_id: '',
    bucket_image_2_id: '',
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
      // Fetch schedules with image statistics
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('print_on_shirt_schedules')
        .select(
          `
          *,
          print_on_shirt_images!schedule_id(
            id,
            status
          )
        `
        )
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (schedulesError) throw schedulesError;

      // Transform data to include statistics
      const schedulesWithStats =
        schedulesData?.map((schedule) => {
          const images = schedule.print_on_shirt_images || [];
          return {
            ...schedule,
            total_images: images.length,
            completed_images: images.filter(
              (img: any) => img.status === 'completed'
            ).length,
            failed_images: images.filter((img: any) => img.status === 'failed')
              .length,
            print_on_shirt_images: undefined, // Remove the nested data
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
      const { data, error } = await supabase
        .from('project_bucket_images')
        .select('*')
        .eq('project_id', project.id)
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
      setSelectedBucketImage1(image);
      setFormData((prev) => ({
        ...prev,
        bucket_image_1_id: image.id,
        input_image_1_url: image.image_url,
      }));
    } else {
      setSelectedBucketImage2(image);
      setFormData((prev) => ({
        ...prev,
        bucket_image_2_id: image.id,
        input_image_2_url: image.image_url,
      }));
    }
  };

  const removeBucketSelection = (imageNumber: 1 | 2) => {
    if (imageNumber === 1) {
      setSelectedBucketImage1(null);
      setFormData((prev) => ({
        ...prev,
        bucket_image_1_id: '',
        input_image_1_url: '',
      }));
    } else {
      setSelectedBucketImage2(null);
      setFormData((prev) => ({
        ...prev,
        bucket_image_2_id: '',
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

    if (!formData.input_image_1_url || !formData.input_image_2_url) {
      toast.error('Please upload both reference images');
      return;
    }

    setIsSaving(true);
    try {
      const { data: newSchedule, error: insertError } = await supabase
        .from('print_on_shirt_schedules')
        .insert({
          user_id: user?.id,
          project_id: project.id, // Add project_id to link schedule to project
          name: formData.name,
          description: formData.description || null,
          prompt: formData.prompt,
          input_image_1_url: formData.input_image_1_url,
          input_image_2_url: formData.input_image_2_url,
          aspect_ratio: formData.aspect_ratio,
          schedule_enabled: formData.schedule_enabled,
          schedule_duration_hours: formData.schedule_duration_hours,
          max_images_to_generate: formData.max_images_to_generate,
          generation_interval_minutes: formData.generation_interval_minutes,
          use_bucket_images: formData.use_bucket_images,
          bucket_image_1_id: formData.bucket_image_1_id || null,
          bucket_image_2_id: formData.bucket_image_2_id || null,
        })
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
        use_bucket_images: false,
        bucket_image_1_id: '',
        bucket_image_2_id: '',
      });

      // Reset bucket state
      setSelectedBucketImage1(null);
      setSelectedBucketImage2(null);
      setImageMode1('upload');
      setImageMode2('upload');
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
    setFormData({
      name: schedule.name,
      description: schedule.description || '',
      prompt: schedule.prompt,
      input_image_1_url: schedule.input_image_1_url,
      input_image_2_url: schedule.input_image_2_url,
      aspect_ratio: schedule.aspect_ratio,
      schedule_enabled: schedule.schedule_enabled,
      schedule_duration_hours: schedule.schedule_duration_hours,
      max_images_to_generate: schedule.max_images_to_generate,
      generation_interval_minutes: schedule.generation_interval_minutes,
      use_bucket_images: schedule.use_bucket_images || false,
      bucket_image_1_id: schedule.bucket_image_1_id || '',
      bucket_image_2_id: schedule.bucket_image_2_id || '',
    });

    // Set bucket images if they exist
    if (schedule.use_bucket_images) {
      setUseBucketImages(true);
      if (schedule.bucket_image_1_id) {
        const bucketImage1 = bucketImages.find(
          (img) => img.id === schedule.bucket_image_1_id
        );
        if (bucketImage1) {
          setSelectedBucketImage1(bucketImage1);
          setImageMode1('bucket');
        }
      }
      if (schedule.bucket_image_2_id) {
        const bucketImage2 = bucketImages.find(
          (img) => img.id === schedule.bucket_image_2_id
        );
        if (bucketImage2) {
          setSelectedBucketImage2(bucketImage2);
          setImageMode2('bucket');
        }
      }
    }

    setIsEditing(true);
  };

  const handleUpdateSchedule = async () => {
    if (!editingSchedule) return;

    if (!formData.name.trim() || !formData.prompt.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.input_image_1_url || !formData.input_image_2_url) {
      toast.error('Please upload both reference images');
      return;
    }

    setIsSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('print_on_shirt_schedules')
        .update({
          project_id: project.id, // Ensure project_id is included in updates
          name: formData.name,
          description: formData.description || null,
          prompt: formData.prompt,
          input_image_1_url: formData.input_image_1_url,
          input_image_2_url: formData.input_image_2_url,
          aspect_ratio: formData.aspect_ratio,
          schedule_enabled: formData.schedule_enabled,
          schedule_duration_hours: formData.schedule_duration_hours,
          max_images_to_generate: formData.max_images_to_generate,
          generation_interval_minutes: formData.generation_interval_minutes,
          use_bucket_images: formData.use_bucket_images,
          bucket_image_1_id: formData.bucket_image_1_id || null,
          bucket_image_2_id: formData.bucket_image_2_id || null,
        })
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
        use_bucket_images: false,
        bucket_image_1_id: '',
        bucket_image_2_id: '',
      });

      // Reset bucket state
      setSelectedBucketImage1(null);
      setSelectedBucketImage2(null);
      setImageMode1('upload');
      setImageMode2('upload');
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
      use_bucket_images: false,
      bucket_image_1_id: '',
      bucket_image_2_id: '',
    });

    // Reset bucket state
    setSelectedBucketImage1(null);
    setSelectedBucketImage2(null);
    setImageMode1('upload');
    setImageMode2('upload');
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

            {/* Image Upload Section */}
            <div className="space-y-6">
              {/* Use Bucket Images Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="use-bucket-images"
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
                <Label htmlFor="use-bucket-images">
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
                  <Label>Reference Image 1 *</Label>
                  <Tabs
                    value={imageMode1}
                    onValueChange={(value) =>
                      setImageMode1(value as 'upload' | 'bucket')
                    }
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="upload">Upload</TabsTrigger>
                      <TabsTrigger value="bucket">From Bucket</TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="space-y-4">
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                        {formData.input_image_1_url &&
                        imageMode1 === 'upload' &&
                        !selectedBucketImage1 ? (
                          <div className="space-y-4">
                            <img
                              src={formData.input_image_1_url}
                              alt="Reference 1"
                              className="max-w-full h-32 mx-auto object-cover rounded-lg"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  input_image_1_url: '',
                                }))
                              }
                            >
                              <X className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">
                                Upload first image
                              </p>
                              <p className="text-xs text-muted-foreground">
                                JPG, PNG, GIF, or WebP
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement)
                                    .files?.[0];
                                  if (file) handleImageUpload(file, 1);
                                };
                                input.click();
                              }}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Choose File
                            </Button>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="bucket" className="space-y-4">
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
                            Upload images to your bucket first to select them
                            here.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedBucketImage1 && (
                            <div className="space-y-4">
                              <div className="relative">
                                <img
                                  src={selectedBucketImage1.image_url}
                                  alt={selectedBucketImage1.filename}
                                  className="w-full max-h-32 object-contain rounded-lg border"
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="absolute top-2 right-2"
                                  onClick={() => removeBucketSelection(1)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <ImageIcon className="h-4 w-4" />
                                <span>{selectedBucketImage1.filename}</span>
                                <span>
                                  (
                                  {formatFileSize(
                                    selectedBucketImage1.file_size
                                  )}
                                  )
                                </span>
                              </div>
                            </div>
                          )}

                          {!selectedBucketImage1 && (
                            <div className="grid grid-cols-2 gap-4 max-h-64 overflow-y-auto">
                              {bucketImages.map((image) => (
                                <div
                                  key={image.id}
                                  className="relative group cursor-pointer"
                                  onClick={() =>
                                    handleBucketImageSelect(image, 1)
                                  }
                                >
                                  <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-border/50 hover:border-primary transition-colors">
                                    <img
                                      src={image.image_url}
                                      alt={image.filename}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Check className="h-8 w-8 text-white" />
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 truncate">
                                    {image.filename}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Image 2 */}
                <div className="space-y-4">
                  <Label>Reference Image 2 *</Label>
                  <Tabs
                    value={imageMode2}
                    onValueChange={(value) =>
                      setImageMode2(value as 'upload' | 'bucket')
                    }
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="upload">Upload</TabsTrigger>
                      <TabsTrigger value="bucket">From Bucket</TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="space-y-4">
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                        {formData.input_image_2_url &&
                        imageMode2 === 'upload' &&
                        !selectedBucketImage2 ? (
                          <div className="space-y-4">
                            <img
                              src={formData.input_image_2_url}
                              alt="Reference 2"
                              className="max-w-full h-32 mx-auto object-cover rounded-lg"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  input_image_2_url: '',
                                }))
                              }
                            >
                              <X className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">
                                Upload second image
                              </p>
                              <p className="text-xs text-muted-foreground">
                                JPG, PNG, GIF, or WebP
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement)
                                    .files?.[0];
                                  if (file) handleImageUpload(file, 2);
                                };
                                input.click();
                              }}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Choose File
                            </Button>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="bucket" className="space-y-4">
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
                            Upload images to your bucket first to select them
                            here.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedBucketImage2 && (
                            <div className="space-y-4">
                              <div className="relative">
                                <img
                                  src={selectedBucketImage2.image_url}
                                  alt={selectedBucketImage2.filename}
                                  className="w-full max-h-32 object-contain rounded-lg border"
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="absolute top-2 right-2"
                                  onClick={() => removeBucketSelection(2)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <ImageIcon className="h-4 w-4" />
                                <span>{selectedBucketImage2.filename}</span>
                                <span>
                                  (
                                  {formatFileSize(
                                    selectedBucketImage2.file_size
                                  )}
                                  )
                                </span>
                              </div>
                            </div>
                          )}

                          {!selectedBucketImage2 && (
                            <div className="grid grid-cols-2 gap-4 max-h-64 overflow-y-auto">
                              {bucketImages.map((image) => (
                                <div
                                  key={image.id}
                                  className="relative group cursor-pointer"
                                  onClick={() =>
                                    handleBucketImageSelect(image, 2)
                                  }
                                >
                                  <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-border/50 hover:border-primary transition-colors">
                                    <img
                                      src={image.image_url}
                                      alt={image.filename}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Check className="h-8 w-8 text-white" />
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 truncate">
                                    {image.filename}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
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
                      toast.info('When using bucket images, the schedule will generate one image for each combination of bucket images.');
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
                    <strong>Batch Generation Mode:</strong> When enabled, this schedule will generate one image for each possible combination of images from your bucket. Select bucket images below to use as references.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Image 1 */}
                <div className="space-y-4">
                  <Label>Reference Image 1 *</Label>
                  <Tabs value={imageMode1} onValueChange={(value) => setImageMode1(value as 'upload' | 'bucket')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="upload">Upload</TabsTrigger>
                      <TabsTrigger value="bucket">From Bucket</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="upload" className="space-y-4">
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                        {formData.input_image_1_url && imageMode1 === 'upload' && !selectedBucketImage1 ? (
                          <div className="space-y-4">
                            <img
                              src={formData.input_image_1_url}
                              alt="Reference 1"
                              className="max-w-full h-32 mx-auto object-cover rounded-lg"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  input_image_1_url: '',
                                }))
                              }
                            >
                              <X className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Upload first image</p>
                              <p className="text-xs text-muted-foreground">JPG, PNG, GIF, or WebP</p>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) handleImageUpload(file, 1);
                                };
                                input.click();
                              }}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Choose File
                            </Button>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="bucket" className="space-y-4">
                      {loadingBucketImages ? (
                        <div className="text-center py-8">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                          <p className="text-muted-foreground">Loading bucket images...</p>
                        </div>
                      ) : bucketImages.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                          <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground mb-2">No images in bucket</p>
                          <p className="text-sm text-muted-foreground">
                            Upload images to your bucket first to select them here.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedBucketImage1 && (
                            <div className="space-y-4">
                              <div className="relative">
                                <img
                                  src={selectedBucketImage1.image_url}
                                  alt={selectedBucketImage1.filename}
                                  className="w-full max-h-32 object-contain rounded-lg border"
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="absolute top-2 right-2"
                                  onClick={() => removeBucketSelection(1)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <ImageIcon className="h-4 w-4" />
                                <span>{selectedBucketImage1.filename}</span>
                                <span>({formatFileSize(selectedBucketImage1.file_size)})</span>
                              </div>
                            </div>
                          )}
                          
                          {!selectedBucketImage1 && (
                            <div className="grid grid-cols-2 gap-4 max-h-64 overflow-y-auto">
                              {bucketImages.map((image) => (
                                <div 
                                  key={image.id}
                                  className="relative group cursor-pointer"
                                  onClick={() => handleBucketImageSelect(image, 1)}
                                >
                                  <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-border/50 hover:border-primary transition-colors">
                                    <img
                                      src={image.image_url}
                                      alt={image.filename}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Check className="h-8 w-8 text-white" />
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 truncate">
                                    {image.filename}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Image 2 */}
                <div className="space-y-4">
                  <Label>Reference Image 2 *</Label>
                  <Tabs value={imageMode2} onValueChange={(value) => setImageMode2(value as 'upload' | 'bucket')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="upload">Upload</TabsTrigger>
                      <TabsTrigger value="bucket">From Bucket</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="upload" className="space-y-4">
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                        {formData.input_image_2_url && imageMode2 === 'upload' && !selectedBucketImage2 ? (
                          <div className="space-y-4">
                            <img
                              src={formData.input_image_2_url}
                              alt="Reference 2"
                              className="max-w-full h-32 mx-auto object-cover rounded-lg"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  input_image_2_url: '',
                                }))
                              }
                            >
                              <X className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Upload second image</p>
                              <p className="text-xs text-muted-foreground">JPG, PNG, GIF, or WebP</p>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) handleImageUpload(file, 2);
                                };
                                input.click();
                              }}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Choose File
                            </Button>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="bucket" className="space-y-4">
                      {loadingBucketImages ? (
                        <div className="text-center py-8">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                          <p className="text-muted-foreground">Loading bucket images...</p>
                        </div>
                      ) : bucketImages.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                          <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground mb-2">No images in bucket</p>
                          <p className="text-sm text-muted-foreground">
                            Upload images to your bucket first to select them here.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedBucketImage2 && (
                            <div className="space-y-4">
                              <div className="relative">
                                <img
                                  src={selectedBucketImage2.image_url}
                                  alt={selectedBucketImage2.filename}
                                  className="w-full max-h-32 object-contain rounded-lg border"
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="absolute top-2 right-2"
                                  onClick={() => removeBucketSelection(2)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <ImageIcon className="h-4 w-4" />
                                <span>{selectedBucketImage2.filename}</span>
                                <span>({formatFileSize(selectedBucketImage2.file_size)})</span>
                              </div>
                            </div>
                          )}
                          
                          {!selectedBucketImage2 && (
                            <div className="grid grid-cols-2 gap-4 max-h-64 overflow-y-auto">
                              {bucketImages.map((image) => (
                                <div 
                                  key={image.id}
                                  className="relative group cursor-pointer"
                                  onClick={() => handleBucketImageSelect(image, 2)}
                                >
                                  <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-border/50 hover:border-primary transition-colors">
                                    <img
                                      src={image.image_url}
                                      alt={image.filename}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Check className="h-8 w-8 text-white" />
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 truncate">
                                    {image.filename}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
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
                        schedule.schedule_enabled && schedule.is_active
                          ? 'bg-green-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    <h3 className="text-lg font-semibold">{schedule.name}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                      <span className="text-sm font-medium">
                        {schedule.schedule_enabled && schedule.is_active
                          ? 'Active'
                          : 'Paused'}
                      </span>
                      <Switch
                        checked={
                          schedule.schedule_enabled && schedule.is_active
                        }
                        onCheckedChange={async () => {
                          try {
                            const newStatus = !(
                              schedule.schedule_enabled && schedule.is_active
                            );
                            const { error } = await supabase
                              .from('print_on_shirt_schedules')
                              .update({
                                schedule_enabled: newStatus,
                                is_active: newStatus,
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
                            .from('print_on_shirt_schedules')
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
                  {!schedule.schedule_enabled &&
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
                  {!schedule.schedule_enabled &&
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
                      schedule.schedule_enabled && schedule.is_active
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {schedule.schedule_enabled && schedule.is_active
                      ? 'Active'
                      : 'Paused'}
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
    </div>
  );
};

export default PrintOnShirtView;
