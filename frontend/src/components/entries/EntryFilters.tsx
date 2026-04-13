import { useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input, Select, Badge, Button } from '@/components/ui';
import type { EntryFilters, EntryStatus } from '@/types';

interface EntryFiltersProps {
  filters: EntryFilters;
  onChange: (filters: EntryFilters) => void;
}

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'generated', label: 'Generated' },
  { value: 'printed', label: 'Printed' },
  { value: 'archived', label: 'Archived' },
];

export function EntryFiltersBar({ filters, onChange }: EntryFiltersProps) {
  const update = useCallback(
    <K extends keyof EntryFilters>(key: K, value: EntryFilters[K]) =>
      onChange({ ...filters, [key]: value, page: 1 }),
    [filters, onChange]
  );

  const hasFilters = !!(filters.search || filters.status || filters.tags?.length);

  const clearAll = () =>
    onChange({ sort_by: filters.sort_by, sort_order: filters.sort_order, page: 1, per_page: filters.per_page });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-52">
          <Input
            placeholder="Search entries..."
            value={filters.search ?? ''}
            onChange={(e) => update('search', e.target.value)}
            leftElement={<Search className="w-4 h-4" />}
            rightElement={
              filters.search ? (
                <button onClick={() => update('search', '')} className="hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              ) : undefined
            }
          />
        </div>
        <div className="w-44">
          <Select
            value={filters.status ?? ''}
            onChange={(e) => update('status', e.target.value as EntryStatus | undefined)}
            options={statusOptions}
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear filters
          </Button>
        )}
      </div>
      {/* Active tag filters */}
      {filters.tags && filters.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Tags:</span>
          {filters.tags.map((tag) => (
            <button
              key={tag}
              onClick={() =>
                update(
                  'tags',
                  filters.tags!.filter((t) => t !== tag)
                )
              }
              className="inline-flex items-center gap-1"
            >
              <Badge variant="indigo">
                {tag}
                <X className="w-3 h-3 ml-1" />
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
