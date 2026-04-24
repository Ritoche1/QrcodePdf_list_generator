import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { LoadingSpinner } from '@/components/ui';
import { pdfApi } from '@/lib/api';
import type { PdfLayoutOptions, QrDesignOptions } from '@/types';

interface PdfPreviewProps {
  projectId: string;
  options: PdfLayoutOptions;
  design?: Pick<QrDesignOptions, 'foreground_color' | 'background_color' | 'error_correction'>;
  className?: string;
  enabled?: boolean;
}

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export function PdfPreview({
  projectId,
  options,
  design,
  className,
  enabled = true,
}: PdfPreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedOptions = useDebounce(options, 600);

  useEffect(() => {
    if (!enabled || !projectId) return;

    setLoading(true);
    setError(null);

    pdfApi
      .preview(projectId, debouncedOptions, design)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      })
      .catch(() => {
        setError('Could not generate PDF preview');
      })
      .finally(() => setLoading(false));
  }, [projectId, debouncedOptions, design, enabled]);

  return (
    <div className={clsx('flex flex-col', className)}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        Page Preview
      </p>
      <div className="flex-1 flex items-center justify-center min-h-64 rounded-xl border border-gray-200 bg-gray-50 p-4">
        {loading ? (
          <LoadingSpinner size="lg" className="text-indigo-500" />
        ) : error ? (
          <div className="text-center">
            <p className="text-sm text-gray-500">{error}</p>
            <p className="text-xs text-gray-400 mt-1">
              Make sure entries have QR codes generated
            </p>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt="PDF page preview"
            className="max-w-full max-h-[480px] rounded-lg shadow-md object-contain"
          />
        ) : (
          <div className="text-center">
            <PageIcon />
            <p className="text-sm text-gray-400 mt-3">Preview will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PageIcon() {
  return (
    <svg
      viewBox="0 0 60 80"
      className="w-12 h-16 text-gray-200"
      fill="currentColor"
      aria-hidden
    >
      <rect x="0" y="0" width="60" height="80" rx="4" />
      <rect x="8" y="12" width="20" height="20" rx="2" fill="#d1d5db" />
      <rect x="32" y="12" width="20" height="20" rx="2" fill="#d1d5db" />
      <rect x="8" y="36" width="20" height="20" rx="2" fill="#d1d5db" />
      <rect x="32" y="36" width="20" height="20" rx="2" fill="#d1d5db" />
      <rect x="8" y="62" width="44" height="4" rx="2" fill="#d1d5db" />
    </svg>
  );
}
