import { useEffect, useState } from "react";

/**
 * Avisa quando existe versão nova esperando.
 *
 * Um app instalado abre do cache do service worker, então sem este aviso a
 * pessoa pode ficar semanas numa versão antiga sem perceber — inclusive sem
 * correções de bug. O service worker novo fica em espera e só assume quando o
 * usuário aceita, pra não recarregar a página no meio de um formulário.
 */
export function usePwaUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const [applyUpdate, setApplyUpdate] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // Import dinâmico: o módulo virtual só existe no build com o plugin PWA.
    // No `npm run dev` ele não é gerado, e um import estático quebraria a tela.
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        if (cancelled) return;

        const update = registerSW({
          immediate: true,
          onNeedRefresh() {
            setUpdateReady(true);
          },
        });

        // Guardado dentro de função: setState com função como valor a
        // executaria em vez de armazenar.
        setApplyUpdate(() => () => update(true));
      })
      .catch(() => {
        // Sem service worker (dev ou navegador sem suporte): segue a vida.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { updateReady, applyUpdate };
}
