import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Shirt,
  RotateCcw,
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
  image_url: string;
  prompt: string;
  generated_at: string;
  project_id: string;
  project_name?: string | null;
  model_used?: string;
  generation_time_seconds?: number;
  storage_path?: string | null;
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
      // Fetch regular generated images
      const { data: regularImages, error: regularError } = await supabase
        .from('generated_images')
        .select(
          `
          *,
          projects:project_id (
            name
          )
        `
        )
        .eq('user_id', user?.id)
        .order('generated_at', { ascending: false })
        .limit(25);

      if (regularError) throw regularError;

      // Fetch print-on-shirt generated images
      const { data: printOnShirtImages, error: printError } = await supabase
        .from('print_on_shirt_images')
        .select(
          `
          *,
          print_on_shirt_schedules:schedule_id (
            name
          )
        `
        )
        .eq('user_id', user?.id)
        .order('generated_at', { ascending: false })
        .limit(25);

      if (printError) throw printError;

      // Transform regular images
      const transformedRegularImages = (regularImages || []).map((image) => ({
        ...image,
        project_name: image.projects?.name || null,
        image_type: 'regular' as const,
      }));

      // Transform print-on-shirt images
      const transformedPrintImages = (printOnShirtImages || []).map(
        (image) => ({
          ...image,
          project_name: image.print_on_shirt_schedules?.name || null,
          image_type: 'print-on-shirt' as const,
          // Map to match regular image structure
          project_id: image.schedule_id,
        })
      );

      // Combine and sort by date
      const allImages = [...transformedRegularImages, ...transformedPrintImages]
        .sort(
          (a, b) =>
            new Date(b.generated_at).getTime() -
            new Date(a.generated_at).getTime()
        )
        .slice(0, 50);

      setImages(allImages);
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
            .from('ai-generated-images')
            .remove([img.storage_path!]);

          if (error) {
            console.error(
              `Failed to delete storage file for image ${img.id}:`,
              error
            );
          }
        });

      await Promise.allSettled(storageDeletePromises);

      // Delete from database (separate regular and print-on-shirt images)
      const regularImageIds = imagesToDelete
        .filter((img) => img.image_type === 'regular')
        .map((img) => img.id);

      const printOnShirtImageIds = imagesToDelete
        .filter((img) => img.image_type === 'print-on-shirt')
        .map((img) => img.id);

      // Delete regular images
      if (regularImageIds.length > 0) {
        const { error } = await supabase
          .from('generated_images')
          .delete()
          .in('id', regularImageIds);

        if (error) throw error;
      }

      // Delete print-on-shirt images
      if (printOnShirtImageIds.length > 0) {
        const { error } = await supabase
          .from('print_on_shirt_images')
          .delete()
          .in('id', printOnShirtImageIds);

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
            All Generated Images
          </h1>
          <p className="text-muted-foreground">
            View all AI-generated images from all your schedules
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
                  src={image.image_url}
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

                {/* Model badge */}
                {image.model_used && (
                  <div
                    className={`absolute top-2 ${
                      isSelecting ? 'right-2' : 'right-2'
                    }`}
                  >
                    <Badge variant="secondary" className="text-xs">
                      {image.model_used === 'flux-kontext-max'
                        ? 'Edit'
                        : 'Generate'}
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {/* Project name or "Deleted Schedule" */}
                  <div className="flex items-center gap-2">
                    {image.image_type === 'print-on-shirt' ? (
                      <Shirt className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <Bot className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="text-xs font-medium text-muted-foreground">
                      {image.project_name || '(Deleted Schedule)'}
                    </span>
                    {image.image_type === 'print-on-shirt' && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        Multi-Image
                      </Badge>
                    )}
                  </div>

                  {/* Prompt */}
                  <p
                    className="text-sm text-foreground line-clamp-2"
                    title={image.prompt}
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
