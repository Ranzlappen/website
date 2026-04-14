import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { useTopics } from '../../hooks/useTopics';
import { useStore } from '../../hooks/useStore';
import { adminDeleteTopicFn, adminCreateTopicFn, adminEditTopicFn } from '../../firebase';
import DataTable from './components/DataTable';
import type { Topic } from '../../types';

export default function AdminTopics() {
  const { topics, loading } = useTopics();
  const addToast = useStore((s) => s.addToast);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Create topic modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    category: 'Other',
  });
  const [creating, setCreating] = useState(false);

  // Edit modal state
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '' });
  const [editing, setEditing] = useState(false);

  const handleDelete = async (topicId: string) => {
    if (!confirm('Are you sure you want to delete this topic? This cannot be undone.')) return;
    setDeleting(topicId);
    try {
      await adminDeleteTopicFn({ topicId });
      addToast('Topic deleted.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to delete topic.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await adminCreateTopicFn({
        title: createForm.title,
        description: createForm.description,
        category: createForm.category,
        metrics: [
          {
            id: crypto.randomUUID(),
            label: 'Default Metric',
            choices: [
              { id: crypto.randomUUID(), label: 'Option A', color: '#3b82f6', votes: 0 },
              { id: crypto.randomUUID(), label: 'Option B', color: '#ef4444', votes: 0 },
            ],
          },
        ],
      });
      addToast('Topic created!', 'success');
      setShowCreate(false);
      setCreateForm({ title: '', description: '', category: 'Other' });
    } catch (err) {
      console.error(err);
      addToast('Failed to create topic.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (topic: Topic) => {
    setEditTopic(topic);
    setEditForm({ title: topic.title, description: topic.description, category: topic.category });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTopic) return;
    setEditing(true);
    try {
      await adminEditTopicFn({
        topicId: editTopic.id,
        updates: {
          title: editForm.title,
          description: editForm.description,
          category: editForm.category,
        },
      });
      addToast('Topic updated!', 'success');
      setEditTopic(null);
    } catch (err) {
      console.error(err);
      addToast('Failed to update topic.', 'error');
    } finally {
      setEditing(false);
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (t: Topic) => (
        <div className="max-w-xs truncate font-medium text-gray-200">{t.title}</div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (t: Topic) => (
        <span className="text-xs text-gray-400">{t.category}</span>
      ),
    },
    {
      key: 'metrics',
      label: 'Metrics',
      render: (t: Topic) => <span className="text-xs text-gray-500">{t.metrics.length}</span>,
    },
    {
      key: 'votes',
      label: 'Votes',
      render: (t: Topic) => <span className="text-xs text-gray-400">{t.totalVotes}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (t: Topic) => (
        <div className="flex items-center gap-2">
          <Link to={`/topic/${t.id}`} className="text-gray-500 hover:text-brand-400" title="View">
            <ExternalLink size={14} />
          </Link>
          <button onClick={() => openEdit(t)} className="text-gray-500 hover:text-blue-400" title="Edit">
            <Pencil size={14} />
          </button>
          <button
            onClick={() => handleDelete(t.id)}
            disabled={deleting === t.id}
            className="text-gray-500 hover:text-red-400 disabled:opacity-30"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-100">Topics</h1>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  const categories = ['Politics', 'Technology', 'Science', 'Culture', 'Environment', 'Health', 'Sports', 'Other'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Topics ({topics.length})</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 rounded-lg bg-brand-400 px-3 py-2 text-sm font-medium text-surface hover:bg-brand-500 transition-colors"
        >
          <Plus size={16} /> Create Topic
        </button>
      </div>

      <DataTable columns={columns} data={topics} emptyMessage="No topics yet." />

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-xl border border-surface-200 bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Create Topic</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                required
                maxLength={200}
                className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-brand-400 focus:outline-none"
              />
              <textarea
                placeholder="Description"
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                required
                rows={3}
                className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-brand-400 focus:outline-none resize-none"
              />
              <select
                value={createForm.category}
                onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 focus:border-brand-400 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500">A default metric with two options will be created. Edit the topic afterwards for more.</p>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-gray-200">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-medium text-surface hover:bg-brand-500 disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditTopic(null)}>
          <div className="w-full max-w-md rounded-xl border border-surface-200 bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Edit Topic</h2>
            <form onSubmit={handleEdit} className="space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                required
                maxLength={200}
                className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-brand-400 focus:outline-none"
              />
              <textarea
                placeholder="Description"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                required
                rows={3}
                className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-brand-400 focus:outline-none resize-none"
              />
              <select
                value={editForm.category}
                onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 focus:border-brand-400 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditTopic(null)} className="rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-gray-200">
                  Cancel
                </button>
                <button type="submit" disabled={editing} className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-medium text-surface hover:bg-brand-500 disabled:opacity-50">
                  {editing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
