import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Award,
  AtSign,
  Bookmark,
  Car,
  Check,
  CheckCircle2,
  Clapperboard,
  Copy,
  EyeOff,
  Edit3,
  Flame,
  Heart,
  MapPin,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  MessageCircle,
  Trophy,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { engineDB } from "../services/db";
import { useConfirm } from "../components/ConfirmProvider";
import { useToast } from "../components/ToastProvider";

const fallbackImage =
  "https://images.unsplash.com/photo-1598209279122-8541213a0387?q=80&w=900";

const videoPosts = [];
const friendSuggestions = [];

const emptyInteraction = {
  liked: false,
  comments: [],
  rating: 0,
};

const getProgress = (goal) =>
  Math.min(goal.targetValue ? (goal.savedValue / goal.targetValue) * 100 : 0, 100);

const getInitials = (name = "U") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const isImageUrl = (value) =>
  typeof value === "string" && (value.startsWith("http") || value.startsWith("data:"));

const getGoalRangeKey = (value) => {
  if (value >= 500000) return "community.ranges.elite";
  if (value >= 250000) return "community.ranges.performance";
  if (value >= 120000) return "community.ranges.premium";
  return "community.ranges.entry";
};

const normalizeVehicleText = (value = "") =>
  String(value).replace(/\s+/g, " ").trim();

const removeVehicleBrand = (title = "", brand = "") => {
  let label = normalizeVehicleText(title);
  const brandParts = normalizeVehicleText(brand)
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean);

  [normalizeVehicleText(brand), ...brandParts].forEach((part) => {
    if (part && label.toLowerCase().startsWith(part.toLowerCase())) {
      label = label.slice(part.length).trim();
    }
  });

  return label.replace(/^[-/|]+/, "").trim();
};

const getRankingVehicleLabel = (goal = {}) => {
  const brand = normalizeVehicleText(goal.brand);
  const model = removeVehicleBrand(goal.model, brand);
  const titleModel = removeVehicleBrand(goal.title, brand);
  const brandLower = brand.toLowerCase();

  if (model && model.toLowerCase() !== brandLower) {
    return model;
  }

  if (titleModel && titleModel.toLowerCase() !== brandLower) {
    return titleModel;
  }

  return model || normalizeVehicleText(goal.title) || brand || "Meta";
};

const communityGoalId = (goal, userId = "") => {
  const goalId = String(goal?.id || "");
  if (goalId.startsWith("goal-")) return goalId;
  return `goal-${userId || goal?.ownerId || ""}-${String(goal?.carId || goalId).replace(/^user-/, "")}`;
};

const legacyCommunityGoalId = (goal, userId = "") => {
  const goalId = String(goal?.id || "");
  if (goalId.startsWith("goal-")) return goalId;
  return `goal-${userId || goal?.ownerId || ""}-user-${String(goal?.carId || goalId).replace(/^user-/, "")}`;
};

const buildShareUrl = (goal) => {
  const url = new URL(window.location.href);
  url.pathname = "/community";
  url.searchParams.set("goal", goal.id);
  return url.toString();
};

const profileFromSettings = (settings, user) => {
  const name = settings.profile.displayName || user?.displayName || "Usuário Engine";
  return {
    id: user?.uid || "",
    userId: user?.uid || "",
    author: name,
    username: settings.profile.username || `@engine.${String(user?.uid || "").slice(0, 6)}`,
    avatar: settings.profile.avatar || user?.photoURL || "",
    avatarInitials: getInitials(name),
    city: settings.profile.location || "Engine Garage",
    note: settings.profile.bio || "",
  };
};

const withProfile = (person = {}, profiles = {}) => {
  const profile = profiles[person.userId] || profiles[person.ownerId];
  if (!profile) return person;
  return {
    ...person,
    author: profile.author ?? person.author,
    username: profile.username ?? person.username,
    avatar: profile.avatar ?? person.avatar,
    avatarInitials: profile.avatarInitials ?? person.avatarInitials,
    city: profile.city ?? person.city,
    note: profile.note ?? person.note,
  };
};

const enrichGoalProfiles = (goal, profiles) => {
  const enriched = withProfile(goal, profiles);
  return {
    ...enriched,
    comments: (enriched.comments || []).map((comment) =>
      typeof comment === "string" ? comment : withProfile(comment, profiles),
    ),
  };
};

const getProfileStats = (profile = {}) => {
  const goals = profile.goals || [];
  const progress = goals.reduce((sum, goal) => sum + getProgress(goal), 0);
  return {
    goalsCount: profile.goalsCount ?? goals.length,
    likesCount:
      profile.likesCount ??
      goals.reduce((sum, goal) => sum + (Number(goal.likes) || 0), 0),
    averageProgress:
      profile.averageProgress ?? (goals.length ? progress / goals.length : 0),
  };
};

const isGoalShared = (goal, sharedGoalIds, userId = "") => {
  const goalId = communityGoalId(goal, userId || goal.ownerId);
  const legacyGoalId = legacyCommunityGoalId(goal, userId || goal.ownerId);
  return [goal.id, `user-${goal.id}`, goalId, legacyGoalId].some((id) =>
    sharedGoalIds.includes(id),
  );
};

