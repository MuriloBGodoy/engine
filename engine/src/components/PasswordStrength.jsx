import { Car } from "lucide-react";
import { useTranslation } from "react-i18next";
import { passwordLevel } from "../services/passwordStrength";

// A "garagem" evolui com a força: carrinho simples → maior → esportivão.
const LEVELS = {
  1: { labelKey: "auth.strength.weak", color: "#ef4444", size: 15 },
  2: { labelKey: "auth.strength.medium", color: "#f59e0b", size: 18 },
  3: { labelKey: "auth.strength.strong", color: "#22c55e", size: 21 },
};

export function PasswordStrength({ password }) {
  const { t } = useTranslation();
  const level = passwordLevel(password);
  if (!level) return null;

  const config = LEVELS[level];

  return (
    <div className="pw-strength" aria-live="polite">
      <div className="pw-strength-track">
        {[1, 2, 3].map((segment) => (
          <span
            key={segment}
            className="pw-strength-seg"
            style={{ background: segment <= level ? config.color : undefined }}
          />
        ))}
      </div>
      <div className="pw-strength-meta">
        <Car size={config.size} strokeWidth={2.4} style={{ color: config.color }} />
        <span className="pw-strength-label" style={{ color: config.color }}>
          {t(config.labelKey)}
        </span>
      </div>
    </div>
  );
}
