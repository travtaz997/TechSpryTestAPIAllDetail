import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface NavigationMenuItem {
  id: string;
  label: string;
  href: string;
}

interface NavigationContextValue {
  items: NavigationMenuItem[];
  addItem: (item: Omit<NavigationMenuItem, 'id'>) => void;
  updateItem: (id: string, updates: Partial<Omit<NavigationMenuItem, 'id'>>) => void;
  removeItem: (id: string) => void;
  moveItem: (id: string, direction: 'up' | 'down') => void;
  resetToDefaults: () => void;
}

const STORAGE_KEY = 'techspry-navigation-menu';

const defaultMenuItems: NavigationMenuItem[] = [
  { id: 'about', label: 'About', href: '/about' },
  { id: 'contact', label: 'Contact', href: '/contact' },
];

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `nav-${Math.random().toString(36).slice(2, 10)}`;
};

function readStoredMenu(): NavigationMenuItem[] {
  if (typeof window === 'undefined') {
    return defaultMenuItems;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...defaultMenuItems];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...defaultMenuItems];

    const sanitized = parsed
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        const { id, label, href } = item as Partial<NavigationMenuItem>;
        if (!id || !label || !href) return null;
        return { id, label, href } satisfies NavigationMenuItem;
      })
      .filter((item): item is NavigationMenuItem => item !== null);

    return sanitized.length > 0 ? sanitized : [...defaultMenuItems];
  } catch (error) {
    console.warn('Failed to read navigation menu from storage', error);
    return [...defaultMenuItems];
  }
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NavigationMenuItem[]>(() => readStoredMenu());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.warn('Failed to persist navigation menu', error);
    }
  }, [items]);

  const addItem = (item: Omit<NavigationMenuItem, 'id'>) => {
    setItems(prev => [...prev, { ...item, id: generateId() }]);
  };

  const updateItem = (id: string, updates: Partial<Omit<NavigationMenuItem, 'id'>>) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              ...updates,
            }
          : item,
      ),
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
    setItems([...defaultMenuItems]);
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

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigationMenu() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationMenu must be used within a NavigationProvider');
  }
  return context;
}

export function getDefaultNavigationMenu(): NavigationMenuItem[] {
  return [...defaultMenuItems];
}
