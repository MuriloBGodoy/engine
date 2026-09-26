// Passada no CELULAR (390×844), usuário novo do zero: primeira impressão,
// carro que já tem, lançar gasto, simulador, painel. Capturas de página
// inteira para olhar, não só para contar erro.
import { chromium } from "playwright";
import { novaSessao, etapa, cadastrar, relatorio, USUARIOS, textoDaPagina, esperarOpcoes, escolherPorTexto, fecharSobreposicoes } from "./e2e-emulator.mjs";

const BASE = "http://localhost:5190";
const browser = await chromium.launch();
const S = await novaSessao(browser, { mobile: true });
const p = S.page;
const foto = async (nome) => p.screenshot({ path: `e2e-out/cel-${nome}.png`, fullPage: true });

await etapa("Cel: cadastro", S, async () => {
  await cadastrar(p, USUARIOS.a);
  await p.waitForURL((u) => !u.pathname.startsWith("/register"), { timeout: 20000 });
  await p.waitForTimeout(3500);
  await foto("01-primeira-tela");
  return (await textoDaPagina(p)).slice(0, 160);
});

await etapa("Cel: garagem vazia", S, async () => {
  await p.goto(`${BASE}/garagem`, { waitUntil: "load" });
  await p.waitForTimeout(3000);
  await foto("02-garagem-vazia");
});

await etapa("Cel: cadastra o carro que já tem", S, async () => {
  await p.getByRole("button", { name: /Adicionar carro/ }).first().click();
  await p.waitForTimeout(1500);
  await p.getByRole("button", { name: /Já é meu/ }).first().click();
  const modal = p.locator("form").filter({ has: p.locator("select") }).last();
  const sel = modal.locator("select");
  await esperarOpcoes(sel.nth(0), 5);
  await escolherPorTexto(sel.nth(0), /^VW - VolksWagen$|^Volkswagen/i);
  await esperarOpcoes(sel.nth(1), 2);
  await escolherPorTexto(sel.nth(1), /Gol 1\.0/i);
  await esperarOpcoes(sel.nth(2), 2);
  const ano = await escolherPorTexto(sel.nth(2), /2016|2017|2018/);
  await p.waitForTimeout(2500);
  // SEM foto, de propósito: desde 25/09/2026 ela é opcional na garagem.
  await foto("03-modal-carro-preenchido");
  await modal.locator('button[type="submit"]').click();
  await p.waitForTimeout(4000);
  await fecharSobreposicoes(p);
  await foto("04-garagem-com-carro");
  if (!/Gol/i.test(await textoDaPagina(p))) throw new Error("carro sem foto não foi salvo");
  return `Gol ${ano}, sem foto`;
});

await etapa("Cel: lança gasto de combustível", S, async () => {
  await p.getByRole("button", { name: /Lançar gasto|^Gasto$/ }).first().click();
  await p.waitForTimeout(2000);
  await foto("05-modal-gasto");
  await p.getByPlaceholder("250").fill("220");
  await p.getByPlaceholder("87500").fill("87500").catch(() => {});
  await p.getByPlaceholder("38").fill("38").catch(() => {});
  await p.getByRole("button", { name: /^Lançar$/ }).last().click();
  await p.waitForTimeout(3000);
  await foto("06-gasto-lancado");
  const t = await textoDaPagina(p);
  return /220/.test(t) ? "R$ 220 aparece" : `? ${t.slice(0, 160)}`;
});

await etapa("Cel: simulador no celular", S, async () => {
  await p.goto(`${BASE}/garagem`, { waitUntil: "load" });
  await p.waitForTimeout(3000);
  await fecharSobreposicoes(p);
  await p.getByRole("button", { name: /Simular|Custo real/ }).first().click();
  await p.waitForTimeout(2500);
  await foto("07-simulador");
});

await etapa("Cel: Painel", S, async () => {
  await p.goto(`${BASE}/dashboard`, { waitUntil: "load" });
  await p.waitForTimeout(5000);
  await foto("08-painel");
});

await etapa("Cel: Configurações", S, async () => {
  await p.goto(`${BASE}/settings`, { waitUntil: "load" });
  await p.waitForTimeout(3500);
  await foto("09-configuracoes");
});

await etapa("Cel: Início logado", S, async () => {
  await p.goto(`${BASE}/`, { waitUntil: "load" });
  await p.waitForTimeout(4000);
  await foto("10-inicio-logado");
});

await browser.close();
relatorio();
