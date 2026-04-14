export type EntryStatus = 'draft' | 'generated' | 'printed' | 'archived';

export type ContentType = 'url' | 'text' | 'vcard' | 'wifi';

export interface UrlContent {
  type: 'url';
  url: string;
}

export interface TextContent {
  type: 'text';
  text: string;
}

export interface VCardContent {
  type: 'vcard';
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  organization?: string;
  title?: string;
  address?: string;
}

export interface WiFiContent {
  type: 'wifi';
  ssid: string;
  password?: string;
  encryption: 'WPA' | 'WEP' | 'None';
  hidden: boolean;
}

export type QrContentData = UrlContent | TextContent | VCardContent | WiFiContent;

export interface Entry {
  id: string;
  project_id: string;
  label?: string;
  content_type: ContentType;
  content: QrContentData;
  status: EntryStatus;
  tags: string[];
  qr_generated: boolean;
  qr_image_url?: string;
  qr_status: 'not_generated' | 'generated' | 'outdated' | 'error';
  qr_generated_at?: string;
  qr_error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEntry {
  label?: string;
  content_type: ContentType;
  content: QrContentData;
  tags?: string[];
}

export interface UpdateEntry {
  label?: string;
  content_type?: ContentType;
  content?: QrContentData;
  status?: EntryStatus;
  tags?: string[];
}

export interface BulkCreateEntry {
  entries: CreateEntry[];
}

export interface EntryFilters {
  search?: string;
  status?: EntryStatus;
  tags?: string[];
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}
