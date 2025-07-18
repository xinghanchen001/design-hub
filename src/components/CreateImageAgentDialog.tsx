import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
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
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Upload, X } from 'lucide-react';

interface BucketImage {
  id: string;
  filename: string;
  image_url: string;
  created_at: string;
}

interface CreateImageAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
}

const aspectRatios = [
  { value: 'match_input_image', label: 'Match Input Image' },
  { value: '1:1', label: '1:1 (Square)' },
  { value: '16:9', label: '16:9 (Wide)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '4:3', label: '4:3 (Standard)' },
  { value: '3:4', label: '3:4 (Portrait)' },
  { value: '3:2', label: '3:2 (Landscape)' },
  { value: '2:3', label: '2:3 (Portrait)' },
  { value: '5:4', label: '5:4 (Nearly Square)' },
  { value: '4:5', label: '4:5 (Portrait)' },
];

const CreateImageAgentDialog: React.FC<CreateImageAgentDialogProps> = ({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bucketImages, setBucketImages] = useState<BucketImage[]>([]);
  const [loadingBucketImages, setLoadingBucketImages] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
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
    aspectRatio: 'match_input_image',
  });

  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load tasks and bucket images when dialog opens
  useEffect(() => {
    if (open && projectId) {
      fetchTasks();
    }
  }, [open, projectId]);

  // Fetch bucket images when tasks are loaded
  useEffect(() => {
    if (tasks.length > 0) {
      fetchBucketImages();
    }
  }, [tasks]);

  const fetchTasks = async () => {
    if (!user || !projectId) return;

    try {
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('project_id', projectId);

      if (error) throw error;
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load project tasks');
    }
  };

  const fetchBucketImages = async () => {
    if (!user || !projectId || !tasks?.length) return;

    setLoadingBucketImages(true);
    try {
      // Get task IDs for image-generation tasks in this project
      const imageGenerationTasks = tasks.filter(
        (task) => task.task_type === 'image-generation'
      );
      const taskIds = imageGenerationTasks.map((task) => task.id);

      if (taskIds.length === 0) {
        setBucketImages([]);
        setLoadingBucketImages(false);
        return;
      }

      const { data: images, error } = await supabase
        .from('project_bucket_images')
        .select('*')
        .in('task_id', taskIds)
        .eq('user_id', user.id)
        .eq('task_type', 'image-generation')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBucketImages(images || []);
    } catch (error) {
      console.error('Error fetching bucket images:', error);
      toast.error('Failed to load bucket images');
    } finally {
      setLoadingBucketImages(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !projectId) return;

    setLoading(true);
    try {
      // Check if task already exists
      const { data: existingTasks, error: taskCheckError } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', projectId)
        .eq('task_type', 'image-generation')
        .limit(1);

      if (taskCheckError) throw taskCheckError;

      let targetTaskId = existingTasks?.[0]?.id;

      // Create task if it doesn't exist
      if (!targetTaskId) {
        const { data: newTask, error: taskError } = await supabase
          .from('tasks')
          .insert([
            {
              project_id: projectId,
              user_id: user.id,
              name: formData.name,
              task_type: 'image-generation',
              prompt: formData.prompt,
            },
          ])
          .select()
          .single();

        if (taskError) throw taskError;
        targetTaskId = newTask.id;
      }

      // Handle file upload
      let referenceImageUrl = '';
      if (selectedFile) {
        setUploading(true);
        const timestamp = Date.now();
        const fileName = `bucket_${timestamp}_0.${selectedFile.name
          .split('.')
          .pop()}`;
        const filePath = `${user.id}/bucket/${projectId}/image-generation/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('user-bucket-images')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('user-bucket-images')
          .getPublicUrl(filePath);

        referenceImageUrl = publicUrlData.publicUrl;

        // Save to bucket images table
        await supabase.from('project_bucket_images').insert([
          {
            user_id: user.id,
            task_id: targetTaskId,
            task_type: 'image-generation',
            filename: selectedFile.name,
            storage_path: filePath,
            image_url: referenceImageUrl,
            file_size: selectedFile.size,
            mime_type: selectedFile.type,
          },
        ]);
      } else if (selectedBucketImage) {
        referenceImageUrl = selectedBucketImage.image_url;
      }

      // Create schedule
      const scheduleData = {
        user_id: user.id,
        task_id: targetTaskId,
        task_type: 'image-generation',
        name: formData.name,
        description: formData.description,
        prompt: formData.prompt,
        schedule_config: {
          enabled: true,
          duration_hours: formData.scheduleDuration,
          interval_minutes: formData.generationInterval,
        },
        generation_settings: {
          max_images: formData.maxImages,
          reference_image_url: referenceImageUrl,
          aspect_ratio: formData.aspectRatio,
        },
        bucket_settings: {
          use_bucket_images: true,
        },
        status: 'active' as const,
        next_run: new Date().toISOString(),
      };

      const { error: scheduleError } = await supabase
        .from('schedules')
        .insert([scheduleData]);

      if (scheduleError) throw scheduleError;

      toast.success('AI Image Agent created successfully!');
      onOpenChange(false);
      onSuccess?.();

      // Reset form
      setFormData({
        name: '',
        description: '',
        prompt: '',
        referenceImage: null,
        maxImages: 10,
        scheduleDuration: 1,
        generationInterval: 1,
        aspectRatio: 'match_input_image',
      });
      setSelectedFile(null);
      setSelectedBucketImage(null);
    } catch (error: any) {
      console.error('AI Agent creation error:', error);
      toast.error(error.message || 'Failed to create AI Agent');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSelectedBucketImage(null); // Clear bucket selection when file is selected
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create AI Image Agent</DialogTitle>
        </DialogHeader>

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
                    {aspectRatios.map((ratio) => (
                      <SelectItem key={ratio.value} value={ratio.value}>
                        {ratio.label}
                      </SelectItem>
                    ))}
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
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">
                    Reference Image (Optional)
                  </h4>

                  {/* File Upload */}
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {selectedFile
                        ? `Selected: ${selectedFile.name}`
                        : 'Upload Image'}
                    </Button>
                    {selectedFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>

                  {/* Bucket Images */}
                  {bucketImages.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium">
                        Or Select from Bucket
                      </h5>
                      <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                        {bucketImages.map((image) => (
                          <div
                            key={image.id}
                            className={`relative group cursor-pointer ${
                              selectedBucketImage?.id === image.id
                                ? 'ring-2 ring-primary'
                                : ''
                            }`}
                            onClick={() => {
                              setSelectedBucketImage(image);
                              setSelectedFile(null); // Clear file when bucket image is selected
                            }}
                          >
                            <div className="aspect-square rounded-lg overflow-hidden bg-muted border">
                              <img
                                src={image.image_url}
                                alt={image.filename}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
              />
            </CardContent>
          </Card>

          {/* Generation Limits */}
          <Card className="shadow-card border-border/50">
            <CardContent className="space-y-4 pt-6">
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
                        maxImages: parseInt(e.target.value) || 10,
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
                <Label htmlFor="interval">Generation Interval (minutes)</Label>
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

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || uploading}
              className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
            >
              {loading || uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploading ? 'Uploading...' : 'Creating...'}
                </>
              ) : (
                'Create AI Agent'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateImageAgentDialog;
