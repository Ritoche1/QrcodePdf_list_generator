import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, FolderOpen } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Card, EmptyState } from '@/components/ui';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useProject } from '@/hooks/useProjects';
import { useProjectPdfs } from '@/hooks/usePdfs';
import { downloadBlob, pdfApi } from '@/lib/api';
import { useToastContext } from '@/components/ui/Toast';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectPdfsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToastContext();
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useProject(id!);
  const { data: files = [], isLoading: filesLoading } = useProjectPdfs(id!);

  useEffect(() => {
    if (files.length === 0) {
      setActiveFileName(null);
      return;
    }
    setActiveFileName((prev) => (prev && files.some((f) => f.file_name === prev) ? prev : files[0].file_name));
  }, [files]);

  const previewUrl = useMemo(() => {
    if (!id || !activeFileName) return null;
    return `${API_BASE}/projects/${id}/pdfs/download?file_name=${encodeURIComponent(activeFileName)}`;
  }, [id, activeFileName]);

  const handleDownload = async (fileName: string) => {
    try {
      const blob = await pdfApi.download(id!, fileName);
      downloadBlob(blob, fileName);
      toast.success('PDF downloaded successfully');
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  if (projectLoading || filesLoading) return <PageLoader />;
  if (!project) return <div className="p-8 text-gray-500">Project not found.</div>;

  return (
    <div>
      <PageHeader
        title="Generated PDFs"
        description={`Browse generated PDFs for ${project.name}`}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project.name, href: `/projects/${id}` },
          { label: 'Generated PDFs' },
        ]}
        actions={(
          <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${id}/generate`)}>
            Generate New PDF
          </Button>
        )}
      />

      {files.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderOpen className="w-8 h-8" />}
            title="No generated PDFs yet"
            description="Generate a PDF from the wizard to see it listed here."
            action={(
              <Button size="sm" onClick={() => navigate(`/projects/${id}/generate`)}>
                Open Generator
              </Button>
            )}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="space-y-2">
            {files.map((file) => (
              <div
                key={file.file_name}
                className={`rounded-lg border p-3 ${
                  file.file_name === activeFileName
                    ? 'border-indigo-300 bg-indigo-50/40'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  className="text-left w-full"
                  onClick={() => setActiveFileName(file.file_name)}
                >
                  <p className="text-sm font-medium text-indigo-700 break-all">{file.file_name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(file.created_at).toLocaleString()} • {formatBytes(file.size_bytes)}
                  </p>
                </button>
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(file.file_name)}>
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </Card>

          <Card className="p-2">
            {previewUrl ? (
              <iframe
                title="Generated PDF preview"
                src={previewUrl}
                className="w-full h-[620px] rounded border-0 bg-white"
              />
            ) : (
              <div className="h-[620px] flex items-center justify-center text-gray-500 text-sm">
                <FileText className="w-5 h-5 mr-2" />
                Select a file to preview
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
