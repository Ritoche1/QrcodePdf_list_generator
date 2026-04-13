export type PageSize = 'A4' | 'Letter' | 'Legal' | 'A3';

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
}
