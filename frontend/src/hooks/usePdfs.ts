import { useQuery } from '@tanstack/react-query';
import { pdfApi } from '@/lib/api';

export const pdfKeys = {
  all: (projectId: string) => ['pdfs', projectId] as const,
};

export function useProjectPdfs(projectId: string) {
  return useQuery({
    queryKey: pdfKeys.all(projectId),
    queryFn: () => pdfApi.list(projectId),
    enabled: !!projectId,
  });
}
