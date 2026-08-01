// BACKUP: Design com Stats (antes do design profissional)
// Para restaurar, use o protocolo "derruba muro"
// Este é o Home.jsx que tínhamos antes de aplicar o novo design profissional

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
  const [stats, setStats] = useState({ cars: 0, goals: 0, communityMembers: 0 });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const cars = await engineDB.getCars();
        setStats((prev) => ({ ...prev, cars: cars.length }));
      } catch (error) {
        console.error("Erro ao carregar carros:", error);
      }
    };

    loadStats();
  }, []);

  useEffect(() => {
    const unsubscribe = engineDB.subscribeCommunityGoals((goals) => {
      setStats((prev) => ({ ...prev, goals: goals.length, communityMembers: goals.length }));
    });
    return () => unsubscribe?.();
  }, []);

  const shortcuts = [
    { to: "/garagem", icon: Car, title: t("nav.garage"), desc: t("home.links.garage") },
    { to: "/dashboard", icon: LayoutDashboard, title: t("nav.dashboard"), desc: t("home.links.dashboard") },
    { to: "/community", icon: Users, title: t("nav.community"), desc: t("home.links.community") },
  ];

  const statCards = [
    {
      label: "Carros",
      value: stats.cars,
      subtitle: stats.cars === 1 ? "1 carro" : `${stats.cars} carros`,
      to: "/garagem",
    },
    {
      label: "Metas",
      value: stats.goals,
      subtitle: stats.goals === 1 ? "1 meta" : `${stats.goals} metas`,
      to: "/dashboard",
    },
    {
      label: "Comunidade",
      value: stats.communityMembers,
      subtitle: stats.communityMembers === 1 ? "1 membro" : `${stats.communityMembers} membros`,
      to: "/community",
    },
  ];

  return (
    <div className="relative flex flex-1 flex-col justify-center overflow-hidden py-6 sm:py-10">
      {/* Glow de acento sutil atrás do título — decorativo, não captura clique */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 mx-auto h-[420px] max-w-4xl opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, var(--engine-accent-soft), transparent 70%)",
        }}
      />

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <h1
          className="engine-rise mb-5 font-display font-black uppercase italic leading-[0.9] tracking-tight text-[var(--engine-text)]"
          style={{ fontSize: "clamp(2.75rem, 11vw, 6rem)", animationDelay: "0.06s" }}
        >
          Engine <span className="text-[var(--engine-accent)]">Garage</span>
        </h1>

        <p
          className="engine-rise mb-8 max-w-xl text-balance text-base font-medium leading-relaxed text-[var(--engine-text-muted)] sm:text-lg"
          style={{ animationDelay: "0.12s" }}
        >
          {t("home.subtitle")}
        </p>

        <div
          className="engine-rise flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center"
          style={{ animationDelay: "0.18s" }}
        >
          <Button size="lg" className="w-full sm:w-auto" onClick={() => navigate("/garagem")}>
            {t("home.cta")}
            <ArrowRight size={18} />
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => navigate("/dashboard")}
          >
            {t("home.ctaSecondary")}
          </Button>
        </div>
      </section>

      {/* Stats - Seu Garage */}
      <section
        className="engine-rise mx-auto mt-12 w-full max-w-4xl sm:mt-16"
        style={{ animationDelay: "0.24s" }}
      >
        <div className="mb-4 px-4 sm:px-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--engine-text-subtle)]">
            Seu Garage
          </p>
        </div>

        {/* Stats Cards - Scroll horizontal no mobile, grid no desktop */}
        <div className="flex gap-3 overflow-x-auto px-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0 pb-2 sm:pb-0 -mx-4 sm:mx-0">
          {statCards.map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className="engine-card engine-card-hover group flex-shrink-0 w-40 sm:w-auto flex flex-col justify-between p-4 sm:p-5 cursor-pointer transition-all"
            >
              <div>
                <p className="text-xs font-semibold text-[var(--engine-text-muted)] mb-3">
                  {card.label}
                </p>
                <div className="text-3xl sm:text-2xl font-black text-[var(--engine-accent)]">
                  {card.value}
                </div>
              </div>
              <p className="text-xs text-[var(--engine-text-subtle)] mt-3 group-hover:text-[var(--engine-accent)] transition-colors">
                {card.subtitle}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Âncora discreta no rodapé — só aparece para quem não é premium. */}
      <AdSlot slot="home-footer" format="horizontal" className="mx-auto mt-12 max-w-4xl" />
    </div>
  );
}
