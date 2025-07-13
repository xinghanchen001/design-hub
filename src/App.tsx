import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/components/AuthProvider';
import Index from './pages/Index';
import Auth from './pages/Auth';
import CreateProject from './pages/CreateProject';
import CreateImageAgent from './pages/CreateImageAgent';
import {
  ProjectLayout,
  DashboardView,
  SchedulesView,
  QueueView,
  ImagesView,
  PrintOnShirtView,
  JournalView,
  SettingsView,
  Output2View,
  Output3View,
  BucketView,
  VideoGenerationView,
  VideoOutputView,
} from './pages/project';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/create-project" element={<CreateProject />} />
              <Route
                path="/create-image-agent"
                element={<CreateImageAgent />}
              />

              {/* Project nested routes */}
              <Route path="/project/:projectId" element={<ProjectLayout />}>
                {/* Default redirect to dashboard */}
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DashboardView />} />
                <Route path="schedules" element={<SchedulesView />} />
                <Route path="queue" element={<QueueView />} />
                <Route path="images" element={<ImagesView />} />
                <Route path="printonshirt" element={<PrintOnShirtView />} />
                <Route path="output2" element={<Output2View />} />
                <Route path="video" element={<VideoGenerationView />} />
                <Route path="video-output" element={<VideoOutputView />} />
                <Route path="journal" element={<JournalView />} />
                <Route path="output3" element={<Output3View />} />
                <Route
                  path="bucket/image-generation"
                  element={<BucketView />}
                />
                <Route path="bucket/print-on-shirt" element={<BucketView />} />
                <Route
                  path="bucket/video-generation"
                  element={<BucketView />}
                />
                <Route path="bucket/journal" element={<BucketView />} />
                <Route path="settings" element={<SettingsView />} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
