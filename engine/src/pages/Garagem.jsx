import { Plus, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CarCard } from "../components/CarCard";
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
  defaultSort = "progress-desc",
  hideValues = false,
}) {
  const { t } = useTranslation();
  const sortedCars = sortCars(cars, defaultSort);

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

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedCars.map((car) => (
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
    </section>
  );
}
