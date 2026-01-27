/**
 * ThemeContext - Global theme management with localStorage persistence
 *
 * Supports three modes: 'light', 'dark', 'system'
 * System mode follows the user's OS preference
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  /** Current theme setting (may be 'system') */
  theme: Theme;
  /** Resolved theme (always 'light' or 'dark') */
  resolvedTheme: 'light' | 'dark';
  /** Update the theme setting */
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'atlas-theme';

/**
 * Get the system's preferred color scheme
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get the stored theme from localStorage
 */
function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Default theme if no stored preference */
  defaultTheme?: Theme;
}

/**
 * ThemeProvider - Wraps app to provide theme context
 *
 * Usage:
 * ```tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = getStoredTheme();
    return stored === 'system' ? defaultTheme : stored;
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (theme === 'system') {
      return getSystemTheme();
    }
    return theme;
  });

  // Update resolved theme when theme changes or system preference changes
  useEffect(() => {
    const updateResolvedTheme = () => {
      const resolved = theme === 'system' ? getSystemTheme() : theme;
      setResolvedTheme(resolved);

      // Apply to document root
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
    };

    updateResolvedTheme();

    // Listen for system theme changes when in system mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateResolvedTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 *
 * Usage:
 * ```tsx
 * const { theme, resolvedTheme, setTheme } = useTheme();
 * ```
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
