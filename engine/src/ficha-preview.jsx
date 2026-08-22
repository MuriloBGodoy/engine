/**
 * Banco de prova da ficha tecnica.
 *
 * NÃO É MAIS TEMPORÁRIO (22/08/2026). Ficou porque é a única forma de olhar o
 * que está atrás do login sem criar conta na produção. Foi com ele que a
 * auditoria mobile mediu o simulador e a ficha pela primeira vez num celular.
 * Não entra no build: o Vite só empacota o index.html, então isto vive só no
 * `npm run dev` — abrir /ownership-preview.html ou /ficha-preview.html.
 *
 * A Garagem exige login, e nao se cria conta na producao de ninguem so para
 * tirar print. Este entry monta os componentes DE PRODUCAO (CarCard,
 * SpecSheetView, SpecSheetEditor) com os mesmos tokens, a mesma i18n e os
 * mesmos servicos, e com carros reais da FIPE cobrindo os estados que importam.
 */
import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { useTranslation } from "react-i18next";
import { CarCard } from "./components/CarCard";
import { SpecSheetEditor } from "./components/specsheet/SpecSheetEditor";
import { SpecSheetView } from "./components/specsheet/SpecSheetView";
import { resolveVehicleSpecSheet } from "./services/carSpecSheet";
import "./index.css";
import "./services/i18n";

const car = (brand, model, year, extra = {}) => ({
  id: `${model}-${year}`,
  brand,
  model,
  year,
  type: "owned",
  image: "",
  targetValue: 90000,
  savedValue: 90000,
  ...extra,
});

const CARS = [
  // O estado MAJORITARIO: 62% dos carros reais nao tem numero de fabrica.
  car("VW - VolksWagen", "Polo Track 1.0 Flex 12V 5p Mec.", "2023 Gasolina"),
  // Abstencao do parser: a FIPE lista o Onix 1.0 com e sem turbo.
  car("GM - Chevrolet", "ONIX HATCH LT 1.0 12V Flex 5p Mec.", "2022 Gasolina"),
  // Tudo confirmado, com par flex.
  car("Hyundai", "HB20 Platinum Plus 1.0 TGDI Flex 12V Aut.", "2026 Gasolina"),
  // Camada 3: modificado sobre um valor de fabrica -> a seta.
  car("VW - VolksWagen", "T-Cross 200 TSI 1.0 Flex 12V 5p Aut.", "2023 Gasolina", {
    specs: {
      performance: {
        powerCv: { value: 210, unit: "cv", origin: "modified", method: "owner", basis: "crank" },
        torque: { value: 32, unit: "kgfm", origin: "modified", method: "owner", basis: "crank" },
      },
      mods: ["remap", "intake", "exhaust", "intercooler"],
      stage: "stage2",
      notes: "Stage 2 na Turbo Motorsport, downpipe e intercooler maior. Roda com 0,9 bar no etanol.",
    },
  }),
  // Reguas diferentes: numero na roda contra ficha no motor.
  car("Fiat", "PULSE Drive 1.0 Turbo 200 Flex Aut.", "2023 Gasolina", {
    specs: {
      performance: {
        powerCv: { value: 118, unit: "cv", origin: "declared", method: "dyno", basis: "wheel", shop: "Dinamica Dyno", date: "2026-03-14" },
      },
      mods: [],
    },
  }),
  // GNV: a modificacao mais comum da frota nacional, e ela TIRA potencia.
  car("Fiat", "ARGO DRIVE 1.0 6V Flex", "2022 Gasolina", {
    specs: { mods: ["gnv"], notes: "Kit de 5a geracao, cilindro de 16 m3 no porta-malas." },
  }),
  // Correcao de versao que DESTRAVA a ficha inteira.
  car("GM - Chevrolet", "ONIX HATCH LT 1.0 12V Flex 5p Mec.", "2022 Gasolina", {
    id: "onix-corrigido",
    specs: { version: { aspiration: "naturally_aspirated" } },
  }),
  // Carro de outra pessoa (Comunidade): sem `type`, logo sem ficha de exemplar.
  car("Hyundai", "HB20 Platinum Plus 1.0 TGDI Flex 12V Aut.", "2026 Gasolina", {
    id: "comunidade",
    type: "goal",
  }),
];

