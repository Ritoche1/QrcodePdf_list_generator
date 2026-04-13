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
  QrDesignOptions,
  ProjectPdfFile,
} from '@/types';

const BASE_URL = (import.meta.env.VITE_API_URL as string) || '/api/v1';

function formatApiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string') return payload;

  if (Array.isArray(payload)) {
    const parts = payload
      .map((item) => formatApiErrorMessage(item, ''))
      .filter(Boolean);
    return parts.length > 0 ? parts.join('; ') : fallback;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    if (typeof record.detail === 'string') {
      return record.detail;
    }

    if (Array.isArray(record.detail)) {
      return formatApiErrorMessage(record.detail, fallback);
    }

    if (typeof record.message === 'string') {
      return record.message;
    }

    if (typeof record.error === 'string') {
      return record.error;
    }

    if (typeof record.msg === 'string') {
      return record.msg;
    }

    if (record.detail && typeof record.detail === 'object') {
      return formatApiErrorMessage(record.detail, fallback);
    }
  }

  return fallback;
}

interface BackendQrPreviewRequest {
  content_type: string;
  content_data: Record<string, unknown>;
  fg_color: string;
  bg_color: string;
  error_correction: 'L' | 'M' | 'Q' | 'H';
  box_size: number;
  border: number;
}

interface BackendPdfLayoutOptions {
  page_size: string;
  orientation: 'portrait' | 'landscape';
  margin_mm: number;
  columns: number;
  rows: number;
  qr_size_mm: number;
  spacing_mm: number;
  show_labels: boolean;
  show_serial: boolean;
  label_font_size: number;
  fg_color: string;
  bg_color: string;
  error_correction: 'L' | 'M' | 'Q' | 'H';
}

interface BackendPdfRequest {
  layout: BackendPdfLayoutOptions;
  entry_ids?: number[];
}

function normalizeEntry(payload: Partial<Entry> & { id?: string | number }): Entry {
  const content =
    (payload as Partial<Entry> & { content_data?: Entry['content'] }).content ??
    (payload as Partial<Entry> & { content_data?: Entry['content'] }).content_data;

  return {
    id: String(payload.id ?? ''),
    project_id: String(payload.project_id ?? ''),
    label: payload.label ?? undefined,
    content_type: payload.content_type ?? 'text',
    content: (content ?? { type: 'text', text: '' }) as Entry['content'],
    status: payload.status ?? 'draft',
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    qr_generated: payload.qr_generated ?? Boolean(payload.qr_image_url),
    qr_image_url: payload.qr_image_url ?? undefined,
    created_at: payload.created_at ?? new Date(0).toISOString(),
    updated_at: payload.updated_at ?? payload.created_at ?? new Date(0).toISOString(),
  };
}

function mapQrPreviewRequest(payload: QrPreviewRequest): BackendQrPreviewRequest {
  const { content, design } = payload;
  const { type, ...contentData } = content;

  const normalizedContentData =
    type === 'wifi'
      ? {
          ...contentData,
          security: 'encryption' in contentData ? contentData.encryption : 'WPA',
        }
      : contentData;

  return {
    content_type: type,
    content_data: normalizedContentData,
    fg_color: design.foreground_color,
    bg_color: design.background_color,
    error_correction: design.error_correction,
    box_size: Math.max(1, Math.min(50, Math.round((design.size ?? 400) / 40))),
    border: 4,
  };
}

function mapPdfLayoutRequest(
  options: PdfLayoutOptions,
  design?: Pick<QrDesignOptions, 'foreground_color' | 'background_color' | 'error_correction'>
): BackendPdfRequest {
  return {
    layout: {
      page_size: options.page_size,
      orientation: 'portrait',
      margin_mm: options.margin_top,
      columns: options.columns,
      rows: options.rows,
      qr_size_mm: options.qr_size,
      spacing_mm: options.spacing,
      show_labels: options.show_labels,
      show_serial: false,
      label_font_size: options.font_size ?? 8,
      fg_color: design?.foreground_color ?? '#000000',
      bg_color: design?.background_color ?? '#ffffff',
      error_correction: design?.error_correction ?? 'M',
    },
    entry_ids: options.entry_ids?.map((entryId) => Number(entryId)).filter((entryId) => !Number.isNaN(entryId)),
  };
}

function normalizeProject(payload: Partial<Project> & { id?: string | number }): Project {
  const createdAt = payload.created_at ?? new Date(0).toISOString();
  return {
    id: String(payload.id ?? ''),
    name: payload.name ?? '',
    description: payload.description ?? undefined,
    entry_count: payload.entry_count ?? 0,
    generated_count: payload.generated_count ?? 0,
    created_at: createdAt,
    updated_at: payload.updated_at ?? createdAt,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
  };
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = formatApiErrorMessage(
      error.response?.data,
      error.message || 'An unexpected error occurred'
    );
    return Promise.reject(new Error(message));
  }
);

