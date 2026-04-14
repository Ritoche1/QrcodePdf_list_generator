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
    mutationFn: ({
      entryId,
      payload,
    }: {
      entryId: string;
      payload?: {
        fg_color?: string;
        bg_color?: string;
        error_correction?: 'L' | 'M' | 'Q' | 'H';
      };
    }) => qrApi.generate(entryId, payload),
  });
}
