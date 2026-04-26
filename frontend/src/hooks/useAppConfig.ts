import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appApi } from '@/lib/api';
import { setRuntimeConfig } from '@/lib/runtimeConfig';

export const appConfigKeys = {
  all: ['app-config'] as const,
};

export function useAppConfig() {
  const query = useQuery({
    queryKey: appConfigKeys.all,
    queryFn: appApi.getConfig,
    staleTime: Infinity,
    retry: 1,
  });

  useEffect(() => {
    if (query.data) {
      setRuntimeConfig(query.data);
    }
  }, [query.data]);

  return query;
}