/**
 * Testes das regras do Firestore para CLUBES, rodados contra o emulador.
 *
 * Não roda sozinho — precisa do emulador de pé e de duas dependências que não
 * ficam no projeto:
 *
 *   npm i -D @firebase/rules-unit-testing firebase
 *   firebase emulators:exec --only firestore --project demo-rules-check \
 *     "node scripts/check-club-rules.mjs"
 *
 * (O emulador sobe na 8099 porque a 8080 é do backend Java em dev.)
 *
 * Por que existe: até 22/09/2026 a feature de Clubes falava só com o backend
 * Java, e a coleção `clubs` não tinha regra nenhuma — caía no deny padrão,
 * como `events` caiu em agosto. O port para o Firestore direto criou de uma vez
 * cinco caminhos de ESCRITA EM DOCUMENTO ALHEIO: o contador de membros, o doc
 * de membro que o capitão cria ao aprovar, o espelho de "meus clubes" do
 * aprovado, o carimbo de clube em `events` e o carimbo em `communityGoals`.
 * Escrita alheia sem teste é buraco com aparência de feature.
 *
 * Duas armadilhas que já custaram teste verde pelo motivo errado, e que este
 * arquivo trata de propósito:
 *
 *   - ESCRITA QUE NÃO MUDA NADA PASSA EM QUALQUER REGRA. Gravar o mesmo valor
 *     produz um diff vazio, e `affectedKeys().hasOnly([...])` de um conjunto
 *     vazio é sempre verdadeiro. Todo teste aqui que espera sucesso escreve um
 *     valor DIFERENTE do que estava lá.
 *   - LER COM A CONTA CERTA ESCONDE A REGRA. Por isso existem cinco atores:
 *     fundador, capitão, membro comum, estranho logado e visitante deslogado —
 *     e o `membro` é usado justamente onde seria cômodo usar o fundador.
 *
 * E, para provar que as asserções pegam alguma coisa, o arquivo roda em dois
 * tempos: primeiro a suíte contra as regras REAIS (tem que passar inteira),
 * depois uma suíte por MUTANTE — cada mutante apaga uma trava do
 * `firestore.rules`. Mutante que continua verde é trava sem teste, e o script
 * falha dizendo qual.
 *
 *   node scripts/check-club-rules.mjs            # suíte + mutantes
 *   node scripts/check-club-rules.mjs --sem-mutantes
 */
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGRAS = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
const SEM_MUTANTES = process.argv.includes("--sem-mutantes");

