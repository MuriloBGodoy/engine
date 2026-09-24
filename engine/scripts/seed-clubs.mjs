/**
 * Semeia os 10 CLUBES OFICIAIS do Engine e o `featured/clubOfWeek`.
 *
 *   node scripts/seed-clubs.mjs            # simulação (não escreve nada)
 *   node scripts/seed-clubs.mjs --aplicar  # escreve
 *   node scripts/seed-clubs.mjs --aplicar --fundador=<uid>
 *
 * Precisa da credencial de administrador, que mora FORA do repositório:
 *   C:\engine-credentials\service-account.json
 * (ou o caminho em GOOGLE_APPLICATION_CREDENTIALS / ENGINE_SERVICE_ACCOUNT)
 *
 * POR QUE EXISTE. O problema do dia 1 de Clubes não é técnico, é de tela
 * vazia: descoberta com três clubes mal preenchidos convence a pessoa de que
 * ninguém usa a feature, e ela não volta. Dez clubes oficiais resolvem duas
 * coisas de uma vez — enchem a grade e ENSINAM PELO EXEMPLO o que é um clube
 * bem preenchido (sigla, emblema, cor, cidade-base, fundação, encontro fixo,
 * foco e regras). É o mesmo papel dos diretórios de clube da VW e do Eventos
 * VW, que listam cada clube com logo, cidade/UF e ano.
 *
 * `official: true` só o admin grava (regra do Firestore). O selo ★ serve para
 * a tela mostrar que é clube da casa, e a camada de dados joga clube oficial
 * para o FIM de cada seção: semente não compete com clube de gente.
 *
 * DUAS DECISÕES DE HONESTIDADE, que valem mais que o preenchimento bonito:
 *
 *   - `foundedYear` é 2026 em todos. Seria fácil escrever "desde 1998" e
 *     encher o card, e seria mentira: estes clubes nascem hoje. Clube com
 *     história antiga existe (Civic Club Brasil diz 1972), mas é história de
 *     quem tem.
 *   - `meetupSchedule` diz a CADÊNCIA e manda o local para a aba Encontros.
 *     Inventar "1º domingo na Praça X" é o único campo deste arquivo capaz de
 *     fazer alguém pegar o carro e dirigir até um lugar onde não vai ter nada.
 *
 * IDEMPOTENTE, e com duas proteções que importam numa segunda rodada:
 *   - `memberCount`, `createdAt` e `founderId` de clube que já existe NÃO são
 *     reescritos: gente de verdade pode ter entrado, e zerar o contador seria
 *     apagar isso;
 *   - se a sigla já estiver registrada em `clubTags` apontando para OUTRO
 *     clube, o clube é PULADO com aviso. Sigla é única no app e quem chegou
 *     primeiro fica com ela, inclusive contra a casa.
 */
import fs from "node:fs";
import path from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const APLICAR = process.argv.includes("--aplicar");
const FUNDADOR_ARG = (process.argv.find((a) => a.startsWith("--fundador=")) || "").split("=")[1];
const FORCAR_DESTAQUE = process.argv.includes("--forcar-destaque");
const ADMIN_EMAIL = process.env.ENGINE_ADMIN_EMAIL || "muxdtuber@gmail.com";

const CAMINHOS = [
  process.env.ENGINE_SERVICE_ACCOUNT,
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  "C:\\engine-credentials\\service-account.json",
].filter(Boolean);

const credencial = CAMINHOS.find((p) => fs.existsSync(p));
if (!credencial) {
  console.error(
    "Credencial de administrador não encontrada. Procurei em:\n  " +
      CAMINHOS.join("\n  ") +
      "\nEla fica fora do repositório de propósito — ver engine-api/src/main/resources/README.",
  );
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(fs.readFileSync(credencial, "utf8"))) });
const db = getFirestore();

// ---------------------------------------------------------------------------
// Os 10 clubes: um por estilo, dez estados diferentes.
//
// Os ids de estilo, cor, forma e símbolo vêm do vocabulário fechado de
// `src/services/clubStyles.js`. Nome de cor e id de símbolo, NUNCA hex nem
// SVG: é isso que permite a paleta inteira mudar sem tocar em documento.
// ---------------------------------------------------------------------------

