import { Plus, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CarCard } from "../components/CarCard";
import { CAR_TYPE_OWNED } from "../services/db";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";

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
  onOpenOwnership,
  onAddContribution,
  onMarkAchieved,
  defaultSort = "progress-desc",
  hideValues = false,
}) {
  const { t } = useTranslation();
  const sortedCars = sortCars(cars, defaultSort);
  const goalCars = sortedCars.filter((car) => car.type !== CAR_TYPE_OWNED);
  const ownedCars = sortedCars.filter((car) => car.type === CAR_TYPE_OWNED);

  return (
    <section>
      <PageHeader
        title={t("garage.title")}
        subtitle={t("garage.subtitle")}
        actions={
          <Button className="w-full sm:w-auto" onClick={() => onOpenModal()}>
            <Plus size={17} />
            {t("garage.addCar")}
          </Button>
        }
      />

      {/* Duas listas quando os dois tipos existem: sonho e realidade não se
          comparam lado a lado, e misturar deixa a garagem confusa. Com um tipo
          só, a seção some e vira grade simples. */}
      {ownedCars.length > 0 && goalCars.length > 0 && (
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-[var(--engine-text-subtle)]">
          {t("garage.sectionGoals")}
        </h2>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {goalCars.map((car) => (
          <div
            key={car.id}
            onClick={() => onOpenModal(car)}
            className="cursor-pointer transition-transform active:scale-95"
          >
            <CarCard
              car={car}
              hideValues={hideValues}
              onOpenOwnership={onOpenOwnership}
              onAddContribution={onAddContribution}
              onMarkAchieved={onMarkAchieved}
              onDelete={(event) => {
                event.stopPropagation();
                onOpenDelete(car);
              }}
            />
          </div>
        ))}

        {cars.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--engine-border)] bg-[var(--engine-surface)] p-8 text-center sm:p-16">
            <Target className="mb-4 text-[var(--engine-accent)]" size={40} />
            <p className="font-semibold text-[var(--engine-text-muted)]">
              {t("garage.empty")}
            </p>
          </div>
        )}
      </div>

      {ownedCars.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-[11px] font-black uppercase tracking-widest text-[var(--engine-text-subtle)]">
            {t("garage.sectionOwned")}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ownedCars.map((car) => (
              <div
                key={car.id}
                onClick={() => onOpenModal(car)}
                className="cursor-pointer transition-transform active:scale-95"
              >
                <CarCard
                  car={car}
                  hideValues={hideValues}
                  onOpenOwnership={onOpenOwnership}
                  onDelete={(event) => {
                    event.stopPropagation();
                    onOpenDelete(car);
                  }}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
