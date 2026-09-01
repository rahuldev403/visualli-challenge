import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "mindmap-theme";

const readStoredTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    // Private windows and blocked site data both throw here.
    return null;
  }
};

const systemTheme = (): Theme =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";

/**
 * Owns the single `data-theme` attribute on <html>. Every colour in the app
 * resolves from CSS variables keyed off that attribute, so nothing else needs
 * to know which theme is active — no context, no prop drilling, no re-render.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme() ?? systemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Not being able to remember the choice is not worth surfacing.
    }
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((current) => (current === "dark" ? "light" : "dark")),
    [],
  );

  return { theme, toggleTheme };
}
