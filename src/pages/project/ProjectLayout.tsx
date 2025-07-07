import { useEffect, useState } from 'react';
import {
  useParams,
  useNavigate,
  Outlet,
  useLocation,
  NavLink,
} from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot,
  Calendar,
  BarChart3,
  Clock,
  AlertCircle,
  Images,
  FileText,
  Settings,
  Shirt,
  ChartColumn,
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

const ProjectLayout = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !projectId) return;
    fetchProjectData();
  }, [user, projectId]);

  const fetchProjectData = async () => {
    try {
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user?.id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load project data');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center space-y-4">
          <Bot className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-muted-foreground">Project not found</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const menuItems = [
    {
      title: 'Dashboard',
      path: 'dashboard',
      icon: ChartColumn,
    },
    {
      title: 'Schedules',
      path: 'schedules',
      icon: Calendar,
    },
    {
      title: 'Generation Queue',
      path: 'queue',
      icon: Clock,
    },
    {
      title: 'Generated Images',
      path: 'images',
      icon: Images,
    },
    {
      title: 'Print on Shirt',
      path: 'printonshirt',
      icon: Shirt,
    },
    {
      title: 'Journal Blog Post',
      path: 'journal',
      icon: FileText,
    },
    {
      title: 'Settings',
      path: 'settings',
      icon: Settings,
    },
  ];

  const AppSidebar = () => (
    <Sidebar className="w-60">
      <SidebarContent>
        {/* Project Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-gradient-primary">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">
              AI Image Agent
            </span>
          </div>
          <h2 className="font-semibold text-foreground truncate">
            {project.name}
          </h2>
          <p className="text-xs text-muted-foreground">Runway Gen-4</p>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) => `
                        flex items-center gap-2 px-2 py-2 rounded-md transition-colors
                        ${
                          isActive
                            ? 'bg-muted text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }
                      `}
                      end={item.path === 'dashboard'}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Theme Toggle */}
        <SidebarGroup>
          <SidebarGroupLabel>Appearance</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2">
              <ThemeToggle />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1">
            {/* Header */}
            <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
              <div className="flex items-center gap-4 px-6 py-4">
                <SidebarTrigger />
                <div className="text-sm text-muted-foreground">
                  demo · 2847 tokens
                </div>
              </div>
            </header>

            {/* Content */}
            <div className="p-6">
              <Outlet context={{ project, fetchProjectData }} />
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default ProjectLayout;