// Marca vai na forma CANÔNICA (`Volkswagen`, não `VW - VolksWagen`): é o que
// `canonicalBrand` em `services/clubs.js` grava e é o que a descoberta procura.
// O rótulo cru da FIPE, que é o que a garagem guarda em `car.brand`, também é
// procurado na mesma consulta — os dois lados se encontram lá, não aqui.
const REGRAS_DA_CASA = [
  "Respeito primeiro: carro é gosto, não é briga.",
  "Foto de carro alheio, só com crédito de quem fotografou.",
  "Nada de rolê ilegal ou racha usando o nome do clube.",
];

const CLUBES = [
  {
    id: "engine-rebaixados",
    tag: "RBX",
    name: "Rebaixados Brasil",
    motto: "Fixa, rosca ou ar — o que vale é a altura",
    description:
      "Clube oficial do Engine para quem baixa o carro: fixa, rosca e suspensão a ar. Mostre a altura, a roda e o antes e depois na garagem do clube.",
    state: "SP",
    city: "São Paulo",
    styles: ["rebaixados"],
    colors: { primary: "roxo-neon", secondary: "preto-fosco" },
    emblem: { shape: "plate", icon: "lowered" },
    meetupSchedule: "Encontro no 1º domingo do mês — local na aba Encontros",
  },
  {
    id: "engine-som",
    tag: "SOM",
    name: "Som Automotivo Brasil",
    motto: "Grave que se sente no peito",
    description:
      "Para quem monta som: porta-malas, isolamento, alinhamento e o que cada caixa pede. Traga o projeto, não só o volume.",
    state: "GO",
    city: "Goiânia",
    styles: ["som"],
    colors: { primary: "ciano-nitro", secondary: "grafite" },
    emblem: { shape: "circle", icon: "bolt" },
    meetupSchedule: "Encontro no 2º sábado do mês — local na aba Encontros",
  },
  {
    id: "engine-antigos",
    tag: "ANT",
    name: "Antigos e Clássicos",
    motto: "Placa preta é história andando",
    description:
      "Restauração, originalidade e a briga de sempre entre manter de fábrica ou modernizar. Todo carro com mais de 30 anos tem lugar aqui.",
    state: "MG",
    city: "Belo Horizonte",
    styles: ["antigos"],
    colors: { primary: "marrom-couro", secondary: "bege-areia" },
    emblem: { shape: "shield", icon: "headlight" },
    meetupSchedule: "Encontro mensal, último domingo — local na aba Encontros",
  },
  {
    id: "engine-ar",
    tag: "AIRC",
    name: "VW a Ar",
    motto: "Motor atrás, alma na frente",
    description:
      "Fusca, Kombi, Brasília, Variant e todo derivado com motor a ar refrigerado. Manutenção, peça difícil e viagem longa.",
    state: "PR",
    city: "Curitiba",
    styles: ["ar"],
    brands: ["Volkswagen"],
    colors: { primary: "amarelo-pista", secondary: "preto-fosco" },
    emblem: { shape: "hex", icon: "piston" },
    meetupSchedule: "Encontro no 1º sábado do mês — local na aba Encontros",
  },
  {
    id: "engine-jdm",
    tag: "JDM",
    name: "JDM Brasil",
    motto: "Giro alto, respeito maior",
    description:
      "Japonês de coração: Civic, Integra, Skyline, Supra, Silvia e o que mais vier de lá. Motor, câmbio e a ficha da versão certa.",
    state: "RJ",
    city: "Rio de Janeiro",
    styles: ["jdm"],
    brands: ["Honda"],
    models: ["CIVIC"],
    colors: { primary: "vermelho-corrida", secondary: "prata" },
    emblem: { shape: "plate", icon: "gauge" },
    meetupSchedule: "Encontro no 3º domingo do mês — local na aba Encontros",
  },
  {
    id: "engine-euro",
    tag: "EURO",
    name: "Euro Clube",
    motto: "Alemão de fábrica, europeu de estrada",
    description:
      "VW, BMW, Audi, Peugeot, Renault e Fiat de origem europeia. Acabamento, suspensão e a conta da manutenção sem romantizar.",
    state: "RS",
    city: "Porto Alegre",
    styles: ["euro"],
    brands: ["Volkswagen", "BMW", "Audi"],
    colors: { primary: "azul-mercosul", secondary: "prata" },
    emblem: { shape: "shield", icon: "wheel" },
    meetupSchedule: "Encontro no 2º domingo do mês — local na aba Encontros",
  },
  {
    id: "engine-esportivos",
    tag: "HOT",
    name: "Esportivos e Hot Hatch",
    motto: "Hatch pequeno, susto grande",
    description:
      "GTI, ST, RS, Abarth, Sandero RS e todo hatch que corre mais do que aparenta. Peso, torque e curva — não linha reta.",
    state: "SC",
    city: "Joinville",
    styles: ["esportivos"],
    colors: { primary: "laranja-turbo", secondary: "grafite" },
    emblem: { shape: "plate", icon: "turbo" },
    meetupSchedule: "Encontro no último sábado do mês — local na aba Encontros",
  },
  {
    id: "engine-offroad",
    tag: "4X4",
    name: "Off-road 4x4",
    motto: "Onde o asfalto acaba, a gente começa",
    description:
      "Trilha, areia, lama e a preparação que aguenta voltar. Pneu, redução, guincho e a regra número um: ninguém sai sozinho.",
    state: "MT",
    city: "Cuiabá",
    styles: ["offroad"],
    colors: { primary: "verde-bandeira", secondary: "marrom-couro" },
    emblem: { shape: "hex", icon: "mountain" },
    meetupSchedule: "Trilha mensal, 3º sábado — ponto de saída na aba Encontros",
  },
  {
    id: "engine-eletricos",
    tag: "VOLT",
    name: "Elétricos e Híbridos",
    motto: "Silêncio também é torque",
    description:
      "Elétrico e híbrido de verdade: autonomia real, ponto de recarga, custo por quilômetro e o que a bateria faz com o tempo.",
    state: "DF",
    city: "Brasília",
    styles: ["eletricos"],
    colors: { primary: "verde-limao", secondary: "grafite" },
    emblem: { shape: "circle", icon: "bolt" },
    meetupSchedule: "Encontro no 1º sábado do mês — local na aba Encontros",
  },
  {
    id: "engine-track",
    tag: "TRK",
    name: "Track Day Brasil",
    motto: "Rua é rua, pista é pista",
    description:
      "Quem leva o carro para o autódromo: freio, pneu, gaiola, tempo de volta e a preparação que sobrevive a vinte minutos de pista.",
    state: "BA",
    city: "Salvador",
    styles: ["track"],
    colors: { primary: "preto-fosco", secondary: "amarelo-pista" },
    emblem: { shape: "plate", icon: "flag" },
    meetupSchedule: "Track day a cada dois meses — data na aba Encontros",
  },
];

