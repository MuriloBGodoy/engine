import { useNavigate } from "react-router-dom";

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      <h1 className="text-6xl font-black italic uppercase tracking-tighter text-white mb-4">
        Engine{" "}
        <span className="text-red-600 underline decoration-red-600/30">
          Garage
        </span>
      </h1>
      <p className="text-gray-400 max-w-md mb-10 font-medium">
        Transforme sua meta financeira em realidade. Monitore o progresso do seu
        próximo carro com precisão e estilo.
      </p>
      <button
        onClick={() => navigate("/garagem")}
        className="px-10 py-4 bg-red-600 text-white font-black italic rounded-xl hover:bg-red-700 transition-all hover:scale-105 shadow-[0_0_30px_rgba(220,38,38,0.4)]"
      >
        GET STARTED
      </button>

      <div className="mt-20 grid grid-cols-3 gap-8 opacity-50 italic font-bold text-[10px] uppercase tracking-[0.3em]">
        <span>Select Model</span>
        <span>Track Progress</span>
        <span>Conquer</span>
      </div>
    </div>
  );
}
