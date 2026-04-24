import { Input, Select } from '@/components/ui';
import type { PdfLayoutOptions } from '@/types';

interface PdfLayoutOptionsProps {
  value: PdfLayoutOptions;
  onChange: (opts: PdfLayoutOptions) => void;
}

export function PdfLayoutOptionsForm({ value, onChange }: PdfLayoutOptionsProps) {
  const update = <K extends keyof PdfLayoutOptions>(field: K, val: PdfLayoutOptions[K]) =>
    onChange({ ...value, [field]: val });

  const numInput = (
    field: keyof PdfLayoutOptions,
    label: string,
    min?: number,
    max?: number,
    hint?: string
  ) => (
    <Input
      label={label}
      type="number"
      min={min}
      max={max}
      value={String(value[field] ?? '')}
      onChange={(e) => update(field, Number(e.target.value) as PdfLayoutOptions[typeof field])}
      hint={hint}
    />
  );

  return (
    <div className="space-y-5">
      {/* Page Size */}
      <Select
        label="Page Size"
        value={value.page_size}
        onChange={(e) => update('page_size', e.target.value as PdfLayoutOptions['page_size'])}
        options={[
          { value: 'A4', label: 'A4 (210 × 297 mm)' },
          { value: 'Letter', label: 'Letter (8.5 × 11 in)' },
          { value: 'Legal', label: 'Legal (8.5 × 14 in)' },
          { value: 'A3', label: 'A3 (297 × 420 mm)' },
        ]}
      />

      {/* Grid Layout */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Grid Layout</p>
        <div className="grid grid-cols-2 gap-3">
          {numInput('columns', 'Columns', 1, 10)}
          {numInput('rows', 'Rows per page', 1, 12)}
        </div>
      </div>

      {/* Margins */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Margins (mm)</p>
        <div className="grid grid-cols-2 gap-3">
          {numInput('margin_top', 'Top', 0, 50)}
          {numInput('margin_bottom', 'Bottom', 0, 50)}
          {numInput('margin_left', 'Left', 0, 50)}
          {numInput('margin_right', 'Right', 0, 50)}
        </div>
      </div>

      {/* QR Size & Spacing */}
      <div className="grid grid-cols-2 gap-3">
        {numInput('qr_size', 'QR Code Size (mm)', 10, 120, 'Width and height of each QR code')}
        {numInput('spacing', 'Spacing (mm)', 0, 30, 'Gap between QR codes')}
      </div>

      {/* Labels */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={value.show_labels}
            onChange={(e) => update('show_labels', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-700">Show Labels</p>
            <p className="text-xs text-gray-500">
              Print the entry label below each QR code
            </p>
          </div>
        </label>
        {value.show_labels && (
          <div className="mt-3 pl-7">
            {numInput('font_size', 'Font Size (pt)', 6, 24)}
          </div>
        )}
      </div>
    </div>
  );
}
