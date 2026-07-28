import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { FcGoogle } from "react-icons/fc";
import { FaFacebookF } from "react-icons/fa6";
import { auth } from "../services/firebase";

/**
 * Botões de login social (Google, Facebook, Apple) via Firebase Auth.
 * Compartilhado por Login e Register.
 *
 * IMPORTANTE — cada provedor precisa ser habilitado no Firebase Console
 * (Authentication → Sign-in method):
 *   - Google: basta habilitar (funciona na hora).
 *   - Facebook: exige App ID + App Secret de um app no Meta for Developers.
 * Enquanto um provedor não estiver habilitado, o clique cai no onError com
 * uma mensagem amigável em vez de quebrar.
 */

const PROVIDERS = {
  google: () => new GoogleAuthProvider(),
  facebook: () => new FacebookAuthProvider(),
};

export function SocialAuthButtons() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  const handleSocial = async (key) => {
    setError("");
    setPending(key);
    try {
      const provider = PROVIDERS[key]();
      await signInWithPopup(auth, provider);
      navigate("/");
    } catch (err) {
      // Popup fechado pelo usuário não é erro que mereça alarme.
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
        return;
      }
      // Loga o código real para diagnóstico (o texto na tela é amigável).
      console.error("Social sign-in falhou:", err?.code, err?.message);
      if (err?.code === "auth/unauthorized-domain") {
        // Domínio (ex.: *.netlify.app) não está em Authentication →
        // Settings → Authorized domains no Firebase Console.
        setError(t("auth.social.unauthorizedDomain"));
      } else if (err?.code === "auth/operation-not-allowed") {
        // Provedor não habilitado em Authentication → Sign-in method.
        setError(t("auth.social.notEnabled"));
      } else if (err?.code === "auth/popup-blocked") {
        setError(t("auth.social.popupBlocked"));
      } else {
        setError(t("auth.social.error"));
      }
    } finally {
      setPending("");
    }
  };

  const buttons = [
    {
      key: "google",
      label: t("auth.social.google"),
      icon: <FcGoogle size={20} />,
      className:
        "border border-[var(--engine-border)] bg-white text-[#1f1f1f] hover:brightness-95",
    },
    {
      key: "facebook",
      label: t("auth.social.facebook"),
      icon: <FaFacebookF size={17} />,
      className: "bg-[#1877F2] text-white hover:brightness-110",
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {buttons.map((button) => (
        <button
          key={button.key}
          type="button"
          disabled={Boolean(pending)}
          onClick={() => handleSocial(button.key)}
          className={`flex h-11 items-center justify-center gap-2.5 rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${button.className}`}
        >
          <span className="flex h-5 w-5 items-center justify-center">{button.icon}</span>
          {button.label}
        </button>
      ))}
      {error && <p className="auth-feedback auth-feedback-error">{error}</p>}
    </div>
  );
}
