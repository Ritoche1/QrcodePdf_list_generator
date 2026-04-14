import { useState } from 'react';
import { clsx } from 'clsx';
import { Tag, Trash2, CheckCircle, X, QrCode } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import type { EntryStatus } from '@/types';

interface BulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onChangeStatus: (status: EntryStatus) => void;
  onDelete: () => void;
  onGenerateQr?: () => void;
  loading?: boolean;
}

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'generated', label: 'Generated' },
  { value: 'printed', label: 'Printed' },
  { value: 'archived', label: 'Archived' },
];

export function BulkActions({
  selectedCount,
  onClearSelection,
  onChangeStatus,
  onDelete,
  onGenerateQr,
  loading,
}: BulkActionsProps) {
  const [status, setStatus] = useState<EntryStatus>('generated');

  if (selectedCount === 0) return null;

  return (
    <div
      className={clsx(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-40',
        'flex items-center gap-3 px-4 py-3 rounded-2xl',
        'bg-gray-900 text-white shadow-2xl shadow-gray-900/40',
        'border border-gray-700'
      )}
    >
      {/* Count + deselect */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-indigo-500 rounded-lg px-2.5 py-1">
          <CheckCircle className="w-3.5 h-3.5" />
          <span className="text-sm font-semibold">{selectedCount}</span>
        </div>
        <span className="text-sm text-gray-300">selected</span>
        <button
          onClick={onClearSelection}
          className="ml-1 p-0.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-gray-700" />

      {/* Change status */}
      <div className="flex items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as EntryStatus)}
          className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onChangeStatus(status)}
          loading={loading}
          className="bg-gray-700 text-white hover:bg-gray-600 border-0"
        >
          <Tag className="w-3.5 h-3.5 mr-1" />
          Set status
        </Button>
      </div>

      <div className="w-px h-6 bg-gray-700" />

      {onGenerateQr && (
        <>
          <Button
            size="sm"
            variant="secondary"
            onClick={onGenerateQr}
            loading={loading}
            className="bg-indigo-600 text-white hover:bg-indigo-500 border-0"
            leftIcon={<QrCode className="w-3.5 h-3.5" />}
          >
            Generate QR
          </Button>
          <div className="w-px h-6 bg-gray-700" />
        </>
      )}

      {/* Delete */}
      <Button
        size="sm"
        variant="danger"
        onClick={onDelete}
        loading={loading}
        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
      >
        Delete
      </Button>
    </div>
  );
}
