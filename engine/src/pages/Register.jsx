import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { auth } from "../services/firebase";
import { engineDB } from "../services/db";
import { AuthShell } from "../components/AuthShell";

export function Register() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const normalizedUsername = engineDB.normalizeUsername(username);
      await engineDB.reserveUsername(normalizedUsername, "pending");

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      engineDB.setCurrentUser(userCredential.user.uid);
      await engineDB.reserveUsername(normalizedUsername, userCredential.user.uid);
      await updateProfile(userCredential.user, {
        displayName: name.trim(),
      });

      const settings = engineDB.getDefaultSettings();
      await engineDB.saveSettings(
        {
          ...settings,
          profile: {
            ...settings.profile,
            displayName: name.trim(),
            username: normalizedUsername,
            phone: engineDB.normalizePhone(phone),
          },
        },
        userCredential.user.uid,
      );

      navigate("/");
    } catch (err) {
      await engineDB.releasePendingUsername(username);
      if (err.code === "auth/email-already-in-use") {
        setError(t("auth.emailInUse"));
      } else if (err.code === "auth/weak-password") {
        setError(t("auth.weakPassword"));
      } else if (err.message?.includes("usuario")) {
        setError(t("auth.usernameInUse"));
      } else {
        setError(t("auth.genericRegisterError"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      kicker={t("auth.registerKicker")}
      title={t("auth.registerTitle")}
      subtitle={t("auth.registerSubtitle")}
    >
      <form onSubmit={handleRegister} className="auth-form auth-register-form">
        <label className="auth-field auth-span-two">
          <span>{t("auth.fullName")}</span>
          <input
            type="text"
            placeholder={t("auth.fullNamePlaceholder")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />
        </label>
        <label className="auth-field">
          <span>{t("auth.username")}</span>
          <input
            type="text"
            placeholder="@engine"
            value={username}
            onChange={(event) =>
              setUsername(engineDB.normalizeUsername(event.target.value))
            }
            autoComplete="username"
            required
          />
        </label>
        <label className="auth-field">
          <span>{t("auth.phone")}</span>
          <input
            type="tel"
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            required
          />
        </label>
        <label className="auth-field auth-span-two">
          <span>{t("common.email")}</span>
          <input
            type="email"
            placeholder={t("auth.registerEmailPlaceholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="auth-field auth-span-two">
          <span>{t("common.password")}</span>
          <input
            type="password"
            placeholder={t("auth.createPassword")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        {error && <p className="auth-feedback auth-feedback-error auth-span-two">{error}</p>}

        <button type="submit" disabled={loading} className="auth-submit auth-span-two">
          {loading ? <Loader2 className="animate-spin" /> : <UserPlus size={18} />}
          {t("auth.registerButton")}
        </button>
      </form>

      <p className="auth-switch-copy">
        {t("auth.hasAccount")}{" "}
        <Link to="/login">{t("auth.signIn")}</Link>
      </p>
    </AuthShell>
  );
}
