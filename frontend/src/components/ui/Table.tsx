import React from 'react';
import { clsx } from 'clsx';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string | React.ReactNode;
  accessor?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  width?: string;
}

interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  sortState?: SortState;
  onSort?: (column: string) => void;
  selectedIds?: Set<string>;
  onSelectAll?: () => void;
  onSelectRow?: (id: string) => void;
  className?: string;
  emptyMessage?: string;
  loading?: boolean;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  sortState,
  onSort,
  selectedIds,
  onSelectAll,
  onSelectRow,
  className,
  loading,
}: TableProps<T>) {
  const showCheckboxes = !!selectedIds;
  const allSelected = showCheckboxes && data.length > 0 && data.every((row) => selectedIds.has(keyExtractor(row)));
  const someSelected = showCheckboxes && data.some((row) => selectedIds.has(keyExtractor(row))) && !allSelected;

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {showCheckboxes && (
              <th className="w-10 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={clsx(
                  'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap',
                  col.sortable && 'cursor-pointer hover:text-gray-700 select-none',
                  col.headerClassName
                )}
                onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
              >
                <div className="flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    <span className="text-gray-400">
                      {sortState?.column === col.key ? (
                        sortState.direction === 'asc' ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {showCheckboxes && <td className="px-4 py-3"><div className="h-4 w-4 bg-gray-200 rounded" /></td>}
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                  </td>
                ))}
              </tr>
            ))
          ) : (
            data.map((row) => {
              const id = keyExtractor(row);
              const isSelected = selectedIds?.has(id);
              return (
                <tr
                  key={id}
                  className={clsx(
                    'transition-colors',
                    isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  )}
                >
                  {showCheckboxes && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onSelectRow?.(id)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx('px-4 py-3 text-gray-700', col.className)}
                    >
                      {col.accessor ? col.accessor(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  page: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, total, perPage, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium">{start}</span>–<span className="font-medium">{end}</span> of{' '}
        <span className="font-medium">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600"
        >
          Previous
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p = i + 1;
          if (totalPages > 5) {
            if (page <= 3) p = i + 1;
            else if (page >= totalPages - 2) p = totalPages - 4 + i;
            else p = page - 2 + i;
          }
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                p === page
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
              )}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600"
        >
          Next
        </button>
      </div>
    </div>
  );
}
