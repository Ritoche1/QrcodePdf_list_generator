import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  FolderOpen,
  QrCode,
  BookOpen,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  label: string;
  to: string;
  icon: React.FC<{ className?: string }>;
  exact?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, exact: true },
  { label: 'Projects', to: '/projects', icon: FolderOpen },
  { label: 'Create QR', to: '/qr/create', icon: QrCode },
  { label: 'Documentation', to: '/docs', icon: BookOpen },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="flex flex-col w-60 h-screen bg-white border-r border-gray-200 sticky top-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-100">
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-500 text-white shadow-sm shadow-indigo-200">
          <QrCodeIcon />
        </div>
        <span className="font-bold text-gray-900 text-base tracking-tight">QRCodePDF</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.exact}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <item.icon
                    className={clsx(
                      'w-4 h-4 flex-shrink-0',
                      isActive ? 'text-indigo-500' : 'text-gray-400'
                    )}
                  />
                  {item.label}
                  {isActive && (
                    <ChevronRight className="ml-auto w-3.5 h-3.5 text-indigo-400" />
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">QRCodePDF v1.0</p>
      </div>
    </aside>
  );
}

// Inline SVG QR icon for branding
function QrCodeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden>
      <rect x="2" y="2" width="7" height="7" rx="1" />
      <rect x="11" y="2" width="7" height="7" rx="1" />
      <rect x="2" y="11" width="7" height="7" rx="1" />
      <rect x="11" y="11" width="2.5" height="2.5" />
      <rect x="15.5" y="11" width="2.5" height="2.5" />
      <rect x="11" y="15.5" width="2.5" height="2.5" />
      <rect x="15.5" y="15.5" width="2.5" height="2.5" />
    </svg>
  );
}
