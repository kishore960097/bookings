import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Haptics } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

export type ThemeMode = 'light' | 'system' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'qgo-theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    const saved = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('qgo_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved as ThemeMode;
    }
    return 'light';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Listen to system changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, []);

  const resolvedTheme: ResolvedTheme = themeMode === 'system'
    ? (systemIsDark ? 'dark' : 'light')
    : themeMode;

  // Keep the document and Capacitor system chrome in sync with the selected mode.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;

    if (body) {
      body.classList.toggle('dark', resolvedTheme === 'dark');
      body.dataset.theme = resolvedTheme;
      body.style.colorScheme = resolvedTheme;
    }

    // Update <meta name="theme-color">
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    const systemBarColor = resolvedTheme === 'dark' ? '#0B0B0E' : '#FFFFFF';
    metaThemeColor.setAttribute('content', systemBarColor);

    // Capacitor Native StatusBar sync
    try {
      StatusBar.setStyle({ style: resolvedTheme === 'dark' ? Style.Dark : Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: systemBarColor }).catch(() => {});
    } catch {}
  }, [resolvedTheme]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    localStorage.setItem('qgo_theme', mode);

    // Haptic feedback
    try {
      Haptics.selectionChanged().catch(() => {});
    } catch {}
  };

  // Autonomous Qbe Voice & App Theme Controller Event Listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleThemeEvent = (e: any) => {
      const mode = e?.detail;
      if (mode === 'light' || mode === 'dark' || mode === 'system') {
        setThemeMode(mode);
      }
    };
    window.addEventListener('qgo-set-theme', handleThemeEvent);
    return () => window.removeEventListener('qgo-set-theme', handleThemeEvent);
  }, []);

  return (
    <ThemeContext.Provider value={{ themeMode, resolvedTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      themeMode: 'system',
      resolvedTheme:
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains('dark')
          ? 'dark'
          : 'light',
      setThemeMode: () => {},
    };
  }
  return ctx;
};
