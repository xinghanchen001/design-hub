import React, { useState, useRef, useEffect } from 'react';
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
import { Loader2, Save, Upload } from 'lucide-react';

interface CreateVideoGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
}

const CreateVideoGenerationDialog: React.FC<
  CreateVideoGenerationDialogProps
> = ({ open, onOpenChange, projectId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedStartImage, setSelectedStartImage] = useState<File | null>(
    null
  );
  const [formData, setFormData] = useState({
    name: '',
    prompt: '',
    negative_prompt: '',
    mode: 'standard',
    duration: 5,
    max_videos: 5,
    schedule_enabled: true,
    generation_interval_minutes: 1,
    schedule_duration_hours: 1,
  });

  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !projectId) return;

    if (!selectedStartImage) {
      toast.error('Please upload a start image');
      return;
    }

    setLoading(true);
    try {
      // Check if task already exists
      const { data: existingTasks, error: taskCheckError } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', projectId)
        .eq('task_type', 'video-generation')
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
              task_type: 'video-generation',
              prompt: formData.prompt,
            },
          ])
          .select()
          .single();

        if (taskError) throw taskError;
        targetTaskId = newTask.id;
      }

      // Upload start image
      setUploadingImage(true);
      const timestamp = Date.now();
      const fileName = `bucket_${timestamp}_0.${selectedStartImage.name
        .split('.')
        .pop()}`;
      const filePath = `${user.id}/bucket/${projectId}/video-generation/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user-bucket-images')
        .upload(filePath, selectedStartImage);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('user-bucket-images')
        .getPublicUrl(filePath);

      const startImageUrl = publicUrlData.publicUrl;

      // Save to bucket images table
      await supabase.from('project_bucket_images').insert([
        {
          user_id: user.id,
          task_id: targetTaskId,
          task_type: 'video-generation',
          filename: selectedStartImage.name,
          storage_path: filePath,
          image_url: startImageUrl,
          file_size: selectedStartImage.size,
          mime_type: selectedStartImage.type,
        },
      ]);

      // Create schedule
      const scheduleData = {
        user_id: user.id,
        task_id: targetTaskId,
        task_type: 'video-generation' as const,
        name: formData.name,
        description: '',
        prompt: formData.prompt,
        schedule_config: {
          enabled: formData.schedule_enabled,
          duration_hours: formData.schedule_duration_hours,
          interval_minutes: formData.generation_interval_minutes,
        },
        generation_settings: {
          mode: formData.mode,
          duration: formData.duration,
          max_videos: formData.max_videos,
          negative_prompt: formData.negative_prompt,
          start_image_url: startImageUrl,
        },
        bucket_settings: {
          use_bucket_images: true,
        },
        status: formData.schedule_enabled
          ? ('active' as const)
          : ('paused' as const),
        next_run: formData.schedule_enabled ? new Date().toISOString() : null,
      };

      const { error: scheduleError } = await supabase
        .from('schedules')
        .insert([scheduleData]);

      if (scheduleError) throw scheduleError;

      toast.success('Video Generation schedule created successfully!');
      onOpenChange(false);
      onSuccess?.();

      // Reset form
      setFormData({
        name: '',
        prompt: '',
        negative_prompt: '',
        mode: 'standard',
        duration: 5,
        max_videos: 5,
        schedule_enabled: true,
        generation_interval_minutes: 1,
        schedule_duration_hours: 1,
      });
      setSelectedStartImage(null);
    } catch (error: any) {
      console.error('Schedule creation error:', error);
      toast.error(error.message || 'Failed to create schedule');
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedStartImage(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Create Video Generation Schedule
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="shadow-card border-border/50">
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
                  required
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
                  required
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

              {/* Start Image Upload */}
              <div>
                <Label>Start Image *</Label>
                <div className="mt-2 space-y-4">
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {selectedStartImage
                        ? `Selected: ${selectedStartImage.name}`
                        : 'Upload Start Image'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Video Settings */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="mode">Quality Mode</Label>
                  <Select
                    value={formData.mode}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, mode: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard (720p)</SelectItem>
                      <SelectItem value="high">High (1080p)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="duration">Duration</Label>
                  <Select
                    value={formData.duration.toString()}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        duration: parseInt(value),
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
                    value={formData.max_videos}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        max_videos: parseInt(e.target.value) || 5,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Schedule Settings */}
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
                          generation_interval_minutes:
                            parseInt(e.target.value) || 1,
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
                          schedule_duration_hours:
                            parseInt(e.target.value) || 1,
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={loading || uploadingImage}
                  className="gap-2"
                >
                  {loading || uploadingImage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {uploadingImage ? 'Uploading...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
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

export default CreateVideoGenerationDialog;
