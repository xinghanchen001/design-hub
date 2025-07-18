import React, { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Folder } from 'lucide-react';

interface BucketImage {
  id: string;
  filename: string;
  image_url: string;
  created_at: string;
}

interface CreatePrintOnShirtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
}

const aspectRatios = [
  { value: '1:1', label: '1:1 (Square)' },
  { value: '16:9', label: '16:9 (Wide)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '4:3', label: '4:3 (Standard)' },
  { value: '3:4', label: '3:4 (Portrait)' },
];

const CreatePrintOnShirtDialog: React.FC<CreatePrintOnShirtDialogProps> = ({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [bucketImages, setBucketImages] = useState<BucketImage[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedBucketImages1, setSelectedBucketImages1] = useState<
    BucketImage[]
  >([]);
  const [selectedBucketImages2, setSelectedBucketImages2] = useState<
    BucketImage[]
  >([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: '',
    aspect_ratio: '1:1',
    schedule_enabled: true,
    schedule_duration_hours: 1,
    max_images_to_generate: 10,
    generation_interval_minutes: 1,
  });

  const { user } = useAuth();

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

    try {
      // Get task IDs for print-on-shirt tasks in this project
      const printOnShirtTasks = tasks.filter(
        (task) => task.task_type === 'print-on-shirt'
      );
      const taskIds = printOnShirtTasks.map((task) => task.id);

      if (taskIds.length === 0) {
        setBucketImages([]);
        return;
      }

      const { data: images, error } = await supabase
        .from('project_bucket_images')
        .select('*')
        .in('task_id', taskIds)
        .eq('user_id', user.id)
        .eq('task_type', 'print-on-shirt')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBucketImages(images || []);
    } catch (error) {
      console.error('Error fetching bucket images:', error);
      toast.error('Failed to load bucket images');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !projectId) return;

    if (
      selectedBucketImages1.length === 0 ||
      selectedBucketImages2.length === 0
    ) {
      toast.error('Please select at least one image from each reference set');
      return;
    }

    setLoading(true);
    try {
      // Check if task already exists
      const { data: existingTasks, error: taskCheckError } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', projectId)
        .eq('task_type', 'print-on-shirt')
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
              task_type: 'print-on-shirt',
              prompt: formData.prompt,
            },
          ])
          .select()
          .single();

        if (taskError) throw taskError;
        targetTaskId = newTask.id;
      }

      // Create schedule
      const scheduleData = {
        user_id: user.id,
        task_id: targetTaskId,
        task_type: 'print-on-shirt',
        name: formData.name,
        description: formData.description,
        prompt: formData.prompt,
        schedule_config: {
          enabled: formData.schedule_enabled,
          duration_hours: formData.schedule_duration_hours,
          interval_minutes: formData.generation_interval_minutes,
        },
        generation_settings: {
          max_images: formData.max_images_to_generate,
          aspect_ratio: formData.aspect_ratio,
          input_image_1_url: selectedBucketImages1[0]?.image_url || '',
          input_image_2_url: selectedBucketImages2[0]?.image_url || '',
        },
        bucket_settings: {
          use_bucket_images: true,
          bucket_image_1_ids: selectedBucketImages1.map((img) => img.id),
          bucket_image_2_ids: selectedBucketImages2.map((img) => img.id),
        },
        status: formData.schedule_enabled ? 'active' : 'paused',
        next_run: formData.schedule_enabled ? new Date().toISOString() : null,
      };

      const { error: scheduleError } = await supabase
        .from('schedules')
        .insert([scheduleData]);

      if (scheduleError) throw scheduleError;

      toast.success('Print on Shirt schedule created successfully!');
      onOpenChange(false);
      onSuccess?.();

      // Reset form
      setFormData({
        name: '',
        description: '',
        prompt: '',
        aspect_ratio: '1:1',
        schedule_enabled: true,
        schedule_duration_hours: 1,
        max_images_to_generate: 10,
        generation_interval_minutes: 1,
      });
      setSelectedBucketImages1([]);
      setSelectedBucketImages2([]);
    } catch (error: any) {
      console.error('Schedule creation error:', error);
      toast.error(error.message || 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  const toggleImageSelection = (image: BucketImage, isSet1: boolean) => {
    if (isSet1) {
      setSelectedBucketImages1((prev) => {
        const isSelected = prev.some((img) => img.id === image.id);
        if (isSelected) {
          return prev.filter((img) => img.id !== image.id);
        } else {
          return [...prev, image];
        }
      });
    } else {
      setSelectedBucketImages2((prev) => {
        const isSelected = prev.some((img) => img.id === image.id);
        if (isSelected) {
          return prev.filter((img) => img.id !== image.id);
        } else {
          return [...prev, image];
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Create Print on Shirt Schedule
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card className="shadow-card border-border/50">
            <CardContent className="space-y-6 pt-6">
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
                    required
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
                <Label htmlFor="prompt">Combination Prompt *</Label>
                <Textarea
                  id="prompt"
                  value={formData.prompt}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, prompt: e.target.value }))
                  }
                  placeholder="e.g., Put the logo from the first image on the shirt from the second image, make it look professional and stylish"
                  rows={4}
                  required
                />
              </div>

              {/* Reference Images Selection */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Reference Images Set 1 */}
                  <div className="space-y-4">
                    <Label>
                      Reference Images Set 1 * (Select multiple for batch
                      generation)
                    </Label>
                    {bucketImages.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto border rounded-lg p-3">
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
                              onClick={() => toggleImageSelection(image, true)}
                            >
                              <div className="aspect-square rounded-lg overflow-hidden bg-muted border">
                                <img
                                  src={image.image_url}
                                  alt={image.filename}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                  <span className="text-xs text-white font-bold">
                                    {selectedBucketImages1.findIndex(
                                      (img) => img.id === image.id
                                    ) + 1}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
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
                    )}
                  </div>

                  {/* Reference Images Set 2 */}
                  <div className="space-y-4">
                    <Label>
                      Reference Images Set 2 * (Select multiple for batch
                      generation)
                    </Label>
                    {bucketImages.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                        {bucketImages.map((image) => {
                          const isSelected = selectedBucketImages2.some(
                            (img) => img.id === image.id
                          );
                          return (
                            <div
                              key={image.id}
                              className={`relative group cursor-pointer ${
                                isSelected ? 'ring-2 ring-secondary' : ''
                              }`}
                              onClick={() => toggleImageSelection(image, false)}
                            >
                              <div className="aspect-square rounded-lg overflow-hidden bg-muted border">
                                <img
                                  src={image.image_url}
                                  alt={image.filename}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-secondary rounded-full flex items-center justify-center">
                                  <span className="text-xs text-white font-bold">
                                    {selectedBucketImages2.findIndex(
                                      (img) => img.id === image.id
                                    ) + 1}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
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
                      min="1"
                      value={formData.generation_interval_minutes}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          generation_interval_minutes:
                            parseInt(e.target.value) || 1,
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
                          max_images_to_generate:
                            parseInt(e.target.value) || 10,
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
                          schedule_duration_hours:
                            parseInt(e.target.value) || 1,
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

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
                >
                  {loading ? (
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
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePrintOnShirtDialog;
