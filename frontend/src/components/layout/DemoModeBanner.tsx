import { isDemoMode } from '@/lib/runtimeConfig';

export function DemoModeBanner() {
  if (!isDemoMode()) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
      <p className="text-sm font-semibold">Demo mode is enabled</p>
      <p className="mt-1 text-sm text-amber-800">
        This site is running with mocked data and restricted write actions. QR creation is available, while
        project, import, export, and PDF workflows are simulated.
      </p>
    </div>
  );
}