function AvatarButton({ person, onClick, size = "md" }) {
  const label = person?.author || person?.name || "Usuário Engine";
  const avatar = person?.avatar || person?.avatarInitials || getInitials(label);
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--engine-accent)] font-black italic text-white transition hover:ring-2 hover:ring-red-500/40`}
      title={label}
    >
      {isImageUrl(avatar) ? (
        <img src={avatar} alt={label} className="h-full w-full object-cover" />
      ) : (
        avatar
      )}
    </button>
  );
}

const buildUserGoals = (cars, settings, user) => {
  const displayName = settings.profile.displayName || user?.displayName || "Você";
  const username = settings.profile.username || "@sua.garagem";

  return cars.map((car, index) => ({
    id: String(car.id),
    carId: String(car.id),
    ownerId: user?.uid || "",
    author: displayName,
    username,
    avatar: settings.profile.avatar || getInitials(displayName),
    city: settings.profile.location || "Engine Garage",
    title: `${car.brand} ${car.model}`,
    brand: car.brand,
    model: car.model,
    year: car.year,
    image: car.image || fallbackImage,
    savedValue: car.savedValue,
    targetValue: car.targetValue,
    streak: 7 + index * 3,
    likes: 64 + index * 19,
    comments: [],
    rating: 4.5,
    verified: true,
    tagKey: "community.seed.mine",
    noteKey: settings.profile.bio ? null : "community.seed.mineNote",
    note: settings.profile.bio,
    isMine: true,
  }));
};

function RatingControl({ value, onRate, label }) {
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRate(star)}
          className="text-amber-400 transition-transform hover:scale-110"
          title={`${star}/5`}
        >
          <Star
            size={17}
            fill={star <= Math.round(value) ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}

function GoalCard({
  goal,
  interactions,
  following,
  shared,
  t,
  onLike,
  onComment,
  onRate,
  onShare,
  onUnshare,
  onFollow,
  onOpenProfile,
  onEditComment,
  onDeleteComment,
  currentUserId,
}) {
  const [draft, setDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingDraft, setEditingDraft] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentMenuId, setCommentMenuId] = useState("");
  const progress = getProgress(goal);
  const comments = [...goal.comments, ...interactions.comments];
  const previewComments = comments.slice(-2);
  const liked = interactions.liked;
  const rating = interactions.rating || goal.rating;
  const isFollowing = following.includes(goal.ownerId || goal.username);

  const submitComment = (event) => {
    event.preventDefault();
    const cleanDraft = draft.trim().slice(0, 180);
    if (!cleanDraft) return;
    onComment(goal.id, cleanDraft);
    setDraft("");
  };

  const startEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingDraft(comment.text || "");
  };

  const submitEditComment = (event, comment) => {
    event.preventDefault();
    const cleanDraft = editingDraft.trim().slice(0, 180);
    if (!cleanDraft) return;
    onEditComment(goal.id, comment.id, cleanDraft);
    setEditingCommentId("");
    setEditingDraft("");
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] shadow-xl transition-all hover:border-[var(--engine-accent)]/40   dark:shadow-none">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--engine-border)] p-4  sm:gap-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarButton person={goal} onClick={() => onOpenProfile(goal.ownerId, goal)} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenProfile(goal.ownerId, goal)}
                className="min-w-0 truncate text-left text-sm font-bold text-[var(--engine-text)] transition hover:text-[var(--engine-accent)] dark:text-white"
              >
                {goal.author}
              </button>
              {goal.verified && <ShieldCheck size={15} className="text-[var(--engine-accent)]" />}
            </div>
            <p className="truncate text-xs font-medium text-[var(--engine-text-subtle)]">
              {goal.username} · {goal.city}
            </p>
          </div>
        </div>
        {goal.isMine ? (
          <span className="shrink-0 rounded-full border border-[var(--engine-accent)]/20 bg-[var(--engine-accent)]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-[var(--engine-accent)] sm:px-3 sm:text-[10px]">
            {shared ? t("community.shared") : t("community.privateDraft")}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onFollow(goal)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-2 text-[9px] font-black uppercase tracking-widest transition sm:gap-2 sm:px-3 sm:text-[10px] ${
              isFollowing
                ? "bg-[var(--engine-accent)] text-white"
                : "border border-[var(--engine-border)] text-[var(--engine-text-muted)] hover:border-[var(--engine-accent)] hover:text-[var(--engine-accent)] "
            }`}
          >
            {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
            {isFollowing ? t("community.following") : t("community.follow")}
          </button>
        )}
      </div>

      <div className="relative aspect-[4/3] bg-[var(--engine-surface-2)] sm:aspect-auto sm:h-72 ">
        <img
          src={goal.image}
          alt={goal.title}
          onError={(event) => {
            event.currentTarget.src = fallbackImage;
          }}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--engine-accent)]">
            {goal.brand} · {goal.year}
          </p>
          <h3 className="mt-1 line-clamp-2 text-lg font-extrabold italic tracking-tight sm:text-xl">
            {goal.model}
          </h3>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:space-y-5 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--engine-accent)]/20 bg-[var(--engine-accent)]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--engine-accent)]">
            {t(goal.tagKey)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--engine-border)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--engine-text-muted)] ">
            <EyeOff size={13} />
            {t(getGoalRangeKey(goal.targetValue))}
          </span>
        </div>

        <p className="text-sm font-medium leading-6 text-[var(--engine-text-muted)] ">
          {goal.note || t(goal.noteKey)}
        </p>

        <div>
          <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-[var(--engine-text-subtle)]">{t("community.goalProgress")}</span>
            <span className="text-[var(--engine-accent)]">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--engine-surface-2)] dark:bg-red-950/30">
            <div
              className="h-full rounded-full bg-[var(--engine-accent)] shadow-[0_0_12px_rgba(220,38,38,0.55)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs font-bold text-[var(--engine-text-muted)] ">
            <ShieldCheck size={15} className="text-[var(--engine-accent)]" />
            {t("community.privacyLine")}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Metric icon={Flame} label={t("community.streak")} value={`${goal.streak}d`} />
          <Metric
            icon={Heart}
            label={t("community.likes")}
            value={goal.likes}
          />
          <Metric icon={Star} label={t("community.rating")} value={rating.toFixed(1)} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[var(--engine-border)] py-3 ">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <ActionButton
              active={liked}
              title={t("community.like")}
              onClick={() => onLike(goal.id)}
              icon={<Heart size={18} fill={liked ? "currentColor" : "none"} />}
            />
            <ActionButton
              title="Comentários"
              onClick={() => setCommentsOpen(true)}
              icon={<MessageCircle size={18} />}
            />
            <ActionButton
              title={t("community.share")}
              onClick={() => onShare(goal)}
              icon={<Copy size={18} />}
            />
            {goal.isMine && (
              <ActionButton
                title={t("community.unshare")}
                onClick={() => onUnshare(goal)}
                icon={<Trash2 size={18} />}
              />
            )}
          </div>
          <RatingControl
            value={rating}
            label={t("community.rate")}
            onRate={(value) => onRate(goal.id, value)}
          />
        </div>

        <div className="space-y-3">
          {comments.length > 2 && (
            <button
              type="button"
              onClick={() => setCommentsOpen(true)}
              className="text-xs font-black uppercase tracking-widest text-[var(--engine-text-subtle)] transition hover:text-[var(--engine-accent)]"
            >
              Ver todos os {comments.length} comentários
            </button>
          )}
          {previewComments.map((comment, index) => {
            const commentText =
              typeof comment === "string" ? comment : comment.text;
            const commentAuthor =
              typeof comment === "string" ? t("community.member") : comment.author;
            const commentUsername =
              typeof comment === "string" ? "" : comment.username;
            const commentPerson =
              typeof comment === "string"
                ? { author: commentAuthor, username: commentUsername }
                : {
                    author: commentAuthor,
                    username: commentUsername,
                    avatar: comment.avatar,
                    avatarInitials: comment.avatarInitials,
                    userId: comment.userId,
                  };
            const canEdit =
              typeof comment !== "string" &&
              comment.id &&
              comment.userId === currentUserId;
            const canDelete =
              typeof comment !== "string" &&
              comment.id &&
              (comment.userId === currentUserId || goal.ownerId === currentUserId);
            const isEditing = canEdit && editingCommentId === comment.id;
            return (
            <div
              key={`${goal.id}-comment-${comment.id || index}`}
              className="group flex gap-3 rounded-xl px-1 py-1.5 text-sm transition hover:bg-[var(--engine-surface-2)] hover:bg-[var(--engine-surface-2)]"
            >
              <AvatarButton
                person={commentPerson}
                size="sm"
                onClick={() => onOpenProfile(commentPerson.userId, commentPerson)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(commentPerson.userId, commentPerson)}
                    className="min-w-0 truncate text-left text-xs font-bold text-[var(--engine-text-muted)] transition hover:text-[var(--engine-accent)] dark:text-white"
                  >
                    {commentAuthor}{" "}
                    <span className="text-[var(--engine-text-subtle)]">{commentUsername}</span>
                  </button>
                  {(canEdit || canDelete) && !isEditing && (
                    <div className="flex shrink-0 items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => startEditComment(comment)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--engine-text-subtle)] transition hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-accent)] hover:bg-[var(--engine-surface-2)]"
                          title="Editar comentário"
                        >
                          <Edit3 size={13} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDeleteComment(goal.id, comment.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--engine-text-subtle)] transition hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-accent)] hover:bg-[var(--engine-surface-2)]"
                          title="Excluir comentário"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <form
                    onSubmit={(event) => submitEditComment(event, comment)}
                    className="mt-2 grid gap-2"
                  >
                    <input
                      value={editingDraft}
                      onChange={(event) => setEditingDraft(event.target.value)}
                      className="min-h-10 rounded-lg border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-3 text-sm font-semibold text-[var(--engine-text)] outline-none focus:border-[var(--engine-accent)]   dark:text-white"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        className="rounded-lg bg-[var(--engine-accent)] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId("");
                          setEditingDraft("");
                        }}
                        className="rounded-lg border border-[var(--engine-border)] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--engine-text-muted)] "
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="font-medium text-[var(--engine-text-muted)] ">
                      {commentText}
                    </p>
                    {typeof comment !== "string" && comment.editedAt && (
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                        editado
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
          })}
          {!comments.length && (
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
              {t("community.noComments")}
            </p>
          )}
        </div>

        <form onSubmit={submitComment} className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("community.commentPlaceholder")}
            className="min-w-0 flex-1 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-4 py-3 text-sm font-bold outline-none transition focus:border-[var(--engine-accent)]   dark:text-white"
          />
          <button
            type="submit"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--engine-accent)] text-white transition hover:brightness-95"
            title={t("community.send")}
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {commentsOpen && (
        <CommentsModal
          goal={goal}
          comments={comments}
          draft={draft}
          editingCommentId={editingCommentId}
          editingDraft={editingDraft}
          commentMenuId={commentMenuId}
          currentUserId={currentUserId}
          t={t}
          onClose={() => setCommentsOpen(false)}
          onDraftChange={setDraft}
          onSubmitComment={submitComment}
          onOpenProfile={onOpenProfile}
          onStartEditComment={startEditComment}
          onEditingDraftChange={setEditingDraft}
          onSubmitEditComment={submitEditComment}
          onCancelEdit={() => {
            setEditingCommentId("");
            setEditingDraft("");
          }}
          onDeleteComment={onDeleteComment}
          onCommentMenuChange={setCommentMenuId}
        />
      )}
    </article>
  );
}

