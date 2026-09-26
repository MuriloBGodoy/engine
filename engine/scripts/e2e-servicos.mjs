/* global document, getComputedStyle -- usados dentro de page.evaluate(), que roda no navegador */
// Ciclo de receita: prestador anuncia → admin aprova → cliente encontra.
import { chromium } from "playwright";
import { novaSessao, etapa, cadastrar, relatorio, USUARIOS, textoDaPagina, escolherPorTexto } from "./e2e-emulator.mjs";

const BASE = "http://localhost:5190";
const TITULO = `Lavagem a seco ${Date.now().toString(36).slice(-5)}`;
const browser = await chromium.launch();

// Prestador
const A = await novaSessao(browser);
const pa = A.page;
const avisos = [];
pa.on("console", (m) => { if (m.type() === "warning" && /saveServiceListing|Firestore|permission|serviceListing/i.test(m.text())) avisos.push(m.text().slice(0, 400)); });
await etapa("Prestadora: cadastro", A, async () => {
  await cadastrar(pa, USUARIOS.a);
  await pa.waitForURL((u) => !u.pathname.startsWith("/register"), { timeout: 20000 });
});

await etapa("Prestadora: abre o formulário de anúncio", A, async () => {
  await pa.goto(`${BASE}/services`, { waitUntil: "load" });
  await pa.waitForTimeout(3500);
  await pa.getByRole("button", { name: /Cadastrar novo serviço|Novo serviço/i }).first().click();
  await pa.waitForTimeout(2000);
  return (await textoDaPagina(pa)).includes("Minha vitrine") ? "formulário aberto" : "aberto";
});

await etapa("Prestadora: preenche e envia pra aprovação", A, async () => {
  await pa.getByPlaceholder("Limpeza premium de carros em domicílio").fill(TITULO);
  await pa.getByPlaceholder("Seu nome ou empresa").fill("Ana Estética Automotiva");
  await pa.getByPlaceholder(/Explique o que você faz/).fill("Lavagem a seco no seu endereço, com produtos biodegradáveis. Atendo Campinas e região, com hora marcada.");
  const selects = pa.locator("form select");
  const n = await selects.count();
  for (let i = 0; i < n; i += 1) {
    const s = selects.nth(i);
    if (await s.isDisabled()) continue;
    if (!(await s.inputValue())) await escolherPorTexto(s, /Estética|Lavagem|São Paulo|Brasil/).catch(() => {});
  }
  await pa.waitForTimeout(800);
  for (let i = 0; i < n; i += 1) {
    const s = selects.nth(i);
    if (await s.isDisabled()) continue;
    if (!(await s.inputValue())) await escolherPorTexto(s, /São Paulo|Campinas/).catch(() => {});
  }
  await pa.getByPlaceholder("São Paulo, SP").fill("Campinas").catch(() => {});
  await pa.getByPlaceholder("Rua, número, bairro").fill("Av. Norte-Sul, 1000, Cambuí").catch(() => {});
  await pa.getByPlaceholder(/Zona Sul, ABC/).fill("Campinas e região, até 20 km").catch(() => {});
  await pa.getByPlaceholder("(11) 99999-9999").fill("19987654321").catch(() => {});
  await pa.getByPlaceholder("A partir de R$ 120").fill("A partir de R$ 90").catch(() => {});
  await pa.getByRole("button", { name: /Enviar para aprovação|aprovação/i }).last().click();
  await pa.waitForTimeout(400);
  await pa.screenshot({ path: "e2e-out/servico-toast-imediato.png" });
  const toast = await pa.evaluate(() => {
    const t = [...document.querySelectorAll("[role=status], [role=alert], [aria-live]")].map((e) => e.textContent.trim()).filter(Boolean);
    const el = [...document.querySelectorAll("[role=status], [role=alert], [aria-live]")].find((e) => e.textContent.trim());
    if (!el) return { t };
    const r = el.getBoundingClientRect();
    const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { t, visivel: el.contains(topo) || topo === el, z: getComputedStyle(el.closest("[class*=fixed]") || el).zIndex };
  });
  console.log("TOAST:", JSON.stringify(toast));
  await pa.waitForTimeout(4000);
  await textoDaPagina(pa);
  const erros = await pa.locator("form [role=alert], form .text-red-500, form .text-red-400, form .text-red-600").allTextContents().catch(() => []);
  if (erros.filter((e) => e.trim()).length) throw new Error(`formulário recusou: ${erros.join(" | ").slice(0, 240)}`);
  if (toast.t.some((x) => /enviado|aprovação|análise/i.test(x))) return `toast: ${toast.t.join(" | ")}`;
  throw new Error(`não enviou — toast: ${toast.t.join(" | ") || "(nenhum)"}`);
});

