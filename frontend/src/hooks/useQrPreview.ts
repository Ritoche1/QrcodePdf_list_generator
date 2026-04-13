import { useMutation } from '@tanstack/react-query';
import { qrApi } from '@/lib/api';
import type { QrPreviewRequest } from '@/types';

export function useQrPreview() {
  return useMutation({
    mutationFn: (payload: QrPreviewRequest) => qrApi.preview(payload),
  });
}

export function useGenerateQr() {
  return useMutation({
    mutationFn: (entryId: string) => qrApi.generate(entryId),
  });
}
