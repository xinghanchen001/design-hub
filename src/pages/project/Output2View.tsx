import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
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
  Shirt,
  RefreshCw,
  Download,
  MoreVertical,
  Eye,
  Trash2,
  CheckSquare,
  X,
  Loader2,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Project = Tables<'projects'>;
type Schedule = Tables<'schedules'>;
type GeneratedContent = Tables<'generated_content'>;

interface GeneratedContentWithSchedule extends GeneratedContent {
  schedules?: {
    name: string;
  };
  tasks?: {
    id: string;
    settings: any;
  };
}

const Output2View = () => {
  const { project } = useOutletContext<{
    project: Project;
    fetchProjectData: () => Promise<void>;
  }>();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<GeneratedContentWithSchedule[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDeletingImages, setIsDeletingImages] = useState(false);

  const fetchPrintOnShirtImages = async () => {
    setIsLoading(true);
    try {
      if (!user?.id) return;

      // Get all tasks for this project (print-on-shirt type)
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', project?.id)
        .eq('task_type', 'print-on-shirt');

      if (tasksError) throw tasksError;

      const taskIds = tasks?.map((task) => task.id) || [];

      if (taskIds.length === 0) {
        setImages([]);
        setIsLoading(false);
        return;
      }

      // Fetch generated content directly by task_id (no need for schedule lookup)
      const { data: printImages, error } = await supabase
        .from('generated_content')
        .select(
          `
          *,
          tasks:task_id (
            id,
            settings
          )
        `
        )
        .eq('user_id', user.id)
        .eq('content_type', 'design') // Print-on-shirt content type
        .in('task_id', taskIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching print-on-shirt images:', error);
        toast.error('Failed to fetch print-on-shirt images');
      } else {
        // Transform data to include display name for tasks
        const transformedImages = (printImages || []).map((content) => ({
          ...content,
          schedules: {
            name: `Task ${content.task_id?.slice(0, 8)}...`,
          },
        }));
        setImages(transformedImages);
      }
    } catch (error) {
      console.error('Error fetching print-on-shirt images:', error);
      toast.error('An error occurred while fetching images');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrintOnShirtImages();
  }, [user?.id, project?.id]);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
  };

  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Image downloaded successfully');
    } catch (error) {
      console.error('Error downloading image:', error);
      toast.error('Failed to download image');
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

  const deleteImage = async (image: GeneratedContentWithSchedule) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this image? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      // Delete from database
      const { error } = await supabase
        .from('generated_content')
        .delete()
        .eq('id', image.id);

      if (error) throw error;

      toast.success('Image deleted successfully');
      await fetchPrintOnShirtImages();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete image');
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

      const imageIds = Array.from(selectedImages);

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

      setSelectedImages(new Set());
      setIsSelecting(false);
      await fetchPrintOnShirtImages();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete images');
    } finally {
      setIsDeletingImages(false);
    }
  };

  const viewImageDetails = (image: GeneratedContentWithSchedule) => {
    if (image.content_url) {
      window.open(image.content_url, '_blank');
    }
  };

  const downloadImage = async (image: GeneratedContentWithSchedule) => {
    if (!image.content_url) {
      toast.error('No image URL available');
      return;
    }
    await handleDownload(image.content_url, `print-on-shirt-${image.id}.png`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shirt className="h-6 w-6" />
            Print-on-Shirt Gallery
          </h1>
          <p className="text-muted-foreground">
            Generated images from your print-on-shirt schedules (Project 2)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <Button
            onClick={fetchPrintOnShirtImages}
            disabled={isLoading}
            variant="outline"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
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

      {/* Stats Card */}
      <Card className="shadow-card border-border/50">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {images.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Images</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {
                  images.filter((img) => img.generation_status === 'completed')
                    .length
                }
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {
                  images.filter((img) => img.generation_status === 'failed')
                    .length
                }
              </div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {
                  images.filter((img) => img.generation_status === 'processing')
                    .length
                }
              </div>
              <div className="text-sm text-muted-foreground">Processing</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Images Grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {images.map((image) => {
            const metadata = (image.metadata as any) || {};
            const taskSettings = (image.tasks?.settings as any) || {};

            return (
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
                  {image.content_url &&
                  image.generation_status === 'completed' ? (
                    <img
                      src={image.content_url}
                      alt={metadata.prompt || taskSettings.prompt || ''}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <Shirt className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}

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
                            disabled={
                              !image.content_url ||
                              image.generation_status !== 'completed'
                            }
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Full Size
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => downloadImage(image)}
                            disabled={
                              !image.content_url ||
                              image.generation_status !== 'completed'
                            }
                          >
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
                    {/* Schedule name and status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shirt className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          {image.schedules?.name || 'Unknown Schedule'}
                        </span>
                      </div>
                      <Badge
                        variant={
                          image.generation_status === 'completed'
                            ? 'outline'
                            : 'secondary'
                        }
                        className="text-xs px-1 py-0"
                      >
                        {image.generation_status === 'completed'
                          ? 'Multi-Image'
                          : image.generation_status}
                      </Badge>
                    </div>

                    {/* Prompt */}
                    <p
                      className="text-sm text-foreground line-clamp-1"
                      title={metadata.prompt || taskSettings.prompt || ''}
                      style={{ cursor: 'default', position: 'relative' }}
                    >
                      {metadata.prompt || taskSettings.prompt || 'No prompt'}
                    </p>

                    {/* Date and generation time */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDateShort(image.created_at || '')}</span>
                      {metadata.generation_time_seconds && (
                        <span>
                          {metadata.generation_time_seconds.toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Shirt className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            No print-on-shirt images yet
          </h3>
          <p className="text-muted-foreground">
            Create a print-on-shirt schedule to start generating images
          </p>
        </div>
      )}
    </div>
  );
};

export default Output2View;
