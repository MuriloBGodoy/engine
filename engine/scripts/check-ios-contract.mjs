/**
 * Guarda do que foi consertado para iPhone e iPad em 13/09/2026. Irmã da
 * `check-mobile-contract.mjs`: não é teste de layout, é uma trava contra as
 * regressões que já aconteceram uma vez, cada uma com o defeito medido que a
 * criou (Playwright WebKit, matriz iPhone SE / 13 / 15 / 15 Pro Max / iPad).
 *
 *   node scripts/check-ios-contract.mjs
 *
 * O WebKit do Playwright reporta env(safe-area-inset-*) = 0 e não abre
 * teclado, então o que depende disso é travado pelo CSS declarado, não pela
 * medida. O que só um iPhone físico confirma está no relatório da auditoria.
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

console.log("\ncontrato do iOS\n");

const html = read("index.html");
const css = read("src/index.css");
const mobileNav = read("src/components/MobileNav.jsx");
const installPrompt = read("src/components/InstallPrompt.jsx");
const guestHint = read("src/components/GuestLoginHint.jsx");

// 1. O tema padrão é escuro e a classe só chegava com o React montado: todo
//    carregamento pintava #e9ebf0 por um frame antes de escurecer, e no PWA a
//    splash preta abria num flash cinza. Medido no WebKit: primeiro frame com
//    class="" — agora nasce "dark" no HTML.
check(
  "o <html> já nasce com class=\"dark\" (sem flash claro antes do React)",
  /<html[^>]*\bclass="dark"/.test(html),
);

// 2. Havia DUAS metas theme-color, uma por prefers-color-scheme. O tema do
//    Engine é por classe, não pelo sistema: iPhone no claro do sistema com o
//    app escuro ganhava barra do Safari #f9fafb sobre uma tela #08090c. Agora
//    é uma só, sincronizada por script a partir do background do :root.
const themeMetas = html.match(/<meta\s+name="theme-color"[^>]*>/g) || [];
check(
  "existe uma única meta theme-color, sem media query",
  themeMetas.length === 1 && !/media=/.test(themeMetas[0]),
  `achei ${themeMetas.length}: ${themeMetas.join(" | ")}`,
);
check(
  "o theme-color é sincronizado com a classe do :root (MutationObserver)",
  /MutationObserver\(sync\)/.test(html) && /attributeFilter:\s*\["class"/.test(html),
);

// 3. Cabeçalho da PWA: `black-translucent` põe o conteúdo debaixo da barra de
//    status; sem viewport-fit=cover não existe env(), e sem env() no header
//    ele fica atrás do relógio em todo iPhone com notch.
check(
  "viewport tem viewport-fit=cover",
  /<meta\s+name="viewport"[^>]*viewport-fit=cover/.test(html),
);
check(
  "a barra de status da PWA é black-translucent",
  /apple-mobile-web-app-status-bar-style"\s+content="black-translucent"/.test(html),
);
const header = mobileNav.slice(mobileNav.indexOf("<header"), mobileNav.indexOf("</header>"));
check(
  "o header do mobile reserva env(safe-area-inset-top)",
  /pt-\[calc\([^\]]*env\(safe-area-inset-top\)/.test(header),
  "sem isso o header fica atrás da barra de status no PWA instalado",
);
check(
  "o herói do login reserva env(safe-area-inset-top) no celular",
  /\.auth-hero\s*\{[^}]*env\(safe-area-inset-top\)/.test(css),
);

// 4. Barra de abas é `fixed`: o padding lateral do body (notch em landscape)
//    não a alcança, e a barra de gestos embaixo também é dela.
const nav = mobileNav.slice(mobileNav.indexOf("<nav"), mobileNav.indexOf("</nav>"));
check(
  "a barra de abas tem env(safe-area-inset-bottom)",
  /env\(safe-area-inset-bottom\)/.test(nav),
);
check(
  "a barra de abas tem env(safe-area-inset-left) e -right (notch deitado)",
  /env\(safe-area-inset-left\)/.test(nav) && /env\(safe-area-inset-right\)/.test(nav),
);
check(
  "a barra de abas leva a classe engine-mobile-nav (gancho do convite)",
  /className="engine-mobile-nav /.test(nav),
);
check(
  "o body afasta o conteúdo do notch em landscape",
  /body\s*\{[^}]*padding-left:\s*env\(safe-area-inset-left\)/.test(css) &&
    /body\s*\{[^}]*padding-right:\s*env\(safe-area-inset-right\)/.test(css),
);

// 5. Convite de instalação: com `bottom: 12px` cobria 52px da barra de abas
//    e metade da dica de visitante num iPhone 13 na segunda visita, e no PWA
//    ficava debaixo da barra de gestos. O fechar media 32x32.
check(
  "o convite de instalação respeita env(safe-area-inset-bottom)",
  /bottom-\[max\([^\]]*env\(safe-area-inset-bottom\)/.test(installPrompt),
);
check(
  "o convite leva a classe engine-install-prompt",
  /className="engine-install-prompt /.test(installPrompt),
);
check(
  "o index.css sobe o convite acima da barra de abas quando ela existe",
  /body:has\(\.engine-mobile-nav\)\s+\.engine-install-prompt\s*\{[^}]*bottom:\s*calc\(4\.75rem\s*\+\s*env\(safe-area-inset-bottom\)\)/.test(css),
);
check(
  "o index.css recolhe a dica de visitante enquanto o convite está na tela",
  /body:has\(\.engine-install-prompt\)\s+\.engine-guest-dock\s*\{[^}]*display:\s*none/.test(css),
);
check(
  "a dica de visitante (dock) leva a classe engine-guest-dock",
  /className="engine-guest-dock /.test(guestHint),
);
const installClose = installPrompt.match(/aria-label=\{t\("common\.cancel"\)\}[\s\S]*?className="([^"]+)"/);
check(
  "o fechar do convite mede 44x44 (h-11 w-11)",
  Boolean(installClose) && /\bh-11\b/.test(installClose[1]) && /\bw-11\b/.test(installClose[1]),
  installClose ? installClose[1] : "não achei o botão de fechar",
);
const hintClose = guestHint.match(/aria-label=\{t\("guest\.hint\.close"\)\}[\s\S]*?className="([^"]+)"/);
check(
  "o fechar da dica (dock) mede 44x44 (h-11 w-11)",
  Boolean(hintClose) && /\bh-11\b/.test(hintClose[1]) && /\bw-11\b/.test(hintClose[1]),
  hintClose ? hintClose[1] : "não achei o botão de fechar",
);

// 6. iPhone sem beforeinstallprompt: o convite tem de ensinar o caminho
//    (Compartilhar → Adicionar à Tela de Início), nos 3 idiomas.
check(
  "o convite tem o ramo de instrução do iOS",
  /needsIOSInstructions\s*\?/.test(installPrompt) && /pwa\.iosStep1/.test(installPrompt),
);
const i18n = read("src/services/i18n.js");
check(
  "pwa.iosStep1 e iosStep2 existem nos 3 idiomas",
  (i18n.match(/^\s+iosStep1:\s*"/gm) || []).length >= 3 &&
    (i18n.match(/^\s+iosStep2:\s*"/gm) || []).length >= 3,
);

// 7. Zoom ao focar: campo < 16px faz o Safari dar zoom que não volta. A
//    regra existia só até 640px, e o iPad (768) e o iPhone deitado (750)
//    ficavam de fora — medido: 14px na busca e nos 3 selects de Serviços.
const zoomRule = css.match(/@media\s*\(max-width:\s*640px\),\s*\(pointer:\s*coarse\)\s*\{\s*input,\s*select,\s*textarea\s*\{\s*font-size:\s*16px/);
check("campos têm 16px por largura OU por ponteiro grosso (iPad, landscape)", Boolean(zoomRule));

// 8. Duplo-toque vira zoom no Safari mesmo com width=device-width.
check(
  "controles têm touch-action: manipulation",
  /\[role="button"\]\s*\{\s*touch-action:\s*manipulation/.test(css),
);

// 9. Alvos de 44pt nos botões de texto do login (mediam 22-24px de altura).
check(
  "botões de texto do login têm min-height 44px no toque",
  /@media\s*\(pointer:\s*coarse\)\s*\{\s*\.auth-text-button,\s*\.auth-switch-copy a\s*\{\s*min-height:\s*44px/.test(css),
);

// 10. 100vh no iOS é a altura com a barra do Safari recolhida.
check(
  "a tela de login usa 100dvh (com 100vh de fallback)",
  /\.auth-screen\s*\{[^}]*min-height:\s*100dvh/.test(css),
);

// 11. O ícone da tela de início: 180x180 e sem transparência (iOS pinta o
//     transparente de preto). Lê só o cabeçalho do PNG; a opacidade dos pixels
//     foi conferida com sharp na auditoria e o gerador (`npm run icons`)
//     desenha fundo cheio.
const icon = fs.readFileSync(path.join(root, "public/icons/apple-touch-icon.png"));
check(
  "apple-touch-icon.png existe e mede 180x180",
  icon.readUInt32BE(16) === 180 && icon.readUInt32BE(20) === 180,
);
check(
  "index.html aponta para o apple-touch-icon",
  /rel="apple-touch-icon"\s+href="\/icons\/apple-touch-icon\.png"/.test(html),
);

console.log(
  failures === 0 ? "\ntudo verde\n" : `\n${failures} trava(s) quebrada(s)\n`,
);
process.exit(failures === 0 ? 0 : 1);
