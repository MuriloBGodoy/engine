/**
 * Banco de prova do Painel.
 *
 * O Painel exige login, e não se cria conta na produção de ninguém só para
 * medir uma tela. Este entry monta o DashboardPage DE PRODUÇÃO com carros que
 * têm meta, abastecimento e simulação salva — o suficiente para o
 * `estimateOwnership` e os gráficos terem o que mostrar.
 *
 * Existe porque abaixo de 640px o Painel troca o gráfico horizontal do ECharts
 * por uma lista de progresso (ver o comentário no DashboardPage). Esse caminho
 * compacto nunca tinha sido visto num celular.
 *
 * Não entra no build: o Vite só empacota o index.html. Vive no `npm run dev`,
 * em /dashboard-preview.html.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { DashboardPage } from "./pages/DashboardPage";
import "./index.css";
import "./services/i18n";

const QUERY = new URLSearchParams(window.location.search);
if (QUERY.get("dark") === "1") document.documentElement.classList.add("dark");

const dias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const abastecimentos = [
  { id: "e1", category: "fuel", amount: 280, date: dias(96), odometer: 118400, liters: 40 },
  { id: "e2", category: "fuel", amount: 291, date: dias(74), odometer: 118850, liters: 41 },
  { id: "e3", category: "maintenance", amount: 620, date: dias(60), note: "Revisao 120 mil" },
  { id: "e4", category: "fuel", amount: 305, date: dias(52), odometer: 119320, liters: 43 },
  { id: "e5", category: "insurance", amount: 210, date: dias(40) },
  { id: "e6", category: "fuel", amount: 298, date: dias(28), odometer: 119760, liters: 42 },
  { id: "e7", category: "fuel", amount: 312, date: dias(6), odometer: 120240, liters: 44 },
];

/* Nomes longos de propósito: é o rótulo do carro que estoura a barra do gráfico
   no celular, e foi por isso que o modo compacto existe. */
const cars = [
  {
    id: "alvo",
    brand: "Fiat",
    model: "PULSE Drive 1.0 Turbo 200 Flex Aut.",
    year: "2023 Gasolina",
    type: "goal",
    targetValue: 92000,
    savedValue: 18000,
  },
  {
    id: "alvo2",
    brand: "VW - VolksWagen",
    model: "NIVUS Highline 1.0 TSI Flex 12V Aut.",
    year: "2024 Gasolina",
    type: "goal",
    targetValue: 138000,
    savedValue: 96000,
    ownership: { country: "BR", state: "SP", monthlyIncome: 9000, monthlyExpenses: 3200 },
  },
  {
    id: "batido",
    brand: "GM - Chevrolet",
    model: "ONIX PLUS Premier 1.0 12V TB Flex Aut.",
    year: "2022 Gasolina",
    type: "goal",
    targetValue: 78000,
    savedValue: 78000,
  },
  {
    id: "atual",
    brand: "VW - VolksWagen",
    model: "Gol 1.6 Mi Total Flex 8V 4p",
    year: "2014 Gasolina",
    type: "owned",
    targetValue: 34000,
    savedValue: 34000,
    expenses: abastecimentos,
  },
];

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-6">
      <DashboardPage
        cars={QUERY.get("vazio") === "1" ? [] : cars}
        settings={{
          profile: { country: "BR", state: "SP" },
          privacy: { lockSensitiveValues: QUERY.get("oculto") === "1" },
        }}
        onOpenOwnership={() => {}}
      />
    </div>
  </React.StrictMode>,
);