// ---------------------------------------------------------------------------
// Mutantes: cada um apaga UMA trava das regras de clube. A âncora tem que ser
// única no arquivo inteiro — `allow read: if true;` aparece meia dúzia de
// vezes, e mutar o bloco errado faz você concluir que o teste é fraco quando
// quem está errado é a âncora.
// ---------------------------------------------------------------------------
const MUTANTES = [
  {
    nome: "criação: qualquer um pode fundar em nome de outro",
    de: "        return d.founderId == request.auth.uid",
    para: "        return true",
  },
  {
    nome: "criação: sigla pode ter qualquer formato",
    de: "          && d.tag.matches('^[A-Z0-9]{2,5}$')",
    para: "          && true",
  },
  {
    nome: "criação: clube pode nascer com o contador inflado",
    de: "          && d.memberCount == 1",
    para: "          && true",
  },
  {
    nome: "criação: qualquer um nasce com o selo de oficial",
    de: "          && (d.official == false || isServiceAdmin());",
    para: "          && true;",
  },
  {
    nome: "edição: fundador pode trocar a sigla (e órfã o clubTags)",
    de: "          && d.tag == resource.data.tag",
    para: "          && true",
  },
  {
    nome: "edição: fundador pode se marcar como oficial",
    de: "          && d.official == resource.data.official",
    para: "          && true",
  },
  {
    nome: "edição: capitão pode mexer na identidade",
    de: '               .hasOnly(["description", "rules", "links", "meetupSchedule", "cover", "updatedAt"]);',
    para: '               .hasAny(["description", "rules", "links", "meetupSchedule", "cover", "updatedAt", "name"]);',
  },
  {
    nome: "vitrine: somar +1 sem ter entrado no clube",
    de: "            (depois == antes + 1 && existsAfter(meuDoc))",
    para: "            (depois == antes + 1)",
  },
  {
    nome: "vitrine: contador vira porta para o resto do documento",
    de: '               .hasOnly(["memberCount", "updatedAt"])',
    para: '               .hasAny(["memberCount", "updatedAt"])',
  },
  {
    nome: "clube: delete volta a existir",
    de: "      // Firestore não faz cascata e o plano Spark não tem Cloud Function.\n      allow delete: if false;",
    para: "      // Firestore não faz cascata e o plano Spark não tem Cloud Function.\n      allow delete: if signedIn();",
  },
  {
    nome: "membro: qualquer entrada serve",
    de: "          && (fundacao() || entradaAberta() || entradaAprovada());",
    para: "          && true;",
  },
  {
    nome: "membro: capitão arrasta gente para dentro sem pedido",
    de: "            && exists(/databases/$(database)/documents/clubs/$(clubId)/requests/$(memberId));",
    para: "            && true;",
  },
  {
    nome: "membro: capitão também mexe em cargo",
    de: "              isClubFounder(clubId)\n              && resource.data.role != \"founder\"",
    para: "              isClubStaff(clubId)\n              && resource.data.role != \"founder\"",
  },
  {
    nome: "membro: fundador pode sair e deixar o clube sem dono",
    de: '          (memberId == request.auth.uid && resource.data.role != "founder")',
    para: "          (memberId == request.auth.uid)",
  },
  {
    nome: "membro: lista de membros de clube fechado fica pública",
    de: '        allow read: if get(/databases/$(database)/documents/clubs/$(clubId)).data.contentVisibility == "public"\n          || isClubMember(clubId);',
    para: "        allow read: if true;",
  },
  {
    nome: "pedido: dá para pedir entrada em clube que não é de aprovação",
    de: '          && get(/databases/$(database)/documents/clubs/$(clubId)).data.joinPolicy == "approval";',
    para: "          && true;",
  },
  {
    nome: "pedido: qualquer logado lê a fila de quem tentou entrar",
    de: "        allow read: if signedIn() && (requesterId == request.auth.uid || isClubStaff(clubId));",
    para: "        allow read: if signedIn();",
  },
  {
    nome: "sigla: registro pode ser sobrescrito (adeus unicidade)",
    de: "      allow update: if false;\n      allow delete: if isServiceAdmin();",
    para: "      allow update: if signedIn();\n      allow delete: if isServiceAdmin();",
  },
  {
    nome: "sigla: dá para registrar sigla apontando para clube alheio",
    de: "        && getAfter(/databases/$(database)/documents/clubs/$(request.resource.data.clubId)).data.founderId == request.auth.uid",
    para: "        && true",
  },
  {
    nome: "sigla: registro não precisa bater com a sigla do clube",
    de: "        && getAfter(/databases/$(database)/documents/clubs/$(request.resource.data.clubId)).data.tag == tag;",
    para: "        && true;",
  },
  {
    nome: "espelho: qualquer logado escreve em 'meus clubes' alheio",
    de: "      allow create, update: if isOwner(userId)\n        || (isClubStaff(clubId)\n            && existsAfter(/databases/$(database)/documents/clubs/$(clubId)/members/$(userId)));",
    para: "      allow create, update: if signedIn();",
  },
  {
    nome: "espelho: capitão pendura clube em quem nunca entrou",
    de: "      allow create, update: if isOwner(userId)\n        || (isClubStaff(clubId)\n            && existsAfter(/databases/$(database)/documents/clubs/$(clubId)/members/$(userId)));",
    para: "      allow create, update: if isOwner(userId) || isClubStaff(clubId);",
  },
  {
    nome: "evento: qualquer membro cria encontro oficial do clube",
    de: '        && clubStampAllowed(request.resource.data.get("clubId", ""), true);',
    para: "        && true;",
  },
  {
    nome: "evento: dá para pendurar o clube depois, na edição",
    de: '        && (clubStampUnchanged()\n            || clubStampAllowed(request.resource.data.get("clubId", ""), true));',
    para: "        && true;",
  },
  {
    nome: "mural: quem não é do clube posta no mural do clube",
    de: '        && clubStampAllowed(request.resource.data.get("clubId", ""), false);',
    para: "        && true;",
  },
  {
    nome: "clube da semana: qualquer logado edita a vitrine editorial",
    de: "      allow write: if isServiceAdmin();",
    para: "      allow write: if signedIn();",
  },
];

