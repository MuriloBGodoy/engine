import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../services/firebase";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, UserPlus } from "lucide-react";

export function Register() {
  const [name, setName] = useState(""); // Novo estado para o nome
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Cria o usuário
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      // 2. Salva o nome no perfil do Firebase
      await updateProfile(userCredential.user, {
        displayName: name,
      });

      navigate("/");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("Este e-mail já está cadastrado.");
      } else if (err.code === "auth/weak-password") {
        setError("A senha deve ter pelo menos 6 caracteres.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
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
            New Account
          </h1>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Seu Nome Completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#181818] border border-[#222] rounded-xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all"
            required
          />
          <input
            type="email"
            placeholder="Seu melhor e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#181818] border border-[#222] rounded-xl px-5 py-4 text-white focus:border-red-600 outline-none transition-all"
            required
          />
          <input
            type="password"
            placeholder="Crie uma senha"
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
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black italic py-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-red-900/20 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <UserPlus size={18} />
            )}
            CRIAR MINHA CONTA
          </button>
        </form>

        <p className="mt-8 text-center text-gray-500 text-sm font-bold uppercase tracking-tighter">
          Já tem conta?{" "}
          <Link to="/login" className="text-red-600 hover:underline">
            Faça Login
          </Link>
        </p>
      </div>
    </div>
  );
}
