/**
 * Travas da redução de imagem.
 *
 *   node scripts/check-imagens.mjs
 *
 * Por que existe: o upload para o Storage está desligado (precisa do Blaze) e a
 * foto de perfil vive como data URI dentro do documento do Firestore. O
 * documento tem teto de 1 MiB e o `photoURL` do Auth tem teto de alguns
 * milhares de caracteres — nenhum dos dois avisa antes, os dois falham na hora
 * de gravar. No computador a foto escolhida já era pequena e passava; no
 * celular vinha da câmera com 3 a 8 MB e nada passava, com o erro indo para um
 * `console.error` que ninguém lê.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const { calcularDestino, bytesDoDataUri, AVATAR, BANNER } = await import(
  pathToFileURL(path.join(ROOT, "src/services/imagens.js")).href
);

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  if (ok) console.log(`  ok   ${nome}`);
  else {
    falhas += 1;
    console.log(`  FALHA ${nome}${detalhe ? `\n         ${detalhe}` : ""}`);
  }
};
const igual = (nome, obtido, esperado) =>
  check(nome, JSON.stringify(obtido) === JSON.stringify(esperado),
    `obtive ${JSON.stringify(obtido)}, esperava ${JSON.stringify(esperado)}`);

console.log("\nimagem do perfil\n");

// --- a conta de caber sem distorcer
igual("foto de celular deitada cabe na caixa do avatar",
  calcularDestino(4032, 3024, AVATAR.largura, AVATAR.altura), { largura: 256, altura: 192 });
igual("foto em pé mantém a proporção",
  calcularDestino(3024, 4032, AVATAR.largura, AVATAR.altura), { largura: 192, altura: 256 });
igual("imagem já pequena NÃO é ampliada (ficaria borrada e mais pesada)",
  calcularDestino(80, 80, AVATAR.largura, AVATAR.altura), { largura: 80, altura: 80 });
igual("banner largo encosta na largura, não na altura",
  calcularDestino(4000, 1000, BANNER.largura, BANNER.altura), { largura: 1280, altura: 320 });
igual("arquivo sem dimensão não vira NaN",
  calcularDestino(0, 0, AVATAR.largura, AVATAR.altura), { largura: 0, altura: 0 });
igual("quadrado no banner encosta na altura",
  calcularDestino(2000, 2000, BANNER.largura, BANNER.altura), { largura: 420, altura: 420 });

// --- o peso que vai para o documento
check("data URI vira bytes reais (base64 engorda ~33%)",
  bytesDoDataUri(`data:image/jpeg;base64,${"A".repeat(1000)}`) === 750);
check("enchimento do base64 não conta como conteúdo",
  bytesDoDataUri(`data:image/jpeg;base64,${"A".repeat(998)}==`) === 748);
check("string que não é data URI vale zero", bytesDoDataUri("nada disso") === 0);

// O teto dos dois somados tem que caber com folga no documento de 1 MiB, que
// ainda leva bio, cidade, nome e o resto do perfil.
check("avatar e banner somados cabem no documento de 1 MiB",
  AVATAR.tetoBytes + BANNER.tetoBytes < 700 * 1024,
  `${AVATAR.tetoBytes + BANNER.tetoBytes} bytes`);

// --- o fio: reduzir antes de virar preview
const modal = fs.readFileSync(path.join(ROOT, "src/components/EditProfileModal.jsx"), "utf8");
check("a imagem é reduzida antes de virar preview",
  modal.includes("await reduzirImagem(file,"),
  "o arquivo original voltaria a ir inteiro para o documento");
check("não sobrou leitura do arquivo cru em base64",
  !modal.includes("readAsDataURL"),
  "readAsDataURL sobre o arquivo original é justamente o que estourava");
check("o `photoURL` do Auth só recebe URL de verdade",
  modal.includes("urlParaAuth"),
  "data URI no photoURL derruba o salvamento inteiro");
check("falha ao salvar aparece na tela",
  /showToast\(\s*$|showToast\(/m.test(modal) && modal.split("showToast(").length - 1 >= 4,
  "erro que só vai para o console é erro que ninguém vê");

console.log(falhas === 0 ? "\ntudo verde\n" : `\n${falhas} falha(s)\n`);
process.exit(falhas === 0 ? 0 : 1);
