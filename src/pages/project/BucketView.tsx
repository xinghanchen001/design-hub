import { useState, useEffect } from 'react';
import { useOutletContext, useLocation, useParams } from 'react-router-dom';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload,
  X,
  Trash2,
  Eye,
  Download,
  Loader2,
  Image as ImageIcon,
  FolderOpen,
  CheckSquare,
  Square,
} from 'lucide-react';

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

interface ProjectContext {
  project: any;
  tasks: any[];
  fetchProjectData: () => Promise<void>;
}

const BucketView = () => {
  const { projectType } = useParams<{ projectType: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const { project, tasks, fetchProjectData } =
    useOutletContext<ProjectContext>();

  // Extract task type from URL path
  // URL structure: /project/:projectId/bucket/image-generation
  const pathSegments = location.pathname.split('/');
  const taskTypeFromPath = pathSegments[pathSegments.length - 1];

  // Handle different task type formats and provide a default
  const actualProjectType =
    projectType || taskTypeFromPath || 'image-generation';

  const [images, setImages] = useState<BucketImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isDeletingImages, setIsDeletingImages] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<BucketImage | null>(null);

  useEffect(() => {
    // Clear existing images when project or project type changes
    setImages([]);
    setLoading(true);

    if (user && project?.id && tasks?.length) {
      fetchBucketImages();
    } else {
      setLoading(false);
    }
  }, [user, project?.id, actualProjectType, tasks]);

  const fetchBucketImages = async () => {
    if (!project?.id || !tasks?.length) {
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Get task IDs for this project with the specified task type
      const matchingTasks = tasks.filter(
        (task) => task.task_type === actualProjectType
      );
      const taskIds = matchingTasks.map((task) => task.id);

      if (taskIds.length === 0) {
        setImages([]);
        return;
      }

      const { data, error } = await supabase
        .from('project_bucket_images')
        .select('*')
        .in('task_id', taskIds)
        .eq('user_id', user?.id)
        .eq('task_type', actualProjectType)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setImages(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch bucket images');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
      // Automatically start upload
      await uploadImages(files);
    }
  };

  const uploadImages = async (filesToUpload?: FileList) => {
    const files = filesToUpload || selectedFiles;
    if (!files || files.length === 0) return;
    if (!tasks?.length) {
      toast.error('No tasks found for this project');
      return;
    }

    // Find a task of the matching type to associate with
    const matchingTask = tasks.find(
      (task) => task.task_type === actualProjectType
    );
    if (!matchingTask) {
      toast.error(`No ${actualProjectType} task found in this project`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const uploadPromises = Array.from(files).map(async (file, index) => {
        // Generate storage path
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop();
        const fileName = `bucket_${timestamp}_${index}.${fileExt}`;
        const storagePath = `${user?.id}/bucket/${project?.id}/${actualProjectType}/${fileName}`;

        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('user-bucket-images')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('user-bucket-images')
          .getPublicUrl(storagePath);

        // Insert into database with task_id and task_type
        const { data: dbData, error: dbError } = await supabase
          .from('project_bucket_images')
          .insert({
            task_id: matchingTask.id,
            user_id: user?.id,
            task_type: actualProjectType,
            filename: file.name,
            storage_path: storagePath,
            image_url: urlData.publicUrl,
            file_size: file.size,
            mime_type: file.type,
            metadata: {
              originalName: file.name,
              uploadedAt: new Date().toISOString(),
              taskType: actualProjectType,
            },
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Update progress
        setUploadProgress(((index + 1) / files.length) * 100);

        return dbData;
      });

      await Promise.all(uploadPromises);
      toast.success(`Successfully uploaded ${files.length} images`);
      setSelectedFiles(null);

      // Reset file input
      const fileInput = document.getElementById(
        'bucket-images'
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Refresh the images list
      fetchBucketImages();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteSelectedImages = async () => {
    if (selectedImages.size === 0) return;

    setIsDeletingImages(true);
    try {
      const imagesToDelete = images.filter((img) => selectedImages.has(img.id));

      // Delete from storage
      const storageDeletePromises = imagesToDelete.map(
        (img) =>
          supabase.storage.from('user-bucket-images').remove([img.storage_path]) // Changed from 'user-images' to 'user-bucket-images'
      );

      await Promise.all(storageDeletePromises);

      // Delete from database
      const { error: deleteError } = await supabase
        .from('project_bucket_images')
        .delete()
        .in('id', Array.from(selectedImages));

      if (deleteError) throw deleteError;

      toast.success(`Deleted ${selectedImages.size} images`);
      setSelectedImages(new Set());
      setIsSelecting(false);
      fetchBucketImages();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete images');
    } finally {
      setIsDeletingImages(false);
    }
  };

  const toggleImageSelection = (imageId: string) => {
    const newSelection = new Set(selectedImages);
    if (newSelection.has(imageId)) {
      newSelection.delete(imageId);
    } else {
      newSelection.add(imageId);
    }
    setSelectedImages(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedImages.size === images.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(images.map((img) => img.id)));
    }
  };

  const downloadImage = async (image: BucketImage) => {
    try {
      const { data, error } = await supabase.storage
        .from('user-bucket-images') // Changed from 'user-images' to 'user-bucket-images'
        .download(image.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = image.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.message || 'Failed to download image');
    }
  };

  const deleteImage = async (image: BucketImage) => {
    try {
      // Show confirmation dialog
      const confirmed = window.confirm(
        `Are you sure you want to delete "${image.filename}"? This action cannot be undone.`
      );

      if (!confirmed) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('user-bucket-images')
        .remove([image.storage_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('project_bucket_images')
        .delete()
        .eq('id', image.id);

      if (dbError) throw dbError;

      // Refresh images list
      await loadImages();

      toast.success(`"${image.filename}" has been deleted successfully`);
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete image');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading bucket images...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">
            Reference Bucket -{' '}
            {actualProjectType.charAt(0).toUpperCase() +
              actualProjectType.slice(1)}
          </h1>
          <p className="text-muted-foreground">
            Upload and manage reference images for the{' '}
            {actualProjectType.charAt(0).toUpperCase() +
              actualProjectType.slice(1)}{' '}
            workflow
          </p>
        </div>
        <div className="flex items-center gap-2 justify-start sm:justify-end">
          {images.length > 0 && (
            <Button
              variant={isSelecting ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => {
                setIsSelecting(!isSelecting);
                setSelectedImages(new Set());
              }}
            >
              {isSelecting ? 'Cancel Selection' : 'Select Images'}
            </Button>
          )}
          {isSelecting && selectedImages.size > 0 && (
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
                  Delete Selected ({selectedImages.size})
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Upload Section */}
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle>Upload Images</CardTitle>
          <CardDescription>
            Add reference images to your project bucket. These can be used in
            schedules instead of uploading each time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 rounded-full bg-muted">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-medium">Upload Reference Images</h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop or click to upload
                  <br />
                  JPEG, PNG, GIF, or WebP (max 10MB each)
                </p>
              </div>
              <Label htmlFor="bucket-images" className="cursor-pointer">
                <Button type="button" className="pointer-events-none">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Choose Images
                </Button>
                <Input
                  id="bucket-images"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </Label>
            </div>
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Uploading images...
                </p>
                <p className="text-sm text-muted-foreground">
                  {Math.round(uploadProgress)}% complete
                </p>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Images Grid */}
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {actualProjectType.charAt(0).toUpperCase() +
                  actualProjectType.slice(1)}{' '}
                Bucket Images ({images.length})
              </CardTitle>
              <CardDescription>
                Reference images available for use in schedules
              </CardDescription>
            </div>
            {isSelecting && images.length > 0 && (
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {selectedImages.size === images.length ? (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Select All
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No images in bucket</p>
              <p className="text-sm text-muted-foreground">
                Upload some reference images to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {images.map((image) => (
                <div key={image.id} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-border/50">
                    <img
                      src={image.image_url}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                    />

                    {/* Selection Checkbox */}
                    {isSelecting && (
                      <div className="absolute top-2 left-2">
                        <button
                          onClick={() => toggleImageSelection(image.id)}
                          className="p-1 rounded-sm bg-background/80 hover:bg-background"
                        >
                          {selectedImages.has(image.id) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isSelecting && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedImage(image);
                              setShowImageDialog(true);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => downloadImage(image)}
                            className="h-8 w-8 p-0"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteImage(image)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Image Info */}
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {image.filename}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {formatFileSize(image.file_size)}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(image.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image View Dialog */}
      {selectedImage && (
        <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedImage.filename}</DialogTitle>
              <DialogDescription>
                Uploaded on{' '}
                {new Date(selectedImage.created_at).toLocaleDateString()} •{' '}
                {formatFileSize(selectedImage.file_size)}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center">
              <img
                src={selectedImage.image_url}
                alt={selectedImage.filename}
                className="max-w-full max-h-96 rounded-lg"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => downloadImage(selectedImage)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button onClick={() => setShowImageDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default BucketView;
