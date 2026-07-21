import { useCallback, useSyncExternalStore } from "react";

/**
 * Acompanha uma media query do CSS em JS. Serve para os casos em que só
 * classes responsivas não bastam — quando o componente precisa RENDERIZAR
 * algo diferente no celular (ex.: trocar um gráfico pesado por uma lista).
 *
 *   const isMobile = useMediaQuery("(max-width: 767px)");
 */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  // O terceiro argumento cobre a renderização no servidor//build: assume
  // desktop e o cliente corrige na hidratação.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
