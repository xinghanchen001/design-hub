import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot,
  Image,
  CheckSquare,
  Square,
  X,
  Trash2,
  Loader2,
  RotateCcw,
  MoreVertical,
  Download,
  Eye,
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

interface GeneratedImage {
  id: string;
  content_url: string;
  metadata: any;
  created_at: string;
  schedule_id: string;
  schedule_name?: string | null;
  project_type?: string | null;
  generation_status: string;
  content_type: string;
  // Legacy compatibility fields for UI
  image_url?: string;
  generated_at?: string;
  project_id?: string;
  project_name?: string | null;
  storage_path?: string | null;
  prompt?: string;
  model_used?: string;
  generation_time_seconds?: number;
  image_type?: 'regular' | 'print-on-shirt';
}

const ImagesView = () => {
  const { project } = useOutletContext<{
    project: Project;
    fetchProjectData: () => Promise<void>;
  }>();
  const { user } = useAuth();

  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDeletingImages, setIsDeletingImages] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadImages();
  }, [user]);

  const loadImages = async () => {
    try {
      // Fetch generated images from the new generated_content table
      const { data: contentData, error: contentError } = await supabase
        .from('generated_content')
        .select(
          `
          *,
          schedules:schedule_id (
            name,
            project_type
          )
        `
        )
        .eq('user_id', user?.id)
        .eq('content_type', 'image')
        .eq('generation_status', 'completed')
        .not('content_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (contentError) throw contentError;

      // Transform the data to match the expected interface
      const transformedImages = (contentData || []).map((content) => ({
        id: content.id,
        content_url: content.content_url,
        metadata: content.metadata,
        created_at: content.created_at,
        schedule_id: content.schedule_id,
        schedule_name: content.schedules?.name || null,
        project_type: content.schedules?.project_type || null,
        generation_status: content.generation_status,
        content_type: content.content_type,
        // Legacy fields for compatibility
        image_url: content.content_url,
        generated_at: content.created_at,
        project_id: content.schedule_id,
        project_name: content.schedules?.name || null,
        storage_path: content.metadata?.storage_path || null,
        prompt: content.metadata?.prompt || '',
        model_used: content.metadata?.model_used || undefined,
        generation_time_seconds:
          content.metadata?.generation_time_seconds || undefined,
        image_type: 'regular' as const,
      }));

      setImages(transformedImages);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const toggleImageSelection = (imageId: string) => {
    setSelectedImages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  const selectAllImages = () => {
    setSelectedImages(new Set(images.map((img) => img.id)));
  };

  const deselectAllImages = () => {
    setSelectedImages(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedImages.size === images.length) {
      deselectAllImages();
    } else {
      selectAllImages();
    }
  };

  const deleteSelectedImages = async () => {
    if (selectedImages.size === 0) return;

    const confirmMessage = `Are you sure you want to delete ${
      selectedImages.size
    } selected image${
      selectedImages.size > 1 ? 's' : ''
    }? This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      setIsDeletingImages(true);

      // Get the images to delete
      const imagesToDelete = images.filter((img) => selectedImages.has(img.id));

      // Delete from storage first (if storage_path exists)
      const storageDeletePromises = imagesToDelete
        .filter((img) => img.storage_path)
        .map(async (img) => {
          const { error } = await supabase.storage
            .from('generated-images')
            .remove([img.storage_path!]);

          if (error) {
            console.error(
              `Failed to delete storage file for image ${img.id}:`,
              error
            );
          }
        });

      await Promise.allSettled(storageDeletePromises);

      // Delete from database (only regular images in this view)
      const imageIds = imagesToDelete.map((img) => img.id);

      if (imageIds.length > 0) {
        const { error } = await supabase
          .from('generated_content')
          .delete()
          .in('id', imageIds);

        if (error) throw error;
      }

      toast.success(
        `Successfully deleted ${selectedImages.size} image${
          selectedImages.size > 1 ? 's' : ''
        }`
      );

      // Reset selection and exit selection mode
      setSelectedImages(new Set());
      setIsSelecting(false);

      // Refresh data
      await loadImages();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete images');
    } finally {
      setIsDeletingImages(false);
    }
  };

  const downloadImage = async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.image_url || image.content_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `generated-image-${image.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Image downloaded successfully');
    } catch (error) {
      toast.error('Failed to download image');
    }
  };

  const deleteImage = async (image: GeneratedImage) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this image? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      // Delete from storage first (if storage_path exists)
      if (image.storage_path) {
        const { error } = await supabase.storage
          .from('generated-images')
          .remove([image.storage_path]);

        if (error) {
          console.error(
            `Failed to delete storage file for image ${image.id}:`,
            error
          );
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('generated_content')
        .delete()
        .eq('id', image.id);

      if (error) throw error;

      toast.success('Image deleted successfully');

      // Refresh data
      await loadImages();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete image');
    }
  };

  const viewImageDetails = (image: GeneratedImage) => {
    // Open image in new tab for full view
    window.open(image.image_url || image.content_url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading images...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with multi-select controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Generated Images
          </h1>
          <p className="text-muted-foreground">
            View AI-generated images from your regular generation schedules
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              loadImages();
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>

          {/* Selection button */}
          {images.length > 0 && (
            <Button
              variant={isSelecting ? 'secondary' : 'outline'}
              onClick={() => {
                setIsSelecting(!isSelecting);
                if (isSelecting) {
                  setSelectedImages(new Set());
                }
              }}
            >
              {isSelecting ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Cancel Selection
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Select Images
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Bulk actions toolbar - show when in selection mode and images are selected */}
      {isSelecting && selectedImages.size > 0 && (
        <Card className="shadow-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedImages.size === images.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all images"
                  />
                  <span className="text-sm font-medium">
                    {selectedImages.size === images.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {selectedImages.size} of {images.length} images selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteSelectedImages}
                  disabled={isDeletingImages}
                >
                  {isDeletingImages ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Images grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {images.map((image) => (
            <Card
              key={image.id}
              className={`shadow-card border-border/50 overflow-hidden transition-all duration-200 ${
                isSelecting
                  ? selectedImages.has(image.id)
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:ring-2 hover:ring-muted-foreground cursor-pointer'
                  : ''
              }`}
              onClick={
                isSelecting ? () => toggleImageSelection(image.id) : undefined
              }
            >
              <div className="aspect-square bg-white relative">
                <img
                  src={image.image_url || image.content_url}
                  alt={image.prompt}
                  className="w-full h-full object-contain"
                />

                {/* Selection checkbox */}
                {isSelecting && (
                  <div className="absolute top-2 left-2">
                    <Checkbox
                      checked={selectedImages.has(image.id)}
                      onCheckedChange={() => toggleImageSelection(image.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-background/80 border-background/80"
                    />
                  </div>
                )}

                {/* More actions dropdown */}
                {!isSelecting && (
                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-black hover:bg-background/80 data-[state=open]:bg-background/80"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => viewImageDetails(image)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Full Size
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadImage(image)}>
                          <Download className="h-4 w-4 mr-2" />
                          Download Image
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteImage(image)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Image
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {/* Project name and model info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {image.project_name || '(Deleted Schedule)'}
                      </span>
                    </div>
                    {image.model_used && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        {image.model_used === 'flux-kontext-max'
                          ? 'Edit'
                          : 'Generate'}
                      </Badge>
                    )}
                  </div>

                  {/* Prompt */}
                  <p
                    className="text-sm text-foreground line-clamp-1"
                    title={image.prompt}
                    style={{ cursor: 'default', position: 'relative' }}
                  >
                    {image.prompt}
                  </p>

                  {/* Date and generation time */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {new Date(image.generated_at).toLocaleDateString()}
                    </span>
                    {image.generation_time_seconds && (
                      <span>{image.generation_time_seconds.toFixed(1)}s</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Image className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            No images generated yet
          </h3>
          <p className="text-muted-foreground">
            Images will appear here automatically when your schedules run
          </p>
        </div>
      )}
    </div>
  );
};

export default ImagesView;
