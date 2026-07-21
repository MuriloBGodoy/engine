import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Sistema de confirmação estilizado do Engine — substitui os window.confirm()
 * nativos ("localhost diz..."). Uso:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title, message, confirmLabel, tone }))) return;
 * Retorna uma Promise<boolean>. Segue os tokens (funciona em light e dark).
 */
const ConfirmContext = createContext(() => Promise.resolve(false));

export function useConfirm() {
  return useContext(ConfirmContext);
}

const closedState = { open: false };

export function ConfirmProvider({ children }) {
  const { t } = useTranslation();
  const [state, setState] = useState(closedState);
  const resolverRef = useRef(null);

  const settle = useCallback((result) => {
    setState((current) => ({ ...current, open: false }));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, ...options });
    });
  }, []);

  useEffect(() => {
    if (!state.open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") settle(false);
      if (event.key === "Enter") settle(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.open, settle]);

  const danger = state.tone !== "neutral";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state.open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => settle(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="engine-pop w-full max-w-sm rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-elevated)] p-7 text-center shadow-[var(--engine-shadow-lg)]"
          >
            <div
              className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full ${
                danger
                  ? "border border-[var(--engine-accent)]/20 bg-[var(--engine-accent-soft)] text-[var(--engine-accent)]"
                  : "bg-[var(--engine-surface-2)] text-[var(--engine-text)]"
              }`}
            >
              <AlertTriangle size={26} strokeWidth={2.2} />
            </div>

            {state.title && (
              <h2 className="mb-2 text-lg font-extrabold tracking-tight text-[var(--engine-text)]">
                {state.title}
              </h2>
            )}
            {state.message && (
              <p className="mb-7 text-sm font-medium leading-relaxed text-[var(--engine-text-muted)]">
                {state.message}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => settle(false)}
                className="rounded-xl border border-[var(--engine-border-strong)] px-4 py-3 text-sm font-semibold text-[var(--engine-text-muted)] transition-colors hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)]"
              >
                {state.cancelLabel || t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold tracking-tight transition hover:brightness-95 ${
                  danger
                    ? "bg-[var(--engine-accent)] text-white"
                    : "bg-[var(--engine-text)] text-[var(--engine-bg)]"
                }`}
              >
                {state.confirmLabel || t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
