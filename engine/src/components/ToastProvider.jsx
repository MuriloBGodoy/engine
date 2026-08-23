import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Trophy, X } from "lucide-react";

/**
 * Toast único e estilizado do Engine — substitui os `flash()` locais espalhados
 * (Community/Services). Uso:
 *   const toast = useToast();
 *   toast("Salvo!");                 // sucesso (padrão)
 *   toast("Falhou", "error");        // erro
 *   toast("Dica", { tone: "info", duration: 4000 });
 *   toast("Conquista desbloqueada — 10K curtidas", { tone: "achievement", icon: Heart });
 * Empilha vários, some sozinho e segue os tokens (light + dark).
 *
 * O tom "achievement" é o único que aceita `icon` (um componente lucide-react):
 * a conquista específica define o próprio ícone (o selo que ela desbloqueou),
 * em vez do ícone genérico dos outros tons. Sem `icon`, cai no Trophy padrão.
 */
const ToastContext = createContext(() => {});

export function useToast() {
  return useContext(ToastContext);
}

let idSeq = 0;

const toneStyles = {
  success: { icon: CheckCircle2, bar: "bg-emerald-500", iconClass: "text-emerald-500" },
  error: {
    icon: AlertTriangle,
    bar: "bg-[var(--engine-accent)]",
    iconClass: "text-[var(--engine-accent)]",
  },
  info: { icon: Info, bar: "bg-sky-500", iconClass: "text-sky-500" },
  achievement: {
    icon: Trophy,
    bar: "bg-[var(--engine-accent)]",
    iconClass: "text-[var(--engine-accent)]",
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((item) => item.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const toast = useCallback(
    (message, options = {}) => {
      if (!message) return;
      const config = typeof options === "string" ? { tone: options } : options;
      const tone = config.tone || "success";
      const duration = config.duration || 2600;
      const id = ++idSeq;
      setToasts((list) => [...list.slice(-3), { id, message, tone, icon: config.icon }]);
      timers.current[id] = setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[210] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:top-6 sm:items-end">
        {toasts.map((item) => {
          const style = toneStyles[item.tone] || toneStyles.success;
          const Icon = item.icon || style.icon;
          return (
            <div
              key={item.id}
              role="status"
              className="engine-pop pointer-events-auto flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-xl border border-[var(--engine-border)] bg-[var(--engine-elevated)] py-3 pl-3 pr-2 shadow-[var(--engine-shadow-lg)]"
            >
              <span className={`h-9 w-1 shrink-0 rounded-full ${style.bar}`} />
              <Icon size={18} className={`shrink-0 ${style.iconClass}`} />
              <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-[var(--engine-text)]">
                {item.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Fechar"
                className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--engine-text-subtle)] transition-colors hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)] sm:m-0 sm:h-auto sm:w-auto sm:p-1.5"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