function CommentsModal({
  goal,
  comments,
  draft,
  editingCommentId,
  editingDraft,
  commentMenuId,
  currentUserId,
  t,
  onClose,
  onDraftChange,
  onSubmitComment,
  onOpenProfile,
  onStartEditComment,
  onEditingDraftChange,
  onSubmitEditComment,
  onCancelEdit,
  onDeleteComment,
  onCommentMenuChange,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <section className="flex h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] text-[var(--engine-text)] shadow-2xl   dark:text-white sm:h-[78vh] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--engine-border)] px-4 py-3  sm:gap-4 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--engine-accent)]">
              Comentários
            </p>
            <h2 className="mt-1 line-clamp-2 text-base font-extrabold italic sm:truncate sm:text-lg">
              {goal.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--engine-surface-2)] text-[var(--engine-text-muted)] transition hover:bg-[var(--engine-accent)] hover:text-white   sm:h-10 sm:w-10"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {comments.length ? (
            <div className="space-y-4">
              {comments.map((comment, index) => (
                <CommentRow
                  key={`${goal.id}-modal-comment-${comment.id || index}`}
                  goal={goal}
                  comment={comment}
                  index={index}
                  currentUserId={currentUserId}
                  editingCommentId={editingCommentId}
                  editingDraft={editingDraft}
                  commentMenuId={commentMenuId}
                  t={t}
                  onOpenProfile={onOpenProfile}
                  onStartEditComment={onStartEditComment}
                  onEditingDraftChange={onEditingDraftChange}
                  onSubmitEditComment={onSubmitEditComment}
                  onCancelEdit={onCancelEdit}
                  onDeleteComment={onDeleteComment}
                  onCommentMenuChange={onCommentMenuChange}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
              <MessageCircle className="mb-3 text-[var(--engine-text-subtle)]" size={34} />
              <p className="text-sm font-bold text-[var(--engine-text)] dark:text-white">
                {t("community.noComments")}
              </p>
            </div>
          )}
        </div>

        <form
          onSubmit={onSubmitComment}
          className="flex gap-2 border-t border-[var(--engine-border)] p-3  sm:p-4"
        >
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={t("community.commentPlaceholder")}
            className="min-w-0 flex-1 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-3 py-3 text-sm font-bold outline-none transition focus:border-[var(--engine-accent)]   dark:text-white sm:px-4"
          />
          <button
            type="submit"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--engine-accent)] text-white transition hover:brightness-95"
            title={t("community.send")}
          >
            <Send size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}

