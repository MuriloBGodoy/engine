import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { engineDB } from "../services/db";
import { GoalCard } from "./Community";
import { trackEvent } from "../services/observability";

const emptyInteraction = { liked: false, rating: 0, comments: [] };

/**
 * Página de uma publicação, aberta por link direto: /post/:postId.
 *
 * Existe para o link compartilhado levar direto ao conteúdo, em vez de cair no
 * feed com um modal por cima. Abre sem login, porque quem recebe o link
 * normalmente ainda não tem conta — é o mesmo motivo pelo qual a leitura da
 * comunidade é pública.
 */
export function PostPage({ user }) {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  // Só o que a pessoa acabou de fazer fica em estado; o resto é derivado do
  // documento, que chega por snapshot. Guardar as duas coisas em estado
  // significaria sincronizar cópia com original a cada atualização.
  const [pendingLike, setPendingLike] = useState(null);
  const [pendingRating, setPendingRating] = useState(0);

  useEffect(() => {
    if (!postId) return undefined;

    const unsubscribe = engineDB.subscribeCommunityGoal(postId, (item) => {
      setGoal(item);
      setLoading(false);
    });

    return () => unsubscribe?.();
  }, [postId]);

  const interactions = goal
    ? {
        liked: pendingLike ?? Boolean(goal.likesBy?.[user?.uid]),
        rating: pendingRating || goal.ratingsBy?.[user?.uid] || 0,
        comments: [],
      }
    : emptyInteraction;

  const requireLogin = () => {
    if (user?.uid) return false;
    navigate("/login");
    return true;
  };

  const handleLike = async () => {
    if (requireLogin()) return;
    const next = !interactions.liked;
    setPendingLike(next);
    await engineDB.toggleCommunityLike(postId, next, user.uid);
  };

  const handleComment = async (_goalId, text) => {
    if (requireLogin()) return;
    await engineDB.addCommunityComment(postId, text, user.uid);
  };

  const handleRate = async (_goalId, value) => {
    if (requireLogin()) return;
    setPendingRating(value);
    await engineDB.rateCommunityGoal(postId, value, user.uid);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      trackEvent("post_link_copiado", { postId });
    } catch {
      // Navegador sem permissão de área de transferência: a URL já está na
      // barra de endereço, então não vale interromper com um erro.
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--engine-bg)]">
        <p className="text-sm text-[var(--engine-text-muted)]">{t("common.loading")}</p>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--engine-bg)] px-6 text-center">
        <p className="text-sm font-bold text-[var(--engine-text)]">
          {t("community.postMissing")}
        </p>
        <button
          type="button"
          onClick={() => navigate("/community")}
          className="text-sm font-bold text-[var(--engine-accent)] hover:underline"
        >
          {t("community.backToFeed")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--engine-bg)]">
      <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-[var(--engine-border)] bg-[var(--engine-bg)]/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/community"))}
          aria-label={t("common.cancel")}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--engine-text-muted)] transition hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-accent)]"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-black text-[var(--engine-text)]">
          {t("community.postTitle")}
        </h1>
      </header>

      <div className="mx-auto w-full max-w-2xl sm:py-5">
        <GoalCard
          goal={goal}
          t={t}
          interactions={interactions}
          following={[]}
          shared
          currentUserId={user?.uid}
          onLike={handleLike}
          onComment={handleComment}
          onRate={handleRate}
          onShare={handleShare}
          onUnshare={() => {}}
          onFollow={() => {}}
          onOpenProfile={() => {
            const username = String(goal.username || "").replace(/^@/, "");
            if (username) navigate(`/community/@${username}`);
          }}
          onEditComment={() => {}}
          onDeleteComment={() => {}}
          initialCommentsOpen
        />
      </div>
    </div>
  );
}
