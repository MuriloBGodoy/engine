import { useId } from "react";
import {
  CLUB_ICON_PATHS,
  DEFAULT_CLUB_ICON,
  DEFAULT_CLUB_SHAPE,
  clubColorVars,
} from "../../services/clubStyles";

/**
 * O emblema do clube, gerado em SVG por composição.
 *
 * Forma × símbolo × sigla × duas cores. Não existe upload: o Firebase Storage
 * está desligado (memória `engine-prelancamento`) e imagem hoje viraria base64
 * dentro do documento. Emblema gerado custa zero byte no Firestore, nunca vem
 * quebrado e mantém a grade de descoberta consistente — que era o defeito do
 * card antigo, com um retângulo cinza vazio onde deveria estar a identidade.
 *
 * A forma padrão é a PLACA, que foi a direção aprovada: faixa superior como a
 * Mercosul, sigla em mono no corpo. É a peça que só um app brasileiro de carro
 * teria, e ela funciona de 28px (lista de ranking) a 96px (cabeçalho).
 */


export function ClubEmblem({ club, size = 64, className = "" }) {
  const gradientId = useId();
  const shape = club?.emblem?.shape || DEFAULT_CLUB_SHAPE;
  const icon = club?.emblem?.icon || DEFAULT_CLUB_ICON;
  const tag = String(club?.tag || "").toUpperCase() || "—";
  const vars = clubColorVars(club);
  const fill = vars["--club"];
  const fill2 = vars["--club-2"];

  // A sigla tem de 2 a 5 letras: sem encolher, "CBSC" transborda a placa.
  const fit = (base) => Math.min(base, (base * 3.2) / Math.max(tag.length, 2.6));
  const path = CLUB_ICON_PATHS[icon] || "";
  const symbol = (x, y, w) =>
    path
      ? `<g transform="translate(${x},${y}) scale(${w / 24})"><path d="${path}" fill="rgba(255,255,255,.92)"/></g>`
      : "";
  const label = (y, fontSize) =>
    `<text x="50" y="${y}" text-anchor="middle" font-family="JetBrains Mono, ui-monospace, monospace" font-weight="800" font-size="${fit(
      fontSize,
    )}" letter-spacing="${tag.length > 4 ? 0.5 : 1.5}" fill="#ffffff">${tag}</text>`;

  let body;
  if (shape === "shield") {
    body = `
      <path d="M50 8l36 13v26c0 22-15 38-36 45C29 85 14 69 14 47V21L50 8z" fill="${fill}"/>
      <path d="M50 8l36 13v26c0 22-15 38-36 45C29 85 14 69 14 47V21L50 8z" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="3"/>
      ${symbol(36, 22, 28)}
      <path d="M14 55h72v16H14z" fill="${fill2}"/>
      ${label(68, 17)}`;
  } else if (shape === "circle") {
    body = `
      <circle cx="50" cy="50" r="42" fill="${fill}"/>
      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="3"/>
      <circle cx="50" cy="50" r="33" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>
      ${symbol(37, 20, 26)}
      <path d="M8 54h84v18H8z" fill="${fill2}" opacity=".95"/>
      ${label(68, 17)}`;
  } else if (shape === "hex") {
    body = `
      <path d="M50 6l38 22v44L50 94 12 72V28L50 6z" fill="${fill}"/>
      <path d="M50 6l38 22v44L50 94 12 72V28L50 6z" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="3"/>
      ${symbol(37, 22, 26)}
      <path d="M17 56h66v16H17z" fill="${fill2}"/>
      ${label(69, 17)}`;
  } else {
    body = `
      <rect x="3" y="12" width="94" height="76" rx="10" fill="${fill}"/>
      <rect x="3" y="12" width="94" height="76" rx="10" fill="none" stroke="rgba(255,255,255,.58)" stroke-width="3"/>
      <path d="M3 22a10 10 0 0110-10h74a10 10 0 0110 10v12H3V22z" fill="${fill2}"/>
      ${symbol(7, 14, 17)}
      <circle cx="46" cy="23" r="1.8" fill="rgba(255,255,255,.72)"/>
      <circle cx="53" cy="23" r="1.8" fill="rgba(255,255,255,.72)"/>
      <circle cx="60" cy="23" r="1.8" fill="rgba(255,255,255,.72)"/>
      ${label(72, 34)}
      <rect x="3" y="80" width="94" height="8" rx="4" fill="rgba(0,0,0,.2)"/>`;
  }

  // O SVG é montado como string e injetado: são formas geradas, sem entrada de
  // usuário além da sigla, que já vem normalizada para [A-Z0-9]{2,5}.
  const markup = `<defs><filter id="${gradientId}"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".34"/></filter></defs><g filter="url(#${gradientId})">${body}</g>`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={tag}
      className={`shrink-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/** A sigla como o membro a carrega: `[CVC]` ao lado do nome. */
export function ClubTag({ tag, className = "" }) {
  if (!tag) return null;
  return (
    <span
      className={`inline-block rounded-md border border-[color-mix(in_srgb,var(--club,var(--engine-border-strong))_38%,transparent)] bg-[color-mix(in_srgb,var(--club,var(--engine-surface-2))_16%,transparent)] px-1.5 py-px font-mono text-[10px] font-extrabold tracking-wide text-[var(--club-ink,var(--engine-text-muted))] ${className}`}
    >
      [{String(tag).toUpperCase()}]
    </span>
  );
}
