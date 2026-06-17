import { Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CarCard } from "../components/CarCard";

const sortCars = (cars, sortMode) => {
  const getProgress = (car) => {
    if (!car.targetValue) return 0;
    return car.savedValue / car.targetValue;
  };

  return [...cars].sort((a, b) => {
    switch (sortMode) {
      case "progress-asc":
        return getProgress(a) - getProgress(b);
      case "target-desc":
        return b.targetValue - a.targetValue;
      case "name-asc":
        return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
      case "progress-desc":
      default:
        return getProgress(b) - getProgress(a);
    }
  });
};

export function Garagem({
  cars,
  onOpenModal,
  onOpenDelete,
  defaultSort = "progress-desc",
  hideValues = false,
}) {
  const { t } = useTranslation();
  const sortedCars = sortCars(cars, defaultSort);

  return (
    <section>
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold uppercase italic tracking-tight text-slate-950 dark:text-white">
            {t("garage.title")}
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {t("garage.subtitle")}
          </p>
        </div>
        <button
          onClick={() => onOpenModal()}
          className="rounded-lg bg-red-600 px-6 py-3 font-black uppercase italic text-white shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all hover:bg-red-700"
        >
          {t("garage.addCar")} +
        </button>
      </header>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {sortedCars.map((car) => (
          <div
            key={car.id}
            onClick={() => onOpenModal(car)}
            className="cursor-pointer transition-transform active:scale-95"
          >
            <CarCard
              car={car}
              hideValues={hideValues}
              onDelete={(event) => {
                event.stopPropagation();
                onOpenDelete(car);
              }}
            />
          </div>
        ))}

        {cars.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-white p-20 text-center dark:border-[#222] dark:bg-[#151515]">
            <Target className="mb-4 text-red-600" size={48} />
            <p className="font-bold uppercase italic text-gray-500">
              {t("garage.empty")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
