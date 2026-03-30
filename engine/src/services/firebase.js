import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

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
