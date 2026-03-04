import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const THEME_KEY = 'medilink-theme-preference';

const ThemeContext = createContext(null);

const palettes = {
  light: {
    background: '#FFFFFF',
    surface: '#F9F7F7',
    surfaceSecondary: '#FDEFF0',
    card: '#FFFFFF',
    text: '#111111',
    textSecondary: '#2A2A2A',
    textTertiary: '#4A4A4A',
    primary: '#1B8F3A',
    primaryLight: '#E6F4EA',
    primaryDark: '#0F6E2A',
    accent: '#C62828',
    accentLight: '#FDEBEC',
    accentDark: '#8E1D1D',
    success: '#1B8F3A',
    warning: '#D4A017',
    error: '#C62828',
    info: '#8E1D1D',
    border: '#D8C8C8',
    borderLight: '#E8DADA',
    borderInput: '#CEBEBE',
    surfaceBorder: '#E1D2D2',
    inputBackground: '#FFFFFF',
    bottomArea: '#FFFFFF',
    bottomBorder: '#E1D2D2',
  },
  dark: {
    background: '#0A0A0A',
    surface: '#1A1A1A',
    surfaceSecondary: '#2A2A2A',
    card: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#B3B3B3',
    textTertiary: '#7A7A7A',
    primary: '#00B4D8',
    primaryLight: '#90E0EF',
    primaryDark: '#0077B6',
    accent: '#FF8B6B',
    accentLight: '#FFB5A3',
    accentDark: '#E8633B',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#DC2626',
    info: '#3B82F6',
    border: '#333333',
    borderLight: '#404040',
    borderInput: '#555555',
    surfaceBorder: '#404040',
    inputBackground: '#1A1A1A',
    bottomArea: '#1A1A1A',
    bottomBorder: '#333333',
  },
};

function getSystemScheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyCssVars(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  Object.entries(theme).forEach(([key, value]) => {
    root.style.setProperty(`--ml-${key}`, String(value));
  });
}

export function WebThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState(() => {
    if (typeof window === 'undefined') return 'auto';
    return window.localStorage.getItem(THEME_KEY) || 'auto';
  });
  const [systemScheme, setSystemScheme] = useState(getSystemScheme);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => setSystemScheme(media.matches ? 'dark' : 'light');
    listener();
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const colorScheme = themeMode === 'auto' ? systemScheme : themeMode;
  const theme = colorScheme === 'dark' ? palettes.dark : palettes.light;
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', colorScheme);
    applyCssVars(theme);
  }, [colorScheme, theme]);

  const setThemeMode = (mode) => {
    const next = ['auto', 'light', 'dark'].includes(mode) ? mode : 'auto';
    setThemeModeState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, next);
    }
  };

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      colorScheme,
      isDark,
      theme,
      toggleTheme: () => setThemeMode(isDark ? 'light' : 'dark'),
    }),
    [themeMode, colorScheme, isDark, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useWebTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useWebTheme must be used inside WebThemeProvider');
  }
  return context;
}
