import { Badge } from '@/components/ui';
import type { EntryStatus } from '@/types';
import type { BadgeVariant } from '@/components/ui/Badge';

const statusConfig: Record<EntryStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'gray' },
  generated: { label: 'Generated', variant: 'blue' },
  printed: { label: 'Printed', variant: 'green' },
  archived: { label: 'Archived', variant: 'yellow' },
};

interface EntryStatusBadgeProps {
  status: EntryStatus;
}

export function EntryStatusBadge({ status }: EntryStatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: 'gray' };
  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  );
}
