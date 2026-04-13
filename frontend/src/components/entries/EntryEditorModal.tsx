import { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { QrTypeSelector } from '@/components/qr/QrTypeSelector';
import { QrContentForm } from '@/components/qr/QrContentForm';
import type { ContentType, CreateEntry, Entry, QrContentData, UpdateEntry } from '@/types';

interface EntryEditorModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialEntry?: Entry | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateEntry | UpdateEntry) => Promise<void>;
}

const defaultContentByType: Record<ContentType, QrContentData> = {
  url: { type: 'url', url: '' },
  text: { type: 'text', text: '' },
  vcard: { type: 'vcard', first_name: '', last_name: '' },
  wifi: { type: 'wifi', ssid: '', password: '', encryption: 'WPA', hidden: false },
};

function normalizeContent(contentType: ContentType, value?: QrContentData): QrContentData {
  if (!value || value.type !== contentType) return defaultContentByType[contentType];

  if (contentType !== 'wifi') return value;

  const wifi = value as unknown as Record<string, unknown>;
  const security = typeof wifi.security === 'string' ? wifi.security : undefined;
  const encryptionValue = typeof wifi.encryption === 'string' ? wifi.encryption : undefined;
  const encryption = encryptionValue ?? (security === 'nopass' ? 'None' : security) ?? 'WPA';
  return {
    type: 'wifi',
    ssid: typeof wifi.ssid === 'string' ? wifi.ssid : '',
    password: typeof wifi.password === 'string' ? wifi.password : '',
    encryption: encryption === 'None' || encryption === 'WEP' ? encryption : 'WPA',
    hidden: Boolean(wifi.hidden),
  };
}

function getValidationError(content: QrContentData): string | null {
  switch (content.type) {
    case 'url':
      return content.url.trim() ? null : 'URL is required.';
    case 'text':
      return content.text.trim() ? null : 'Text content is required.';
    case 'vcard':
      return content.first_name.trim() ? null : 'First name is required for vCard.';
    case 'wifi':
      return content.ssid.trim() ? null : 'SSID is required for Wi-Fi.';
    default:
      return null;
  }
}

export function EntryEditorModal({
  isOpen,
  mode,
  initialEntry,
  loading = false,
  onClose,
  onSubmit,
}: EntryEditorModalProps) {
  const [label, setLabel] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [contentType, setContentType] = useState<ContentType>('url');
  const [content, setContent] = useState<QrContentData>(defaultContentByType.url);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const initialType = initialEntry?.content_type ?? 'url';
    setLabel(initialEntry?.label ?? '');
    setTagsInput((initialEntry?.tags ?? []).join(', '));
    setContentType(initialType);
    setContent(normalizeContent(initialType, initialEntry?.content));
    setError(null);
  }, [initialEntry, isOpen]);

  const handleSave = async () => {
    const validationError = getValidationError(content);
    if (validationError) {
      setError(validationError);
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    await onSubmit({
      label: label.trim() || undefined,
      content_type: contentType,
      content,
      tags,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={mode === 'create' ? 'Add entry' : 'Edit entry'}
      description="Manually add or update an entry before generating your PDF."
      footer={(
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={loading}>
            {mode === 'create' ? 'Add entry' : 'Save changes'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Input
          label="Label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Optional label for this QR"
        />
        <Input
          label="Tags"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          placeholder="tag1, tag2"
          hint="Optional comma-separated tags."
        />
        <QrTypeSelector
          value={contentType}
          onChange={(nextType) => {
            setContentType(nextType);
            setContent(defaultContentByType[nextType]);
          }}
        />
        <QrContentForm contentType={contentType} value={content} onChange={setContent} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