const aplicarMutante = (regras, mutante) => {
  const ocorrencias = regras.split(mutante.de).length - 1;
  if (ocorrencias !== 1) {
    throw new Error(
      `âncora do mutante "${mutante.nome}" aparece ${ocorrencias} vez(es) — precisa ser única`,
    );
  }
  return regras.replace(mutante.de, mutante.para);
};

// ---------------------------------------------------------------------------
// A suíte
// ---------------------------------------------------------------------------

const clubeBase = (extra = {}) => ({
  name: "Civic Club Campinas",
  nameLower: "civic club campinas",
  tag: "ABE",
  motto: "",
  description: "",
  emblem: { shape: "plate", icon: "target" },
  colors: { primary: "azul-noite", secondary: "" },
  cover: "",
  country: "BR",
  state: "SP",
  city: "Campinas",
  foundedYear: 2011,
  meetupSchedule: "",
  focus: { brands: ["Honda"], models: ["CIVIC"], styles: ["jdm"] },
  rules: [],
  links: { instagram: "", whatsapp: "", facebook: "", website: "" },
  joinPolicy: "open",
  contentVisibility: "public",
  founderId: "fundador",
  memberCount: 3,
  official: false,
  archived: false,
  ...extra,
});

const membro = (uid, role) => ({
  uid,
  role,
  joinedAt: serverTimestamp(),
  displayName: "Fulano",
  username: "@fulano",
  avatar: "",
});

const evento = (extra = {}) => ({
  title: "Encontro",
  type: "casual",
  eventDate: "2026-12-01",
  createdBy: "estranho",
  ...extra,
});

const post = (extra = {}) => ({
  kind: "post",
  ownerId: "estranho",
  note: "oi",
  likesCount: 0,
  ...extra,
});

