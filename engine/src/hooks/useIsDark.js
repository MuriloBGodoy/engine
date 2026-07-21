import { useEffect, useState } from "react";

/**
 * Retorna true quando o tema atual é escuro, observando a classe `dark`
 * que o useThemeMode aplica no <html>. Útil para componentes que precisam
 * reagir ao tema fora do Tailwind (ex.: opções de gráficos do ECharts).
 */
export function useIsDark() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true,
  );

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));

    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return isDark;
}
