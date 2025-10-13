import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Undo2, ExternalLink } from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useNavigationMenu, type NavigationMenuItem } from '../../contexts/NavigationContext';
import { useCatalogCategories, type CatalogCategory } from '../../contexts/CatalogCategoryContext';

interface LinkDraft {
  label: string;
  href: string;
}

interface CategoryDraft {
  label: string;
  slug: string;
  description: string;
  highlights: string;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const parseHighlights = (value: string) =>
  value
    .split(',')
    .map(segment => segment.trim())
    .filter(Boolean);

export default function AdminNavigation() {
  const {
    items: navigationItems,
    addItem: addNavigationItem,
    updateItem: updateNavigationItem,
    removeItem: removeNavigationItem,
    moveItem: moveNavigationItem,
    resetToDefaults: resetNavigationDefaults,
  } = useNavigationMenu();
  const {
    items: categoryItems,
    addItem: addCategoryItem,
    updateItem: updateCategoryItem,
    removeItem: removeCategoryItem,
    moveItem: moveCategoryItem,
    resetToDefaults: resetCategoryDefaults,
  } = useCatalogCategories();

  const [linkDraft, setLinkDraft] = useState<LinkDraft>({ label: '', href: '' });
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>({ label: '', slug: '', description: '', highlights: '' });
  const [highlightDrafts, setHighlightDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const timeoutRef = useRef<number | null>(null);

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

  useEffect(() => () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    setHighlightDrafts(prev => {
      const next: Record<string, string> = {};
      for (const category of categoryItems) {
        next[category.id] = prev[category.id] ?? (category.highlights ?? []).join(', ');
      }
      return next;
    });
  }, [categoryItems]);

  const handleLinkDraftChange = (key: keyof LinkDraft, value: string) => {
    setLinkDraft(prev => ({ ...prev, [key]: value }));
  };

  const handleCategoryDraftChange = (key: keyof CategoryDraft, value: string) => {
    setCategoryDraft(prev => {
      if (key === 'label') {
        const nextLabel = value;
        const slug = prev.slug.trim() ? prev.slug : slugify(value);
        return { ...prev, label: nextLabel, slug };
      }
      return { ...prev, [key]: value };
    });
  };

  const handleAddLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const label = linkDraft.label.trim();
    const href = linkDraft.href.trim() || '/';

    if (!label) {
      showMessage('Please provide a label for the navigation item.');
      return;
    }

    addNavigationItem({ label, href });
    setLinkDraft({ label: '', href: '' });
    showMessage('Navigation item added. Changes are saved automatically.');
  };

  const handleUpdateLink = (id: string, updates: Partial<Omit<NavigationMenuItem, 'id'>>) => {
    updateNavigationItem(id, updates);
    showMessage('Navigation menu updated.');
  };

  const handleRemoveLink = (id: string) => {
    removeNavigationItem(id);
    showMessage('Navigation item removed.');
  };

  const handleMoveLink = (id: string, direction: 'up' | 'down') => {
    moveNavigationItem(id, direction);
    showMessage('Navigation order updated.');
  };

  const handleResetLinks = () => {
    resetNavigationDefaults();
    showMessage('Navigation links reset to defaults.');
  };

  const handleAddCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const label = categoryDraft.label.trim();
    const slug = categoryDraft.slug.trim() || slugify(label);
    const description = categoryDraft.description.trim();
    const highlights = parseHighlights(categoryDraft.highlights);

    if (!label) {
      showMessage('Please provide a label for the category.');
      return;
    }