async function rodar(regras, { mostrar = true } = {}) {
  const env = await initializeTestEnvironment({
    projectId: "demo-rules-check",
    firestore: { rules: regras, host: "127.0.0.1", port: 8099 },
  });
  await env.clearFirestore();

  const visitante = env.unauthenticatedContext().firestore();
  const fundador = env.authenticatedContext("fundador").firestore();
  const capitao = env.authenticatedContext("capitao").firestore();
  // O segundo usuário NÃO-admin. Ele existe porque ler com a conta do dono
  // esconde a regra: quase todo teste cômodo passaria com o fundador.
  const comum = env.authenticatedContext("comum").firestore();
  const estranho = env.authenticatedContext("estranho").firestore();
  const admin = env
    .authenticatedContext("admin", { email: "muxdtuber@gmail.com" })
    .firestore();

  const semear = (caminho, dados) =>
    env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), caminho), dados));

  let pass = 0;
  let fail = 0;
  const falhas = [];
  const t = async (nome, fn) => {
    try {
      await fn();
      if (mostrar) console.log(`  ok   ${nome}`);
      pass += 1;
    } catch (error) {
      if (mostrar) {
        console.log(`  FALHA ${nome}\n         ${String(error).split("\n")[0].slice(0, 140)}`);
      }
      falhas.push(nome);
      fail += 1;
    }
  };
  const titulo = (texto) => {
    if (mostrar) console.log(`\n${texto}\n`);
  };

  // --- base ---------------------------------------------------------------
  await semear("clubs/aberto", clubeBase());
  await semear("clubs/aberto/members/fundador", membro("fundador", "founder"));
  await semear("clubs/aberto/members/capitao", membro("capitao", "captain"));
  await semear("clubs/aberto/members/comum", membro("comum", "member"));
  await semear("clubTags/ABE", { clubId: "aberto" });

  await semear(
    "clubs/fechado",
    clubeBase({
      tag: "FEC",
      name: "Rebaixados GO",
      nameLower: "rebaixados go",
      joinPolicy: "approval",
      contentVisibility: "members",
      memberCount: 2,
    }),
  );
  await semear("clubs/fechado/members/fundador", membro("fundador", "founder"));
  await semear("clubs/fechado/members/capitao", membro("capitao", "captain"));
  await semear("clubs/fechado/requests/comum", {
    uid: "comum",
    message: "quero entrar",
    createdAt: serverTimestamp(),
  });

  // Clube de outra pessoa, SEM sigla registrada: é o alvo das tentativas de
  // sequestro de sigla.
  await semear("clubs/alheio", clubeBase({ tag: "ALH", founderId: "fundador" }));

  // --- criação ------------------------------------------------------------
  titulo("criação do clube (lote atômico: clube + sigla + fundador + espelho)");

  const fundar = (db, uid, clubId, tag, extra = {}) => {
    const lote = writeBatch(db);
    lote.set(doc(db, `clubs/${clubId}`), {
      ...clubeBase({ tag, founderId: uid, memberCount: 1, ...extra }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    lote.set(doc(db, `clubTags/${tag}`), { clubId, createdBy: uid });
    lote.set(doc(db, `clubs/${clubId}/members/${uid}`), membro(uid, "founder"));
    lote.set(doc(db, `users/${uid}/clubs/${clubId}`), { clubId, role: "founder", tag });
    return lote.commit();
  };

  await t("visitante NÃO funda clube", () =>
    assertFails(fundar(visitante, "estranho", "c-visitante", "VIS")));
  await t("logado funda o clube inteiro num lote só", () =>
    assertSucceeds(fundar(comum, "comum", "c-novo", "NOV")));
  await t("NÃO funda em nome de outra pessoa", () =>
    assertFails(fundar(estranho, "fundador", "c-fake", "FAK")));
  // O teste acima passa pelo motivo ERRADO: o lote também morre no registro da
  // sigla e no doc de membro, então a trava do `founderId` no documento do
  // clube nunca é a que decide. Descoberto pelo mutante, que sobreviveu.
  // Este isola a trava: um setDoc só, no documento do clube.
  await t("documento do clube sozinho NÃO nasce com fundador alheio", () =>
    assertFails(
      setDoc(doc(estranho, "clubs/c-so-doc"), {
        ...clubeBase({ tag: "SOD", founderId: "fundador", memberCount: 1 }),
      }),
    ));
  await t("clube NÃO nasce com o contador inflado", () =>
    assertFails(fundar(estranho, "estranho", "c-inflado", "INF", { memberCount: 5000 })));
  await t("sigla minúscula é negada", () =>
    assertFails(fundar(estranho, "estranho", "c-min", "abc")));
  await t("sigla de 6 caracteres é negada", () =>
    assertFails(
      setDoc(doc(estranho, "clubs/c-longo"), {
        ...clubeBase({ tag: "ABCDEF", founderId: "estranho", memberCount: 1 }),
      }),
    ));
  await t("clube NÃO nasce com o selo de oficial", () =>
    assertFails(fundar(estranho, "estranho", "c-selo", "SEL", { official: true })));
  await t("admin cria clube oficial (é o seed do dia 1)", () =>
    assertSucceeds(fundar(admin, "admin", "c-oficial", "ENG", { official: true })));

  titulo("unicidade da sigla (registro, não consulta)");

  await t("sigla já registrada derruba o registro (é o tag-taken)", () =>
    assertFails(setDoc(doc(estranho, "clubTags/ABE"), { clubId: "outro" })));
  await t("NÃO dá para registrar sigla apontando para clube alheio", () =>
    assertFails(setDoc(doc(estranho, "clubTags/ALH"), { clubId: "alheio" })));
  await t("registro tem que bater com a sigla do clube", () =>
    assertFails(setDoc(doc(fundador, "clubTags/OUTRA"), { clubId: "alheio" })));
  await t("visitante NÃO lê o registro de siglas", () =>
    assertFails(getDoc(doc(visitante, "clubTags/ABE"))));
  await t("logado lê o registro (é o checkTagAvailable)", () =>
    assertSucceeds(getDoc(doc(comum, "clubTags/ABE"))));

  // --- leitura ------------------------------------------------------------
  titulo("leitura: o card é público, a lista de membros nem sempre");

  await t("visitante LÊ o card do clube (descoberta precisa dele)", () =>
    assertSucceeds(getDoc(doc(visitante, "clubs/aberto"))));
  await t("visitante LISTA clubes", () =>
    assertSucceeds(getDocs(collection(visitante, "clubs"))));
  await t("visitante LÊ o card de clube FECHADO (clube fechado aparece)", () =>
    assertSucceeds(getDoc(doc(visitante, "clubs/fechado"))));
  await t("qualquer um lê os membros de clube público", () =>
    assertSucceeds(getDocs(collection(estranho, "clubs/aberto/members"))));
  await t("estranho NÃO lê os membros de clube 'members'", () =>
    assertFails(getDocs(collection(estranho, "clubs/fechado/members"))));
  await t("membro do clube fechado lê a lista", () =>
    assertSucceeds(getDocs(collection(capitao, "clubs/fechado/members"))));

  // --- entrada ------------------------------------------------------------
  titulo("entrada");

  await t("logado entra em clube aberto", () =>
    assertSucceeds(
      setDoc(doc(estranho, "clubs/aberto/members/estranho"), membro("estranho", "member")),
    ));
  const novato = env.authenticatedContext("novato").firestore();
  await t("NÃO entra já como capitão (escalada de cargo na porta)", () =>
    assertFails(
      setDoc(doc(novato, "clubs/aberto/members/novato"), membro("novato", "captain")),
    ));
  await t("NÃO entra no lugar de outra pessoa", () =>
    assertFails(
      setDoc(doc(estranho, "clubs/aberto/members/terceiro"), membro("terceiro", "member")),
    ));
  await t("NÃO entra direto em clube de aprovação", () =>
    assertFails(
      setDoc(doc(estranho, "clubs/fechado/members/estranho"), membro("estranho", "member")),
    ));
  await t("pede para entrar em clube de aprovação", () =>
    assertSucceeds(
      setDoc(doc(estranho, "clubs/fechado/requests/estranho"), {
        uid: "estranho",
        message: "posso?",
        createdAt: serverTimestamp(),
      }),
    ));
  await t("NÃO pede em nome de outro", () =>
    assertFails(
      setDoc(doc(estranho, "clubs/fechado/requests/terceiro"), { uid: "terceiro", message: "" }),
    ));
  await t("NÃO pede entrada em clube que é aberto", () =>
    assertFails(
      setDoc(doc(estranho, "clubs/aberto/requests/estranho"), { uid: "estranho", message: "" }),
    ));
  await t("estranho NÃO lê a fila de pedidos", () =>
    assertFails(getDocs(collection(estranho, "clubs/fechado/requests"))));
  await t("capitão lê a fila de pedidos", () =>
    assertSucceeds(getDocs(collection(capitao, "clubs/fechado/requests"))));
  await t("quem pediu lê o PRÓPRIO pedido", () =>
    assertSucceeds(getDoc(doc(comum, "clubs/fechado/requests/comum"))));

  titulo("aprovação (escrita no documento de OUTRA pessoa)");

  await t("capitão aprova quem pediu", () =>
    assertSucceeds(
      setDoc(doc(capitao, "clubs/fechado/members/comum"), membro("comum", "member")),
    ));
  await t("capitão NÃO arrasta para dentro quem não pediu", () =>
    assertFails(
      setDoc(doc(capitao, "clubs/fechado/members/terceiro"), membro("terceiro", "member")),
    ));
  await t("membro comum NÃO aprova ninguém", () =>
    assertFails(
      setDoc(doc(comum, "clubs/aberto/members/terceiro"), membro("terceiro", "member")),
    ));
  // Aprovado NOVO de propósito: refazer o setDoc em cima do membro que já
  // existe seria UPDATE, passaria por outra regra, e o teste estaria medindo
  // outra coisa sem avisar.
  await semear("clubs/fechado/requests/comum2", { uid: "comum2", message: "eu tambem" });
  await t("capitão aprova e monta o espelho do aprovado no mesmo lote", () => {
    const lote = writeBatch(capitao);
    lote.set(doc(capitao, "clubs/fechado/members/comum2"), membro("comum2", "member"));
    lote.set(doc(capitao, "users/comum2/clubs/fechado"), {
      clubId: "fechado",
      role: "member",
      tag: "FEC",
    });
    return assertSucceeds(lote.commit());
  });
  await t("capitão NÃO pendura clube em quem não virou membro", () =>
    assertFails(
      setDoc(doc(capitao, "users/terceiro/clubs/fechado"), { clubId: "fechado", role: "member" }),
    ));

  // --- cargos -------------------------------------------------------------
  titulo("cargos");

  await t("fundador promove membro a capitão", () =>
    assertSucceeds(updateDoc(doc(fundador, "clubs/aberto/members/comum"), { role: "captain" })));
  await t("fundador rebaixa de volta", () =>
    assertSucceeds(updateDoc(doc(fundador, "clubs/aberto/members/comum"), { role: "member" })));
  await t("capitão NÃO promove ninguém", () =>
    assertFails(updateDoc(doc(capitao, "clubs/aberto/members/comum"), { role: "captain" })));
  await t("membro NÃO se promove sozinho", () =>
    assertFails(updateDoc(doc(comum, "clubs/aberto/members/comum"), { role: "captain" })));
  await t("nem o fundador cria um SEGUNDO fundador", () =>
    assertFails(updateDoc(doc(fundador, "clubs/aberto/members/capitao"), { role: "founder" })));
  // Valor DIFERENTE de propósito: gravar o mesmo nome passaria em qualquer
  // regra, porque o diff sai vazio.
  await t("membro atualiza o PRÓPRIO nome desnormalizado", () =>
    assertSucceeds(
      updateDoc(doc(comum, "clubs/aberto/members/comum"), { displayName: "Nome Novo" }),
    ));
  await t("membro NÃO reescreve o nome de outro", () =>
    assertFails(
      updateDoc(doc(comum, "clubs/aberto/members/capitao"), { displayName: "Sequestrado" }),
    ));
  await t("membro NÃO pendura campo extra no doc de membro", () =>
    assertFails(updateDoc(doc(comum, "clubs/aberto/members/comum"), { spam: "compre aqui" })));

  // --- saída --------------------------------------------------------------
  titulo("saída e remoção");

  await semear("clubs/aberto/members/sai", membro("sai", "member"));
  await t("membro sai do clube", () =>
    assertSucceeds(deleteDoc(doc(env.authenticatedContext("sai").firestore(), "clubs/aberto/members/sai"))));
  await t("FUNDADOR não sai (tem que transferir ou arquivar)", () =>
    assertFails(deleteDoc(doc(fundador, "clubs/aberto/members/fundador"))));
  await semear("clubs/aberto/members/alvo", membro("alvo", "member"));
  await t("estranho NÃO remove membro", () =>
    assertFails(deleteDoc(doc(estranho, "clubs/aberto/members/alvo"))));
  await t("capitão remove membro", () =>
    assertSucceeds(deleteDoc(doc(capitao, "clubs/aberto/members/alvo"))));
  await semear("clubs/aberto/members/cap3", membro("cap3", "captain"));
  await t("capitão NÃO remove outro capitão", () =>
    assertFails(deleteDoc(doc(capitao, "clubs/aberto/members/cap3"))));
  await semear("clubs/aberto/members/cap2", membro("cap2", "captain"));
  await t("fundador remove capitão", () =>
    assertSucceeds(deleteDoc(doc(fundador, "clubs/aberto/members/cap2"))));

  // --- contador de vitrine ------------------------------------------------
  titulo("memberCount (vitrine: escrita no documento de outra pessoa)");

  await semear("clubs/vitrine", clubeBase({ tag: "VIT", memberCount: 10 }));
  await semear("clubs/vitrine/members/capitao", membro("capitao", "captain"));
  await t("quem entra soma 1 no mesmo lote", () => {
    const lote = writeBatch(comum);
    lote.set(doc(comum, "clubs/vitrine/members/comum"), membro("comum", "member"));
    lote.update(doc(comum, "clubs/vitrine"), { memberCount: 11 });
    return assertSucceeds(lote.commit());
  });
  await t("estranho NÃO soma 1 sem entrar em nada", () =>
    assertFails(updateDoc(doc(estranho, "clubs/vitrine"), { memberCount: 12 })));
  await t("ninguém PULA o contador", () =>
    assertFails(updateDoc(doc(comum, "clubs/vitrine"), { memberCount: 9999 })));
  await t("nem zera o contador alheio", () =>
    assertFails(updateDoc(doc(comum, "clubs/vitrine"), { memberCount: 0 })));
  await t("contador não abre porta para o resto do clube", () =>
    assertFails(updateDoc(doc(comum, "clubs/vitrine"), { memberCount: 12, name: "Invadido" })));
  await t("quem sai tira 1 no mesmo lote", () => {
    const lote = writeBatch(comum);
    lote.delete(doc(comum, "clubs/vitrine/members/comum"));
    lote.update(doc(comum, "clubs/vitrine"), { memberCount: 10 });
    return assertSucceeds(lote.commit());
  });
  await semear("clubs/vitrine/members/alvo2", membro("alvo2", "member"));
  await t("capitão que remove alguém também tira 1", () => {
    const lote = writeBatch(capitao);
    lote.delete(doc(capitao, "clubs/vitrine/members/alvo2"));
    lote.update(doc(capitao, "clubs/vitrine"), { memberCount: 9 });
    return assertSucceeds(lote.commit());
  });

  // --- edição -------------------------------------------------------------
  titulo("edição do clube");

  await t("fundador edita o nome", () =>
    assertSucceeds(updateDoc(doc(fundador, "clubs/aberto"), { name: "Civic Club Campinas 2" })));
  await t("capitão edita a descrição", () =>
    assertSucceeds(updateDoc(doc(capitao, "clubs/aberto"), { description: "Encontro no domingo" })));
  await t("capitão NÃO edita o nome (identidade é do fundador)", () =>
    assertFails(updateDoc(doc(capitao, "clubs/aberto"), { name: "Renomeado pelo capitão" })));
  await t("capitão NÃO edita a sigla", () =>
    assertFails(updateDoc(doc(capitao, "clubs/aberto"), { tag: "CAP" })));
  await t("nem o fundador troca a sigla na fase 1", () =>
    assertFails(updateDoc(doc(fundador, "clubs/aberto"), { tag: "XYZ" })));
  await t("fundador NÃO se marca como oficial", () =>
    assertFails(updateDoc(doc(fundador, "clubs/aberto"), { official: true })));
  await t("fundador NÃO passa a fundação escrevendo no doc", () =>
    assertFails(updateDoc(doc(fundador, "clubs/aberto"), { founderId: "comum" })));
  await t("fundador NÃO digita o contador de membros", () =>
    assertFails(updateDoc(doc(fundador, "clubs/aberto"), { memberCount: 500 })));
  await t("membro comum NÃO edita nada do clube", () =>
    assertFails(updateDoc(doc(comum, "clubs/aberto"), { description: "invadido" })));
  await t("fundador arquiva o clube", () =>
    assertSucceeds(updateDoc(doc(fundador, "clubs/alheio"), { archived: true })));
  await t("membro NÃO arquiva o clube alheio", () =>
    assertFails(updateDoc(doc(comum, "clubs/aberto"), { archived: true })));
  await t("clube não tem delete — ele arquiva", () =>
    assertFails(deleteDoc(doc(fundador, "clubs/aberto"))));
  await t("admin edita qualquer clube (moderação)", () =>
    assertSucceeds(updateDoc(doc(admin, "clubs/aberto"), { official: true })));

  // --- espelho ------------------------------------------------------------
  titulo("espelho users/{uid}/clubs (é o que evita collectionGroup)");

  await t("dono escreve o próprio espelho", () =>
    assertSucceeds(
      setDoc(doc(comum, "users/comum/clubs/aberto"), { clubId: "aberto", role: "member" }),
    ));
  await t("dono lê o próprio espelho", () =>
    assertSucceeds(getDocs(collection(comum, "users/comum/clubs"))));
  await t("estranho NÃO lê o espelho alheio", () =>
    assertFails(getDocs(collection(estranho, "users/comum/clubs"))));
  await t("estranho NÃO escreve no espelho alheio", () =>
    assertFails(
      setDoc(doc(estranho, "users/comum/clubs/spam"), { clubId: "spam", role: "founder" }),
    ));
  await t("dono apaga o próprio espelho ao sair", () =>
    assertSucceeds(deleteDoc(doc(comum, "users/comum/clubs/aberto"))));

  // --- carimbo em eventos -------------------------------------------------
  titulo("carimbo de clube em events (campo novo, opcional)");

  await t("evento sem clube continua livre para qualquer logado", () =>
    assertSucceeds(setDoc(doc(estranho, "events/ev-livre"), evento())));
  await t("capitão cria o encontro do clube", () =>
    assertSucceeds(
      setDoc(doc(capitao, "events/ev-clube"), evento({ createdBy: "capitao", clubId: "aberto" })),
    ));
  await t("membro comum NÃO cria encontro oficial do clube", () =>
    assertFails(
      setDoc(doc(comum, "events/ev-comum"), evento({ createdBy: "comum", clubId: "aberto" })),
    ));
  await t("estranho NÃO carimba evento com clube de que não é nada", () =>
    assertFails(
      setDoc(doc(estranho, "events/ev-fake"), evento({ createdBy: "estranho", clubId: "fechado" })),
    ));
  await t("dono NÃO pendura o clube depois, pela edição", () =>
    assertFails(updateDoc(doc(estranho, "events/ev-livre"), { clubId: "aberto" })));
  await t("dono edita o resto do evento de clube sem pagar get de membro", () =>
    assertSucceeds(updateDoc(doc(capitao, "events/ev-clube"), { title: "Encontro de outubro" })));

  // --- carimbo no mural ---------------------------------------------------
  titulo("carimbo de clube em communityGoals (o mural)");

  await t("post sem clube continua livre", () =>
    assertSucceeds(setDoc(doc(estranho, "communityGoals/p-livre"), post())));
  await t("membro posta no mural do clube", () =>
    assertSucceeds(
      setDoc(doc(comum, "communityGoals/p-clube"), post({ ownerId: "comum", clubId: "aberto" })),
    ));
  await t("estranho NÃO posta no mural de clube que não é dele", () =>
    assertFails(
      setDoc(doc(estranho, "communityGoals/p-fake"), post({ ownerId: "estranho", clubId: "fechado" })),
    ));
  await t("dono NÃO carimba o post depois sem ser membro", () =>
    assertFails(updateDoc(doc(estranho, "communityGoals/p-livre"), { clubId: "fechado" })));
  await t("quem curte post de clube NÃO precisa ser do clube", () =>
    assertSucceeds(
      setDoc(doc(estranho, "communityGoals/p-clube/likes/estranho"), {
        likerId: "estranho",
        postOwnerId: "comum",
      }),
    ));

  // --- vitrine editorial --------------------------------------------------
  titulo("featured/clubOfWeek (editorial)");

  await semear("featured/clubOfWeek", { clubId: "aberto", blurb: "A crew da semana" });
  await t("visitante LÊ o clube da semana", () =>
    assertSucceeds(getDoc(doc(visitante, "featured/clubOfWeek"))));
  await t("logado NÃO escreve o clube da semana", () =>
    assertFails(updateDoc(doc(comum, "featured/clubOfWeek"), { clubId: "comum" })));
  await t("admin escreve o clube da semana", () =>
    assertSucceeds(updateDoc(doc(admin, "featured/clubOfWeek"), { clubId: "fechado" })));

  await env.cleanup();
  return { pass, fail, falhas };
}

// ---------------------------------------------------------------------------

console.log("\nREGRAS REAIS\n");
const real = await rodar(REGRAS, { mostrar: true });
console.log(`\n${real.pass} passaram, ${real.fail} falharam\n`);

if (real.fail > 0) {
  console.log("Regras reais falhando: não faz sentido rodar mutante em cima disso.\n");
  process.exit(1);
}

if (SEM_MUTANTES) process.exit(0);

console.log(`MUTANTES (${MUTANTES.length}) — cada um apaga uma trava; todos têm que ficar VERMELHOS\n`);

const sobreviventes = [];
for (const mutante of MUTANTES) {
  const resultado = await rodar(aplicarMutante(REGRAS, mutante), { mostrar: false });
  if (resultado.fail > 0) {
    console.log(`  vermelho  ${mutante.nome}  (${resultado.fail} asserção(ões) pegaram)`);
  } else {
    console.log(`  SOBREVIVEU  ${mutante.nome}`);
    sobreviventes.push(mutante.nome);
  }
}

console.log(
  `\n${real.pass} asserções · ${MUTANTES.length - sobreviventes.length}/${MUTANTES.length} mutantes vermelhos\n`,
);

if (sobreviventes.length) {
  console.log(
    "Mutante que sobrevive é trava sem teste — a regra pode sumir e ninguém percebe:\n  " +
      sobreviventes.join("\n  ") +
      "\n",
  );
  process.exit(1);
}
process.exit(0);
