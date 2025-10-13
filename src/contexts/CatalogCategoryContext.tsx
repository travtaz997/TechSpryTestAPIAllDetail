import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getDefaultCatalogCategories, type CatalogCategory } from '../utils/catalogCategories';

interface CatalogCategoryContextValue {
  items: CatalogCategory[];
  addItem: (item: Omit<CatalogCategory, 'id'>) => void;
  updateItem: (id: string, updates: Partial<Omit<CatalogCategory, 'id'>>) => void;
  removeItem: (id: string) => void;
  moveItem: (id: string, direction: 'up' | 'down') => void;
  resetToDefaults: () => void;
}

const STORAGE_KEY = 'techspry-catalog-menu';

const CatalogCategoryContext = createContext<CatalogCategoryContextValue | undefined>(undefined);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `cat-${Math.random().toString(36).slice(2, 10)}`;
};

function normalizeHighlights(highlights?: string[] | null): string[] | undefined {
  if (!Array.isArray(highlights)) return undefined;

  const normalized = highlights
    .map(item => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function sanitizeCategory(partial: Partial<CatalogCategory>, fallbackLabel = 'Category'): CatalogCategory | null {
  const fallback = typeof fallbackLabel === 'string' ? fallbackLabel.trim() : '';
  const labelRaw = typeof partial.label === 'string' ? partial.label.trim() : '';
  const label = labelRaw || fallback;
  const description = typeof partial.description === 'string' ? partial.description.trim() : '';
  const rawSlug = typeof partial.slug === 'string' ? partial.slug : '';
  const slugSource = rawSlug.trim() || label;
  const slug = slugify(slugSource);

  if (!label || !slug) {
    return null;
  }

  const id = typeof partial.id === 'string' && partial.id.trim() ? partial.id : generateId();

  return {
    id,
    label,
    description,
    slug,
    highlights: normalizeHighlights(partial.highlights),
  } satisfies CatalogCategory;
}

function readStoredCategories(): CatalogCategory[] {
  if (typeof window === 'undefined') {
    return getDefaultCatalogCategories();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultCatalogCategories();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return getDefaultCatalogCategories();

    const sanitized = parsed
      .map(item => sanitizeCategory(item as Partial<CatalogCategory>))
      .filter((item): item is CatalogCategory => item !== null);

    return sanitized.length > 0 ? sanitized : getDefaultCatalogCategories();
  } catch (error) {
    console.warn('Failed to read catalog categories from storage', error);
    return getDefaultCatalogCategories();
  }
}

export function CatalogCategoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CatalogCategory[]>(() => readStoredCategories());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.warn('Failed to persist catalog categories', error);
    }
  }, [items]);

  const addItem = (item: Omit<CatalogCategory, 'id'>) => {
    const sanitized = sanitizeCategory(item, item.label ?? 'Category');
    if (!sanitized) return;

    setItems(prev => [...prev, { ...sanitized, id: generateId() }]);
  };

  const updateItem = (id: string, updates: Partial<Omit<CatalogCategory, 'id'>>) => {
    setItems(prev =>
      prev.map(existing => {
        if (existing.id !== id) return existing;

        const next: CatalogCategory = {
          ...existing,
          ...updates,
        };

        const sanitized = sanitizeCategory(next, next.label);
        return sanitized ?? existing;
      }),
    );
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    setItems(prev => {
      const index = prev.findIndex(item => item.id === id);
      if (index === -1) return prev;

      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(index, 1);
      updated.splice(nextIndex, 0, moved);
      return updated;
    });
  };

  const resetToDefaults = () => {
    setItems(getDefaultCatalogCategories());
  };

  const value = useMemo(
    () => ({
      items,
      addItem,
      updateItem,
      removeItem,
      moveItem,
      resetToDefaults,
    }),
    [items],
  );

  return <CatalogCategoryContext.Provider value={value}>{children}</CatalogCategoryContext.Provider>;
}

export function useCatalogCategories() {
  const context = useContext(CatalogCategoryContext);
  if (!context) {
    throw new Error('useCatalogCategories must be used within a CatalogCategoryProvider');
  }
  return context;
}

export function getDefaultCatalogCategoryMenu() {
  return getDefaultCatalogCategories();
}
