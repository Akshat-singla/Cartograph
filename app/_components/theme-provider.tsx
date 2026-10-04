"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export type ThemeMode = "system" | "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "cartograph-theme";

// Inline script that runs before React hydrates — prevents flash of wrong theme.
// Reads the persisted preference and applies the class to <html> immediately.
const themeScript = `
(function() {
  try {
    var mode = localStorage.getItem('${STORAGE_KEY}') || 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = mode === 'dark' || (mode === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
  } catch(e) {}
})();
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always start with "system" so the initial client render matches the server
  // snapshot. The stored preference is loaded after hydration in the effect
  // below to avoid a hydration mismatch.
  const [mode, setModeState] = useState<ThemeMode>("system");

  // After hydration: read the stored preference and apply it if present.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      setModeState(stored);
    }
    // Empty deps — runs once on mount, which is after hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply the chosen mode to <html> whenever it changes.
  useEffect(() => {
    const apply = (m: ThemeMode) => {
      if (m === "light") {
        document.documentElement.classList.remove("dark");
      } else if (m === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        // system — follow the OS setting.
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        document.documentElement.classList.toggle("dark", prefersDark);
      }
    };

    apply(mode);

    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      {/* Inline script prevents flash of wrong theme on load */}
      <script
        dangerouslySetInnerHTML={{ __html: themeScript }}
        suppressHydrationWarning
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
