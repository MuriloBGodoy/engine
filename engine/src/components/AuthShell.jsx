import { ShieldCheck, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AuthShell({ children, kicker, title, subtitle, compact = false }) {
  const { t } = useTranslation();

  return (
    <div className="auth-screen">
      <div className={compact ? "auth-shell auth-shell-compact" : "auth-shell"}>
        <section className="auth-hero">
          <div className="auth-brand-block">
            <h1>Engine</h1>
            <p>{t("auth.heroText")}</p>
          </div>
          <div className="auth-highlights">
            <div className="auth-highlight">
              <ShieldCheck size={18} />
              <div>
                <strong>{t("auth.heroControlTitle")}</strong>
                <span>{t("auth.heroControlText")}</span>
              </div>
            </div>
            <div className="auth-highlight">
              <Zap size={18} />
              <div>
                <strong>{t("auth.heroSpeedTitle")}</strong>
                <span>{t("auth.heroSpeedText")}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-panel-header">
            <span>{kicker}</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
