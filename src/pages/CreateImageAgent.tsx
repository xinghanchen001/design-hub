import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Image, ArrowLeft, X, Folder } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type BucketImage = {
  id: string;
  filename: string;
  image_url: string;
  created_at: string;
};

const CreateImageAgent = () => {
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bucketImages, setBucketImages] = useState<BucketImage[]>([]);
  const [loadingBucketImages, setLoadingBucketImages] = useState(false);
  const [selectedBucketImage, setSelectedBucketImage] =
    useState<BucketImage | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: '',
    referenceImage: null as File | null,
    maxImages: 10,
    scheduleDuration: 1,
    generationInterval: 1,
    aspectRatio: 'match_input_image', // Add aspect ratio to form data
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get project ID from query parameters
  const projectId = searchParams.get('projectId');

  // Load bucket images on component mount
  useEffect(() => {
    if (projectId) {
      fetchBucketImages();
    }
  }, [projectId]);

  const fetchBucketImages = async () => {
    if (!user || !projectId) return;

    setLoadingBucketImages(true);
    try {
      // First get the image-generation tasks for this project
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', projectId)
        .eq('task_type', 'image-generation');

      if (tasksError) throw tasksError;

      const taskIds = tasks?.map((task) => task.id) || [];

      if (taskIds.length === 0) {
        setBucketImages([]);
        setLoadingBucketImages(false);
        return;
      }

      // Now get bucket images for these tasks
      const { data, error } = await supabase
        .from('project_bucket_images')
        .select('id, filename, image_url, created_at')
        .in('task_id', taskIds)
        .eq('task_type', 'image-generation')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBucketImages(data || []);
    } catch (error) {
      console.error('Error fetching bucket images:', error);
      toast.error('Failed to load bucket images');
    } finally {
      setLoadingBucketImages(false);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleBucketImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user || !projectId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image file must be smaller than 10MB');
      return;
    }

    setUploading(true);
    try {
      // First get or create an image-generation task for this project
      let { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', projectId)
        .eq('task_type', 'image-generation')
        .limit(1);

      if (tasksError) throw tasksError;

      let taskId: string;
      if (tasks && tasks.length > 0) {
        taskId = tasks[0].id;
      } else {
        // Create a new image-generation task if none exists
        const { data: newTask, error: createTaskError } = await supabase
          .from('tasks')
          .insert([
            {
              name: `Image Generation - ${new Date().toLocaleDateString()}`,
              task_type: 'image-generation',
              project_id: projectId,
              user_id: user.id,
              status: 'paused',
              settings: {},
            },
          ])
          .select('id')
          .single();

        if (createTaskError) throw createTaskError;
        taskId = newTask.id;
      }

      // Upload to storage bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `bucket_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;
      const filePath = `${user.id}/bucket/${projectId}/image-generation/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-bucket-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-bucket-images')
        .getPublicUrl(filePath);

      // Save to database with correct schema
      const { data: dbData, error: dbError } = await supabase
        .from('project_bucket_images')
        .insert([
          {
            task_id: taskId,
            user_id: user.id,
            task_type: 'image-generation',
            filename: file.name,
            storage_path: filePath,
            image_url: urlData.publicUrl,
            file_size: file.size,
            mime_type: file.type,
            metadata: {
              taskType: 'image-generation',
              uploadedAt: new Date().toISOString(),
              originalName: file.name,
            },
          },
        ])
        .select()
        .single();

      if (dbError) throw dbError;

      toast.success('Image uploaded successfully!');

      // Refresh bucket images
      await fetchBucketImages();

      // Auto-select the uploaded image
      setSelectedBucketImage(dbData);
      setSelectedFile(null); // Clear direct file selection

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleBucketImageSelect = (image: BucketImage) => {
    setSelectedBucketImage(image);
    setSelectedFile(null); // Clear direct file selection
    setFormData({ ...formData, referenceImage: null });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image file must be smaller than 10MB');
        return;
      }

      setSelectedFile(file);
      setSelectedBucketImage(null); // Clear bucket selection
      setFormData({ ...formData, referenceImage: file });
    }
  };

  const uploadReferenceImage = async (
    file: File,
    projectId: string
  ): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user?.id}/reference/${projectId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-bucket-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('user-bucket-images')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading reference image:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name.trim()) {
      toast.error('Please enter an agent name');
      return;
    }

    if (!formData.prompt.trim()) {
      toast.error('Please enter a generation prompt');
      return;
    }

    setLoading(true);
    try {
      let targetProjectId = projectId;

      // If no project ID provided, create a new project
      if (!targetProjectId) {
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
        targetProjectId = project.id;
      }

      // Handle reference image - either from direct upload or bucket selection
      let referenceImageUrl = null;
      if (selectedBucketImage) {
        referenceImageUrl = selectedBucketImage.image_url;
      } else if (formData.referenceImage) {
        setUploading(true);
        referenceImageUrl = await uploadReferenceImage(
          formData.referenceImage,
          targetProjectId
        );
        setUploading(false);
      }

      // Create the image-generation task
      const taskData = {
        name: `${formData.name} - Image Generation`,
        description: formData.description.trim() || null,
        task_type: 'image-generation',
        project_id: targetProjectId,
        user_id: user.id,
        status: 'paused', // Start paused
        settings: {
          prompt: formData.prompt.trim(),
          reference_image_url: referenceImageUrl,
          max_images_to_generate: formData.maxImages,
          generation_interval_minutes: formData.generationInterval,
          schedule_duration_hours: formData.scheduleDuration,
          aspect_ratio: formData.aspectRatio, // Add aspect ratio to task settings
        },
      };

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();

      if (taskError) throw taskError;

      // Create the schedule
      const scheduleData = {
        name: `${formData.name} Schedule`,
        description: `Automated schedule for ${formData.name}`,
        task_id: task.id,
        user_id: user.id,
        task_type: 'image-generation',
        prompt: formData.prompt.trim(),
        status: 'paused', // Start paused, user can activate later
        schedule_config: {
          generation_interval_minutes: formData.generationInterval,
          schedule_duration_hours: formData.scheduleDuration,
        },
        generation_settings: {
          max_images_to_generate: formData.maxImages,
          reference_image_url: referenceImageUrl,
          aspect_ratio: formData.aspectRatio,
        },
        bucket_settings: {
          auto_cleanup: true,
          max_bucket_size: 1000,
        },
      };

      const { error: scheduleError } = await supabase
        .from('schedules')
        .insert([scheduleData]);

      if (scheduleError) throw scheduleError;

      const successMessage = projectId
        ? 'AI Image Agent added to project successfully!'
        : 'AI Image Agent created successfully!';
      toast.success(successMessage);

      // Navigate to the project dashboard
      navigate(`/project/${targetProjectId}/dashboard`);
    } catch (error: any) {
      console.error('AI Agent creation error:', error);
      toast.error(error.message || 'Failed to create AI Agent');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  // Get the correct back navigation path
  const getBackPath = () => {
    if (projectId) {
      return `/project/${projectId}/dashboard`;
    }
    return '/';
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(getBackPath())}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Set Up Your{' '}
                <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  AI Image Agent
                </span>
              </h1>
              <p className="text-muted-foreground">
                Configure your automated image generation agent with custom
                prompts, schedules, and limits.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <Card className="shadow-card border-border/50">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Agent Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Product Photography Agent"
                    required
                  />
                </div>
              </CardContent>
            </Card>

            {/* Prompt Configuration */}
            <Card className="shadow-card border-border/50">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="prompt">Generation Prompt *</Label>
                  <Textarea
                    id="prompt"
                    value={formData.prompt}
                    onChange={(e) =>
                      setFormData({ ...formData, prompt: e.target.value })
                    }
                    placeholder="A professional product photo of a [product] on a clean white background, studio lighting, high quality, detailed..."
                    rows={4}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: Use detailed descriptions for better results. You can
                    upload a reference image below.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aspect_ratio">Aspect Ratio</Label>
                  <Select
                    value={formData.aspectRatio}
                    onValueChange={(value) =>
                      setFormData({ ...formData, aspectRatio: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select aspect ratio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="match_input_image">
                        Match Input Image
                      </SelectItem>
                      <SelectItem value="1:1">1:1 (Square)</SelectItem>
                      <SelectItem value="16:9">16:9 (Wide)</SelectItem>
                      <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                      <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                      <SelectItem value="3:4">3:4 (Portrait)</SelectItem>
                      <SelectItem value="3:2">3:2 (Landscape)</SelectItem>
                      <SelectItem value="2:3">2:3 (Portrait)</SelectItem>
                      <SelectItem value="5:4">5:4 (Nearly Square)</SelectItem>
                      <SelectItem value="4:5">4:5 (Portrait)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Control the dimensions of generated images. "Match Input
                    Image" uses the reference image's aspect ratio.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Reference Image */}
            <Card className="shadow-card border-border/50">
              <CardHeader>
                <CardTitle className="text-2xl">
                  Reference Image (Optional)
                </CardTitle>
                <CardDescription>
                  Upload a reference image to guide the AI generation, or select
                  from your bucket.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Selection Display */}
                {(selectedFile || selectedBucketImage) && (
                  <div className="p-4 border border-primary/20 rounded-lg bg-primary/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border">
                          {selectedBucketImage ? (
                            <img
                              src={selectedBucketImage.image_url}
                              alt={selectedBucketImage.filename}
                              className="w-full h-full object-cover"
                            />
                          ) : selectedFile ? (
                            <img
                              src={URL.createObjectURL(selectedFile)}
                              alt={selectedFile.name}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            Selected Reference Image
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {selectedBucketImage?.filename ||
                              selectedFile?.name}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedBucketImage(null);
                          setSelectedFile(null);
                          setFormData({ ...formData, referenceImage: null });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Upload and Selection Area */}
                <div className="space-y-4">
                  {/* Bucket Image Selection */}
                  {projectId && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">
                        Or Select from Bucket Images
                      </h4>
                      {loadingBucketImages ? (
                        <div className="text-center py-8">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            Loading bucket images...
                          </p>
                        </div>
                      ) : bucketImages.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                          <Folder className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground text-sm">
                            No images in bucket
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Upload images to your bucket first to select them
                            here.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                          {/* Upload trigger card */}
                          <div
                            className="aspect-square border-2 border-dashed border-muted-foreground/50 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                            onClick={triggerFileUpload}
                          >
                            <Upload className="h-5 w-5 text-muted-foreground group-hover:text-primary mb-1" />
                            <p className="text-xs text-muted-foreground group-hover:text-primary text-center">
                              Import
                            </p>
                            <p className="text-xs text-muted-foreground group-hover:text-primary text-center">
                              from local
                            </p>
                          </div>

                          {/* Bucket images */}
                          {bucketImages.map((image) => {
                            const isSelected =
                              selectedBucketImage?.id === image.id;
                            return (
                              <div
                                key={image.id}
                                className={`relative group cursor-pointer ${
                                  isSelected ? 'ring-2 ring-primary' : ''
                                }`}
                                onClick={() => handleBucketImageSelect(image)}
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
                                    <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                                      ✓
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Hidden file input for bucket upload */}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleBucketImageUpload}
                />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <strong>Tips for reference images:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Use high-quality images for better results</li>
                    <li>
                      The AI will maintain similar style, composition, or colors
                    </li>
                    <li>Works great for style transfer and object editing</li>
                    <li>
                      You can edit or enhance the reference image with text
                      prompts
                    </li>
                    <li>
                      After creating your project, you can upload multiple
                      images to your project's bucket for batch generation
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Generation Limits */}
            <Card className="shadow-card border-border/50">
              <CardHeader>
                <CardTitle className="text-2xl">Generation Limits</CardTitle>
                <CardDescription>
                  Set limits to control costs and usage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max_images">Maximum Images</Label>
                    <Input
                      id="max_images"
                      type="number"
                      min="1"
                      max="1000"
                      value={formData.maxImages}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxImages: parseInt(e.target.value) || 100,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule_duration">
                      Schedule Duration (hours)
                    </Label>
                    <Select
                      value={formData.scheduleDuration.toString()}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          scheduleDuration: parseInt(value),
                        })
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
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interval">
                    Generation Interval (minutes)
                  </Label>
                  <Select
                    value={formData.generationInterval.toString()}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        generationInterval: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Every 1 minute</SelectItem>
                      <SelectItem value="5">Every 5 minutes</SelectItem>
                      <SelectItem value="10">Every 10 minutes</SelectItem>
                      <SelectItem value="15">Every 15 minutes</SelectItem>
                      <SelectItem value="30">Every 30 minutes</SelectItem>
                      <SelectItem value="60">Every hour</SelectItem>
                      <SelectItem value="120">Every 2 hours</SelectItem>
                      <SelectItem value="360">Every 6 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(getBackPath())}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  loading ||
                  uploading ||
                  !formData.name.trim() ||
                  !formData.prompt.trim()
                }
                className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              >
                {loading || uploading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {uploading ? 'Uploading...' : 'Creating AI Agent'}
                  </div>
                ) : (
                  'Create AI Agent'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateImageAgent;
