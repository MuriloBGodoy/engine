import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { auth } from "../services/firebase";
import { engineDB } from "../services/db";

const inputClass =
  "w-full rounded-xl border border-[#222] bg-[#181818] px-5 py-4 text-white outline-none transition-all focus:border-red-600";

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
    <div className="flex min-h-screen w-full items-center justify-center bg-[#080808] p-4">
      <div className="w-full max-w-md rounded-[2rem] border border-white/5 bg-[#121212] p-10 shadow-2xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]">
            <span className="text-lg font-black italic">E</span>
          </div>
          <h1 className="text-center text-3xl font-black uppercase italic tracking-tight text-white">
            {t("auth.registerTitle")}
          </h1>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder={t("auth.fullName")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
            autoComplete="name"
            required
          />
          <input
            type="text"
            placeholder="@engine"
            value={username}
            onChange={(event) =>
              setUsername(engineDB.normalizeUsername(event.target.value))
            }
            className={inputClass}
            autoComplete="username"
            required
          />
          <input
            type="tel"
            placeholder={t("auth.phone")}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={inputClass}
            autoComplete="tel"
            required
          />
          <input
            type="email"
            placeholder={t("auth.bestEmail")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder={t("auth.createPassword")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
            autoComplete="new-password"
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
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <UserPlus size={18} />
            )}
            {t("auth.registerButton")}
          </button>
        </form>

        <p className="mt-8 text-center text-sm font-bold uppercase tracking-tight text-gray-500">
          {t("auth.hasAccount")}{" "}
          <Link to="/login" className="text-red-600 hover:underline">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
