import { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Card, Button } from '@/components/ui';
import { QrTypeSelector } from '@/components/qr/QrTypeSelector';
import { QrContentForm } from '@/components/qr/QrContentForm';
import { QrDesignOptionsForm } from '@/components/qr/QrDesignOptions';
import { QrPreview } from '@/components/qr/QrPreview';
import { useToastContext } from '@/components/ui/Toast';
import { qrApi, downloadBlob } from '@/lib/api';
import {
  STANDARD_QR_BACKGROUND_COLOR,
  STANDARD_QR_ERROR_CORRECTION,
  STANDARD_QR_FOREGROUND_COLOR,
} from '@/lib/qrDefaults';
import type { ContentType, QrContentData, QrDesignOptions } from '@/types';

const defaultContent: Record<ContentType, QrContentData> = {
  url: { type: 'url', url: '' },
  text: { type: 'text', text: '' },
  vcard: { type: 'vcard', first_name: '', last_name: '' },
  wifi: { type: 'wifi', ssid: '', encryption: 'WPA', hidden: false },
};

const defaultDesign: QrDesignOptions = {
  foreground_color: STANDARD_QR_FOREGROUND_COLOR,
  background_color: STANDARD_QR_BACKGROUND_COLOR,
  error_correction: STANDARD_QR_ERROR_CORRECTION,
  size: 400,
};

export function SingleQrCreatorPage() {
  const toast = useToastContext();
  const [contentType, setContentType] = useState<ContentType>('url');
  const [content, setContent] = useState<QrContentData>(defaultContent.url);
  const [design, setDesign] = useState<QrDesignOptions>(defaultDesign);
  const [downloading, setDownloading] = useState(false);

  const handleTypeChange = (type: ContentType) => {
    setContentType(type);
    setContent(defaultContent[type]);
  };

  const hasContent = (() => {
    switch (content.type) {
      case 'url': return !!content.url?.trim();
      case 'text': return !!content.text?.trim();
      case 'vcard': return !!(content.first_name?.trim() || content.last_name?.trim());
      case 'wifi': return !!content.ssid?.trim();
      default: return false;
    }
  })();

  const handleDownload = async () => {
    if (!hasContent) return;
    setDownloading(true);
    try {
      const blob = await qrApi.preview({ content, design });
      downloadBlob(blob, 'qrcode.png');
      toast.success('QR code downloaded');
    } catch {
      toast.error('Failed to generate QR code');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Create QR Code"
        description="Generate a single QR code instantly — no project needed"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Type selection */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">QR Code Type</h3>
            <QrTypeSelector value={contentType} onChange={handleTypeChange} />
          </Card>

          {/* Content form */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Content</h3>
            <QrContentForm
              contentType={contentType}
              value={content}
              onChange={setContent}
            />
          </Card>

          {/* Design options */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Design</h3>
            <QrDesignOptionsForm value={design} onChange={setDesign} />
          </Card>
        </div>

        {/* Right: Preview + Download */}
        <div className="space-y-4">
          <QrPreview
            request={{ content, design }}
            className="w-full"
          />
          <Button
            className="w-full"
            size="lg"
            onClick={handleDownload}
            loading={downloading}
            disabled={!hasContent}
            leftIcon={<Download className="w-5 h-5" />}
          >
            {downloading ? 'Generating…' : 'Download PNG'}
          </Button>
          {!hasContent && (
            <p className="text-xs text-center text-gray-400">
              Fill in the content above to download
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
