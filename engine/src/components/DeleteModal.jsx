import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function DeleteModal({ isOpen, onClose, onConfirm, carName, message }) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="engine-pop w-full max-w-sm rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-elevated)] p-8 text-center shadow-[var(--engine-shadow-lg)]">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--engine-accent)]/20 bg-[var(--engine-accent-soft)]">
          <AlertTriangle className="text-[var(--engine-accent)]" size={30} />
        </div>

        <h2 className="mb-2 text-lg font-extrabold tracking-tight text-[var(--engine-text)]">
          {t("deleteModal.title")}
        </h2>

        <p className="mb-4 text-sm font-bold text-[var(--engine-accent)]">{carName}</p>

        <p className="mb-8 text-sm font-medium leading-relaxed text-[var(--engine-text-muted)]">
          {message}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-[var(--engine-border-strong)] px-4 py-3 font-semibold text-[var(--engine-text-muted)] transition-colors hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)]"
          >
            {t("deleteModal.keep")}
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--engine-accent)] px-4 py-3 font-semibold tracking-tight text-white transition-colors hover:brightness-95"
          >
            <Trash2 size={16} /> {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
