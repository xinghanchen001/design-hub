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
  Video,
  RefreshCw,
  Download,
  MoreVertical,
  Eye,
  Trash2,
  CheckSquare,
  X,
  Loader2,
  Play,
  Clock,
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

const VideoOutputView = () => {
  const { project } = useOutletContext<{
    project: Project;
    fetchProjectData: () => Promise<void>;
  }>();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<GeneratedContentWithSchedule[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDeletingVideos, setIsDeletingVideos] = useState(false);

  const fetchVideoGenerationContent = async () => {
    setIsLoading(true);
    try {
      if (!user?.id) return;

      // Get all tasks for this project (video-generation type)
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', project?.id)
        .eq('task_type', 'video-generation');

      if (tasksError) throw tasksError;

      const taskIds = tasks?.map((task) => task.id) || [];

      if (taskIds.length === 0) {
        setVideos([]);
        setIsLoading(false);
        return;
      }

      // Fetch generated content directly by task_id
      const { data: generatedVideos, error } = await supabase
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
        .eq('content_type', 'video') // Video content type
        .in('task_id', taskIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setVideos(generatedVideos || []);
    } catch (error: any) {
      toast.error(`Failed to fetch videos: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && project) {
      fetchVideoGenerationContent();
    }
  }, [user, project]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDownload = async (videoUrl: string, filename: string) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename || 'video.mp4';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Video downloaded successfully');
    } catch (error) {
      toast.error('Failed to download video');
    }
  };

  const toggleVideoSelection = (videoId: string) => {
    const newSelection = new Set(selectedVideos);
    if (newSelection.has(videoId)) {
      newSelection.delete(videoId);
    } else {
      newSelection.add(videoId);
    }
    setSelectedVideos(newSelection);
  };

  const selectAllVideos = () => {
    setSelectedVideos(new Set(videos.map((video) => video.id)));
  };

  const deselectAllVideos = () => {
    setSelectedVideos(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedVideos.size === videos.length) {
      deselectAllVideos();
    } else {
      selectAllVideos();
    }
  };

  const deleteVideo = async (video: GeneratedContentWithSchedule) => {
    try {
      const { error } = await supabase
        .from('generated_content')
        .delete()
        .eq('id', video.id);

      if (error) throw error;

      toast.success('Video deleted successfully');
      fetchVideoGenerationContent();
    } catch (error: any) {
      toast.error(`Failed to delete video: ${error.message}`);
    }
  };

  const deleteSelectedVideos = async () => {
    if (selectedVideos.size === 0) return;

    setIsDeletingVideos(true);
    try {
      const videosToDelete = Array.from(selectedVideos);

      const { error } = await supabase
        .from('generated_content')
        .delete()
        .in('id', videosToDelete);

      if (error) throw error;

      toast.success(`${selectedVideos.size} video(s) deleted successfully`);
      setSelectedVideos(new Set());
      setIsSelecting(false);
      fetchVideoGenerationContent();
    } catch (error: any) {
      toast.error(`Failed to delete videos: ${error.message}`);
    } finally {
      setIsDeletingVideos(false);
    }
  };

  const downloadVideo = async (video: GeneratedContentWithSchedule) => {
    if (video.content_url) {
      await handleDownload(video.content_url, `video_${video.id}.mp4`);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getVideoDuration = (metadata: any) => {
    const duration = metadata?.duration || 5;
    return `${duration}s`;
  };

  const getVideoMode = (metadata: any) => {
    const mode = metadata?.mode || 'standard';
    return mode === 'pro' ? '1080p' : '720p';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Generated Videos</h1>
        </div>
        <div className="flex items-center gap-2">
          {isSelecting && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="gap-2"
              >
                <CheckSquare className="h-4 w-4" />
                {selectedVideos.size === videos.length
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
              {selectedVideos.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteSelectedVideos}
                  disabled={isDeletingVideos}
                  className="gap-2"
                >
                  {isDeletingVideos ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete ({selectedVideos.size})
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSelecting(false);
                  setSelectedVideos(new Set());
                }}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </>
          )}
          {!isSelecting && videos.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSelecting(true)}
              className="gap-2"
            >
              <CheckSquare className="h-4 w-4" />
              Select
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchVideoGenerationContent}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && videos.length === 0 ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading videos...</p>
          </div>
        </div>
      ) : videos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No videos generated yet
            </h3>
            <p className="text-muted-foreground text-center">
              Create a video generation schedule to start producing AI videos
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <Card key={video.id} className="overflow-hidden">
              <div className="relative">
                {isSelecting && (
                  <div className="absolute top-2 left-2 z-10">
                    <Checkbox
                      checked={selectedVideos.has(video.id)}
                      onCheckedChange={() => toggleVideoSelection(video.id)}
                      className="bg-background"
                    />
                  </div>
                )}

                {video.content_url &&
                video.generation_status === 'completed' ? (
                  <div className="relative bg-black aspect-video">
                    <video
                      className="w-full h-full object-contain"
                      controls
                      preload="metadata"
                      poster=""
                    >
                      <source src={video.content_url} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                    <div className="absolute top-2 right-2">
                      <Badge
                        className={getStatusBadgeColor(video.generation_status)}
                      >
                        {video.generation_status}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <div className="text-center">
                      {video.generation_status === 'processing' ? (
                        <>
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Generating...
                          </p>
                        </>
                      ) : video.generation_status === 'failed' ? (
                        <>
                          <X className="h-8 w-8 text-destructive mx-auto mb-2" />
                          <p className="text-sm text-destructive">
                            Generation failed
                          </p>
                        </>
                      ) : (
                        <>
                          <Video className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Video not available
                          </p>
                        </>
                      )}
                    </div>
                    <Badge
                      className={`absolute top-2 right-2 ${getStatusBadgeColor(
                        video.generation_status
                      )}`}
                    >
                      {video.generation_status}
                    </Badge>
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-semibold truncate"
                      title={video.title || 'Untitled'}
                    >
                      {video.title || 'Untitled Video'}
                    </h3>
                    {video.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {video.description}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {video.content_url && (
                        <DropdownMenuItem onClick={() => downloadVideo(video)}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => deleteVideo(video)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {getVideoDuration(video.metadata)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Video className="h-3 w-3" />
                    {getVideoMode(video.metadata)}
                  </div>
                  <div>{formatDateShort(video.created_at)}</div>
                </div>

                {video.generation_status === 'completed' &&
                  video.content_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadVideo(video)}
                      className="w-full gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download Video
                    </Button>
                  )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoOutputView;