function CommentRow({
  goal,
  comment,
  index,
  currentUserId,
  editingCommentId,
  editingDraft,
  commentMenuId,
  t,
  onOpenProfile,
  onStartEditComment,
  onEditingDraftChange,
  onSubmitEditComment,
  onCancelEdit,
  onDeleteComment,
  onCommentMenuChange,
}) {
  const commentText = typeof comment === "string" ? comment : comment.text;
  const commentAuthor =
    typeof comment === "string" ? t("community.member") : comment.author;
  const commentUsername = typeof comment === "string" ? "" : comment.username;
  const commentPerson =
    typeof comment === "string"
      ? { author: commentAuthor, username: commentUsername }
      : {
          author: commentAuthor,
          username: commentUsername,
          avatar: comment.avatar,
          avatarInitials: comment.avatarInitials,
          userId: comment.userId,
        };
  const canEdit =
    typeof comment !== "string" &&
    comment.id &&
    comment.userId === currentUserId;
  const canDelete =
    typeof comment !== "string" &&
    comment.id &&
    (comment.userId === currentUserId || goal.ownerId === currentUserId);
  const isEditing = canEdit && editingCommentId === comment.id;

  return (
    <div className="group flex gap-3 rounded-xl px-1 py-1.5 text-sm transition hover:bg-[var(--engine-surface-2)] hover:bg-[var(--engine-surface-2)]">
      <AvatarButton
        person={commentPerson}
        size="sm"
        onClick={() => onOpenProfile(commentPerson.userId, commentPerson)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpenProfile(commentPerson.userId, commentPerson)}
            className="min-w-0 truncate text-left text-xs font-bold text-[var(--engine-text-muted)] transition hover:text-[var(--engine-accent)] dark:text-white"
          >
            {commentAuthor} <span className="text-[var(--engine-text-subtle)]">{commentUsername}</span>
          </button>
          {(canEdit || canDelete) && !isEditing && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() =>
                  onCommentMenuChange((current) =>
                    current === comment.id ? "" : comment.id,
                  )
                }
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--engine-text-subtle)] transition hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)] hover:bg-[var(--engine-surface-2)] dark:hover:text-white"
                title="Opções"
              >
                <MoreHorizontal size={16} />
              </button>
              {commentMenuId === comment.id && (
                <div className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-lg border border-[var(--engine-border)] bg-[var(--engine-surface)] py-1 shadow-xl  ">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        onStartEditComment(comment);
                        onCommentMenuChange("");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-[var(--engine-text-muted)] transition hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-accent)]  hover:bg-[var(--engine-surface-2)]"
                    >
                      <Edit3 size={14} />
                      Editar
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteComment(goal.id, comment.id);
                        onCommentMenuChange("");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-[var(--engine-text-muted)] transition hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-accent)]  hover:bg-[var(--engine-surface-2)]"
                    >
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {isEditing ? (
          <form
            onSubmit={(event) => onSubmitEditComment(event, comment)}
            className="mt-2 grid gap-2"
          >
            <input
              value={editingDraft}
              onChange={(event) => onEditingDraftChange(event.target.value)}
              className="min-h-10 rounded-lg border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-3 text-sm font-semibold text-[var(--engine-text)] outline-none focus:border-[var(--engine-accent)]   dark:text-white"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-lg bg-[var(--engine-accent)] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-lg border border-[var(--engine-border)] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--engine-text-muted)] "
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="font-medium text-[var(--engine-text-muted)] ">
              {commentText}
            </p>
            {typeof comment !== "string" && comment.editedAt && (
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                editado
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, value, label }) {
  const IconComponent = icon;

  return (
    <div className="rounded-xl bg-[var(--engine-surface-2)] p-3 ">
      <IconComponent size={18} className="mb-2 text-[var(--engine-accent)]" />
      <p className="text-lg font-black text-[var(--engine-text)] dark:text-white">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
        {label}
      </p>
    </div>
  );
}

