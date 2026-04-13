import type { QrContentData } from './entry';

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrDesignOptions {
  foreground_color: string;
  background_color: string;
  error_correction: ErrorCorrectionLevel;
  size?: number;
}

export interface QrPreviewRequest {
  content: QrContentData;
  design: QrDesignOptions;
}
