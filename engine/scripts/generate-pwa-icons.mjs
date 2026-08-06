/**
 * Gera os ícones do PWA a partir do favicon.
 *
 * Rodar com `npm run icons` sempre que a marca mudar. O resultado vai pra
 * public/icons e é versionado — build não depende de gerar nada.
 *
 * O ícone "maskable" é desenhado à parte porque o Android recorta o ícone em
 * círculo, losango ou squircle conforme o aparelho: só os ~80% centrais são
 * garantidos. Reaproveitar o favicon quadrado ali cortaria o E.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../public/icons");

const BRAND = "#e11d2a";

// Mesma letra do favicon, no quadrado 64x64 original.
const letter = `<path fill="#fff" d="M18 46 24.4 18h23.2l-1.5 6.4H30.2l-1 4.3h14.5l-1.4 6.1H27.8l-1.1 4.8h16.4L41.6 46H18Z"/>`;

// Normal: cantos arredondados, letra no tamanho cheio.
const standard = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="${BRAND}"/>
  ${letter}
</svg>`;

// Maskable: fundo sangrando até a borda (o recorte cuida do formato) e a letra
// reduzida a 62% no centro, folgada dentro da zona segura.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${BRAND}"/>
  <g transform="translate(32 32) scale(0.62) translate(-32 -32)">${letter}</g>
</svg>`;

// Apple ignora transparência e não arredonda sozinho: fundo cheio, sem raio.
const appleTouch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${BRAND}"/>
  <g transform="translate(32 32) scale(0.78) translate(-32 -32)">${letter}</g>
</svg>`;

const targets = [
  { name: "icon-192.png", size: 192, svg: standard },
  { name: "icon-512.png", size: 512, svg: standard },
  { name: "icon-maskable-192.png", size: 192, svg: maskable },
  { name: "icon-maskable-512.png", size: 512, svg: maskable },
  { name: "apple-touch-icon.png", size: 180, svg: appleTouch },
];

await mkdir(outDir, { recursive: true });

for (const { name, size, svg } of targets) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  await writeFile(resolve(outDir, name), png);
  console.log(`${name} (${size}x${size})`);
}

console.log(`\n${targets.length} ícones gerados em public/icons`);
