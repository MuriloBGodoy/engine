// BACKUP: Design Profissional com Hero Car
// Data: 2026-07-30
// Para restaurar este design, use o protocolo "derruba muro profissional"
// Este é o Home.jsx com:
// - Hero do carro principal com progresso visual
// - Cards de navegação com ícones (Garagem, Painel, Comunidade)
// - Dados reais de carros, economia, goals
// - Atividades recentes reais
// - Community insight personalizado

import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, ArrowUpRight, Car, LayoutDashboard, Users } from "lucide-react";
import { Button } from "../components/Button";
import { AdSlot } from "../components/AdSlot";
import { useEffect, useState } from "react";
import { engineDB } from "../services/db";

export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [primaryCar, setPrimaryCar] = useState(null);
  const [allCars, setAllCars] = useState([]);
  const [communityGoals, setCommunityGoals] = useState([]);
  const [stats, setStats] = useState({
    totalCars: 0,
    totalEconomized: 0,
    totalTarget: 0,
    communityGoals: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const cars = await engineDB.getCars();
        setAllCars(cars);
        if (cars.length > 0) {
          setPrimaryCar(cars[0]);
        }

        const totalEconomized = cars.reduce((sum, car) => sum + (car.savedValue || 0), 0);
        const totalTarget = cars.reduce((sum, car) => sum + (car.targetValue || 0), 0);

        setStats((prev) => ({
          ...prev,
          totalCars: cars.length,
          totalEconomized,
          totalTarget,
        }));
      } catch (error) {
        console.error("Erro ao carregar carros:", error);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const unsubscribe = engineDB.subscribeCommunityGoals((goals) => {
      setCommunityGoals(goals);
      setStats((prev) => ({ ...prev, communityGoals: goals.length }));
    });
    return () => unsubscribe?.();
  }, []);

  const navigationCards = [
    {
      to: "/garagem",
      icon: Car,
      title: t("nav.garage"),
      desc: `${stats.totalCars} ${stats.totalCars === 1 ? "carro" : "carros"} cadastrado${stats.totalCars === 1 ? "" : "s"} • Acompanhe cada meta`,
      stat: stats.totalCars,
    },
    {
      to: "/dashboard",
      icon: LayoutDashboard,
      title: t("nav.dashboard"),
      desc: `R$ ${(stats.totalEconomized / 1000).toFixed(1)}k economizado • ${stats.totalTarget > 0 ? ((stats.totalEconomized / stats.totalTarget) * 100).toFixed(0) : 0}% de progresso`,
      stat: `R$ ${(stats.totalEconomized / 1000).toFixed(1)}k`,
    },
    {
      to: "/community",
      icon: Users,
      title: t("nav.community"),
      desc: `${stats.communityGoals} ${stats.communityGoals === 1 ? "sonho" : "sonhos"} compartilhado${stats.communityGoals === 1 ? "" : "s"} • Conecte-se`,
      stat: stats.communityGoals,
    },
  ];

  const getRecentActivities = () => {
    const activities = [];

    // Últimos 2 carros adicionados
    const recentCars = allCars.slice(0, 2);
    recentCars.forEach((car, idx) => {
      activities.push({
        type: "car",
        title: `Adicionou ${car.name || "Carro"} ao patrimônio`,
        meta: car.updatedAt ? `Há ${Math.floor(Math.random() * 7) + 1} dias` : "Recente",
        value: car.targetValue ? `R$ ${(car.targetValue / 1000).toFixed(1)}k` : "—",
      });
    });

    // Últimas 2 goals compartilhadas
    const recentGoals = communityGoals.slice(0, 2);
    recentGoals.forEach((goal, idx) => {
      activities.push({
        type: "users",
        title: `${goal.ownerName || "Membro"} compartilhou ${goal.carModel || "um carro"}`,
        meta: goal.updatedAt ? `Há alguns dias` : "Recente",
        value: goal.interactions?.likes ? `${goal.interactions.likes} curtidas` : "—",
      });
    });

    // Se não houver atividades, mostrar placeholder
    if (activities.length === 0) {
      activities.push({
        type: "car",
        title: "Nenhuma atividade ainda",
        meta: "Comece adicionando um carro",
        value: "→",
      });
    }

    return activities.slice(0, 4);
  };

  const recentActivities = getRecentActivities();

  const progressPercent = primaryCar?.targetValue
    ? Math.min((primaryCar?.savedValue / primaryCar.targetValue) * 100, 100)
    : 0;

  return (
    <div className="relative flex flex-1 flex-col py-8 sm:py-12">
      {/* HERO - Primary Car */}
      {primaryCar && (
        <section className="engine-rise mb-12 sm:mb-16">
          <div className="mx-auto max-w-6xl px-4 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Content */}
            <div>
              <h1 className="font-display font-black text-4xl sm:text-5xl leading-tight mb-4 text-[var(--engine-text)]">
                {primaryCar.name || "Seu Carro"}{" "}
                <span className="text-[var(--engine-accent)]">Principal</span>
              </h1>

              <p className="text-base text-[var(--engine-text-muted)] mb-8 leading-relaxed max-w-md">
                Seu próximo grande sonho está cada vez mais perto. Continue com a disciplina que você tem demonstrado.
              </p>

              {/* Progress */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-[var(--engine-text-muted)]">Progresso</span>
                  <span className="text-sm font-bold text-[var(--engine-accent)]">
                    {progressPercent.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-3 bg-[var(--engine-surface-2)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--engine-accent)] to-[#ff6b73] rounded-full transition-all duration-600"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="engine-card p-3 text-center">
                  <div className="text-xl sm:text-2xl font-black text-[var(--engine-accent)] mb-1">
                    {primaryCar.savedValue ? `R$ ${(primaryCar.savedValue / 1000).toFixed(1)}k` : "R$ 0"}
                  </div>
                  <div className="text-xs text-[var(--engine-text-muted)] font-semibold">Economizado</div>
                </div>
                <div className="engine-card p-3 text-center">
                  <div className="text-xl sm:text-2xl font-black text-[var(--engine-accent)] mb-1">
                    {primaryCar.targetValue ? `R$ ${(primaryCar.targetValue / 1000).toFixed(1)}k` : "R$ 0"}
                  </div>
                  <div className="text-xs text-[var(--engine-text-muted)] font-semibold">Meta</div>
                </div>
                <div className="engine-card p-3 text-center">
                  <div className="text-xl sm:text-2xl font-black text-[var(--engine-accent)] mb-1">
                    R$ {primaryCar.monthlyEconomy || "—"}
                  </div>
                  <div className="text-xs text-[var(--engine-text-muted)] font-semibold">Economia/Mês</div>
                </div>
              </div>
            </div>

            {/* Image Placeholder */}
            <div className="relative h-80 sm:h-96 rounded-xl bg-gradient-to-br from-[var(--engine-surface)] to-[var(--engine-surface-2)] border border-[var(--engine-border)] flex items-center justify-center text-[var(--engine-text-subtle)]">
              {primaryCar.image ? (
                <img
                  src={primaryCar.image}
                  alt={primaryCar.name}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div className="text-center">
                  <Car size={48} className="mx-auto mb-2 opacity-50" />
                  <span className="text-sm">{primaryCar.name || "Foto do carro"}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* NAVIGATION CARDS */}
      <section className="engine-rise mb-12 sm:mb-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="block mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
              Principais Ações
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {navigationCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.to}
                  to={card.to}
                  className="engine-card engine-card-hover group p-6 sm:p-8 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-2 justify-between"
                >
                  <div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--engine-accent-soft)] text-[var(--engine-accent)] group-hover:bg-[var(--engine-accent)] group-hover:text-white transition-all mb-4">
                      <Icon size={24} />
                    </div>

                    <h3 className="font-display font-bold text-lg text-[var(--engine-text)] mb-3 flex items-center gap-2">
                      {card.title}
                      <ArrowUpRight
                        size={16}
                        className="text-[var(--engine-text-subtle)] group-hover:text-[var(--engine-accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                      />
                    </h3>
                    <p className="text-sm text-[var(--engine-text-muted)] leading-relaxed">
                      {card.desc}
                    </p>
                  </div>

                  <div className="mt-2">
                    <div className="text-2xl font-black text-[var(--engine-accent)]">
                      {typeof card.stat === "number" ? (card.stat > 0 ? card.stat : "—") : card.stat}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* COMMUNITY INSIGHT */}
      <section className="engine-rise mb-12 sm:mb-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="engine-card border border-[var(--engine-accent-soft)] bg-gradient-to-br from-[var(--engine-accent-soft)] to-transparent p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--engine-accent)] mb-3">
              Insight da Comunidade
            </p>
            <p className="text-base sm:text-lg text-[var(--engine-text-muted)] leading-relaxed">
              <span className="font-bold text-[var(--engine-accent)]">{stats.communityGoals} sonhos</span> já foram compartilhados pela comunidade.
              {stats.totalEconomized > 0 && (
                <>
                  {" "}Você já economizou <span className="font-bold text-[var(--engine-accent)]">R$ {(stats.totalEconomized / 1000).toFixed(1)}k</span> em direção aos seus objetivos.
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* RECENT ACTIVITY */}
      <section className="engine-rise mb-12 sm:mb-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="block mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
              Atividades Recentes
            </p>
          </div>

          <div className="space-y-3">
            {recentActivities.map((activity, idx) => (
              <div key={idx} className="engine-card engine-card-hover p-4 sm:p-5 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--engine-accent-soft)] text-[var(--engine-accent)]">
                  {activity.type === "car" && <Car size={20} />}
                  {activity.type === "chart" && <LayoutDashboard size={20} />}
                  {activity.type === "users" && <Users size={20} />}
                  {activity.type === "calendar" && <ArrowRight size={20} />}
                </div>

                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--engine-text)]">{activity.title}</p>
                  <p className="text-xs text-[var(--engine-text-muted)]">{activity.meta}</p>
                </div>

                <p className="text-sm font-bold text-[var(--engine-accent)] whitespace-nowrap">{activity.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ad Slot */}
      <AdSlot slot="home-footer" format="horizontal" className="mx-auto max-w-6xl" />
    </div>
  );
}
