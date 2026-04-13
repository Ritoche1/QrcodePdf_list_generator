import { Select } from '@/components/ui';
import type { QrDesignOptions, ErrorCorrectionLevel } from '@/types';

interface QrDesignOptionsProps {
  value: QrDesignOptions;
  onChange: (opts: QrDesignOptions) => void;
}

const ecLevels: { value: ErrorCorrectionLevel; label: string; description: string }[] = [
  { value: 'L', label: 'Low (7%)', description: 'Best for clean environments' },
  { value: 'M', label: 'Medium (15%)', description: 'Balanced — recommended' },
  { value: 'Q', label: 'Quartile (25%)', description: 'Better error recovery' },
  { value: 'H', label: 'High (30%)', description: 'Best for damaged/dirty surfaces' },
];

export function QrDesignOptionsForm({ value, onChange }: QrDesignOptionsProps) {
  const update = (field: keyof QrDesignOptions, val: string) =>
    onChange({ ...value, [field]: val });

  return (
    <div className="space-y-5">
      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Foreground Color
          </label>
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-2 bg-white">
            <input
              type="color"
              value={value.foreground_color}
              onChange={(e) => update('foreground_color', e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
            />
            <span className="text-sm font-mono text-gray-600">{value.foreground_color}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Background Color
          </label>
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-2 bg-white">
            <input
              type="color"
              value={value.background_color}
              onChange={(e) => update('background_color', e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
            />
            <span className="text-sm font-mono text-gray-600">{value.background_color}</span>
          </div>
        </div>
      </div>

      {/* Error Correction */}
      <Select
        label="Error Correction Level"
        value={value.error_correction}
        onChange={(e) => update('error_correction', e.target.value)}
        options={ecLevels.map((l) => ({ value: l.value, label: l.label }))}
        hint={
          ecLevels.find((l) => l.value === value.error_correction)?.description
        }
      />

      {/* Color Presets */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Color Presets</p>
        <div className="flex items-center gap-2 flex-wrap">
          {colorPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  foreground_color: preset.fg,
                  background_color: preset.bg,
                })
              }
              title={preset.label}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0"
                style={{ backgroundColor: preset.fg }}
              />
              <span className="text-xs text-gray-600">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const colorPresets = [
  { label: 'Classic', fg: '#000000', bg: '#ffffff' },
  { label: 'Indigo', fg: '#4338ca', bg: '#eef2ff' },
  { label: 'Forest', fg: '#166534', bg: '#f0fdf4' },
  { label: 'Ruby', fg: '#991b1b', bg: '#fff1f2' },
  { label: 'Slate', fg: '#1e293b', bg: '#f8fafc' },
  { label: 'Night', fg: '#ffffff', bg: '#0f172a' },
];
