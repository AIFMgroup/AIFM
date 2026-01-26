'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'aifm-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Get system preference
  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  // Resolve theme (handle 'system')
  const resolveTheme = useCallback((t: Theme): 'light' | 'dark' => {
    if (t === 'system') {
      return getSystemTheme();
    }
    return t;
  }, [getSystemTheme]);

  // Apply theme to document
  const applyTheme = useCallback((resolved: 'light' | 'dark') => {
    if (typeof document === 'undefined') return;
    
    const root = document.documentElement;
    
    // Remove existing theme class
    root.classList.remove('light', 'dark');
    
    // Add new theme class
    root.classList.add(resolved);
    
    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        resolved === 'dark' ? '#1a1a1a' : '#ffffff'
      );
    }
  }, []);

  // Set theme
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    
    // Save to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newTheme);
    }
  }, [resolveTheme, applyTheme]);

  // Toggle between light/dark
  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  // Initialize theme on mount
  useEffect(() => {
    // Read from localStorage
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initialTheme = stored || 'system';
    
    setThemeState(initialTheme);
    const resolved = resolveTheme(initialTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [resolveTheme, applyTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handler = (e: MediaQueryListEvent) => {
      const newResolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(newResolved);
      applyTheme(newResolved);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  // Return a safe default during SSR
  if (!context) {
    return {
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}

// Theme toggle component
import { Moon, Sun, Monitor } from 'lucide-react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div className={`flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'light' 
            ? 'bg-white dark:bg-gray-700 shadow-sm' 
            : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
        }`}
        title="Ljust läge"
      >
        <Sun className="w-4 h-4 text-amber-500" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'dark' 
            ? 'bg-white dark:bg-gray-700 shadow-sm' 
            : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
        }`}
        title="Mörkt läge"
      >
        <Moon className="w-4 h-4 text-blue-500" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-2 rounded-md transition-colors ${
          theme === 'system' 
            ? 'bg-white dark:bg-gray-700 shadow-sm' 
            : 'hover:bg-white/50 dark:hover:bg-gray-700/50'
        }`}
        title="Följ systemet"
      >
        <Monitor className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  );
}

// Simple toggle button
export function ThemeToggleButton({ className = '' }: { className?: string }) {
  const { toggleTheme, resolvedTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
      title={resolvedTheme === 'light' ? 'Byt till mörkt läge' : 'Byt till ljust läge'}
    >
      {resolvedTheme === 'light' ? (
        <Moon className="w-5 h-5 text-gray-600" />
      ) : (
        <Sun className="w-5 h-5 text-amber-400" />
      )}
    </button>
  );
}















