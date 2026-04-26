export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ApiError {
  detail: string;
  status_code?: number;
}

export interface AppConfig {
  app_name: string;
  app_version: string;
  debug: boolean;
  demo_mode: boolean;
}

export interface Stats {
  total_projects: number;
  total_entries: number;
  total_qr_generated: number;
  total_pdfs_generated: number;
  recent_projects: import('./project').Project[];
}
