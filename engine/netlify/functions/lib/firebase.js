// Firebase Admin do lado servidor.
//
// O Admin SDK ignora as regras do Firestore — é justamente por isso que ele
// mora aqui e não no navegador. `users/{uid}.plan` só pode ser escrito por
// este caminho: no cliente a regra nega, senão bastaria abrir o console pra
// virar premium de graça.
//
// A credencial vem da env FIREBASE_SERVICE_ACCOUNT (o JSON da service account
// inteiro, em uma linha). Nunca versionar esse valor.
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app = null;

const ensureApp = () => {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT ausente nas variáveis do Netlify.");
  }

  app = initializeApp({ credential: cert(JSON.parse(raw)) });
  return app;
};

export const db = () => getFirestore(ensureApp());

export const auth = () => getAuth(ensureApp());

/**
 * Descobre quem está chamando pelo ID token do Firebase.
 *
 * O userId nunca pode vir no corpo do request: qualquer um mandaria o uid de
 * outra pessoa e assinaria no nome dela (ou pior, ativaria o próprio plano
 * usando o pagamento de terceiro).
 */
export async function requireUser(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    throw Object.assign(new Error("Não autenticado."), { status: 401 });
  }

  try {
    return await auth().verifyIdToken(token);
  } catch {
    throw Object.assign(new Error("Sessão inválida."), { status: 401 });
  }
}

/** Grava o plano do usuário. Único lugar do sistema que faz isso. */
export async function setUserPlan(userId, { plan, provider, providerRef, currentPeriodEnd }) {
  await db()
    .collection("users")
    .doc(String(userId))
    .set(
      {
        plan,
        subscription: {
          provider,
          providerRef: providerRef || null,
          currentPeriodEnd: currentPeriodEnd || null,
          updatedAt: new Date().toISOString(),
        },
      },
      { merge: true },
    );
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
