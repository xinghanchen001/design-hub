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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileText, Plus, Send, Loader2 } from 'lucide-react';

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
  title: string;
  system_prompt: string;
  user_prompt: string;
  ai_response: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const JournalView = () => {
  const { project } = useOutletContext<{
    project: Project;
    fetchProjectData: () => Promise<void>;
  }>();
  const { user } = useAuth();

  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(
    'Schreibe diesen Artikel im professionellen Tagesschau-Stil um, mit einer passenden Schlagzeile und Datum. Behalt die wichtigsten Informationen bei, aber mache ihn journalistisch strukturiert und objektiv'
  );
  const [userPrompt, setUserPrompt] = useState('');
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [journalPosts, setJournalPosts] = useState<JournalBlogPost[]>([]);

  const fetchJournalPosts = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const response = await fetch(
        'https://sphgdlqoabzsyhtyopim.supabase.co/functions/v1/journal-blog-post',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setJournalPosts(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching journal posts:', error);
    }
  };

  useEffect(() => {
    fetchJournalPosts();
  }, []);

  const handleCreatePost = async () => {
    if (!title.trim() || !systemPrompt.trim() || !userPrompt.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error('Please sign in to create a journal post');
        return;
      }

      const response = await fetch(
        'https://sphgdlqoabzsyhtyopim.supabase.co/functions/v1/journal-blog-post',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            systemPrompt,
            userPrompt,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        setJournalPosts([result.data, ...journalPosts]);
        setTitle('');
        setUserPrompt('');
        setIsCreating(false);
        toast.success('Journal post created successfully!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create journal post');
      }
    } catch (error) {
      toast.error('Failed to create journal post');
      console.error('Error creating journal post:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Journal Blog Post
          </h1>
          <p className="text-muted-foreground">
            Create AI-powered journal blog posts using your fine-tuned model
          </p>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>

      {isCreating && (
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle>Create New Journal Post</CardTitle>
            <CardDescription>
              Use your fine-tuned AI model to generate professional journal
              content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter post title..."
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">System Prompt</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Enter system prompt..."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">User Prompt</label>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Enter your content to be transformed..."
                rows={6}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreatePost}
                disabled={isLoading}
                className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Generate Post
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsCreating(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {journalPosts.length > 0 ? (
          journalPosts.map((post) => (
            <Card key={post.id} className="shadow-card border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{post.title}</CardTitle>
                    <CardDescription>
                      Created {new Date(post.created_at).toLocaleString()}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpandedPost(expandedPost === post.id ? null : post.id)
                    }
                  >
                    {expandedPost === post.id ? 'Collapse' : 'Expand'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">AI Response:</h4>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm">
                        {post.ai_response}
                      </pre>
                    </div>
                  </div>
                  {expandedPost === post.id && (
                    <div className="space-y-3 border-t pt-4">
                      <div>
                        <h4 className="font-medium text-sm mb-1">
                          System Prompt:
                        </h4>
                        <p className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg">
                          {post.system_prompt}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-1">
                          User Prompt:
                        </h4>
                        <p className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg">
                          {post.user_prompt}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="shadow-card border-border/50">
            <CardContent className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No journal posts yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first journal post to get started
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default JournalView;
