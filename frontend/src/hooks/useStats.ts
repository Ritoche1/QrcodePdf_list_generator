import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/lib/api';

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: statsApi.get,
    staleTime: 30000,
  });
}
