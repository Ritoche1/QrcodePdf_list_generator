import { clsx } from 'clsx';
import { Link2, FileText, User, Wifi } from 'lucide-react';
import type { ContentType } from '@/types';

interface QrTypeSelectorProps {
  value: ContentType;
  onChange: (type: ContentType) => void;
  disabled?: boolean;
}

const qrTypes: {
  value: ContentType;
  label: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    value: 'url',
    label: 'URL',
    description: 'Link to a website or web page',
    icon: Link2,
  },
  {
    value: 'text',
    label: 'Plain Text',
    description: 'Any text content or message',
    icon: FileText,
  },
  {
    value: 'vcard',
    label: 'vCard',
    description: 'Contact information card',
    icon: User,
  },
  {
    value: 'wifi',
    label: 'Wi-Fi',
    description: 'Network credentials for easy joining',
    icon: Wifi,
  },
];

export function QrTypeSelector({ value, onChange, disabled = false }: QrTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {qrTypes.map((type) => {
        const isSelected = value === type.value;
        return (
          <button
            key={type.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(type.value)}
            className={clsx(
              'flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
              isSelected
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
              disabled && 'opacity-60 cursor-not-allowed hover:border-gray-200 hover:bg-white'
            )}
          >
            <div
              className={clsx(
                'flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
                isSelected ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
              )}
            >
              <type.icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <p
                className={clsx(
                  'text-sm font-semibold transition-colors',
                  isSelected ? 'text-indigo-700' : 'text-gray-900'
                )}
              >
                {type.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
