import { useEffect, useMemo, useState } from "react";

const KEY = "rota190:theme";
type ThemeId = string;

export function useTheme(){
  const [theme, setTheme] = useState<ThemeId>("dark");

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved) setTheme(saved);
    document.documentElement.dataset.theme = saved ?? "dark";
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      if (next) setTheme(next);
    };
    window.addEventListener("rota190:theme", handler as EventListener);
    return () => window.removeEventListener("rota190:theme", handler as EventListener);
  }, []);

  return useMemo(() => ({
    theme,
    setTheme,
    toggle: () => setTheme(t => t === "light" ? "dark" : "light")
  }), [theme]);
}