    addCategoryItem({
      label,
      slug,
      description,
      highlights: highlights.length > 0 ? highlights : undefined,
    });
    setCategoryDraft({ label: '', slug: '', description: '', highlights: '' });
    showMessage('Category added. The storefront menu updates immediately.');
  };

  const handleUpdateCategory = (id: string, updates: Partial<Omit<CatalogCategory, 'id'>>) => {
    updateCategoryItem(id, updates);
    showMessage('Category updated.');
  };

  const handleRemoveCategory = (id: string) => {
    removeCategoryItem(id);
    showMessage('Category removed from the menu.');
  };

  const handleMoveCategory = (id: string, direction: 'up' | 'down') => {
    moveCategoryItem(id, direction);
    showMessage('Category order updated.');
  };

  const handleResetCategories = () => {
    resetCategoryDefaults();
    setHighlightDrafts({});
    showMessage('Category menu reset to defaults.');
  };

  const handleHighlightChange = (id: string, value: string) => {
    setHighlightDrafts(prev => ({ ...prev, [id]: value }));
  };

  const handleHighlightBlur = (id: string) => {
    const raw = highlightDrafts[id] ?? '';
    const highlights = parseHighlights(raw);
    updateCategoryItem(id, { highlights: highlights.length > 0 ? highlights : undefined });
    setHighlightDrafts(prev => ({ ...prev, [id]: highlights.join(', ') }));
    showMessage('Category highlights updated.');
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Navigation Menu</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage the storefront header links and the “Shop products” category menu. Updates save instantly for shoppers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetLinks}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              <Undo2 className="h-4 w-4" />
              Reset quick links
            </button>
            <button
              type="button"
              onClick={handleResetCategories}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              <Undo2 className="h-4 w-4" />
              Reset categories
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>
        )}

        <div className="space-y-6">
          <section className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-800">Quick links</h2>
              <p className="mt-1 text-sm text-gray-500">These links appear to the right of the category menu in the storefront header.</p>
            </div>
            <ul className="divide-y divide-gray-100">
              {navigationItems.length === 0 ? (
                <li className="px-6 py-6 text-sm text-gray-500">No quick links configured yet.</li>
              ) : (
                navigationItems.map((item, index) => {
                  const canMoveUp = index > 0;
                  const canMoveDown = index < navigationItems.length - 1;
                  return (
                    <li key={item.id} className="px-6 py-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
                        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                          <div className="flex items-center gap-3 md:w-48">
                            <span className="text-xs font-semibold uppercase text-gray-400">Label</span>
                            <input
                              type="text"
                              value={item.label}
                              onChange={event => handleUpdateLink(item.id, { label: event.target.value })}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Navigation label"
                            />
                          </div>
                          <div className="flex items-center gap-3 md:flex-1">
                            <span className="text-xs font-semibold uppercase text-gray-400">Link</span>
                            <input
                              type="text"
                              value={item.href}
                              onChange={event => handleUpdateLink(item.id, { href: event.target.value })}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="/path-or-full-url"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 md:flex-col">
                          <button
                            type="button"
                            onClick={() => handleMoveLink(item.id, 'up')}
                            disabled={!canMoveUp}
                            className="inline-flex items-center justify-center rounded-full border border-gray-300 p-2 text-gray-600 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
                            aria-label="Move link up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveLink(item.id, 'down')}
                            disabled={!canMoveDown}
                            className="inline-flex items-center justify-center rounded-full border border-gray-300 p-2 text-gray-600 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
                            aria-label="Move link down"
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
                            onClick={() => handleRemoveLink(item.id)}
                            className="inline-flex items-center justify-center rounded-full border border-red-200 p-2 text-red-500 transition hover:bg-red-50"
                            aria-label="Remove link"
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
              <h2 className="text-lg font-semibold text-gray-800">Add quick link</h2>
              <p className="mt-1 text-sm text-gray-500">Links can be internal paths (e.g. /support) or full URLs to external destinations.</p>
            </div>
            <form onSubmit={handleAddLink} className="space-y-4 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Label</label>
                  <input
                    type="text"
                    value={linkDraft.label}
                    onChange={event => handleLinkDraftChange('label', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Support"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Link</label>
                  <input
                    type="text"
                    value={linkDraft.href}
                    onChange={event => handleLinkDraftChange('href', event.target.value)}
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
                Add quick link
              </button>
            </form>
          </section>

          <section className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-800">Category menu</h2>
              <p className="mt-1 text-sm text-gray-500">These categories power the “Shop products” dropdown and catalog sidebar filters.</p>
            </div>
            <ul className="divide-y divide-gray-100">
              {categoryItems.length === 0 ? (
                <li className="px-6 py-6 text-sm text-gray-500">No categories configured yet.</li>
              ) : (
                categoryItems.map((category, index) => {
                  const canMoveUp = index > 0;
                  const canMoveDown = index < categoryItems.length - 1;
                  const highlightValue = highlightDrafts[category.id] ?? '';
                  const previewHref = category.slug ? `/catalog?category=${category.slug}` : '/catalog';
                  return (
                    <li key={category.id} className="px-6 py-5">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
                        <div className="flex-1 grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Label</label>
                            <input
                              type="text"
                              value={category.label}
                              onChange={event => handleUpdateCategory(category.id, { label: event.target.value })}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Category label"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Slug</label>
                            <input
                              type="text"
                              value={category.slug}
                              onChange={event => handleUpdateCategory(category.id, { slug: event.target.value })}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g. barcode-scanners"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Description</label>
                            <textarea
                              value={category.description}
                              onChange={event => handleUpdateCategory(category.id, { description: event.target.value })}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={3}
                              placeholder="Short description"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Highlights</label>
                            <input
                              type="text"
                              value={highlightValue}
                              onChange={event => handleHighlightChange(category.id, event.target.value)}
                              onBlur={() => handleHighlightBlur(category.id)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Comma-separated highlights"
                            />
                            <p className="mt-1 text-xs text-gray-500">Example: 1D &amp; 2D scanning, Cordless options, Retail ready</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 lg:flex-col">
                          <button
                            type="button"
                            onClick={() => handleMoveCategory(category.id, 'up')}
                            disabled={!canMoveUp}
                            className="inline-flex items-center justify-center rounded-full border border-gray-300 p-2 text-gray-600 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
                            aria-label="Move category up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveCategory(category.id, 'down')}
                            disabled={!canMoveDown}
                            className="inline-flex items-center justify-center rounded-full border border-gray-300 p-2 text-gray-600 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
                            aria-label="Move category down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <a
                            href={previewHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-full border border-gray-300 p-2 text-gray-600 transition hover:border-blue-300 hover:text-blue-600"
                            aria-label="Preview category in catalog"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(category.id)}
                            className="inline-flex items-center justify-center rounded-full border border-red-200 p-2 text-red-500 transition hover:bg-red-50"
                            aria-label="Remove category"
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
              <h2 className="text-lg font-semibold text-gray-800">Add category</h2>
              <p className="mt-1 text-sm text-gray-500">Slug controls the catalog filter (e.g. /catalog?category=barcode-scanners).</p>
            </div>
            <form onSubmit={handleAddCategory} className="space-y-4 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Label</label>
                  <input
                    type="text"
                    value={categoryDraft.label}
                    onChange={event => handleCategoryDraftChange('label', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Barcode Scanners"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Slug</label>
                  <input
                    type="text"
                    value={categoryDraft.slug}
                    onChange={event => handleCategoryDraftChange('slug', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. barcode-scanners"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={categoryDraft.description}
                    onChange={event => handleCategoryDraftChange('description', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Short description for the dropdown and filters"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Highlights</label>
                  <input
                    type="text"
                    value={categoryDraft.highlights}
                    onChange={event => handleCategoryDraftChange('highlights', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Comma-separated highlights"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add category
              </button>
            </form>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