/** O clube da semana de estreia, e a frase que o Murilo trocaria à mão. */
const DESTAQUE = {
  clubId: "engine-rebaixados",
  blurb: "O primeiro clube do Engine. Fixa, rosca ou ar — mostre a sua altura.",
};

// ---------------------------------------------------------------------------

const ANO_DE_FUNDACAO = new Date().getFullYear();

/** Segunda-feira da semana corrente, em `YYYY-MM-DD`. */
const semanaDe = () => {
  const hoje = new Date();
  const diaDaSemana = (hoje.getUTCDay() + 6) % 7;
  const segunda = new Date(hoje.getTime() - diaDaSemana * 86400000);
  return segunda.toISOString().slice(0, 10);
};

const documentoDoClube = (clube, fundadorUid) => ({
  name: clube.name,
  nameLower: clube.name.toLowerCase(),
  tag: clube.tag,
  motto: clube.motto,
  description: clube.description,
  emblem: clube.emblem,
  colors: clube.colors,
  cover: "",
  country: "BR",
  state: clube.state,
  city: clube.city,
  foundedYear: ANO_DE_FUNDACAO,
  meetupSchedule: clube.meetupSchedule,
  focus: {
    brands: clube.brands || [],
    models: clube.models || [],
    styles: clube.styles,
  },
  rules: REGRAS_DA_CASA,
  links: { instagram: "", whatsapp: "", facebook: "", website: "" },
  joinPolicy: "open",
  contentVisibility: "public",
  founderId: fundadorUid,
  official: true,
  archived: false,
});

console.log(
  `\n${APLICAR ? "APLICANDO" : "SIMULAÇÃO (nada será escrito)"} · credencial: ${path.basename(credencial)}\n`,
);

// Quem funda. Clube sem fundador não tem quem edite pela tela: sobra só o
// admin pelo console, e aí o seed vira dado que ninguém mantém.
let fundadorUid = FUNDADOR_ARG || "";
if (!fundadorUid) {
  try {
    fundadorUid = (await getAuth().getUserByEmail(ADMIN_EMAIL)).uid;
    console.log(`fundador: ${ADMIN_EMAIL} → ${fundadorUid}\n`);
  } catch (erro) {
    console.error(
      `Não achei a conta ${ADMIN_EMAIL} no Firebase Auth (${erro.code || erro.message}).\n` +
        "Passe o uid na mão: node scripts/seed-clubs.mjs --aplicar --fundador=<uid>\n",
    );
    process.exit(1);
  }
} else {
  console.log(`fundador: ${fundadorUid} (passado na linha de comando)\n`);
}

