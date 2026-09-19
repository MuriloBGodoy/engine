import { useEffect, useRef } from "react";

/**
 * Fecha um overlay (modal, folha, popover, confirmação) pelo gesto de voltar.
 *
 * No Android o botão/gesto de voltar é o `history.back()` do navegador. Sem
 * uma entrada de histórico própria, voltar com um modal aberto sai da tela —
 * ou, no PWA/TWA, sai do app. Medido em 13/09/2026 (Chromium, 360×740): os
 * 14 overlays do Engine saíam da página, 14/14. É a reclamação nº 1 de
 * "parece quebrado" em web app Android, e no iOS o deslizar da borda faz o
 * mesmo. Uso:
 *
 *   useHistoryDismiss(open, onClose);
 *
 * Enquanto `open` for verdadeiro existe uma entrada a mais no histórico com
 * um token deste overlay; o popstate que tira esse token do topo chama
 * `onDismiss`. Fechar pelo X (ou desmontar) desfaz a entrada com um
 * `history.back()` nosso, que o ouvinte ignora — senão o próximo "voltar" da
 * pessoa cairia numa entrada fantasma e pareceria não fazer nada.
 *
 * Empilha: modal → cropper, foto → editor, qualquer coisa → confirmação.
 * Cada nível tem o próprio token; voltar fecha só o de cima. Um "voltar" que
 * pula vários níveis (segurar o botão no Chrome) fecha todos os que ficaram
 * acima da entrada de destino.
 *
 * Convive com o React Router: a entrada nova é um `pushState` na MESMA URL
 * que preserva o estado do router (`usr`, `key`, `idx`), então nenhuma rota
 * muda e o `RouteTracker` não registra pageview a mais. Se um link navegar
 * com o overlay aberto (o "ver prestadores" do ExpensesModal), o topo do
 * histórico deixa de ser nosso e o `history.back()` de limpeza é pulado —
 * sobra uma entrada inerte abaixo da rota nova, que custa um toque a mais no
 * caminho de volta; é o preço de não desfazer a navegação da pessoa.
 *
 * Toasts não entram aqui: não são overlays, e voltar não deve gastá-los.
 */

const STATE_KEY = "engineOverlay";

// Pilha viva dos overlays abertos, de baixo para cima, com o token que cada
// um deixou no histórico e a função que o fecha. Um ouvinte só para todos:
// com um ouvinte por overlay, o contador de "voltar nosso" ficava órfão
// quando o único overlay aberto fechava, e engolia o próximo voltar real.
const stack = [];
let selfBacksPending = 0;
let sequence = 0;
let listening = false;

// Entrada que acabou de ser abandonada e ainda não foi desfeita. O
// `history.back()` de limpeza espera um tique: em desenvolvimento o
// StrictMode desmonta e remonta o efeito na mesma passada, e `back()` seguido
// de `pushState` no mesmo tique deixa o Chrome numa entrada imprevisível —
// o overlay abria já sem entrada própria e "voltar" saía da tela. Com a
// espera, o efeito remontado encontra a entrada ainda no topo e a reaproveita.
let abandoned = null;

function undoAbandonedEntry() {
  abandoned = null;
  selfBacksPending += 1;
  window.history.back();
}

const readToken = (state) =>
  state && typeof state === "object" ? state[STATE_KEY] : undefined;

function handlePopState(event) {
  if (selfBacksPending > 0) {
    selfBacksPending -= 1;
    return;
  }
  const current = readToken(event.state);
  // Tudo acima da entrada em que a pessoa caiu fecha; se ela caiu numa
  // entrada sem token (a página de antes), fecha tudo.
  const keep = current ? stack.findIndex((entry) => entry.token === current) : -1;
  const closing = stack.splice(keep + 1);
  for (let index = closing.length - 1; index >= 0; index -= 1) {
    closing[index].dismissed = true;
    closing[index].dismiss();
  }
}

function ensureListener() {
  if (listening) return;
  listening = true;
  window.addEventListener("popstate", handlePopState);
}

export function useHistoryDismiss(open, onDismiss) {
  // A função de fechar muda a cada render; o ouvinte lê sempre a mais nova
  // sem precisar reabrir a entrada de histórico.
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;
    ensureListener();

    let token;
    if (abandoned && readToken(window.history.state) === abandoned.token) {
      clearTimeout(abandoned.timer);
      token = abandoned.token;
      abandoned = null;
    } else {
      sequence += 1;
      token = `${Date.now().toString(36)}-${sequence}`;
      const base = window.history.state;
      window.history.pushState(
        { ...(base && typeof base === "object" ? base : {}), [STATE_KEY]: token },
        "",
        window.location.href,
      );
    }
    const entry = {
      token,
      dismissed: false,
      dismiss: () => dismissRef.current?.(),
    };
    stack.push(entry);

    return () => {
      const position = stack.indexOf(entry);
      if (position !== -1) stack.splice(position, 1);
      if (entry.dismissed) return;
      // Só desfaz a entrada se ela ainda é o topo; se uma navegação subiu em
      // cima dela, voltar agora desfaria a navegação da pessoa.
      if (readToken(window.history.state) !== token) return;
      if (abandoned) clearTimeout(abandoned.timer);
      abandoned = { token, timer: setTimeout(undoAbandonedEntry, 0) };
    };
  }, [open]);
}
