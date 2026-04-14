export interface Project {
  id: string;
  name: string;
  description?: string;
  default_qr_foreground_color: string;
  default_qr_background_color: string;
  default_qr_error_correction: 'L' | 'M' | 'Q' | 'H';
  entry_count: number;
  generated_count: number;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface CreateProject {
  name: string;
  description?: string;
  tags?: string[];
  default_qr_foreground_color?: string;
  default_qr_background_color?: string;
  default_qr_error_correction?: 'L' | 'M' | 'Q' | 'H';
}

export interface UpdateProject {
  name?: string;
  description?: string | null;
  tags?: string[];
  default_qr_foreground_color?: string;
  default_qr_background_color?: string;
  default_qr_error_correction?: 'L' | 'M' | 'Q' | 'H';
}
