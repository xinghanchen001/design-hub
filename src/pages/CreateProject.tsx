import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, ArrowLeft, Bot, X, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CreateProject = () => {
  const [loading, setLoading] = useState(false);
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<
    string | null
  >(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: '',
    schedule_enabled: true,
    schedule_duration_hours: 8,
    max_images_to_generate: 100,
    generation_interval_minutes: 60,
    reference_image_url: '',
  });

  const { user } = useAuth();
  const navigate = useNavigate();

  const handleReferenceImageChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a JPEG, PNG, GIF, or WebP image');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size must be less than 10MB');
        return;
      }

      setReferenceImage(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        setReferenceImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImagePreview(null);
    setFormData((prev) => ({ ...prev, reference_image_url: '' }));
  };

  const uploadReferenceImage = async (): Promise<string | null> => {
    if (!referenceImage || !user) return null;

    setUploadingImage(true);
    try {
      const fileExt = referenceImage.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_reference.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('user-images')
        .upload(fileName, referenceImage);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('user-images')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload reference image');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      let referenceImageUrl = '';
      if (referenceImage) {
        const uploadedUrl = await uploadReferenceImage();
        if (uploadedUrl) {
          referenceImageUrl = uploadedUrl;
        }
      }

      const { data, error } = await supabase
        .from('projects')
        .insert([
          {
            ...formData,
            reference_image_url: referenceImageUrl,
            user_id: user.id,
            status: 'created',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success('AI Agent created successfully!');
      navigate(`/project/${data.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-primary">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Create AI Agent
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center space-y-4 mb-8">
            <h2 className="text-3xl font-bold text-foreground">
              Set Up Your
              <span className="bg-gradient-accent bg-clip-text text-transparent">
                {' '}
                AI Image Agent
              </span>
            </h2>
            <p className="text-muted-foreground">
              Configure your automated image generation agent with custom
              prompts, schedules, and limits.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <Card className="shadow-card border-border/50">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Give your AI agent a name and description
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Agent Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Product Photography Agent"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what this agent will be used for..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* AI Prompt Configuration */}
            <Card className="shadow-card border-border/50">
              <CardHeader>
                <CardTitle>AI Prompt Configuration</CardTitle>
                <CardDescription>
                  Define the prompt that will be used for image generation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prompt">Generation Prompt *</Label>
                  <Textarea
                    id="prompt"
                    placeholder="e.g., Create a professional product photo of [product] on a clean white background with soft lighting..."
                    value={formData.prompt}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        prompt: e.target.value,
                      }))
                    }
                    rows={4}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: Use detailed descriptions for better results. You can
                    upload a reference image below.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Reference Image Upload */}
            <Card className="shadow-card border-border/50">
              <CardHeader>
                <CardTitle>Reference Image (Optional)</CardTitle>
                <CardDescription>
                  Upload a reference image to guide the AI generation. The model
                  will use this as inspiration for style, composition, or
                  editing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!referenceImagePreview ? (
                  <div className="border-2 border-dashed border-border rounded-lg p-8">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="p-4 rounded-full bg-muted">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="font-medium">Upload Reference Image</h3>
                        <p className="text-sm text-muted-foreground">
                          Drag and drop or click to upload
                          <br />
                          JPEG, PNG, GIF, or WebP (max 10MB)
                        </p>
                      </div>
                      <Label
                        htmlFor="reference-image"
                        className="cursor-pointer"
                      >
                        <Button
                          type="button"
                          variant="outline"
                          className="pointer-events-none"
                        >
                          <Image className="h-4 w-4 mr-2" />
                          Choose Image
                        </Button>
                        <Input
                          id="reference-image"
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handleReferenceImageChange}
                          className="hidden"
                        />
                      </Label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <img
                        src={referenceImagePreview}
                        alt="Reference preview"
                        className="w-full max-h-64 object-contain rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={removeReferenceImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Image className="h-4 w-4" />
                      <span>{referenceImage?.name}</span>
                      <span>
                        (
                        {((referenceImage?.size || 0) / (1024 * 1024)).toFixed(
                          2
                        )}{' '}
                        MB)
                      </span>
                    </div>
                  </div>
                )}
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
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Generation Limits */}
            <Card className="shadow-card border-border/50">
              <CardHeader>
                <CardTitle>Generation Limits</CardTitle>
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
                      value={formData.max_images_to_generate}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          max_images_to_generate: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule_duration">
                      Schedule Duration (hours)
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
                        <SelectValue />
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
                    value={formData.generation_interval_minutes.toString()}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        generation_interval_minutes: parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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

            {/* Submit Button */}
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
                disabled={loading || !formData.name || !formData.prompt}
                className="flex-1 bg-gradient-primary hover:shadow-glow"
              >
                {loading ? 'Creating...' : 'Create AI Agent'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default CreateProject;
