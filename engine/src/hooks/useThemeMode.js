import { useEffect } from "react";

export function useThemeMode(theme = "dark") {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const prefersDark = media.matches;
      const resolvedTheme = theme === "system" ? (prefersDark ? "dark" : "light") : theme;

      document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
      document.documentElement.dataset.theme = resolvedTheme;
    };

    applyTheme();
    media.addEventListener("change", applyTheme);

    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);
}