// Cliente ainda não vê
const B = await novaSessao(browser, { mobile: true });
const pb = B.page;
await etapa("Cliente: cadastro", B, async () => {
  await cadastrar(pb, USUARIOS.b);
  await pb.waitForURL((u) => !u.pathname.startsWith("/register"), { timeout: 20000 });
});
await etapa("Cliente: NÃO vê anúncio ainda não aprovado", B, async () => {
  await pb.goto(`${BASE}/services`, { waitUntil: "load" });
  await pb.waitForTimeout(4000);
  const t = await textoDaPagina(pb);
  if (t.includes(TITULO)) throw new Error("anúncio pendente está visível ao público");
  return "oculto, como deve";
});

// Admin aprova (conta descartável no emulador com o e-mail de admin)
const C = await novaSessao(browser);
const pc = C.page;
await etapa("Admin: entra (ou se cadastra) com o e-mail de admin", C, async () => {
  // Login primeiro: a conta de admin sobrevive entre rodadas no mesmo
  // emulador, e tentar cadastrá-la de novo marcava um 400 que não é defeito.
  const entrar = async () => {
    await pc.goto(`${BASE}/login`, { waitUntil: "load" });
    await pc.fill('input[type="email"]', "muxdtuber@gmail.com");
    await pc.fill('input[type="password"]', "Engine!2026seguro");
    await pc.click('button[type="submit"]');
    await pc.waitForTimeout(5000);
    return !new URL(pc.url()).pathname.startsWith("/login");
  };
  const errosAntes = C.erros.length;
  if (await entrar()) return "entrou";
  C.erros.length = errosAntes; // a tentativa de login sem conta não é defeito
  await cadastrar(pc, {
    nome: "Admin Teste",
    usuario: `admin_${Date.now().toString(36).slice(-5)}`,
    email: "muxdtuber@gmail.com",
    senha: "Engine!2026seguro",
    telefone: "11911112222",
  });
  await pc.waitForURL((u) => !u.pathname.startsWith("/register"), { timeout: 20000 });
  return "cadastrou";
});
await etapa("Admin: aprova na fila", C, async () => {
  await pc.goto(`${BASE}/services/approvals`, { waitUntil: "load" });
  await pc.waitForTimeout(4500);
  const t = await textoDaPagina(pc);
  if (!t.includes(TITULO)) throw new Error(`anúncio não aparece na fila — ${t.slice(0, 220)}`);
  // O menor bloco que contém o título E um botão "Aprovar" é o card do anúncio.
  const cartao = pc.locator("div").filter({ hasText: TITULO }).filter({ has: pc.getByRole("button", { name: "Aprovar", exact: true }) }).last();
  await cartao.getByRole("button", { name: "Aprovar", exact: true }).click();
  await pc.waitForTimeout(3500);
  return "aprovado";
});

await etapa("Cliente: agora vê o anúncio", B, async () => {
  await pb.goto(`${BASE}/services`, { waitUntil: "load" });
  await pb.waitForTimeout(4500);
  const t = await textoDaPagina(pb);
  if (!t.includes(TITULO)) throw new Error(`aprovado mas NÃO aparece — ${t.slice(0, 220)}`);
  return "aparece";
});

await etapa("Cliente: abre o anúncio e vê o contato", B, async () => {
  await pb.getByText(TITULO).first().click();
  await pb.waitForTimeout(3000);
  const t = await textoDaPagina(pb);
  return /WhatsApp|whatsapp|Chamar|Contato/i.test(t) ? "contato visível" : `? ${t.slice(0, 200)}`;
});

await browser.close();
relatorio();
