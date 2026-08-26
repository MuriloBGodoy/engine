import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import {
  LIKE_TIERS,
  likeTierId,
  listAchievements,
  subscribeAchievementUnlocked,
} from "../../services/achievements";
import { useToast } from "../ToastProvider";
import { AchievementCelebration } from "./AchievementCelebration";
import { MILESTONE_ICON } from "./icons";

/**
 * O aviso de conquista, montado uma vez no App.
 *
 * A conquista é concedida no fundo, em três lugares que não sabem desenhar nada
 * (curtir, seguir, abrir a garagem). Este componente escuta o anúncio e decide
 * COMO avisar — decisão 3 de 22/08/2026: tela cheia só na primeira conquista de
 * cada categoria, todas as seguintes no toast compacto. A festa que acontece
 * toda vez deixa de ser festa.
 *
 * "Primeira da categoria" se resolve com a contagem carregada na montagem, não
 * com uma bandeira local: a bandeira reiniciaria a cada sessão e a pessoa
 * ganharia a tela cheia de novo pela mesma conquista.
 */
export function AchievementAnnouncer({ userId }) {
  const { t, i18n } = useTranslation();
  const showToast = useToast();
  const [fila, setFila] = useState([]);
  // null enquanto não sabemos o que a pessoa já tem. Nesse intervalo tudo cai
  // no toast: errar para menos é um aviso discreto, errar para mais é uma tela
  // cheia indevida.
  const jaTinha = useRef(null);

  const categoria = (id) => (id.startsWith("likes_") ? "likes" : "milestone");

  const nomeDe = useCallback(
    (id) => {
      if (categoria(id) !== "likes") return t(`achievements.items.${id}.name`);
      const tier = LIKE_TIERS.find((valor) => likeTierId(valor) === id);
      return t("achievements.likeTierLabel", {
        alvo: new Intl.NumberFormat(i18n.language).format(tier || 0),
      });
    },
    [t, i18n.language],
  );

  useEffect(() => {
    let vivo = true;
    jaTinha.current = null;
    if (!userId) return () => { vivo = false; };
    listAchievements(userId).then((ids) => {
      if (!vivo) return;
      jaTinha.current = {
        milestone: [...ids].filter((id) => categoria(id) === "milestone").length,
        likes: [...ids].filter((id) => categoria(id) === "likes").length,
      };
    });
    return () => {
      vivo = false;
    };
  }, [userId]);

  useEffect(
    () =>
      subscribeAchievementUnlocked((id) => {
        const tipo = categoria(id);
        const contagem = jaTinha.current;
        const primeiraDaCategoria = contagem ? contagem[tipo] === 0 : false;
        if (contagem) contagem[tipo] += 1;

        if (primeiraDaCategoria) {
          setFila((atual) => [...atual, id]);
          return;
        }
        showToast(`${t("achievements.toast.unlocked")} — ${nomeDe(id)}`, {
          tone: "achievement",
          icon: tipo === "likes" ? Heart : MILESTONE_ICON[id],
        });
      }),
    [showToast, t, nomeDe],
  );

  const atual = fila[0];
  if (!atual) return null;

  const tipo = categoria(atual);
  const tier = tipo === "likes" ? LIKE_TIERS.find((v) => likeTierId(v) === atual) : undefined;
  // Compartilhar só onde o sistema tem para onde mandar. No desktop sem a API,
  // o botão some em vez de virar um clique que não faz nada.
  const compartilhar = navigator.share
    ? () => {
        navigator
          .share({
            title: nomeDe(atual),
            text: `${t("achievements.toast.unlocked")} — ${nomeDe(atual)}`,
            url: window.location.origin,
          })
          .catch(() => {});
      }
    : undefined;

  return (
    <AchievementCelebration
      open
      kind={tipo}
      milestoneId={tipo === "milestone" ? atual : undefined}
      tier={tier}
      onClose={() => setFila((lista) => lista.slice(1))}
      onShare={compartilhar}
    />
  );
}
