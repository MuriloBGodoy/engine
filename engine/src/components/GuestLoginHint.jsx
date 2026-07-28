import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

/**
 * Dica contextual para visitantes — um balão discreto ancorado no botão
 * "Entrar" que explica o que se ganha ao entrar. Como o Engine agora é aberto
 * (dá pra explorar sem conta), esse empurrãozinho convida a criar conta sem
 * bloquear ninguém. Some ao ser fechado e não volta (lembrado no localStorage).
 *
 * Deve ser renderizado dentro de um container `relative`. `placement` orienta
 * o balão e a setinha em relação ao botão-âncora.
 */
const STORAGE_KEY = "engine_guest_hint_dismissed";

export function GuestLoginHint({ placement = "top" }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.localStorage.getItem(STORAGE_KEY)) return undefined;
    // Pequeno atraso para o balão não "saltar" junto com o carregamento.
    const timer = window.setTimeout(() => setVisible(true), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage indisponível (modo privado): tudo bem, só não persiste.
    }
  };

  if (!visible) return null;

  const isTop = placement === "top";
  const boxPosition = isTop
    ? "bottom-full left-0 mb-2.5"
    : "top-full right-0 mt-2.5";
  const arrowPosition = isTop
    ? "bottom-[-5px] left-5 border-b border-r"
    : "top-[-5px] right-5 border-l border-t";

  return (
    <div
      role="dialog"
      className={`absolute z-50 w-60 rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-3.5 text-left shadow-[var(--engine-shadow-md)] engine-rise ${boxPosition}`}
    >
      <span
        aria-hidden="true"
        className={`absolute h-2.5 w-2.5 rotate-45 border-[var(--engine-border)] bg-[var(--engine-surface)] ${arrowPosition}`}
      />
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("guest.hint.close")}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-lg text-[var(--engine-text-subtle)] transition-colors hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)]"
      >
        <X size={14} />
      </button>
      <p className="pr-5 text-[13px] font-bold text-[var(--engine-text)]">
        {t("guest.hint.title")}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--engine-text-muted)]">
        {t("guest.hint.desc")}
      </p>
      <Link
        to="/register"
        onClick={dismiss}
        className="mt-2.5 inline-flex text-[12px] font-bold text-[var(--engine-accent)] hover:underline"
      >
        {t("guest.hint.cta")}
      </Link>
    </div>
  );
}
