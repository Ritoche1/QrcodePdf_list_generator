import { useNavigate } from 'react-router-dom';
import { FolderOpen, QrCode, FileDown, TrendingUp, Plus, ArrowRight, } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Card, Button, Badge } from '@/components/ui';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { isDemoMode } from '@/lib/runtimeConfig';
import { useProjects } from '@/hooks/useProjects';
import { useStats } from '@/hooks/useStats';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.FC<{ className?: string }>;
  description?: string;
  iconBg: string;
  iconColor: string;
}

function StatCard({ title, value, icon: Icon, description, iconBg, iconColor }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-1.5 text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
          {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </Card>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const demoMode = isDemoMode();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: stats, isLoading: statsLoading } = useStats();
  const projectsList = Array.isArray(projects) ? projects : [];

  const isLoading = projectsLoading || statsLoading;

  // Fallback stats derived from project data if backend /stats is unavailable
  const totalProjects = stats?.total_projects ?? projectsList.length;
  const totalEntries = stats?.total_entries ?? projectsList.reduce((s, p) => s + p.entry_count, 0);
  const totalQr = stats?.total_qr_generated ?? projectsList.reduce((s, p) => s + p.generated_count, 0);

  const recentProjects = stats?.recent_projects ?? projectsList.slice(0, 5);

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your QR code projects"
        actions={
          <Button
            leftIcon={<FolderOpen className="w-4 h-4" />}
            onClick={() => navigate('/projects')}
          >
            {demoMode ? 'Demo project' : 'Projects'}
          </Button>
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Projects"
          value={totalProjects}
          icon={FolderOpen}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-500"
        />
        <StatCard
          title="Total Entries"
          value={totalEntries}
          icon={TrendingUp}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
        />
        <StatCard
          title="QR Codes Generated"
          value={totalQr}
          icon={QrCode}
          iconBg="bg-green-50"
          iconColor="text-green-500"
        />
        <StatCard
          title="PDFs Created"
          value={stats?.total_pdfs_generated ?? '—'}
          icon={FileDown}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Recent Projects</h2>
                <p className="text-sm text-gray-500">Your most recently updated projects</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={() => navigate('/projects')}
              >
                View all
              </Button>
            </div>

            {recentProjects.length === 0 ? (
              <div className="py-10 text-center">
                <FolderOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No projects yet</p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate('/projects')}
                >
                  Create your first project
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="w-full flex items-center gap-4 py-3.5 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors text-left"
                  >
                    <div className="flex-shrink-0 w-9 h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {project.entry_count} entries · {project.generated_count} QR codes
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(project.tags ?? []).slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="gray">
                          {tag}
                        </Badge>
                      ))}
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-5">Quick Actions</h2>
            <div className="space-y-3">
              {!demoMode && (
                <QuickAction
                  icon={Plus}
                  label="New Project"
                  description="Create a project to organize QR codes"
                  onClick={() => navigate('/projects')}
                  iconBg="bg-indigo-100"
                  iconColor="text-indigo-600"
                />
              )}
              <QuickAction
                icon={QrCode}
                label="Create Single QR"
                description="Generate a QR code instantly"
                onClick={() => navigate('/qr/create')}
                iconBg="bg-green-100"
                iconColor="text-green-600"
              />
              {!demoMode && (
                <QuickAction
                  icon={FileDown}
                  label="Generate PDF"
                  description="Export your QR codes as a PDF"
                  onClick={() =>
                    recentProjects[0]
                      ? navigate(`/projects/${recentProjects[0].id}/generate`)
                      : navigate('/projects')
                  }
                  iconBg="bg-purple-100"
                  iconColor="text-purple-600"
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface QuickActionProps {
  icon: React.FC<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
  iconBg: string;
  iconColor: string;
}

function QuickAction({ icon: Icon, label, description, onClick, iconBg, iconColor }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all text-left group"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-700">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
    </button>
  );
}
