import { Input, Textarea, Select } from '@/components/ui';
import type { ContentType, QrContentData } from '@/types';

interface QrContentFormProps {
  contentType: ContentType;
  value: QrContentData;
  onChange: (data: QrContentData) => void;
}

export function QrContentForm({ contentType, value, onChange }: QrContentFormProps) {
  switch (contentType) {
    case 'url': {
      const v = value as { type: 'url'; url: string };
      return (
        <div className="space-y-4">
          <Input
            label="URL"
            type="url"
            placeholder="https://example.com"
            value={v.url ?? ''}
            onChange={(e) => onChange({ type: 'url', url: e.target.value })}
            hint="Enter the full URL including https://"
          />
        </div>
      );
    }
    case 'text': {
      const v = value as { type: 'text'; text: string };
      return (
        <div className="space-y-4">
          <Textarea
            label="Text Content"
            placeholder="Enter any text content..."
            rows={4}
            value={v.text ?? ''}
            onChange={(e) => onChange({ type: 'text', text: e.target.value })}
          />
        </div>
      );
    }
    case 'vcard': {
      const v = value as {
        type: 'vcard';
        first_name: string;
        last_name: string;
        phone?: string;
        email?: string;
        organization?: string;
        title?: string;
        address?: string;
      };
      const update = (field: string, val: string) =>
        onChange({ ...v, [field]: val });
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              placeholder="John"
              value={v.first_name ?? ''}
              onChange={(e) => update('first_name', e.target.value)}
            />
            <Input
              label="Last Name"
              placeholder="Doe"
              value={v.last_name ?? ''}
              onChange={(e) => update('last_name', e.target.value)}
            />
          </div>
          <Input
            label="Phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={v.phone ?? ''}
            onChange={(e) => update('phone', e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="john@example.com"
            value={v.email ?? ''}
            onChange={(e) => update('email', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Organization"
              placeholder="Acme Corp"
              value={v.organization ?? ''}
              onChange={(e) => update('organization', e.target.value)}
            />
            <Input
              label="Title"
              placeholder="Software Engineer"
              value={v.title ?? ''}
              onChange={(e) => update('title', e.target.value)}
            />
          </div>
          <Input
            label="Address"
            placeholder="123 Main St, City, State"
            value={v.address ?? ''}
            onChange={(e) => update('address', e.target.value)}
          />
        </div>
      );
    }
    case 'wifi': {
      const v = value as {
        type: 'wifi';
        ssid: string;
        password?: string;
        encryption: 'WPA' | 'WEP' | 'None';
        hidden: boolean;
      };
      const update = (field: string, val: string | boolean) =>
        onChange({ ...v, [field]: val });
      return (
        <div className="space-y-4">
          <Input
            label="Network Name (SSID)"
            placeholder="MyWifiNetwork"
            value={v.ssid ?? ''}
            onChange={(e) => update('ssid', e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Network password"
            value={v.password ?? ''}
            onChange={(e) => update('password', e.target.value)}
          />
          <Select
            label="Encryption"
            value={v.encryption ?? 'WPA'}
            onChange={(e) => update('encryption', e.target.value)}
            options={[
              { value: 'WPA', label: 'WPA/WPA2' },
              { value: 'WEP', label: 'WEP' },
              { value: 'None', label: 'None (open network)' },
            ]}
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={v.hidden ?? false}
                onChange={(e) => update('hidden', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Hidden network</p>
              <p className="text-xs text-gray-500">Network SSID is not broadcast</p>
            </div>
          </label>
        </div>
      );
    }
    default:
      return null;
  }
}
