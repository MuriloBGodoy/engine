/**
 * Banco de prova das Conquistas.
 *
 * A aba vive atrás do login e depende de números que ninguém tem ainda —
 * produção inteira soma 11 curtidas. Este entry monta os componentes DE
 * PRODUÇÃO com os três momentos que a régua atravessa, para dar pra olhar o
 * estado de hoje e o de daqui a muito tempo sem criar conta nem forjar dado.
 *
 * Não entra no build: o Vite só empacota o index.html. Vive no `npm run dev`,
 * em /achievements-preview.html.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { AchievementsTab } from "./components/achievements/AchievementsTab";
import { AchievementCelebration } from "./components/achievements/AchievementCelebration";
import { likeTierId } from "./services/achievements";
import "./index.css";
import "./services/i18n";

const QUERY = new URLSearchParams(window.location.search);
if (QUERY.get("dark") === "1") document.documentElement.classList.add("dark");

/* Os três momentos. "hoje" é o dado real medido em produção: 11 curtidas
   somadas, nenhum degrau batido, nenhum marco além da primeira meta. */
const CENARIOS = {
  hoje: {
    rotulo: "Hoje (dado real)",
    unlocked: new Set(["first_goal"]),
    likesReceived: 11,
    followersCount: 3,
  },
  quase: {
    rotulo: "Quase lá",
    unlocked: new Set(["first_goal", "first_conquest"]),
    likesReceived: 950,
    followersCount: 612,
  },
  cheio: {
    rotulo: "Cheio (futuro)",
    unlocked: new Set([
      "first_goal",
      "first_conquest",
      "owned_car",
      likeTierId(1000),
      likeTierId(10000),
    ]),
    likesReceived: 12400,
    followersCount: 612,
  },
};

// Exportado só para o fast refresh do Vite não reclamar num arquivo que
// define componente e monta a raiz no mesmo lugar.
export function Bench() {
  const [qual, setQual] = React.useState(QUERY.get("estado") || "hoje");
  const [festa, setFesta] = React.useState(false);
  const cenario = CENARIOS[qual] || CENARIOS.hoje;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 py-6">
      <div className="flex flex-wrap gap-2">
        {Object.entries(CENARIOS).map(([chave, c]) => (
          <button
            key={chave}
            type="button"
            onClick={() => setQual(chave)}
            className={`min-h-11 rounded-xl border px-3 text-[13px] font-bold transition ${
              qual === chave
                ? "border-[var(--engine-accent)] bg-[var(--engine-accent-soft)] text-[var(--engine-accent)]"
                : "border-[var(--engine-border)] text-[var(--engine-text-muted)]"
            }`}
          >
            {c.rotulo}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setFesta(true)}
          className="min-h-11 rounded-xl border border-[var(--engine-border)] px-3 text-[13px] font-bold text-[var(--engine-text-muted)]"
        >
          Ver celebração
        </button>
      </div>

      <p className="text-[13px] text-[var(--engine-text-muted)]">
        {cenario.likesReceived} curtidas recebidas · {cenario.followersCount} seguidores
      </p>

      <AchievementsTab
        unlocked={cenario.unlocked}
        likesReceived={cenario.likesReceived}
        followersCount={cenario.followersCount}
      />

      <AchievementCelebration
        open={festa}
        kind="milestone"
        milestoneId="first_conquest"
        onClose={() => setFesta(false)}
        onShare={() => setFesta(false)}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Bench />
  </React.StrictMode>,
);
