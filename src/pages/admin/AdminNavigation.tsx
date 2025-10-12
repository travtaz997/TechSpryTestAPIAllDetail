import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Undo2, ExternalLink } from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useNavigationMenu, type NavigationMenuItem } from '../../contexts/NavigationContext';

interface DraftItem {
  label: string;
  href: string;
}

export default function AdminNavigation() {
  const { items, addItem, updateItem, removeItem, moveItem, resetToDefaults } = useNavigationMenu();
  const [draft, setDraft] = useState<DraftItem>({ label: '', href: '' });
  const [message, setMessage] = useState('');
  const timeoutRef = useRef<number | null>(null);

  const handleDraftChange = (key: keyof DraftItem, value: string) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const showMessage = (text: string) => {
    setMessage(text);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setMessage('');
      timeoutRef.current = null;
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleAddItem = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const label = draft.label.trim();
    const href = draft.href.trim() || '/';

    if (!label) {
      showMessage('Please provide a label for the navigation item.');
      return;
    }

    addItem({ label, href });
    setDraft({ label: '', href: '' });
    showMessage('Navigation item added. Changes are saved automatically.');
  };

  const handleUpdateItem = (id: string, updates: Partial<Omit<NavigationMenuItem, 'id'>>) => {
    updateItem(id, updates);
    showMessage('Navigation menu updated.');
  };

  const handleRemoveItem = (id: string) => {
    removeItem(id);
    showMessage('Navigation item removed.');
  };

  const handleReset = () => {
    resetToDefaults();
    showMessage('Navigation menu reset to defaults.');
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Navigation Menu</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage the primary links that appear in the storefront header. Reordering or editing items updates the storefront instantly.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            <Undo2 className="h-4 w-4" />
            Reset defaults
          </button>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {message}
          </div>
        )}

        <div className="space-y-6">
          <section className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-800">Menu items</h2>
              <p className="mt-1 text-sm text-gray-500">Drag handles are replaced with up/down arrows for quick reordering.</p>
            </div>
            <ul className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <li className="px-6 py-6 text-sm text-gray-500">No navigation items configured yet.</li>
              ) : (
                items.map((item, index) => {
                  const canMoveUp = index > 0;
                  const canMoveDown = index < items.length - 1;
                  return (
                    <li key={item.id} className="px-6 py-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
                        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                          <div className="flex items-center gap-3 md:w-48">
                            <span className="text-xs font-semibold uppercase text-gray-400">Label</span>
                            <input
                              type="text"
                              value={item.label}
                              onChange={event => handleUpdateItem(item.id, { label: event.target.value })}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Navigation label"
                            />
                          </div>
                          <div className="flex items-center gap-3 md:flex-1">
                            <span className="text-xs font-semibold uppercase text-gray-400">Link</span>
                            <input
                              type="text"
                              value={item.href}
                              onChange={event => handleUpdateItem(item.id, { href: event.target.value })}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="/path-or-full-url"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 md:flex-col">
                          <button
                            type="button"
                            onClick={() => moveItem(item.id, 'up')}
                            disabled={!canMoveUp}
                            className="inline-flex items-center justify-center rounded-full border border-gray-300 p-2 text-gray-600 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
                            aria-label="Move item up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(item.id, 'down')}
                            disabled={!canMoveDown}
                            className="inline-flex items-center justify-center rounded-full border border-gray-300 p-2 text-gray-600 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
                            aria-label="Move item down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <a
                            href={item.href || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-full border border-gray-300 p-2 text-gray-600 transition hover:border-blue-300 hover:text-blue-600"
                            aria-label="Open link"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="inline-flex items-center justify-center rounded-full border border-red-200 p-2 text-red-500 transition hover:bg-red-50"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-800">Add menu item</h2>
              <p className="mt-1 text-sm text-gray-500">Links can be internal paths (e.g. /support) or full URLs to external destinations.</p>
            </div>
            <form onSubmit={handleAddItem} className="space-y-4 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Label</label>
                  <input
                    type="text"
                    value={draft.label}
                    onChange={event => handleDraftChange('label', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Support"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Link</label>
                  <input
                    type="text"
                    value={draft.href}
                    onChange={event => handleDraftChange('href', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. /support"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add menu item
              </button>
            </form>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
