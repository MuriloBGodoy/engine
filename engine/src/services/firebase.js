import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDHQM_oq5fuAVdBjzqchzQQk6G-gXKTr6U",
  authDomain: "engine-garage.firebaseapp.com",
  projectId: "engine-garage",
  storageBucket: "engine-garage.firebasestorage.app",
  messagingSenderId: "23876899045",
  appId: "1:23876899045:web:73fbda584ee3877628040c",
  measurementId: "G-9PN46KXJWB",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);

// Emuladores locais, só quando pedido explicitamente. Sem isto o único jeito
// de ver uma tela logada era entrar numa conta de verdade em produção — e por
// isso Garagem, Painel e Mensagens nunca tinham sido medidos por ninguém além
// do dono. Com `VITE_USE_EMULATORS=true` o app fala com Auth e Firestore
// locais, com as regras reais do repo, e dá pra criar usuário descartável.
// Em produção a variável não existe e esta linha não faz nada.
if (import.meta.env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8099);
}
