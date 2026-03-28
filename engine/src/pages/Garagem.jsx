import { Target } from "lucide-react";
import { CarCard } from "../components/CarCard";

export function Garagem({ cars, onOpenModal, onOpenDelete }) {
  return (
    <section>
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight italic uppercase text-white">
            GARAGEM
          </h1>
          <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase">
            Manage your dreams
          </p>
        </div>
        <button
          onClick={onOpenModal}
          className="px-6 py-3 bg-red-600 text-white font-black italic rounded-lg hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)]"
        >
          ADD CAR +
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {cars.map((car) => (
          <CarCard key={car.id} car={car} onDelete={() => onOpenDelete(car)} />
        ))}

        {cars.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-[#222] rounded-3xl p-20 text-center flex flex-col items-center justify-center bg-[#151515]">
            <Target className="text-red-600 mb-4" size={48} />
            <p className="text-gray-400 font-bold italic uppercase">
              A garagem está vazia.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
