import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FolderOpen, Trash2, ArrowRight, QrCode } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Card, Button, Badge, Input, Modal, EmptyState, ConfirmModal } from '@/components/ui';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useProjects, useCreateProject, useDeleteProject } from '@/hooks/useProjects';
import { useToastContext } from '@/components/ui/Toast';
import type { CreateProject } from '@/types';

function ProjectCard({
  project,
  onDelete,
  onClick,
}: {
  project: import('@/types').Project;
  onDelete: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
          <FolderOpen className="w-5 h-5" />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-0.5 truncate">{project.name}</h3>
      {project.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{project.description}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
        <span className="flex items-center gap-1">
          <FolderOpen className="w-3.5 h-3.5" />
          {project.entry_count} entries
        </span>
        <span className="flex items-center gap-1">
          <QrCode className="w-3.5 h-3.5" />
          {project.generated_count} QR
        </span>
      </div>
      {project.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {project.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="gray">{tag}</Badge>
          ))}
          {project.tags.length > 3 && <Badge variant="gray">+{project.tags.length - 3}</Badge>}
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {new Date(project.updated_at).toLocaleDateString()}
        </p>
        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
      </div>
    </div>
  );
}

function CreateProjectModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CreateProject>({ name: '', description: '', tags: [] });
  const [tagInput, setTagInput] = useState('');
  const { mutateAsync: createProject, isPending } = useCreateProject();
  const toast = useToastContext();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const project = await createProject(form);
      toast.success('Project created');
      onClose();
      navigate(`/projects/${project.id}`);
    } catch (e: unknown) {
      toast.error('Failed to create project', e instanceof Error ? e.message : undefined);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags?.includes(t)) {
      setForm((prev) => ({ ...prev, tags: [...(prev.tags ?? []), t] }));
    }
    setTagInput('');
  };

  const removeTag = (tag: string) =>
    setForm((prev) => ({ ...prev, tags: prev.tags?.filter((t) => t !== tag) }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Project"
      description="Group related QR code entries into a project"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} loading={isPending} disabled={!form.name.trim()}>
            Create project
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Project Name"
          placeholder="e.g. Product Labels Q4 2024"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          autoFocus
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            rows={2}
            placeholder="What's this project for?"
            value={form.description ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>
        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Add a tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addTag(); }
              }}
            />
            <Button type="button" variant="outline" size="md" onClick={addTag}>
              Add
            </Button>
          </div>
          {form.tags && form.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {form.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="inline-flex items-center gap-1"
                >
                  <Badge variant="indigo">
                    {tag} ×
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

export function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data: projects, isLoading } = useProjects();
  const { mutateAsync: deleteProject, isPending: isDeleting } = useDeleteProject();
  const toast = useToastContext();
  const navigate = useNavigate();

  const filtered = (projects ?? []).filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProject(deleteId);
      toast.success('Project deleted');
    } catch {
      toast.error('Failed to delete project');
    } finally {
      setDeleteId(null);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Projects"
        description={`${projects?.length ?? 0} project${projects?.length !== 1 ? 's' : ''}`}
        actions={
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateOpen(true)}
          >
            New Project
          </Button>
        }
      />

      {/* Search */}
      {(projects?.length ?? 0) > 0 && (
        <div className="mb-6 max-w-sm">
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-8 h-8" />}
          title={search ? 'No matching projects' : 'No projects yet'}
          description={
            search
              ? 'Try a different search term.'
              : 'Create your first project to start organizing QR code entries.'
          }
          action={
            !search && (
              <Button
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setCreateOpen(true)}
              >
                Create Project
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={() => setDeleteId(project.id)}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}

      <CreateProjectModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Project"
        message="Are you sure you want to delete this project and all its entries? This action cannot be undone."
        confirmLabel="Delete"
        loading={isDeleting}
      />
    </div>
  );
}
