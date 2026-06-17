import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { auth } from "../services/firebase";

const inputClass =
  "w-full rounded-xl border border-[#222] bg-[#181818] px-5 py-4 text-white outline-none transition-all focus:border-red-600";

export function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate("/");
    } catch {
      setError(t("auth.loginError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#080808] p-4">
      <div className="w-full max-w-md rounded-[2rem] border border-white/5 bg-[#121212] p-10 shadow-2xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]">
            <span className="text-lg font-black italic">E</span>
          </div>
          <h1 className="text-center text-3xl font-black uppercase italic tracking-tight text-white">
            {t("auth.loginTitle")}
          </h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder={t("common.email")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder={t("common.password")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="text-center text-xs font-bold uppercase italic text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-red-600 py-4 font-black uppercase italic text-white shadow-xl shadow-red-900/20 transition-all hover:bg-red-700 active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Lock size={18} />}
            {t("auth.loginButton")}
          </button>
        </form>

        <p className="mt-8 text-center text-sm font-bold uppercase tracking-tight text-gray-500">
          {t("auth.noAccount")}{" "}
          <Link to="/register" className="text-red-600 hover:underline">
            {t("auth.createAccount")}
          </Link>
        </p>
      </div>
    </div>
  );
}
