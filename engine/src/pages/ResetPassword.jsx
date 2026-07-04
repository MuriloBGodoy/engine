import { useMemo, useState } from "react";
import {
  confirmPasswordReset,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
} from "firebase/auth";
import { ArrowLeft, KeyRound, Loader2, Mail } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthShell } from "../components/AuthShell";
import { auth } from "../services/firebase";

export function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get("oobCode") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const hasResetCode = useMemo(() => Boolean(oobCode), [oobCode]);

  const handleSendEmail = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${window.location.origin}/reset-password`,
      });
      setMessage(t("auth.resetEmailSent"));
    } catch {
      setError(t("auth.resetEmailError"));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      setLoading(false);
      return;
    }

    try {
      await verifyPasswordResetCode(auth, oobCode);
      await confirmPasswordReset(auth, oobCode, password);
      setMessage(t("auth.passwordResetSuccess"));
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => navigate("/login"), 1400);
    } catch {
      setError(t("auth.passwordResetError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      compact
      kicker={t("auth.resetKicker")}
      title={hasResetCode ? t("auth.resetPasswordTitle") : t("auth.forgotPasswordTitle")}
      subtitle={
        hasResetCode
          ? t("auth.resetPasswordSubtitle")
          : t("auth.forgotPasswordSubtitle")
      }
    >
      {hasResetCode ? (
        <form onSubmit={handleConfirmReset} className="auth-form">
          <label className="auth-field">
            <span>{t("common.newPassword")}</span>
            <input
              type="password"
              placeholder={t("auth.newPasswordPlaceholder")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <label className="auth-field">
            <span>{t("common.confirmPassword")}</span>
            <input
              type="password"
              placeholder={t("auth.confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          {error && <p className="auth-feedback auth-feedback-error">{error}</p>}
          {message && <p className="auth-feedback auth-feedback-success">{message}</p>}

          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? <Loader2 className="animate-spin" /> : <KeyRound size={18} />}
            {t("auth.saveNewPassword")}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSendEmail} className="auth-form">
          <label className="auth-field">
            <span>{t("common.email")}</span>
            <input
              type="email"
              placeholder={t("auth.loginEmailPlaceholder")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          {error && <p className="auth-feedback auth-feedback-error">{error}</p>}
          {message && <p className="auth-feedback auth-feedback-success">{message}</p>}

          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? <Loader2 className="animate-spin" /> : <Mail size={18} />}
            {t("auth.sendResetEmail")}
          </button>
        </form>
      )}

      <p className="auth-switch-copy">
        <Link to="/login" className="auth-back-link">
          <ArrowLeft size={16} />
          {t("auth.backToLogin")}
        </Link>
      </p>
    </AuthShell>
  );
}
