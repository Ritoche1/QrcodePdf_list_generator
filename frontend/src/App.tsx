import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dashboard } from '@/pages/Dashboard';
import { ProjectsPage } from '@/pages/Projects';
import { ProjectDetailPage } from '@/pages/ProjectDetail';
import { ProjectPdfsPage } from '@/pages/ProjectPdfs';
import { QrWizardPage } from '@/pages/QrWizard';
import { SingleQrCreatorPage } from '@/pages/SingleQrCreator';
import { DocumentationPage } from '@/pages/Documentation';
import { NotFoundPage } from '@/pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/projects/:id/pdfs" element={<ProjectPdfsPage />} />
              <Route path="/projects/:id/generate" element={<QrWizardPage />} />
              <Route path="/qr/create" element={<SingleQrCreatorPage />} />
              <Route path="/docs" element={<DocumentationPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
