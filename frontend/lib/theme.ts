/** Theme preference model shared by the provider, the inline init script and tests. */
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "redisense-theme";
export const LEGACY_THEME_STORAGE_KEY = "reportiq-theme";
export const THEME_PREFERENCE_ATTR = "data-theme-preference";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemDark ? "dark" : "light";
}

/**
 * Runs before hydration (inlined in app/layout.tsx) so the first paint already
 * carries the right data-theme attribute. Dependency-free; mirrors resolveTheme.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}")||localStorage.getItem("${LEGACY_THEME_STORAGE_KEY}")||"system";if(t!=="light"&&t!=="dark")t="system";var m=window.matchMedia("${THEME_MEDIA_QUERY}").matches;var r=t==="dark"||(t==="system"&&m)?"dark":"light";var d=document.documentElement;d.setAttribute("data-theme",r);d.setAttribute("${THEME_PREFERENCE_ATTR}",t);d.style.colorScheme=r;}catch(e){}})();`;
