import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebase";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch {
      setError("Acesso Negado. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#080808] p-4">
      <div className="w-full max-w-md bg-[#121212] border border-white/5 p-10 rounded-[2.5rem] shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center italic font-black text-white mb-4 shadow-[0_0_20px_rgba(220,38,38,0.4)]">
            E
          </div>
          <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">
            Engine Login
          </h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#181818] border border-[#222] rounded-xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#181818] border border-[#222] rounded-xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all"
            required
          />

          {error && (
            <p className="text-red-500 text-xs font-bold uppercase text-center italic">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black italic py-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-red-900/20"
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Lock size={18} />
            )}
            ENTRAR NO SISTEMA
          </button>
        </form>

        {/* LINK PARA CADASTRO */}
        <p className="mt-8 text-center text-gray-500 text-sm font-bold uppercase tracking-tighter">
          Não tem uma conta?{" "}
          <Link to="/register" className="text-red-600 hover:underline">
            Cadastre-se aqui
          </Link>
        </p>
      </div>
    </div>
  );
}
