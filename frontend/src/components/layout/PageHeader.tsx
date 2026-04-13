import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { clsx } from 'clsx';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backTo?: string;
  breadcrumbs?: Breadcrumb[];
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  backTo,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={clsx('mb-6', className)}>
      {(backTo || breadcrumbs) && (
        <div className="flex items-center gap-1.5 mb-3 text-sm text-gray-500">
          {backTo && (
            <button
              onClick={() => navigate(backTo)}
              className="flex items-center gap-1 hover:text-gray-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          {breadcrumbs?.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-gray-300">/</span>}
              {crumb.href ? (
                <button
                  onClick={() => navigate(crumb.href!)}
                  className="hover:text-gray-700 transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-gray-700 font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
