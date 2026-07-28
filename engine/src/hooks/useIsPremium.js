import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "../services/firebase";

/**
 * Estado de assinatura do usuário. A fonte da verdade é o campo `plan` no doc
 * `users/{uid}` — escrito SOMENTE pelo servidor (webhook do Stripe), nunca
 * pelo cliente. Enquanto não houver esse campo, o usuário é tratado como
 * gratuito. Visitante (sem uid) também é gratuito.
 *
 * `loading` fica true até a primeira resposta do Firestore, para o <AdSlot />
 * não piscar um anúncio antes de saber que o usuário é premium. O caso
 * visitante é derivado no return (não via setState no efeito) para não
 * disparar renders em cascata.
 */
const GUEST_STATE = { isPremium: false, loading: false };

export function useIsPremium(userId) {
  const [state, setState] = useState({ isPremium: false, loading: true });

  useEffect(() => {
    if (!userId) return undefined;

    const ref = doc(firestore, "users", userId);
    return onSnapshot(
      ref,
      (snapshot) => {
        const plan = snapshot.data()?.plan;
        setState({ isPremium: plan === "premium" || plan === "pro", loading: false });
      },
      () => {
        // Sem permissão de leitura ou offline: assume gratuito e segue a vida.
        setState({ isPremium: false, loading: false });
      },
    );
  }, [userId]);

  return userId ? state : GUEST_STATE;
}
