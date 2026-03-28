import { Trash2 } from "lucide-react";

export function CarCard({ car, onDelete }) {
  const percentage = Math.min(
    (car.savedValue / car.targetValue) * 100,
    100,
  ).toFixed(1);

  const fallbackImage =
    "https://images.unsplash.com/photo-1598209279122-8541213a0387?q=80&w=600";

  return (
    <div className="group relative bg-[#181818] rounded-2xl overflow-hidden border border-[#222] hover:border-red-600/50 transition-all shadow-xl flex flex-col">
      <div className="relative h-48 w-full overflow-hidden bg-[#121212]">
        <img
          src={car.image}
          alt={car.model}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = fallbackImage;
            e.target.classList.add("opacity-50");
          }}
          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
        />
        <button
          onClick={onDelete}
          className="absolute top-3 right-3 p-2 rounded-lg bg-black/50 text-gray-500 hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <p className="text-red-600 font-black italic text-[10px] tracking-widest">
            {car.brand?.toUpperCase()}
          </p>
          <h3 className="text-2xl font-black text-white italic">{car.model}</h3>
          <p className="text-gray-500 text-xs font-bold mb-4">{car.year}</p>
        </div>

        <div className="mt-auto pt-4 border-t border-[#222]">
          <div className="flex justify-between text-[10px] font-bold mb-2 uppercase tracking-widest">
            <span className="text-gray-500">Progress</span>
            <span className="text-red-500">{percentage}%</span>
          </div>
          <div className="w-full h-1.5 bg-red-950/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)] transition-all duration-700"
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-end">
          <div>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">
              Remaining
            </p>
            <p className="text-lg font-black text-white">
              R$ {(car.targetValue - car.savedValue).toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