// ─── Projects ────────────────────────────────────────────────────────────────

export const projectsApi = {
  list: async (): Promise<Project[]> => {
    const { data } = await apiClient.get<Project[] | { items?: Project[] }>('/projects');
    const rawItems = Array.isArray(data) ? data : data.items ?? [];
    return rawItems.map((item) => normalizeProject(item));
  },

  create: async (payload: CreateProject): Promise<Project> => {
    const { data } = await apiClient.post<Project>('/projects', payload);
    return normalizeProject(data);
  },

  get: async (id: string): Promise<Project> => {
    const { data } = await apiClient.get<Project>(`/projects/${id}`);
    return normalizeProject(data);
  },

  update: async (id: string, payload: UpdateProject): Promise<Project> => {
    const { data } = await apiClient.put<Project>(`/projects/${id}`, payload);
    return normalizeProject(data);
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
    return {
      ...data,
      items: Array.isArray(data.items) ? data.items.map((entry) => normalizeEntry(entry)) : [],
    };
  },

  create: async (projectId: string, payload: CreateEntry): Promise<Entry> => {
    const { data } = await apiClient.post<Entry>(
      `/projects/${projectId}/entries`,
      payload
    );
    return normalizeEntry(data);
  },

  bulkCreate: async (
    projectId: string,
    entries: CreateEntry[]
  ): Promise<Entry[]> => {
    const { data } = await apiClient.post<Entry[]>(
      `/projects/${projectId}/entries/bulk`,
      { entries }
    );
    return data.map((entry) => normalizeEntry(entry));
  },

  update: async (id: string, payload: UpdateEntry): Promise<Entry> => {
    const { data } = await apiClient.put<Entry>(`/entries/${id}`, payload);
    return normalizeEntry(data);
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
    const request = mapQrPreviewRequest(payload);
    const { data } = await apiClient.post<Blob>('/qr/preview', request, {
      responseType: 'blob',
    });
    return data;
  },

  generate: async (entryId: string): Promise<Entry> => {
    const { data } = await apiClient.post<Entry>(`/qr/generate/${entryId}`, {
      fg_color: '#000000',
      bg_color: '#ffffff',
      error_correction: 'M',
      box_size: 10,
      border: 4,
    });
    return normalizeEntry(data);
  },
};

// ─── PDF ─────────────────────────────────────────────────────────────────────

export const pdfApi = {
  generate: async (
    projectId: string,
    options: PdfLayoutOptions,
    design?: Pick<QrDesignOptions, 'foreground_color' | 'background_color' | 'error_correction'>
  ): Promise<Blob> => {
    const request = mapPdfLayoutRequest(options, design);
    const { data } = await apiClient.post<Blob>(
      `/projects/${projectId}/pdf`,
      request,
      { responseType: 'blob' }
    );
    return data;
  },

  preview: async (
    projectId: string,
    options: PdfLayoutOptions,
    design?: Pick<QrDesignOptions, 'foreground_color' | 'background_color' | 'error_correction'>
  ): Promise<Blob> => {
    const request = mapPdfLayoutRequest(options, design);
    const { data } = await apiClient.post<Blob>(
      `/projects/${projectId}/pdf/preview`,
      request,
      { responseType: 'blob' }
    );
    return data;
  },

  list: async (projectId: string): Promise<ProjectPdfFile[]> => {
    const { data } = await apiClient.get<ProjectPdfFile[]>(`/projects/${projectId}/pdfs`);
    return Array.isArray(data) ? data : [];
  },

  download: async (projectId: string, fileName: string): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>(
      `/projects/${projectId}/pdfs/download`,
      { params: { file_name: fileName }, responseType: 'blob' }
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
  column_mapping: Record<string, string>;
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
    const { data } = await apiClient.get<
      Partial<Stats> & {
        entries_by_status?: { generated?: number };
        recent_project?: Project;
      }
    >('/stats');

    const recentProjects = Array.isArray(data.recent_projects)
      ? data.recent_projects.map((project) => normalizeProject(project))
      : data.recent_project
      ? [normalizeProject(data.recent_project)]
      : [];

    return {
      total_projects: data.total_projects ?? 0,
      total_entries: data.total_entries ?? 0,
      total_qr_generated:
        data.total_qr_generated ?? data.entries_by_status?.generated ?? 0,
      total_pdfs_generated: data.total_pdfs_generated ?? 0,
      recent_projects: recentProjects,
    };
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
