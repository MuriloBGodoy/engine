import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { startSubscription } from "../services/subscription";
import { trackEvent } from "../services/observability";

/**
 * Convite para assinar o Premium.
 *
 * O plano libera duas coisas — navegar sem anúncio e publicar serviço — e o
 * texto diz exatamente isso, sem promessa que o produto não cumpre.
 *
 * Ao confirmar, o checkout é criado no servidor (a chave do gateway nunca vem
 * pro navegador) e a pessoa é levada pro pagamento. Quem ativa o plano depois
 * é o webhook, não esta tela.
 */
export function PaywallModal({ open, onClose, country }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubscribe = async () => {
    setLoading(true);
    setError("");
    trackEvent("premium_checkout_iniciado", { country });

    try {
      const url = await startSubscription({ country });
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const benefits = [t("premium.benefitNoAds"), t("premium.benefitPublish")];

  return (
    <div className="engine-modal-overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("premium.title")}
        className="engine-modal-panel engine-pop sm:max-w-md"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--engine-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--engine-accent-soft)] text-[var(--engine-accent)]">
              <Sparkles size={20} />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--engine-accent)]">
                {t("premium.tag")}
              </p>
              <h2 className="text-base font-black text-[var(--engine-text)]">
                {t("premium.title")}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--engine-text-muted)] transition hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <ul className="space-y-2.5">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5">
                <Check size={17} className="mt-0.5 shrink-0 text-[var(--engine-accent)]" />
                <span className="text-sm text-[var(--engine-text)]">{benefit}</span>
              </li>
            ))}
          </ul>

          {error && (
            <p className="rounded-xl border border-[var(--engine-accent)]/40 bg-[var(--engine-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--engine-accent)]">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubscribe}
            disabled={loading}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--engine-accent)] text-sm font-black uppercase tracking-widest text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? t("common.loading") : t("premium.subscribe")}
          </button>

          <p className="text-center text-[11px] leading-relaxed text-[var(--engine-text-muted)]">
            {t("premium.disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}
