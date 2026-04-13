import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, FileSpreadsheet, FolderOpen, QrCode, FileDown, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Card, Badge } from '@/components/ui';

export function DocumentationPage() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const sectionId = location.hash.replace('#', '');
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  return (
    <div>
      <PageHeader
        title="Documentation"
        description="Learn the complete workflow: projects, entries, CSV import, QR generation, and PDF export."
      />

      <div className="space-y-6">
        <section id="introduction" className="scroll-mt-24">
          <Card>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Introduction</h2>
                <p className="text-sm text-gray-600 mt-1">
                  QRCodePDF helps you manage QR entries inside projects, generate QR images, and export
                  print-ready PDFs in a single workflow.
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section id="getting-started" className="scroll-mt-24">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900">Getting Started</h2>
            <p className="text-sm text-gray-600 mt-1">
              Follow this order for the best results:
            </p>
            <ol className="mt-3 list-decimal list-inside text-sm text-gray-700 space-y-1">
              <li>Create a project.</li>
              <li>Add entries manually or import from CSV.</li>
              <li>Generate QR codes for entries.</li>
              <li>Generate and download a PDF.</li>
            </ol>
          </Card>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section id="projects-guide" className="scroll-mt-24">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <FolderOpen className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-semibold text-gray-900">Projects Guide</h3>
              </div>
              <ul className="text-sm text-gray-700 space-y-2">
                <li>Create one project for each campaign, event, or client.</li>
                <li>Use clear names such as Summer Promo 2026.</li>
                <li>Add a short description so your team understands the goal.</li>
                <li>Open a project to manage all entries and exports.</li>
              </ul>
            </Card>
          </section>

          <section id="entries-guide" className="scroll-mt-24">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="w-5 h-5 text-green-500" />
                <h3 className="text-base font-semibold text-gray-900">Entries Guide</h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="blue">url</Badge>
                <Badge variant="green">text</Badge>
                <Badge variant="orange">vcard</Badge>
                <Badge variant="indigo">wifi</Badge>
              </div>
              <ul className="text-sm text-gray-700 space-y-2">
                <li>Each entry becomes one QR code in your PDF.</li>
                <li>Use URL for links, Text for plain messages, vCard for contacts, WiFi for network access.</li>
                <li>Status updates automatically when QR generation succeeds.</li>
              </ul>
            </Card>
          </section>
        </div>

        <section id="csv-import-guide" className="scroll-mt-24">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet className="w-5 h-5 text-blue-500" />
              <h3 className="text-base font-semibold text-gray-900">CSV Import Guide</h3>
            </div>
            <p className="text-sm text-gray-700 mb-3">
              CSV import is the fastest way to add many entries.
            </p>

            <h4 className="text-sm font-semibold text-gray-800 mb-2">Required columns</h4>
            <ul className="text-sm text-gray-700 space-y-1 mb-4">
              <li>content_type: one of url, text, vcard, wifi</li>
              <li>A matching data column depending on content_type</li>
            </ul>

            <h4 className="text-sm font-semibold text-gray-800 mb-2">Recommended columns</h4>
            <ul className="text-sm text-gray-700 space-y-1 mb-4">
              <li>label: friendly name shown in tables and PDFs</li>
              <li>tags: comma-separated tags such as marketing, france, batch1</li>
            </ul>

            <h4 className="text-sm font-semibold text-gray-800 mb-2">CSV examples</h4>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">content_type</th>
                    <th className="text-left px-3 py-2 font-medium">url</th>
                    <th className="text-left px-3 py-2 font-medium">text</th>
                    <th className="text-left px-3 py-2 font-medium">first_name</th>
                    <th className="text-left px-3 py-2 font-medium">last_name</th>
                    <th className="text-left px-3 py-2 font-medium">ssid</th>
                    <th className="text-left px-3 py-2 font-medium">password</th>
                    <th className="text-left px-3 py-2 font-medium">label</th>
                    <th className="text-left px-3 py-2 font-medium">tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  <tr>
                    <td className="px-3 py-2">url</td>
                    <td className="px-3 py-2">https://www.google.com</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">Studio Website</td>
                    <td className="px-3 py-2">website,brand</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">text</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">Welcome to our event</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">Welcome Message</td>
                    <td className="px-3 py-2">event,onsite</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">vcard</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">Alice</td>
                    <td className="px-3 py-2">Martin</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">Sales Contact</td>
                    <td className="px-3 py-2">contact,b2b</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">wifi</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">Guest-Network</td>
                    <td className="px-3 py-2">Welcome2026</td>
                    <td className="px-3 py-2">Guest WiFi</td>
                    <td className="px-3 py-2">wifi,office</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Tip: Keep one content_type per row, and fill only the columns required for that type.
            </p>
          </Card>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section id="pdf-export-guide" className="scroll-mt-24">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <FileDown className="w-5 h-5 text-purple-500" />
                <h3 className="text-base font-semibold text-gray-900">PDF Export Guide</h3>
              </div>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2">
                <li>Open a project and verify your entries.</li>
                <li>Generate QR codes if they are still in draft.</li>
                <li>Open the PDF generator page from the project.</li>
                <li>Adjust layout options and preview.</li>
                <li>Click generate and download the final PDF.</li>
              </ol>
            </Card>
          </section>

          <section id="troubleshooting" className="scroll-mt-24">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-semibold text-gray-900">Troubleshooting</h3>
              </div>
              <ul className="text-sm text-gray-700 space-y-2">
                <li>If import fails, confirm column names and content_type values.</li>
                <li>If preview is blank, check required fields for the selected content type.</li>
                <li>If PDF is empty, ensure the project has entries and generated QR codes.</li>
                <li>If you changed Docker/frontend code, run a full rebuild before retrying.</li>
              </ul>
            </Card>
          </section>
        </div>

        <Card>
          <h3 className="text-base font-semibold text-gray-900">Need more help?</h3>
          <p className="text-sm text-gray-600 mt-2">
            You can start from the Projects page and follow the flow step by step.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/projects"
              className="inline-flex items-center rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Go to Projects
            </Link>
            <Link
              to="/qr/create"
              className="inline-flex items-center rounded-lg border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Try Single QR Creator
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
