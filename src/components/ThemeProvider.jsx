'use client';

import { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {}, mounted: true });

export function useTheme() {
  return useContext(ThemeContext);
}

/** The DENTEX interface is intentionally light-only. Kept as a provider so
 * existing components that consume useTheme remain compatible. */
export default function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    try {
      localStorage.setItem('dental-ai-theme', 'light');
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {}, mounted: true }}>
      {children}
    </ThemeContext.Provider>
  );
}
