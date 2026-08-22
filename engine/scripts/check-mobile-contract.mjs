/**
 * Guarda do que foi consertado na visão mobile em 21/08/2026. Não é teste de
 * layout — é uma trava contra as quatro regressões que já aconteceram uma vez.
 *
 *   npm run check:mobile
 *
 * Cada trava nasceu de um defeito medido, não de gosto. O comentário ao lado
 * de cada uma diz qual.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

let failures = 0;
const check = (name, ok, detail = "") => {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FALHA ${name}${detail ? `\n         ${detail}` : ""}`);
  }
};

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.jsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
};

console.log("\ncontrato da visão mobile\n");

// 1. useToast() DEVOLVE a função. Desestruturar `{ showToast }` dela dá
//    undefined, e a chamada estoura em vez de avisar. Em 21/08/2026 havia 34
//    chamadas assim em Eventos e Clubes — toda validação e todo erro dessas
//    duas telas morria com TypeError.
const files = walk("src");
const badToast = files.filter((f) => /\{\s*showToast\s*\}\s*=\s*useToast\(/.test(read(f)));
check(
  "ninguém desestrutura showToast de useToast()",
  badToast.length === 0,
  badToast.join(", "),
);

// 2. A barra inferior leva no máximo 5 abas. Com 7 cada aba media 51px num
//    iPhone 14 e o rótulo tinha sido baixado para 7px para caber. A diretriz
//    da Apple pede que a aba não caia abaixo de 78pt.
const mobileNav = read("src/components/MobileNav.jsx");
const navItems = (mobileNav.match(/\{\s*name:\s*t?\(?["`]/g) || []).length;
check("a barra inferior tem no máximo 5 abas", navItems <= 5, `achei ${navItems}`);
check(
  "a barra inferior é uma grade de 5 colunas",
  /grid-cols-5/.test(mobileNav),
  "grid-cols-N diferente de 5 significa que uma aba entrou sem outra sair",
);

// 3. Rótulo da barra legível. 7px não se lê.
//    Precisa olhar SÓ dentro do <nav>: o header logo acima tem um
//    `text-[13px] font-semibold` no botão "Entrar", e um regex solto no arquivo
//    inteiro casava com ele e passava mesmo com o rótulo em 7px (essa trava
//    nasceu vazia e foi pega na mutação).
const navBlock = mobileNav.slice(mobileNav.indexOf("<nav"), mobileNav.indexOf("</nav>"));
const navLabel = navBlock.match(/text-\[(\d+)px\][^"`]*font-semibold/);
check(
  "o rótulo da barra tem pelo menos 11px",
  Boolean(navLabel) && Number(navLabel[1]) >= 11,
  navLabel ? `achei ${navLabel[1]}px` : "não achei o rótulo dentro do <nav>",
);

// 4. A dica de visitante precisa sair do header por portal: o header usa
//    `backdrop-blur`, e `backdrop-filter` cria bloco de contenção — um filho
//    `position: fixed` passa a se posicionar pelo header, não pela tela. Sem o
//    portal a barra ia parar em top:-62px, fora de vista.
const hint = read("src/components/GuestLoginHint.jsx");
check(
  "a dica de visitante é desenhada em portal no body",
  /createPortal\(/.test(hint) && /document\.body/.test(hint),
  "sem portal ela some atrás do header que tem backdrop-blur",
);

// 5. "Eventos" já esteve escrito em português dentro de 3 menus. 12 dos 15
//    idiomas herdam do inglês, então o texto cru vaza para todos eles.
const hardcoded = ["src/components/MobileNav.jsx", "src/components/Sidebar.jsx", "src/components/TopNav.jsx"]
  .filter((f) => /name:\s*"Eventos"/.test(read(f)));
check("nenhum menu tem 'Eventos' fora do i18n", hardcoded.length === 0, hardcoded.join(", "));

const i18n = read("src/services/i18n.js");
check(
  "nav.events existe nos 3 idiomas com bloco próprio",
  (i18n.match(/^\s+events: "(Eventos|Events)",$/gm) || []).length >= 3,
);

console.log(
  failures === 0
    ? "\ntudo verde\n"
    : `\n${failures} trava(s) quebrada(s)\n`,
);
process.exit(failures === 0 ? 0 : 1);