function ActionButton({ active = false, title, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
        active
          ? "bg-[var(--engine-accent)] text-white"
          : "bg-[var(--engine-surface-2)] text-[var(--engine-text-muted)] hover:text-[var(--engine-accent)] "
      }`}
      title={title}
    >
      {icon}
    </button>
  );
}

function VideoCard({ video, t, saved, liked, onSave, onLike }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] shadow-xl   dark:shadow-none">
      <div className="relative bg-black">
        <video
          controls
          preload="metadata"
          poster={video.poster}
          className="aspect-[9/14] max-h-[680px] w-full bg-black object-cover"
        >
          <source src={video.src} />
        </video>
        <div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
          <Play size={13} />
          {t("community.videoShort")}
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--engine-accent)]">
            {video.username}
          </p>
          <h2 className="mt-1 text-2xl font-black italic text-[var(--engine-text)] dark:text-white">
            {t(video.titleKey)}
          </h2>
          <p className="mt-2 text-sm font-medium text-[var(--engine-text-muted)] ">
            {t(video.captionKey)}
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--engine-border)] pt-4 ">
          <button
            type="button"
            onClick={() => onLike(video.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
              liked
                ? "bg-[var(--engine-accent)] text-white"
                : "bg-[var(--engine-surface-2)] text-[var(--engine-text-muted)] hover:text-[var(--engine-accent)] "
            }`}
          >
            <Heart size={16} fill={liked ? "currentColor" : "none"} />
            {video.likes + (liked ? 1 : 0)}
          </button>
          <button
            type="button"
            onClick={() => onSave(video.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
              saved
                ? "bg-[var(--engine-accent)] text-white "
                : "bg-[var(--engine-surface-2)] text-[var(--engine-text-muted)] hover:text-[var(--engine-accent)] "
            }`}
          >
            <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
            {saved ? t("community.saved") : t("community.save")}
          </button>
        </div>
      </div>
    </article>
  );
}

function ShareModal({ goals, sharedGoalIds, userId, t, onClose, onShare, onUnshare }) {
  return (
    <div className="engine-modal-overlay">
      <div className="engine-modal-panel engine-pop sm:max-w-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--engine-border)] p-4 sm:p-6">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight text-[var(--engine-text)] dark:text-white">
              {t("community.shareModalTitle")}
            </h2>
            <p className="mt-2 text-sm font-medium text-[var(--engine-text-muted)] ">
              {t("community.shareModalCopy")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--engine-surface-2)] text-[var(--engine-text-muted)] hover:text-[var(--engine-accent)] "
            title={t("common.cancel")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="engine-modal-body engine-scroll engine-safe-bottom space-y-3 p-4 sm:p-6">
          {goals.map((goal) => {
            const shared = isGoalShared(goal, sharedGoalIds, userId);
            return (
              <div
                key={goal.id}
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--engine-border)] p-3 transition hover:border-[var(--engine-accent)] "
              >
                <button
                  type="button"
                  onClick={() => onShare(goal)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                >
                  <img
                    src={goal.image}
                    alt={goal.title}
                    className="h-16 w-20 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black italic text-[var(--engine-text)] dark:text-white">
                      {goal.title}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                      {getProgress(goal).toFixed(1)}% / {t(getGoalRangeKey(goal.targetValue))}
                    </p>
                  </div>
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      shared ? "bg-[var(--engine-accent)] text-white" : "bg-[var(--engine-surface-2)] text-[var(--engine-text-subtle)]"
                    }`}
                    title={shared ? t("community.shared") : t("community.publishGoal")}
                  >
                    {shared ? <Check size={17} /> : <Share2 size={17} />}
                  </span>
                </button>
                {shared && (
                  <button
                    type="button"
                    onClick={() => onUnshare(goal)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--engine-surface-2)] text-[var(--engine-text-muted)] transition hover:bg-[var(--engine-accent)] hover:text-white "
                    title={t("community.unshare")}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
          {!goals.length && (
            <div className="rounded-xl border border-dashed border-[var(--engine-border)] p-8 text-center ">
              <Car className="mx-auto mb-3 text-[var(--engine-accent)]" size={34} />
              <p className="font-medium text-[var(--engine-text-muted)]">
                {t("community.noPersonalGoals")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserProfileModal({ profile, loading, t, onClose, onOpenGoal }) {
  const goals = profile?.goals || [];
  const stats = getProfileStats(profile);

  return (
    <div className="engine-modal-overlay">
      <div className="engine-modal-panel engine-pop sm:max-w-3xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--engine-border)] p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--engine-accent)] text-lg font-black italic text-white sm:h-16 sm:w-16 sm:text-xl">
              {isImageUrl(profile?.avatar) ? (
                <img src={profile.avatar} alt={profile.author} className="h-full w-full object-cover" />
              ) : (
                profile?.avatarInitials || profile?.avatar || getInitials(profile?.author)
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--engine-accent)]">
                {t("community.profileTitle")}
              </p>
              <h2 className="truncate text-xl font-extrabold italic text-[var(--engine-text)] dark:text-white sm:text-2xl">
                {loading ? t("common.loading") : profile?.author || "Usuário Engine"}
              </h2>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-medium text-[var(--engine-text-subtle)] sm:text-sm">
                <span className="inline-flex items-center gap-1">
                  <AtSign size={14} />
                  {profile?.username || "@engine"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} />
                  {profile?.city || "Engine Garage"}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--engine-surface-2)] text-[var(--engine-text-muted)] hover:text-[var(--engine-accent)] "
            title={t("common.cancel")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="engine-modal-body engine-scroll engine-safe-bottom space-y-5 p-4 sm:p-5">
          {profile?.note && (
            <p className="rounded-xl bg-[var(--engine-surface-2)] p-4 text-sm font-medium leading-6 text-[var(--engine-text-muted)]  ">
              {profile.note}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric icon={Car} label={t("community.profileStats.goals")} value={stats.goalsCount} />
            <Metric icon={Heart} label={t("community.profileStats.likes")} value={stats.likesCount} />
            <Metric icon={Award} label={t("community.profileStats.avg")} value={`${Number(stats.averageProgress || 0).toFixed(0)}%`} />
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--engine-text)] dark:text-white">
              {t("community.profileGoals")}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {goals.map((goal) => (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => onOpenGoal(goal.id)}
                  className="flex items-center gap-3 rounded-xl border border-[var(--engine-border)] p-3 text-left transition hover:border-[var(--engine-accent)] "
                >
                  <img
                    src={goal.image || fallbackImage}
                    alt={goal.title}
                    className="h-16 w-20 rounded-lg object-cover"
                    onError={(event) => {
                      event.currentTarget.src = fallbackImage;
                    }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black italic text-[var(--engine-text)] dark:text-white">
                      {goal.title}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                      {getProgress(goal).toFixed(0)}% / {goal.likes} likes
                    </p>
                  </div>
                </button>
              ))}
              {!loading && !goals.length && (
                <p className="rounded-xl border border-dashed border-[var(--engine-border)] p-5 text-center text-sm font-medium text-[var(--engine-text-subtle)] ">
                  {t("community.profileEmpty")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Community({ cars = [], settings, user }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("feed");
  const [query, setQuery] = useState("");
  const [communityState, setCommunityState] = useState(
    engineDB.getDefaultCommunityState(),
  );
  const [communityGoals, setCommunityGoals] = useState([]);
  const [hasMoreGoals, setHasMoreGoals] = useState(false);
  const [loadingMoreGoals, setLoadingMoreGoals] = useState(false);
  const [publicProfiles, setPublicProfiles] = useState({});
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [profileModal, setProfileModal] = useState({
    open: false,
    loading: false,
    profile: null,
  });

  const personalGoals = useMemo(
    () => buildUserGoals(cars, settings, user),
    [cars, settings, user],
  );

  const profiles = useMemo(
    () => ({
      ...publicProfiles,
      ...(user?.uid ? { [user.uid]: profileFromSettings(settings, user) } : {}),
    }),
    [publicProfiles, settings, user],
  );

  const carsById = useMemo(
    () => new Map(cars.map((car) => [String(car.id), car])),
    [cars],
  );

  const goals = useMemo(
    () =>
      communityGoals.map((goal) => {
        const currentCar =
          goal.ownerId === user?.uid ? carsById.get(String(goal.carId)) : null;
        const mergedGoal =
          currentCar?.model
            ? {
                ...goal,
                title: `${currentCar.brand} ${currentCar.model}`.trim(),
                brand: currentCar.brand || goal.brand,
                model: currentCar.model || goal.model,
                year: currentCar.year || goal.year,
                image: currentCar.image || goal.image,
                savedValue: currentCar.savedValue ?? goal.savedValue,
                targetValue: currentCar.targetValue ?? goal.targetValue,
              }
            : goal;

        return enrichGoalProfiles(mergedGoal, profiles);
      }),
    [carsById, communityGoals, profiles, user?.uid],
  );

  useEffect(() => {
    let alive = true;

    engineDB
      .getCommunityState()
      .then((state) => {
        if (alive) setCommunityState(state);
      })
      .catch((error) => console.error(error));

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = engineDB.subscribeCommunityGoals((goals, meta) => {
      setCommunityGoals(goals);
      setHasMoreGoals(Boolean(meta?.hasMore));
    });
    return () => unsubscribe();
  }, []);

  const handleLoadMoreGoals = async () => {
    if (loadingMoreGoals || !hasMoreGoals) return;
    setLoadingMoreGoals(true);
    try {
      const { goals: moreGoals, hasMore } = await engineDB.loadMoreCommunityGoals();
      setCommunityGoals((current) => {
        const existingIds = new Set(current.map((goal) => goal.id));
        return [...current, ...moreGoals.filter((goal) => !existingIds.has(goal.id))];
      });
      setHasMoreGoals(hasMore);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMoreGoals(false);
    }
  };

  useEffect(() => {
    const unsubscribe = engineDB.subscribePublicProfiles(setPublicProfiles);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const goalId = new URLSearchParams(window.location.search).get("goal");
    if (!goalId || !goals.length) return;
    const goal = goals.find((item) => item.id === goalId);
    if (!goal) return;

    const timer = window.setTimeout(() => {
      setActiveTab("feed");
      setQuery(goal.title);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [goals]);

  const persistState = async (updater) => {
    setCommunityState((current) => {
      const next = updater(current);
      engineDB.saveCommunityState(next).catch((error) => console.error(error));
      return next;
    });
  };

  const flash = (message) => toast(message);

  const filteredGoals = goals.filter((goal) =>
    `${goal.author} ${goal.title} ${goal.username}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  const ranking = [...goals]
    .sort((a, b) => {
      const aInteractions = communityState.interactions[a.id] || emptyInteraction;
      const bInteractions = communityState.interactions[b.id] || emptyInteraction;
      const likesA = Number(a.likes) + (aInteractions.liked ? 1 : 0);
      const likesB = Number(b.likes) + (bInteractions.liked ? 1 : 0);
      if (likesB !== likesA) return likesB - likesA;

      const ratingA = aInteractions.rating || a.rating;
      const ratingB = bInteractions.rating || b.rating;
      if (ratingB !== ratingA) return ratingB - ratingA;

      return getProgress(b) - getProgress(a);
    })
    .slice(0, 5);

  const stats = goals.reduce(
    (acc, goal) => {
      acc.progress += getProgress(goal);
      acc.likes += goal.likes;
      return acc;
    },
    { progress: 0, likes: 0 },
  );

  const averageProgress = goals.length ? stats.progress / goals.length : 0;

  const updateInteraction = (goalId, updater) => {
    persistState((current) => {
      const previous = current.interactions[goalId] || emptyInteraction;
      return {
        ...current,
        interactions: {
          ...current.interactions,
          [goalId]: updater(previous),
        },
      };
    });
  };

  const handleLike = (goalId) => {
    const goal = goals.find((item) => item.id === goalId);
    const liked = Boolean(goal?.likesBy?.[user?.uid]);
    engineDB.toggleCommunityLike(goalId, !liked, user?.uid).catch((error) =>
      console.error(error),
    );
  };

  const handleComment = (goalId, comment) => {
    engineDB.addCommunityComment(goalId, comment, user?.uid).catch((error) =>
      console.error(error),
    );
    flash(t("community.commentSaved"));
  };

  const handleEditComment = (goalId, commentId, text) => {
    engineDB.updateCommunityComment(goalId, commentId, text, user?.uid).catch((error) =>
      console.error(error),
    );
    flash("Comentário atualizado.");
  };

  const handleDeleteComment = async (goalId, commentId) => {
    const ok = await confirm({
      title: t("community.deleteCommentTitle"),
      message: t("community.deleteCommentConfirm"),
      confirmLabel: t("common.delete"),
    });
    if (!ok) return;
    engineDB.deleteCommunityComment(goalId, commentId, user?.uid).catch((error) =>
      console.error(error),
    );
    flash(t("community.commentDeleted"));
  };

  const handleRate = (goalId, rating) => {
    engineDB.rateCommunityGoal(goalId, rating, user?.uid).catch((error) =>
      console.error(error),
    );
    flash(t("community.ratingSaved"));
  };

  const handleFollow = (goal) => {
    const followId = goal.ownerId || goal.username;
    const wasFollowing = communityState.following.includes(followId);
    persistState((current) => {
      const isFollowing = current.following.includes(followId);
      return {
        ...current,
        following: isFollowing
          ? current.following.filter((item) => item !== followId)
          : [...current.following, followId],
      };
    });

    if (!wasFollowing && goal.ownerId && goal.ownerId !== user?.uid) {
      engineDB
        .notifyFollow(goal.ownerId)
        .catch((error) => console.error(error));
    }
  };

  const handleOpenProfile = async (profileUserId, fallback = {}) => {
    const profileGoals = goals.filter((goal) => goal.ownerId === profileUserId);
    const profileProgress = profileGoals.reduce((sum, goal) => sum + getProgress(goal), 0);
    const fallbackProfile = {
      id: profileUserId,
      userId: profileUserId,
      author: fallback.author || fallback.name || "Usuário Engine",
      username: fallback.username || "@engine",
      avatar: fallback.avatar || "",
      avatarInitials: fallback.avatarInitials || getInitials(fallback.author),
      city: fallback.city || "Engine Garage",
      note: fallback.note || "",
      goals: profileGoals,
      goalsCount: profileGoals.length,
      likesCount: profileGoals.reduce((sum, goal) => sum + (Number(goal.likes) || 0), 0),
      averageProgress: profileGoals.length ? profileProgress / profileGoals.length : 0,
    };

    setProfileModal({
      open: true,
      loading: Boolean(profileUserId),
      profile: fallbackProfile,
    });
    if (!profileUserId) return;

    try {
      const profile = await engineDB.getPublicProfile(profileUserId);
      setProfileModal({
        open: true,
        loading: false,
        profile: { ...fallbackProfile, ...profile },
      });
    } catch (error) {
      console.error(error);
      setProfileModal((current) => ({ ...current, loading: false }));
    }
  };

  const handleOpenProfileGoal = (goalId) => {
    const goal = goals.find((item) => item.id === goalId);
    setProfileModal({ open: false, loading: false, profile: null });
    if (goal) {
      setActiveTab("feed");
      setQuery(goal.title);
    }
  };

  const handleCopyShareLink = async (goal) => {
    const shareText = `${t("community.shareText")} ${goal.title} - ${getProgress(
      goal,
    ).toFixed(1)}%`;
    const shareUrl = buildShareUrl(goal);

    const payload = `${shareText} ${shareUrl}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        // Fallback sem diálogo nativo: copia via textarea temporária.
        const textarea = document.createElement("textarea");
        textarea.value = payload;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      flash(t("community.linkCopied"));
    } catch {
      flash(t("community.linkCopyError"));
    }
  };

  const handlePublishGoal = async (goal) => {
    if (!goal.isMine || goal.ownerId !== user?.uid) {
      await handleCopyShareLink(goal);
      return;
    }

    try {
      const publishedGoalId = await engineDB.shareCommunityGoal(goal, settings, user?.uid);
      persistState((current) => ({
        ...current,
        sharedGoalIds: Array.from(
          new Set([...current.sharedGoalIds, goal.id, publishedGoalId].filter(Boolean)),
        ),
      }));
      flash(t("community.sharedNotice"));
    } catch {
      flash(t("community.sharedDraftNotice"));
    }
  };

  const handleUnshareGoal = async (goal) => {
    if (!goal.isMine && goal.ownerId !== user?.uid) return;

    try {
      await engineDB.deleteCommunityGoal(goal, user?.uid);
      const goalId = communityGoalId(goal, user?.uid);
      const legacyGoalId = legacyCommunityGoalId(goal, user?.uid);
      persistState((current) => ({
        ...current,
        sharedGoalIds: current.sharedGoalIds.filter(
          (item) => ![goal.id, `user-${goal.id}`, goalId, legacyGoalId].includes(item),
        ),
      }));
      flash(t("community.unsharedNotice"));
    } catch (error) {
      console.error(error);
      flash(t("community.unshareError"));
    }
  };

  const handleClearMyPublications = async () => {
    const ok = await confirm({
      title: t("community.clearPublishedTitle"),
      message: t("community.clearPublishedConfirm"),
      confirmLabel: t("community.clearPublishedAction"),
    });
    if (!ok) return;

    try {
      await engineDB.resetMyCommunityPublications(user?.uid);
      persistState((current) => ({
        ...current,
        sharedGoalIds: [],
      }));
      flash(t("community.clearPublishedNotice"));
    } catch (error) {
      console.error(error);
      flash(t("community.clearPublishedError"));
    }
  };

  const handleSaveVideo = (videoId) => {
    persistState((current) => {
      const saved = current.savedVideos.includes(videoId);
      return {
        ...current,
        savedVideos: saved
          ? current.savedVideos.filter((item) => item !== videoId)
          : [...current.savedVideos, videoId],
      };
    });
  };

  const handleVideoLike = (videoId) => {
    updateInteraction(videoId, (previous) => ({
      ...previous,
      liked: !previous.liked,
    }));
  };

  const tabs = [
    { id: "feed", label: t("community.tabs.feed"), icon: Users },
    { id: "videos", label: t("community.tabs.videos"), icon: Clapperboard },
    { id: "ranking", label: t("community.tabs.ranking"), icon: Trophy },
  ];

  return (
    <section className="space-y-5 pb-6 sm:space-y-8 sm:pb-10">

      {/* No celular o cabeçalho encosta nas bordas (ganha ~32px de largura
          útil) e volta a ser cartão a partir de sm. */}
      <header className="-mx-4 overflow-hidden border-y border-[var(--engine-border)] bg-[var(--engine-surface)] text-[var(--engine-text)] dark:text-white sm:mx-0 sm:rounded-2xl sm:border sm:shadow-xl sm:dark:shadow-none">
        <div className="grid gap-6 p-4 sm:gap-8 sm:p-8 lg:grid-cols-[1.35fr_0.65fr] lg:p-10">
          <div className="flex flex-col justify-between gap-6 sm:gap-8">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--engine-accent)] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white sm:px-4 sm:py-2">
                  <Sparkles size={14} />
                  Engine Social
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--engine-text-muted)] sm:text-[10px] sm:tracking-[0.26em]">
                  {t("community.kicker")}
                </span>
              </div>
              <h1 className="max-w-3xl text-2xl font-extrabold uppercase italic leading-tight tracking-tight sm:text-3xl">
                {t("community.title")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--engine-text-muted)] ">
                {t("community.subtitle")}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <HeroStat icon={Users} label={t("community.stats.goals")} value={goals.length} />
              <HeroStat icon={Heart} label={t("community.stats.interactions")} value={stats.likes} />
              <HeroStat
                icon={Award}
                label={t("community.stats.avg")}
                value={`${averageProgress.toFixed(0)}%`}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] p-4 sm:bg-[var(--engine-surface)] sm:p-5 sm:shadow-xl sm:dark:shadow-none">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-[var(--engine-text-muted)] sm:mb-4">
              {t("community.publishTitle")}
            </p>
            <div className="space-y-3 sm:space-y-4">
              {personalGoals.slice(0, 3).map(
                (goal) => {
                  const progress = getProgress(goal);
                  const shared = isGoalShared(goal, communityState.sharedGoalIds, user?.uid);
                  return (
                    <div
                      key={goal.id}
                      className="flex items-center gap-3 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] p-3  "
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--engine-accent)] text-white">
                        <Car size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black italic text-[var(--engine-text)] dark:text-white">
                          {goal.title}
                        </p>
                        <div className="mt-2 h-1.5 rounded-full bg-[var(--engine-surface-2)] dark:bg-[var(--engine-surface)]/10">
                          <div
                            className="h-full rounded-full bg-[var(--engine-accent)]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      {shared ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : (
                        <EyeOff size={18} className="text-[var(--engine-text-muted)]" />
                      )}
                    </div>
                  );
                },
              )}
              {!personalGoals.length && (
                <div className="rounded-xl border border-dashed border-[var(--engine-border)] p-5 text-center ">
                  <Car className="mx-auto mb-3 text-[var(--engine-accent)]" size={30} />
                  <p className="text-sm font-medium text-[var(--engine-text-muted)]">
                    {t("community.noPersonalGoals")}
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--engine-accent)] px-4 py-3 text-sm font-bold uppercase text-white transition hover:brightness-95"
            >
              <Plus size={18} />
              {t("community.shareNewGoal")}
            </button>
            <button
              type="button"
              onClick={handleClearMyPublications}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--engine-accent)]/25 px-4 py-3 text-xs font-black uppercase tracking-widest text-[var(--engine-accent)] transition hover:border-[var(--engine-accent)] hover:bg-[var(--engine-accent)] hover:text-white"
            >
              <Trash2 size={16} />
              {t("community.clearPublished")}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="hide-scrollbar flex w-full overflow-x-auto rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-1 sm:w-fit  ">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-3 text-xs font-black uppercase tracking-widest transition sm:px-5 ${
                  isActive
                    ? "bg-[var(--engine-accent)] text-white"
                    : "text-[var(--engine-text-muted)] hover:text-[var(--engine-accent)]"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <label className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface)] px-4 lg:max-w-sm  ">
          <Search size={18} className="text-[var(--engine-text-subtle)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("community.search")}
            className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none dark:text-white"
          />
        </label>
      </div>

      {activeTab === "feed" && (
        <div className="grid gap-5 sm:gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-5 sm:gap-8 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {filteredGoals.length ? (
              filteredGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                t={t}
                interactions={{
                  ...emptyInteraction,
                  liked: Boolean(goal.likesBy?.[user?.uid]),
                  rating: goal.ratingsBy?.[user?.uid] || goal.rating,
                }}
                  following={communityState.following}
                  shared={isGoalShared(goal, communityState.sharedGoalIds, user?.uid)}
                  onLike={handleLike}
                  onComment={handleComment}
                  onRate={handleRate}
                  onShare={handleCopyShareLink}
                  onUnshare={handleUnshareGoal}
                  onFollow={handleFollow}
                  onOpenProfile={handleOpenProfile}
                  onEditComment={handleEditComment}
                  onDeleteComment={handleDeleteComment}
                  currentUserId={user?.uid}
                />
              ))
            ) : (
              <EmptyFeed t={t} />
            )}

            {hasMoreGoals && !query && (
              <button
                type="button"
                onClick={handleLoadMoreGoals}
                disabled={loadingMoreGoals}
                className="rounded-xl border border-[var(--engine-border)] py-3 text-xs font-black uppercase tracking-widest text-[var(--engine-text-muted)] transition hover:border-[var(--engine-accent)] hover:text-[var(--engine-accent)] disabled:opacity-50 "
              >
                {loadingMoreGoals ? t("common.loading") : t("community.loadMore")}
              </button>
            )}
          </div>

          <aside className="space-y-6">
            <SidebarRanking ranking={ranking} t={t} />
            {friendSuggestions.length > 0 && (
              <Suggestions
                t={t}
                following={communityState.following}
                onFollow={handleFollow}
              />
            )}
          </aside>
        </div>
      )}

      {activeTab === "videos" && (
        <div className="grid gap-5 sm:gap-8 md:grid-cols-2 xl:grid-cols-3">
          {videoPosts.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              t={t}
              saved={communityState.savedVideos.includes(video.id)}
              liked={communityState.interactions[video.id]?.liked}
              onSave={handleSaveVideo}
              onLike={handleVideoLike}
            />
          ))}
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--engine-border)] bg-[var(--engine-surface)] p-8 text-center  ">
            <Clapperboard className="mb-4 text-[var(--engine-accent)]" size={44} />
            <h2 className="text-lg font-extrabold tracking-tight text-[var(--engine-text)] dark:text-white">
              {t("community.videos.slotTitle")}
            </h2>
            <p className="mt-3 max-w-sm text-sm font-medium text-[var(--engine-text-muted)] ">
              {t("community.videos.slotCopy")}
            </p>
          </div>
        </div>
      )}

      {activeTab === "ranking" && <RankingPanel ranking={ranking} t={t} />}

      {shareModalOpen && (
        <ShareModal
          goals={personalGoals}
          sharedGoalIds={communityState.sharedGoalIds}
          userId={user?.uid}
          t={t}
          onClose={() => setShareModalOpen(false)}
          onShare={handlePublishGoal}
          onUnshare={handleUnshareGoal}
        />
      )}

      {profileModal.open && (
        <UserProfileModal
          profile={profileModal.profile}
          loading={profileModal.loading}
          t={t}
          onClose={() => setProfileModal({ open: false, loading: false, profile: null })}
          onOpenGoal={handleOpenProfileGoal}
        />
      )}
    </section>
  );
}