const LABELS = [
  "1 · Sem fabrica (o caso majoritario)",
  "2 · Parser se abstem",
  "3 · Tudo confirmado, par flex",
  "4 · Modificado: a seta",
  "5 · Na roda x no motor",
  "6 · GNV",
  "7 · Destravado pela correcao",
  "8 · Carro de outra pessoa",
];

// O print e tirado por URL, nao por clique: `chrome --screenshot` sai assim que
// a pagina carrega e nao ha onde encaixar um clique no meio.
const QUERY = new URLSearchParams(window.location.search);
if (QUERY.get("dark") === "1") document.documentElement.classList.add("dark");

function Bench() {
  const { i18n } = useTranslation();
  const [editing, setEditing] = useState(QUERY.get("editor") === "1");

  const lang = QUERY.get("lang");
  if (lang && i18n.language !== lang) i18n.changeLanguage(lang);

  return (
    <div className="min-h-[100dvh] bg-[var(--engine-bg)] p-4 font-sans text-[var(--engine-text)] sm:p-8">
      <div className="mb-6 flex flex-wrap gap-2">
        {["pt-BR", "en-US", "es-ES"].map((lng) => (
          <button
            key={lng}
            type="button"
            data-lang={lng}
            onClick={() => i18n.changeLanguage(lng)}
            className="rounded-lg border border-[var(--engine-border)] px-3 py-1.5 text-xs font-bold"
          >
            {lng}
          </button>
        ))}
        <button
          type="button"
          data-theme-toggle
          onClick={() => document.documentElement.classList.toggle("dark")}
          className="rounded-lg border border-[var(--engine-border)] px-3 py-1.5 text-xs font-bold"
        >
          tema
        </button>
        <button
          type="button"
          data-editor-toggle
          onClick={() => setEditing((value) => !value)}
          className="rounded-lg border border-[var(--engine-border)] px-3 py-1.5 text-xs font-bold"
        >
          editor
        </button>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-black uppercase tracking-widest">CarCard</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CARS.slice(0, 3).map((item) => (
            <CarCard
              key={item.id}
              car={item}
              onOpenSpecs={() => {}}
              onOpenOwnership={() => {}}
              onAddExpense={() => {}}
              onDelete={() => {}}
            />
          ))}
        </div>
      </section>

      {editing ? (
        <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-elevated)] p-4">
          <h2 className="mb-3 text-sm font-black uppercase tracking-widest">Editor</h2>
          <SpecSheetEditor
            car={CARS[1]}
            resolved={resolveVehicleSpecSheet(CARS[1])}
            focusVersion
            onCancel={() => {}}
            onSave={() => {}}
          />
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-2">
          {CARS.map((item, index) => {
            const resolved = resolveVehicleSpecSheet(item);
            return (
              <div key={item.id}>
                <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-[var(--engine-accent)]">
                  {LABELS[index]}
                </p>
                <SpecSheetView
                  resolved={resolved}
                  versionString={`${item.brand} ${item.model}`}
                  canEdit={item.type === "owned"}
                  onEdit={() => {}}
                  onCorrectVersion={() => {}}
                />
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Bench />
  </React.StrictMode>,
);

// Sonda de estouro horizontal (temporaria). Roda num rAF logo apos o render,
// porque `chrome --screenshot` dispara no load e nao espera setTimeout.
if (new URLSearchParams(window.location.search).get("probe") === "1") {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const width = document.documentElement.clientWidth;
      const guilty = [...document.querySelectorAll("*")]
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.right > width + 1)
        .slice(0, 14)
        .map(
          ({ el, rect }) =>
            el.tagName + "." + String(el.className).slice(0, 60) + " right=" + Math.round(rect.right),
        );
      const box = document.createElement("pre");
      box.style.cssText =
        "position:fixed;inset:0 auto auto 0;z-index:9999;background:#fff;color:#000;font:10px monospace;padding:4px;max-width:100vw;white-space:pre-wrap";
      box.textContent = [
        "client=" + width + " scroll=" + document.documentElement.scrollWidth,
      ]
        .concat(guilty)
        .join(String.fromCharCode(10));
      document.body.appendChild(box);
    });
  });
}
