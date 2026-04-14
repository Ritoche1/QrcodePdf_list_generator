import { useState } from 'react';
import { MoreHorizontal, QrCode, Edit, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Table, Pagination, Badge, EmptyState } from '@/components/ui';
import { EntryStatusBadge } from './EntryStatusBadge';
import type { Entry, EntryFilters } from '@/types';
import type { Column } from '@/components/ui/Table';

function getContentSummary(entry: Entry): string {
  const c = entry.content;
  switch (c.type) {
    case 'url': return c.url || '—';
    case 'text': return c.text ? (c.text.slice(0, 60) + (c.text.length > 60 ? '…' : '')) : '—';
    case 'vcard': return [c.first_name, c.last_name].filter(Boolean).join(' ') || '—';
    case 'wifi': return c.ssid || '—';
    default: return '—';
  }
}

function getQrThumbnailUrl(row: Entry): string | null {
  if (!row.qr_image_url) return null;
  if (row.qr_image_url.startsWith('http://') || row.qr_image_url.startsWith('https://') || row.qr_image_url.startsWith('data:')) {
    return row.qr_image_url;
  }
  const basePath = row.qr_image_url.startsWith('/') ? row.qr_image_url : `/files/${row.qr_image_url}`;
  const cacheKey = encodeURIComponent(row.qr_generated_at ?? row.updated_at);
  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}v=${cacheKey}`;
}

interface EntryTableProps {
  entries: Entry[];
  total: number;
  loading: boolean;
  filters: EntryFilters;
  onFiltersChange: (f: EntryFilters) => void;
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onSelectRow: (id: string) => void;
  onEdit?: (entry: Entry) => void;
  onDelete?: (entry: Entry) => void;
  onGenerateQr?: (entry: Entry) => void;
  onPreviewQr?: (entry: Entry) => void;
  onDownloadQr?: (entry: Entry) => void;
}

export function EntryTable({
  entries,
  total,
  loading,
  filters,
  onFiltersChange,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onEdit,
  onDelete,
  onGenerateQr,
  onPreviewQr,
  onDownloadQr,
}: EntryTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const handleSort = (column: string) => {
    const newOrder =
      filters.sort_by === column && filters.sort_order === 'asc' ? 'desc' : 'asc';
    onFiltersChange({ ...filters, sort_by: column, sort_order: newOrder, page: 1 });
  };

  const columns: Column<Entry>[] = [
    {
      key: 'label',
      header: 'Label',
      sortable: true,
      accessor: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.label || '—'}</p>
          <p className="text-xs text-gray-400 capitalize">{row.content_type}</p>
        </div>
      ),
    },
    {
      key: 'content',
      header: 'Content',
      accessor: (row) => (
        <span className="text-gray-600 text-sm truncate block max-w-xs">
          {getContentSummary(row)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (row) => <EntryStatusBadge status={row.status} />,
      width: '120px',
    },
    {
      key: 'qr_generated',
      header: 'QR',
      accessor: (row) => {
        const thumbnailUrl = getQrThumbnailUrl(row);
        return (
          <div className="flex items-center gap-2">
            {thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt={row.label ? `QR thumbnail for ${row.label}` : 'QR code thumbnail'}
                className="w-8 h-8 rounded border border-gray-200 object-contain bg-white"
                loading="lazy"
              />
            )}
            <span className={clsx(
              'inline-flex items-center gap-1 text-xs font-medium',
              row.qr_status === 'generated'
                ? 'text-green-600'
                : row.qr_status === 'outdated'
                ? 'text-amber-600'
                : row.qr_status === 'error'
                ? 'text-red-600'
                : 'text-gray-400'
            )}>
              <QrCode className="w-3.5 h-3.5" />
              {row.qr_status === 'generated'
                ? 'Generated'
                : row.qr_status === 'outdated'
                ? 'Outdated'
                : row.qr_status === 'error'
                ? 'Error'
                : 'Not generated'}
            </span>
          </div>
        );
      },
      width: '130px',
    },
    {
      key: 'tags',
      header: 'Tags',
      accessor: (row) => (
        <div className="flex items-center gap-1 flex-wrap">
          {row.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="gray">
              {tag}
            </Badge>
          ))}
          {row.tags.length > 3 && (
            <Badge variant="gray">+{row.tags.length - 3}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      accessor: (row) => (
        <span className="text-xs text-gray-500">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
      width: '100px',
    },
    {
      key: 'actions',
      header: '',
      width: '48px',
      accessor: (row) => (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(openMenuId === row.id ? null : row.id);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {openMenuId === row.id && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setOpenMenuId(null)}
              />
              <div className="absolute right-0 top-8 z-20 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden">
                {onGenerateQr && (
                  <button
                    onClick={() => { onGenerateQr(row); setOpenMenuId(null); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <QrCode className="w-4 h-4 text-indigo-500" />
                    {row.qr_status === 'generated' ? 'Regenerate QR' : 'Generate QR'}
                  </button>
                )}
                {onPreviewQr && (
                  <button
                    onClick={() => { onPreviewQr(row); setOpenMenuId(null); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <QrCode className="w-4 h-4 text-indigo-500" />
                    Preview PNG
                  </button>
                )}
                {onDownloadQr && (
                  <button
                    onClick={() => { onDownloadQr(row); setOpenMenuId(null); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <QrCode className="w-4 h-4 text-indigo-500" />
                    Download PNG
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={() => { onEdit(row); setOpenMenuId(null); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Edit className="w-4 h-4 text-gray-400" />
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => { onDelete(row); setOpenMenuId(null); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  if (!loading && entries.length === 0) {
    return (
      <EmptyState
        title="No entries yet"
        description="Add entries manually or import from a CSV/Excel file."
      />
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <Table
        columns={columns}
        data={entries}
        keyExtractor={(row) => row.id}
        sortState={
          filters.sort_by
            ? { column: filters.sort_by, direction: filters.sort_order ?? 'asc' }
            : undefined
        }
        onSort={handleSort}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        onSelectRow={onSelectRow}
        loading={loading}
      />
      <Pagination
        page={filters.page ?? 1}
        total={total}
        perPage={filters.per_page ?? 20}
        onPageChange={(p) => onFiltersChange({ ...filters, page: p })}
      />
    </div>
  );
}
