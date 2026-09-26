import { useEffect, useState } from "react";
import { engineDB } from "../services/db";

/**
 * Busca de pessoas com limite, no servidor.
 *
 * Substitui o que Comunidade, Mensagens e Compartilhar faziam até 25/09/2026:
 * escutar a coleção inteira de perfis e filtrar no navegador. Com o avatar em
 * base64 dentro de cada perfil, isso era megabytes por tela e a cota diária do
 * Firebase acabando com poucas centenas de usuários.
 *
 * Espera a pessoa parar de digitar (300 ms) antes de consultar. Sem termo,
 * devolve sugestões (os perfis atualizados mais recentemente), nunca todos.
 */
export function useProfileSearch(term, { enabled = true, max = 20 } = {}) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!enabled) return undefined;
    let vivo = true;
    const timer = window.setTimeout(async () => {
      const found = await engineDB.searchPublicProfiles(term, { max });
      if (vivo) setResults(found);
    }, 300);
    return () => {
      vivo = false;
      window.clearTimeout(timer);
    };
  }, [term, enabled, max]);

  return enabled ? results : [];
}
