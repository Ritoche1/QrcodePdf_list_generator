import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import type {
  Project,
  CreateProject,
  UpdateProject,
  Entry,
  CreateEntry,
  UpdateEntry,
  EntryFilters,
  PaginatedResponse,
  Stats,
  QrPreviewRequest,
  PdfLayoutOptions,
} from '@/types';

const BASE_URL = (import.meta.env.VITE_API_URL as string) || '/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

// ─── Projects ────────────────────────────────────────────────────────────────

export const projectsApi = {
  list: async (): Promise<Project[]> => {
    const { data } = await apiClient.get<Project[]>('/projects');
    return data;
  },

  create: async (payload: CreateProject): Promise<Project> => {
    const { data } = await apiClient.post<Project>('/projects', payload);
    return data;
  },

  get: async (id: string): Promise<Project> => {
    const { data } = await apiClient.get<Project>(`/projects/${id}`);
    return data;
  },

  update: async (id: string, payload: UpdateProject): Promise<Project> => {
    const { data } = await apiClient.put<Project>(`/projects/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },
};

// ─── Entries ─────────────────────────────────────────────────────────────────

export const entriesApi = {
  list: async (
    projectId: string,
    filters: EntryFilters = {}
  ): Promise<PaginatedResponse<Entry>> => {
    const params: Record<string, string | number | boolean> = {};
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.tags?.length) params.tags = filters.tags.join(',');
    if (filters.sort_by) params.sort_by = filters.sort_by;
    if (filters.sort_order) params.sort_order = filters.sort_order;
    if (filters.page) params.page = filters.page;
    if (filters.per_page) params.per_page = filters.per_page;
    const { data } = await apiClient.get<PaginatedResponse<Entry>>(
      `/projects/${projectId}/entries`,
      { params }
    );
    return data;
  },

  create: async (projectId: string, payload: CreateEntry): Promise<Entry> => {
    const { data } = await apiClient.post<Entry>(
      `/projects/${projectId}/entries`,
      payload
    );
    return data;
  },

  bulkCreate: async (
    projectId: string,
    entries: CreateEntry[]
  ): Promise<Entry[]> => {
    const { data } = await apiClient.post<Entry[]>(
      `/projects/${projectId}/entries/bulk`,
      { entries }
    );
    return data;
  },

  update: async (id: string, payload: UpdateEntry): Promise<Entry> => {
    const { data } = await apiClient.put<Entry>(`/entries/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/entries/${id}`);
  },

  bulkStatus: async (ids: string[], status: string): Promise<void> => {
    await apiClient.patch('/entries/bulk-status', { ids, status });
  },

  bulkTags: async (
    ids: string[],
    tags: string[],
    action: 'add' | 'remove' | 'set'
  ): Promise<void> => {
    await apiClient.patch('/entries/bulk-tags', { ids, tags, action });
  },
};

// ─── QR ──────────────────────────────────────────────────────────────────────

export const qrApi = {
  preview: async (payload: QrPreviewRequest): Promise<Blob> => {
    const { data } = await apiClient.post<Blob>('/qr/preview', payload, {
      responseType: 'blob',
    });
    return data;
  },

  generate: async (entryId: string): Promise<Entry> => {
    const { data } = await apiClient.post<Entry>(`/qr/generate/${entryId}`);
    return data;
  },
};

// ─── PDF ─────────────────────────────────────────────────────────────────────

export const pdfApi = {
  generate: async (projectId: string, options: PdfLayoutOptions): Promise<Blob> => {
    const { data } = await apiClient.post<Blob>(
      `/projects/${projectId}/pdf`,
      options,
      { responseType: 'blob' }
    );
    return data;
  },

  preview: async (projectId: string, options: PdfLayoutOptions): Promise<Blob> => {
    const { data } = await apiClient.post<Blob>(
      `/projects/${projectId}/pdf/preview`,
      options,
      { responseType: 'blob' }
    );
    return data;
  },
};

// ─── Import / Export ─────────────────────────────────────────────────────────

export interface ImportPreviewResult {
  columns: string[];
  sample_rows: Record<string, string>[];
  suggested_mapping: Record<string, string>;
}

export interface ImportConfirmPayload {
  mapping: Record<string, string>;
  file_id: string;
}

export const importExportApi = {
  importPreview: async (
    projectId: string,
    file: File
  ): Promise<ImportPreviewResult> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.post<ImportPreviewResult>(
      `/projects/${projectId}/import/preview`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data;
  },

  importConfirm: async (
    projectId: string,
    payload: ImportConfirmPayload
  ): Promise<{ imported: number }> => {
    const { data } = await apiClient.post<{ imported: number }>(
      `/projects/${projectId}/import/confirm`,
      payload
    );
    return data;
  },

  exportZip: async (projectId: string): Promise<Blob> => {
    const { data } = await apiClient.post<Blob>(
      `/projects/${projectId}/export`,
      {},
      { responseType: 'blob' }
    );
    return data;
  },

  exportData: async (
    projectId: string,
    format: 'csv' | 'xlsx'
  ): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>(
      `/projects/${projectId}/export/data`,
      { params: { format }, responseType: 'blob' }
    );
    return data;
  },
};

// ─── Stats ───────────────────────────────────────────────────────────────────

export const statsApi = {
  get: async (): Promise<Stats> => {
    const { data } = await apiClient.get<Stats>('/stats');
    return data;
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
