export type PageSize = 'A4' | 'Letter' | 'Legal' | 'A3';
export type PdfQrRenderMode = 'single_design' | 'per_entry_cached';

export interface PdfLayoutOptions {
  page_size: PageSize;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  columns: number;
  rows: number;
  qr_size: number;
  spacing: number;
  show_labels: boolean;
  font_size?: number;
  entry_ids?: string[];
  qr_render_mode?: PdfQrRenderMode;
}

export interface ProjectPdfFile {
  file_name: string;
  size_bytes: number;
  created_at: string;
}
