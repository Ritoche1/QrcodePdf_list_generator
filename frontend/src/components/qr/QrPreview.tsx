import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { LoadingSpinner } from '@/components/ui';
import { qrApi } from '@/lib/api';
import type { QrPreviewRequest } from '@/types';

interface QrPreviewProps {
  request: QrPreviewRequest;
  className?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function QrPreview({ request, className }: QrPreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedRequest = useDebounce(request, 500);

  useEffect(() => {
    // Check if there's meaningful content to preview
    const content = debouncedRequest.content;
    const hasContent = (() => {
      switch (content.type) {
        case 'url': return !!content.url?.trim();
        case 'text': return !!content.text?.trim();
        case 'vcard': return !!(content.first_name?.trim() || content.last_name?.trim());
        case 'wifi': return !!content.ssid?.trim();
        default: return false;
      }
    })();

    if (!hasContent) {
      setImageUrl(null);
      setError(null);
      return;
    }

    // Cancel previous request
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    qrApi.preview(debouncedRequest)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setError(null);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError('Could not generate preview');
        }
      })
      .finally(() => setLoading(false));

    return () => {
      abortRef.current?.abort();
    };
  }, [debouncedRequest]);

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center rounded-2xl bg-gray-50 border border-gray-200 p-6',
        className
      )}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
        Live Preview
      </p>
      <div className="relative w-48 h-48 flex items-center justify-center">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-xl z-10">
            <LoadingSpinner size="md" className="text-indigo-500" />
          </div>
        )}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="QR code preview"
            className={clsx(
              'w-full h-full object-contain rounded-lg transition-opacity',
              loading ? 'opacity-40' : 'opacity-100'
            )}
          />
        ) : !loading ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <QrPlaceholder />
            <p className="text-xs text-gray-400 mt-2">
              {error ?? 'Fill in the content above to see a preview'}
            </p>
          </div>
        ) : null}
      </div>
      {imageUrl && (
        <p className="mt-3 text-xs text-gray-400">Updates as you type</p>
      )}
    </div>
  );
}

function QrPlaceholder() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-24 h-24 text-gray-200"
      fill="currentColor"
      aria-hidden
    >
      <rect x="5" y="5" width="38" height="38" rx="4" />
      <rect x="57" y="5" width="38" height="38" rx="4" />
      <rect x="5" y="57" width="38" height="38" rx="4" />
      <rect x="14" y="14" width="20" height="20" rx="2" fill="white" />
      <rect x="66" y="14" width="20" height="20" rx="2" fill="white" />
      <rect x="14" y="66" width="20" height="20" rx="2" fill="white" />
      <rect x="57" y="57" width="10" height="10" rx="2" />
      <rect x="73" y="57" width="10" height="10" rx="2" />
      <rect x="57" y="73" width="10" height="10" rx="2" />
      <rect x="73" y="73" width="10" height="10" rx="2" />
    </svg>
  );
}
