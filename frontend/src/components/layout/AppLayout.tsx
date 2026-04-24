import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
