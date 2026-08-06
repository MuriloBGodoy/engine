import { useTranslation } from "react-i18next";
import { Download, Share, X } from "lucide-react";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { trackEvent } from "../services/observability";

/**
 * Convite para instalar o Engine na tela de início.
 *
 * Aparece rente ao rodapé e sem bloquear a tela: quem está no meio de algo
 * ignora e segue. Fecha por 30 dias quando dispensado.
 */
export function InstallPrompt() {
  const { t } = useTranslation();
  const { visible, needsIOSInstructions, install, dismiss } = usePwaInstall();

  if (!visible) return null;

  const handleInstall = async () => {
    const accepted = await install();
    trackEvent("pwa_install_prompt", { accepted });
  };

  const handleDismiss = () => {
    trackEvent("pwa_install_prompt", { accepted: false, dismissed: true });
    dismiss();
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[200] mx-auto max-w-md sm:inset-x-auto sm:right-6 sm:bottom-6">
      <div className="engine-pop flex items-start gap-3 rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-elevated)] p-4 shadow-lg">
        <img
          src="/icons/icon-192.png"
          alt=""
          className="h-11 w-11 shrink-0 rounded-xl"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[var(--engine-text)]">
            {t("pwa.installTitle")}
          </p>

          {needsIOSInstructions ? (
            // No iPhone não existe prompt: sem ensinar o caminho, ninguém acha.
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs leading-relaxed text-[var(--engine-text-muted)]">
              {t("pwa.iosStep1")}
              <Share size={13} className="inline shrink-0" />
              {t("pwa.iosStep2")}
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs leading-relaxed text-[var(--engine-text-muted)]">
                {t("pwa.installBody")}
              </p>
              <button
                type="button"
                onClick={handleInstall}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--engine-accent)] px-3.5 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:brightness-95"
              >
                <Download size={14} />
                {t("pwa.installAction")}
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("common.cancel")}
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--engine-text-muted)] transition hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)]"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
