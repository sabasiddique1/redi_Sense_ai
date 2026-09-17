"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  THEME_INIT_SCRIPT,
  THEME_MEDIA_QUERY,
  THEME_PREFERENCE_ATTR,
  THEME_STORAGE_KEY,
  isThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

export { THEME_INIT_SCRIPT, resolveTheme };
export type { ResolvedTheme, ThemePreference };

const PREFERENCE_ATTR = THEME_PREFERENCE_ATTR;
const MEDIA_QUERY = THEME_MEDIA_QUERY;

function applyTheme(preference: ThemePreference, resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.setAttribute(PREFERENCE_ATTR, preference);
  root.style.colorScheme = resolved;
}

// The <html> attributes written by the inline script are the store; React
// reads them through useSyncExternalStore so no effect ever calls setState.
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function readSnapshot(): string {
  const root = document.documentElement;
  const preference = root.getAttribute(PREFERENCE_ATTR);
  const resolved = root.getAttribute("data-theme");
  return `${isThemePreference(preference) ? preference : "system"}|${resolved === "dark" ? "dark" : "light"}`;
}

const SERVER_SNAPSHOT = "system|light";

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(MEDIA_QUERY);
  const onSystemChange = (event: MediaQueryListEvent) => {
    if (document.documentElement.getAttribute(PREFERENCE_ATTR) === "system") {
      applyTheme("system", resolveTheme("system", event.matches));
      emit();
    }
  };
  media.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
  };
}

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setTheme: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => SERVER_SNAPSHOT);
  const [preference, resolved] = snapshot.split("|") as [ThemePreference, ResolvedTheme];

  const setTheme = useCallback((next: ThemePreference) => {
    const systemDark = window.matchMedia(MEDIA_QUERY).matches;
    applyTheme(next, resolveTheme(next, systemDark));
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // storage unavailable; the attribute still applies for this session
    }
    emit();
  }, []);

  const value = useMemo(() => ({ preference, resolved, setTheme }), [preference, resolved, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
