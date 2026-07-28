import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchGeoRegion,
  normalizeRegion,
  readStoredRegion,
  resolveInitialRegion,
  writeStoredRegion,
} from "../services/region";

/**
 * Contexto da REGIÃO ativa de navegação ({ country, state }, com "all" = sem
 * filtro). Fonte única lida/escrita pela pílula do header, pela tela de
 * Configurações e pelos filtros de conteúdo (Community, Serviços). Assim a
 * troca de região se propaga sozinha, sem estado duplicado nem efeitos de
 * sincronização. Persiste em localStorage (vale para visitante e logado).
 *
 * Uso:
 *   const { region, setRegion, setCountry, setState } = useRegion();
 */
const RegionContext = createContext(null);

const NEUTRAL = {
  region: { country: "all", state: "all" },
  setRegion: () => {},
  setCountry: () => {},
  setState: () => {},
};

export function useRegion() {
  return useContext(RegionContext) || NEUTRAL;
}

export function RegionProvider({ children }) {
  const [region, setRegionState] = useState(resolveInitialRegion);
  // Escolha explícita (usuário mexeu no seletor) vence sempre: a geo-IP nunca
  // pode sobrescrevê-la. Já nasce true se havia região salva no localStorage.
  const explicitRef = useRef(readStoredRegion() !== null);

  const setRegion = useCallback((next) => {
    explicitRef.current = true;
    setRegionState((current) => {
      const normalized = normalizeRegion(
        typeof next === "function" ? next(current) : next,
      );
      writeStoredRegion(normalized);
      return normalized;
    });
  }, []);

  // Refinamento por geo-IP (Netlify Edge). Assíncrono e SOFT: não persiste (é
  // um palpite, igual ao chute por idioma) e só aplica se o usuário ainda não
  // escolheu manualmente. setState no callback (não no corpo do efeito) é
  // seguro para o lint react-hooks/set-state-in-effect.
  useEffect(() => {
    if (explicitRef.current) return undefined;
    const controller = new AbortController();
    fetchGeoRegion(controller.signal).then((geo) => {
      if (!geo || explicitRef.current) return;
      setRegionState(geo);
    });
    return () => controller.abort();
  }, []);

  const setCountry = useCallback(
    (country) => setRegion({ country, state: "all" }),
    [setRegion],
  );

  const setState = useCallback(
    (state) => setRegion((current) => ({ country: current.country, state })),
    [setRegion],
  );

  const value = useMemo(
    () => ({ region, setRegion, setCountry, setState }),
    [region, setRegion, setCountry, setState],
  );

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}