let criados = 0;
let atualizados = 0;
let pulados = 0;

for (const clube of CLUBES) {
  const ref = db.collection("clubs").doc(clube.id);
  const tagRef = db.collection("clubTags").doc(clube.tag);
  const [atual, tagAtual] = await Promise.all([ref.get(), tagRef.get()]);

  // Sigla é única no app inteiro. Se alguém de fora registrou esta antes, o
  // clube da casa fica sem ela — e sem sigla não entra, porque a sigla é a
  // identidade da crew.
  if (tagAtual.exists && tagAtual.data().clubId !== clube.id) {
    console.log(
      `  PULADO  ${clube.tag}  a sigla já é do clube "${tagAtual.data().clubId}" — quem chegou primeiro fica com ela`,
    );
    pulados += 1;
    continue;
  }

  const corpo = documentoDoClube(clube, fundadorUid);

  if (atual.exists) {
    const dados = atual.data();
    // O que NÃO se reescreve numa segunda rodada: contador (pode ter entrado
    // gente de verdade), data de criação e fundação (pode ter sido
    // transferida). O resto é editorial e pode ser corrigido pelo seed.
    const { founderId: _ignorado, ...editorial } = corpo;
    console.log(
      `  atualiza ${clube.tag.padEnd(5)} ${clube.name} · ${clube.city}/${clube.state} · ` +
        `membros: ${dados.memberCount ?? 0} (preservado)`,
    );
    if (APLICAR) {
      await ref.set({ ...editorial, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (!tagAtual.exists) await tagRef.set({ clubId: clube.id, createdBy: fundadorUid });
    }
    atualizados += 1;
    continue;
  }

  console.log(
    `  cria     ${clube.tag.padEnd(5)} ${clube.name} · ${clube.city}/${clube.state} · ` +
      `${clube.styles.join(", ")}`,
  );

  if (APLICAR) {
    // Tudo num lote, como a criação pela tela: clube + sigla + membro fundador
    // + espelho de "meus clubes". Meio caminho gravado é clube que aparece na
    // grade e não abre.
    const lote = db.batch();
    lote.set(ref, {
      ...corpo,
      memberCount: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    lote.set(tagRef, { clubId: clube.id, createdBy: fundadorUid });
    lote.set(ref.collection("members").doc(fundadorUid), {
      uid: fundadorUid,
      role: "founder",
      joinedAt: FieldValue.serverTimestamp(),
      displayName: "Engine",
      username: "@engine",
      avatar: "",
    });
    lote.set(db.doc(`users/${fundadorUid}/clubs/${clube.id}`), {
      clubId: clube.id,
      role: "founder",
      joinedAt: FieldValue.serverTimestamp(),
      tag: clube.tag,
      name: clube.name,
    });
    await lote.commit();
  }
  criados += 1;
}

// Clube da semana: editorial. Só nasce; não sobrescreve escolha feita à mão,
// que é exatamente o que o Murilo vai fazer nos primeiros meses.
const destaqueRef = db.doc("featured/clubOfWeek");
const destaqueAtual = await destaqueRef.get();
if (destaqueAtual.exists && !FORCAR_DESTAQUE) {
  console.log(
    `\n  destaque já existe (clube "${destaqueAtual.data().clubId}") — mantido. ` +
      "Use --forcar-destaque para trocar.",
  );
} else {
  console.log(`\n  destaque ${DESTAQUE.clubId}`);
  if (APLICAR) {
    await destaqueRef.set({
      ...DESTAQUE,
      weekOf: semanaDe(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

console.log(
  `\nclubes: ${CLUBES.length} · ${APLICAR ? "criados" : "a criar"}: ${criados} · ` +
    `${APLICAR ? "atualizados" : "a atualizar"}: ${atualizados} · pulados: ${pulados}`,
);
console.log(
  APLICAR
    ? "\nOs índices de `clubs` precisam estar publicados, senão a descoberta " +
        "devolve vazio com os clubes já no banco.\n"
    : "\nRode de novo com --aplicar para escrever.\n",
);
process.exit(0);
