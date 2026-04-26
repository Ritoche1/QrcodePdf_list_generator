import type { Entry, Project, ProjectPdfFile, Stats } from '@/types';

export const demoProject: Project = {
  id: 'demo-project',
  name: 'Demo Campaign',
  description: 'A sample project used to showcase the app in demo mode.',
  default_qr_foreground_color: '#0f172a',
  default_qr_background_color: '#ffffff',
  default_qr_error_correction: 'M',
  entry_count: 2,
  generated_count: 1,
  created_at: '2026-04-24T12:00:00.000Z',
  updated_at: '2026-04-26T12:00:00.000Z',
  tags: ['demo', 'showcase'],
};

export const demoEntries: Entry[] = [
  {
    id: 'demo-entry-1',
    project_id: demoProject.id,
    label: 'Landing page',
    content_type: 'url',
    content: { type: 'url', url: 'https://example.com/demo' },
    status: 'generated',
    tags: ['website'],
    qr_generated: true,
    qr_image_url: '/files/qr/demo-entry-1.png',
    qr_status: 'generated',
    qr_generated_at: '2026-04-26T12:10:00.000Z',
    created_at: '2026-04-26T12:00:00.000Z',
    updated_at: '2026-04-26T12:10:00.000Z',
  },
  {
    id: 'demo-entry-2',
    project_id: demoProject.id,
    label: 'Contact card',
    content_type: 'vcard',
    content: {
      type: 'vcard',
      first_name: 'Ava',
      last_name: 'Stone',
      email: 'ava@example.com',
      organization: 'Demo Studio',
    },
    status: 'draft',
    tags: ['contact'],
    qr_generated: false,
    qr_status: 'not_generated',
    created_at: '2026-04-26T12:15:00.000Z',
    updated_at: '2026-04-26T12:15:00.000Z',
  },
];

export const demoPdfFiles: ProjectPdfFile[] = [
  {
    file_name: 'demo-campaign-qr.pdf',
    size_bytes: 18432,
    created_at: '2026-04-26T12:20:00.000Z',
  },
];

export const demoStats: Stats = {
  total_projects: 1,
  total_entries: 2,
  total_qr_generated: 1,
  total_pdfs_generated: 1,
  recent_projects: [demoProject],
};

export function createDemoBlob(label: string, mimeType = 'text/html'): Blob {
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: Inter, system-ui, sans-serif;
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%);
            color: #0f172a;
          }
          .card {
            background: rgba(255, 255, 255, 0.92);
            border: 1px solid rgba(148, 163, 184, 0.25);
            border-radius: 24px;
            padding: 32px;
            max-width: 420px;
            box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12);
          }
          h1 { margin: 0 0 8px; font-size: 24px; }
          p { margin: 0; line-height: 1.6; color: #475569; }
          .badge {
            display: inline-block;
            margin-bottom: 16px;
            padding: 6px 10px;
            border-radius: 999px;
            background: #dbeafe;
            color: #1d4ed8;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">Demo Mode</div>
          <h1>${label}</h1>
          <p>This file is simulated so the public demo can showcase the workflow without creating real PDF artifacts.</p>
        </div>
      </body>
    </html>
  `;

  return new Blob([html], { type: mimeType });
}