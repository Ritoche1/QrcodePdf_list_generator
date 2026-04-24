import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  FolderOpen,
  QrCode,
  BookOpen,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  label: string;
  to: string;
  icon: React.FC<{ className?: string }>;
  exact?: boolean;
  children?: Array<{
    label: string;
    to: string;
  }>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, exact: true },
  { label: 'Projects', to: '/projects', icon: FolderOpen },
  { label: 'Create QR', to: '/qr/create', icon: QrCode },
  {
    label: 'Documentation',
    to: '/docs',
    icon: BookOpen,
    children: [
      { label: 'Introduction', to: '/docs#introduction' },
      { label: 'Getting Started', to: '/docs#getting-started' },
      { label: 'Projects Guide', to: '/docs#projects-guide' },
      { label: 'Entries Guide', to: '/docs#entries-guide' },
      { label: 'CSV Import Guide', to: '/docs#csv-import-guide' },
      { label: 'PDF Export Guide', to: '/docs#pdf-export-guide' },
      { label: 'Troubleshooting', to: '/docs#troubleshooting' },
    ],
  },
];

const MD_BREAKPOINT_PX = 768;

export function Sidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${MD_BREAKPOINT_PX}px)`);
    const updateDesktop = () => setIsDesktop(mediaQuery.matches);
    updateDesktop();
    mediaQuery.addEventListener('change', updateDesktop);
    return () => mediaQuery.removeEventListener('change', updateDesktop);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((prev) => !prev)}
        className="md:hidden fixed right-4 bottom-4 z-40 p-3 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-300 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-30"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          role="presentation"
        />
      )}

      <aside
        className={clsx(
          'fixed md:sticky top-0 left-0 z-40 h-screen w-60 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        role="navigation"
        aria-hidden={isDesktop ? false : !mobileOpen}
      >
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
              const activeWithHash = `${location.pathname}${location.hash}`;
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
                  {item.children && location.pathname.startsWith(item.to) && (
                    <ul className="mt-1 ml-7 space-y-0.5">
                      {item.children.map((child) => {
                        const isChildActive = activeWithHash === child.to;
                        return (
                          <li key={child.to}>
                            <NavLink
                              to={child.to}
                              className={clsx(
                                'block px-3 py-1.5 rounded-md text-xs transition-colors',
                                isChildActive
                                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                              )}
                            >
                              {child.label}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  )}
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
    </>
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
