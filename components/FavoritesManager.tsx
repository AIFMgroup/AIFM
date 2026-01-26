'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Star, X, GripVertical } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface FavoriteItem {
  id: string;
  label: string;
  href: string;
  addedAt: string;
}

interface FavoritesContextType {
  favorites: FavoriteItem[];
  addFavorite: (item: Omit<FavoriteItem, 'id' | 'addedAt'>) => void;
  removeFavorite: (href: string) => void;
  isFavorite: (href: string) => boolean;
  reorderFavorites: (fromIndex: number, toIndex: number) => void;
}

// ============================================================================
// Context
// ============================================================================

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

const FAVORITES_KEY = 'aifm-favorites';

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load favorites:', e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when favorites change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    }
  }, [favorites, isLoaded]);

  const addFavorite = useCallback((item: Omit<FavoriteItem, 'id' | 'addedAt'>) => {
    setFavorites(prev => {
      // Don't add duplicates
      if (prev.some(f => f.href === item.href)) return prev;
      
      return [
        ...prev,
        {
          ...item,
          id: `fav-${Date.now()}`,
          addedAt: new Date().toISOString(),
        },
      ];
    });
  }, []);

  const removeFavorite = useCallback((href: string) => {
    setFavorites(prev => prev.filter(f => f.href !== href));
  }, []);

  const isFavorite = useCallback((href: string) => {
    return favorites.some(f => f.href === href);
  }, [favorites]);

  const reorderFavorites = useCallback((fromIndex: number, toIndex: number) => {
    setFavorites(prev => {
      const newFavorites = [...prev];
      const [removed] = newFavorites.splice(fromIndex, 1);
      newFavorites.splice(toIndex, 0, removed);
      return newFavorites;
    });
  }, []);

  return (
    <FavoritesContext.Provider value={{ 
      favorites, 
      addFavorite, 
      removeFavorite, 
      isFavorite,
      reorderFavorites 
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  // Return a no-op implementation if used outside provider (e.g., during static rendering)
  if (!context) {
    return {
      favorites: [],
      addFavorite: () => {},
      removeFavorite: () => {},
      isFavorite: () => false,
      reorderFavorites: () => {},
    };
  }
  return context;
}

// ============================================================================
// Favorite Star Button
// ============================================================================

export function FavoriteButton({ 
  href, 
  label,
  className = '' 
}: { 
  href: string; 
  label: string;
  className?: string;
}) {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const isStarred = isFavorite(href);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isStarred) {
      removeFavorite(href);
    } else {
      addFavorite({ href, label });
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`p-1 rounded transition-all duration-200 ${
        isStarred 
          ? 'text-aifm-gold hover:text-aifm-gold/80' 
          : 'text-white/20 hover:text-aifm-gold/60 opacity-0 group-hover:opacity-100'
      } ${className}`}
      title={isStarred ? 'Ta bort från favoriter' : 'Lägg till som favorit'}
    >
      <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-current' : ''}`} />
    </button>
  );
}

// ============================================================================
// Favorites Section for Sidebar
// ============================================================================

export function FavoritesSidebarSection({ collapsed }: { collapsed: boolean }) {
  const { favorites, removeFavorite } = useFavorites();
  const pathname = usePathname();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  if (favorites.length === 0) return null;

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className={`mb-4 ${collapsed ? 'px-2' : 'px-3'}`}>
      {!collapsed && (
        <div className="flex items-center gap-2 px-3 mb-2">
          <Star className="w-3.5 h-3.5 text-aifm-gold fill-aifm-gold" />
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
            Favoriter
          </span>
        </div>
      )}
      
      <ul className="space-y-0.5">
        {favorites.map((item, index) => {
          const active = isActive(item.href);
          
          return (
            <li 
              key={item.id}
              draggable={!collapsed}
              onDragStart={() => setDraggedIndex(index)}
              onDragEnd={() => setDraggedIndex(null)}
              onDragOver={(e) => e.preventDefault()}
              className={`${draggedIndex === index ? 'opacity-50' : ''}`}
            >
              <Link
                href={item.href}
                className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'} px-3 py-2 rounded-lg 
                           transition-all duration-200 group relative
                           ${active 
                             ? 'text-white bg-aifm-gold' 
                             : 'text-white/70 hover:text-white hover:bg-white/5'
                           }`}
                title={collapsed ? item.label : undefined}
              >
                {!collapsed && (
                  <GripVertical className="w-3 h-3 text-white/20 opacity-0 group-hover:opacity-100 cursor-grab" />
                )}
                <Star className={`w-4 h-4 flex-shrink-0 ${active ? 'fill-white text-white' : 'fill-aifm-gold/50 text-aifm-gold/50'}`} />
                {!collapsed && (
                  <>
                    <span className="text-sm flex-1 truncate">{item.label}</span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeFavorite(item.href);
                      }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )}
                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-aifm-charcoal text-white text-xs rounded 
                                  opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 
                                  shadow-lg border border-white/10">
                    {item.label}
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {!collapsed && (
        <div className="mt-2 mx-3 border-b border-white/5" />
      )}
    </div>
  );
}

