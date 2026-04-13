import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { entriesApi } from '@/lib/api';
import type { CreateEntry, UpdateEntry, EntryFilters } from '@/types';

export const entryKeys = {
  all: (projectId: string) => ['entries', projectId] as const,
  list: (projectId: string, filters: EntryFilters) =>
    ['entries', projectId, filters] as const,
};

export function useEntries(projectId: string, filters: EntryFilters = {}) {
  return useQuery({
    queryKey: entryKeys.list(projectId, filters),
    queryFn: () => entriesApi.list(projectId, filters),
    enabled: !!projectId,
  });
}

export function useCreateEntry(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEntry) => entriesApi.create(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entryKeys.all(projectId) });
    },
  });
}

export function useBulkCreateEntries(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entries: CreateEntry[]) =>
      entriesApi.bulkCreate(projectId, entries),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entryKeys.all(projectId) });
    },
  });
}

export function useUpdateEntry(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEntry }) =>
      entriesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entryKeys.all(projectId) });
    },
  });
}

export function useDeleteEntry(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => entriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entryKeys.all(projectId) });
    },
  });
}

export function useBulkStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      entriesApi.bulkStatus(ids, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entryKeys.all(projectId) });
    },
  });
}

export function useBulkTags(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ids,
      tags,
      action,
    }: {
      ids: string[];
      tags: string[];
      action: 'add' | 'remove' | 'set';
    }) => entriesApi.bulkTags(ids, tags, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entryKeys.all(projectId) });
    },
  });
}
