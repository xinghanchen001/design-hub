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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  FileText,
  RefreshCw,
  Calendar,
  Eye,
  Newspaper,
  User,
  MessageSquare,
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

interface JournalBlogPost {
  id: string;
  user_id: string;
  title: string;
  system_prompt: string;
  user_prompt: string;
  ai_response: string;
  created_at: string;
  updated_at: string;
}

const Output3View = () => {
  const { project } = useOutletContext<{
    project: Project;
    fetchProjectData: () => Promise<void>;
  }>();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [blogPosts, setBlogPosts] = useState<JournalBlogPost[]>([]);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const fetchJournalBlogPosts = async () => {
    setIsLoading(true);
    try {
      if (!user?.id) return;

      // First get all task IDs for this project
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', project?.id);

      if (tasksError) throw tasksError;

      const taskIds = tasks?.map((task) => task.id) || [];

      if (taskIds.length === 0) {
        setBlogPosts([]);
        setIsLoading(false);
        return;
      }

      // Get schedule IDs for these tasks
      const { data: schedules, error: schedulesError } = await supabase
        .from('schedules')
        .select('id')
        .in('task_id', taskIds);

      if (schedulesError) throw schedulesError;

      const scheduleIds = schedules?.map((schedule) => schedule.id) || [];

      if (scheduleIds.length === 0) {
        setBlogPosts([]);
        setIsLoading(false);
        return;
      }

      // Fetch journal content from generated_content table
      const { data: posts, error } = await supabase
        .from('generated_content')
        .select('*')
        .eq('user_id', user.id)
        .eq('task_type', 'journal')
        .eq('content_type', 'text')
        .in('schedule_id', scheduleIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching journal blog posts:', error);
        toast.error('Failed to fetch journal blog posts');
      } else {
        // Transform the data to match the expected JournalBlogPost interface
        const transformedPosts = (posts || []).map((post) => ({
          id: post.id,
          user_id: post.user_id,
          title: post.title || 'Untitled',
          system_prompt: post.metadata?.system_prompt || '',
          user_prompt: post.metadata?.user_prompt || '',
          ai_response: post.content_text || '',
          created_at: post.created_at,
          updated_at: post.updated_at,
        }));
        setBlogPosts(transformedPosts);
      }
    } catch (error) {
      console.error('Error fetching journal blog posts:', error);
      toast.error('An error occurred while fetching blog posts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJournalBlogPosts();
  }, [user?.id]);

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

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Newspaper className="h-6 w-6" />
            Journal Blog Posts
          </h1>
          <p className="text-muted-foreground">
            AI-generated journal entries and blog posts (Project 3)
          </p>
        </div>
        <Button
          onClick={fetchJournalBlogPosts}
          disabled={isLoading}
          className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {/* Stats Card */}
      <Card className="shadow-card border-border/50">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {blogPosts.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Posts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {blogPosts.reduce(
                  (total, post) => total + getWordCount(post.ai_response),
                  0
                )}
              </div>
              <div className="text-sm text-muted-foreground">Total Words</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {
                  blogPosts.filter(
                    (post) =>
                      post.created_at &&
                      new Date(post.created_at) >
                        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  ).length
                }
              </div>
              <div className="text-sm text-muted-foreground">This Week</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(
                  blogPosts.reduce(
                    (total, post) => total + getWordCount(post.ai_response),
                    0
                  ) / Math.max(blogPosts.length, 1)
                )}
              </div>
              <div className="text-sm text-muted-foreground">Avg Words</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Blog Posts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
        {blogPosts.length === 0 ? (
          <Card className="shadow-card border-border/50">
            <CardContent className="text-center py-12">
              <Newspaper className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground mb-2">
                No journal blog posts yet
              </p>
              <p className="text-sm text-muted-foreground">
                Create journal entries to start building your blog content
              </p>
            </CardContent>
          </Card>
        ) : (
          blogPosts.map((post) => (
            <Card
              key={post.id}
              className="shadow-card border-border/50 hover:shadow-lg transition-all duration-300"
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2 line-clamp-2">
                      {post.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(post.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        {getWordCount(post.ai_response)} words
                      </span>
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpandedPost(expandedPost === post.id ? null : post.id)
                    }
                    className="ml-4"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* Preview of AI Response */}
                <div className="mb-4">
                  <div className="prose prose-sm max-w-none text-muted-foreground">
                    {expandedPost === post.id ? (
                      <div className="whitespace-pre-wrap">
                        {post.ai_response}
                      </div>
                    ) : (
                      <div>{truncateText(post.ai_response)}</div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedPost === post.id && (
                  <div className="space-y-4 border-t pt-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-foreground">
                        User Prompt:
                      </h4>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {post.user_prompt}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2 text-foreground">
                        System Prompt:
                      </h4>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {post.system_prompt}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">Created:</span>
                        <br />
                        {formatDate(post.created_at)}
                      </div>
                      <div>
                        <span className="font-medium">Updated:</span>
                        <br />
                        {formatDate(post.updated_at)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Badge variant="secondary" className="text-xs">
                        ID: {post.id.substring(0, 8)}...
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getWordCount(post.ai_response)} words
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Output3View;