function HeroStat({ icon, value, label }) {
  const IconComponent = icon;

  return (
    <div className="min-w-0 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] p-3 dark:border-white/10 dark:bg-[var(--engine-surface)]/5 sm:p-4">
      <IconComponent className="mb-2 text-[var(--engine-accent)] sm:mb-3" size={18} />
      <p className="truncate text-xl font-black text-[var(--engine-text)] dark:text-white sm:text-2xl">
        {value}
      </p>
      <p className="truncate text-[9px] font-bold uppercase tracking-wider text-[var(--engine-text-muted)] sm:text-[10px] sm:tracking-widest">
        {label}
      </p>
    </div>
  );
}

function EmptyFeed({ t }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--engine-border)] bg-[var(--engine-surface)] p-8 text-center lg:col-span-2 xl:col-span-1 2xl:col-span-2  ">
      <Search className="mb-4 text-[var(--engine-accent)]" size={40} />
      <h2 className="text-lg font-extrabold tracking-tight text-[var(--engine-text)] dark:text-white">
        {t("community.noSearchResults")}
      </h2>
      <p className="mt-3 max-w-sm text-sm font-medium text-[var(--engine-text-muted)] ">
        {t("community.noSearchResultsCopy")}
      </p>
    </div>
  );
}

function SidebarRanking({ ranking, t }) {
  return (
    <section className="rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-5  ">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--engine-text)] dark:text-white">
        <Trophy size={18} className="text-[var(--engine-accent)]" />
        {t("community.weekTop")}
      </h2>
      <div className="space-y-3">
        {ranking.slice(0, 3).map((goal, index) => (
          <div key={goal.id} className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--engine-accent)] text-xs font-black text-white">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-[var(--engine-text)] dark:text-white">
                {getRankingVehicleLabel(goal)}
                <span className="font-bold text-[var(--engine-text-subtle)]"> / {goal.author}</span>
              </p>
              <p className="truncate text-[11px] font-medium text-[var(--engine-text-subtle)]">
                {goal.username} · {goal.likes} likes · {getProgress(goal).toFixed(0)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Suggestions({ t, following, onFollow }) {
  return (
    <section className="rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-5  ">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--engine-text)] dark:text-white">
        <UserPlus size={18} className="text-[var(--engine-accent)]" />
        {t("community.suggestions.title")}
      </h2>
      <div className="space-y-3">
        {friendSuggestions.map((friend) => {
          const isFollowing = following.includes(friend.handle);
          return (
            <div key={friend.handle} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[var(--engine-text)] dark:text-white">
                  {friend.name}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                  {t(friend.matchKey)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onFollow(friend.handle)}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                  isFollowing
                    ? "bg-[var(--engine-accent)] text-white"
                    : "bg-[var(--engine-surface-2)] text-[var(--engine-accent)] hover:bg-[var(--engine-accent)] hover:text-white "
                }`}
                title={isFollowing ? t("community.following") : t("community.follow")}
              >
                {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RankingPanel({ ranking, t }) {
  return (
    <div className="rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-4 sm:p-6">
      <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight text-[var(--engine-text)] dark:text-white">
            {t("community.rankingTitle")}
          </h2>
          <p className="mt-1 text-sm font-medium text-[var(--engine-text-muted)]">
            {t("community.rankingSubtitle")}
          </p>
        </div>
        <Trophy size={30} className="shrink-0 text-[var(--engine-accent)] sm:size-9" />
      </div>

      <div className="space-y-4">
        {ranking.map((goal, index) => {
          const progress = getProgress(goal);
          return (
            <div
              key={goal.id}
              className="grid gap-4 rounded-xl border border-[var(--engine-border)] p-4 md:grid-cols-[64px_1fr_160px] md:items-center "
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--engine-accent)] text-xl font-black italic text-white ">
                #{index + 1}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black italic text-[var(--engine-text)] dark:text-white">
                  {goal.title}
                </p>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                  {goal.author} / {goal.username}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--engine-surface-2)] dark:bg-red-950/30">
                  <div
                    className="h-full rounded-full bg-[var(--engine-accent)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center md:grid-cols-1 md:text-right">
                <p className="text-sm font-black text-[var(--engine-accent)]">
                  {progress.toFixed(1)}%
                </p>
                <p className="text-sm font-black text-[var(--engine-text)] dark:text-white">
                  {goal.likes} likes
                </p>
                <p className="text-sm font-black text-amber-500">
                  {goal.rating.toFixed(1)} {t("community.rating")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
