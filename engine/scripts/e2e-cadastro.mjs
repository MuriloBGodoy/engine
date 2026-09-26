/**
 * Cadastro com nome de usuário que já existe — o defeito que prendia o
 * e-mail da pessoa fora do app (achado na auditoria de 24/09/2026).
 *
 *   node scripts/e2e-cadastro.mjs      (com emuladores + vite, ver e2e-emulator.mjs)
 *
 * O que tem que acontecer: a tela diz que o NOME está em uso, nenhuma conta
 * é criada, e a pessoa troca o nome e entra com o MESMO e-mail. Antes:
 * "Não foi possível criar sua conta agora" → "Este e-mail já está cadastrado".
 */
import { chromium } from "playwright";
import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";
import { novaSessao, etapa, cadastrar, lerErroDaTela, relatorio, USUARIOS } from "./e2e-emulator.mjs";

process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
initializeApp({ projectId: "engine-garage" });
const contaExiste = (email) => getAuth().getUserByEmail(email).then(() => true, () => false);

const browser = await chromium.launch();

const a = await novaSessao(browser);
await etapa("Ana se cadastra", a, async () => {
  await cadastrar(a.page, USUARIOS.a);
  await a.page.waitForURL((u) => !u.pathname.startsWith("/register"), { timeout: 20000 });
});
await a.ctx.close();

const b = await novaSessao(browser);
await etapa("Bruno tenta o nome da Ana → mensagem específica", b, async () => {
  await cadastrar(b.page, { ...USUARIOS.b, usuario: USUARIOS.a.usuario });
  await b.page.waitForTimeout(5000);
  const msg = await lerErroDaTela(b.page);
  if (!/usuário já está em uso|já está em uso/i.test(msg)) throw new Error(`tela diz: "${msg}"`);
  return msg;
});

await etapa("…e nenhuma conta foi criada", b, async () => {
  if (await contaExiste(USUARIOS.b.email)) throw new Error("conta órfã criada no Auth");
  return "Auth sem conta do Bruno";
});

await etapa("Bruno troca o nome e entra com o MESMO e-mail", b, async () => {
  await b.page.locator('input[autocomplete="username"]').fill(USUARIOS.b.usuario);
  await b.page.click('button[type="submit"]');
  await b.page.waitForURL((u) => !u.pathname.startsWith("/register"), { timeout: 20000 });
  return new URL(b.page.url()).pathname;
});

await browser.close();
process.exit(relatorio() ? 1 : 0);
