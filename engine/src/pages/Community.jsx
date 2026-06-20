import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Award,
  Bookmark,
  Car,
  Check,
  CheckCircle2,
  Clapperboard,
  EyeOff,
  Flame,
  Heart,
  MessageCircle,
  Play,
  Plus,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { engineDB } from "../services/db";

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

const getGoalRangeKey = (value) => {
  if (value >= 500000) return "community.ranges.elite";
  if (value >= 250000) return "community.ranges.performance";
  if (value >= 120000) return "community.ranges.premium";
  return "community.ranges.entry";
};

const buildUserGoals = (cars, settings, user) => {
  const displayName = settings.profile.displayName || user?.displayName || "Voce";
  const username = settings.profile.username || "@sua.garagem";

  return cars.map((car, index) => ({
    id: `user-${car.id}`,
    author: displayName,
    username,
    avatar: getInitials(displayName),
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
  onFollow,
}) {
  const [draft, setDraft] = useState("");
  const progress = getProgress(goal);
  const comments = [...goal.comments, ...interactions.comments];
  const liked = interactions.liked;
  const rating = interactions.rating || goal.rating;
  const isFollowing = following.includes(goal.username);

  const submitComment = (event) => {
    event.preventDefault();
    const cleanDraft = draft.trim().slice(0, 180);
    if (!cleanDraft) return;
    onComment(goal.id, cleanDraft);
    setDraft("");
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl transition-all hover:border-red-600/40 dark:border-[#222] dark:bg-[#151515] dark:shadow-none">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 p-5 dark:border-[#222]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-600 font-black italic text-white">
            {goal.avatar}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-black uppercase italic text-slate-950 dark:text-white">
                {goal.author}
              </h2>
              {goal.verified && <ShieldCheck size={15} className="text-red-500" />}
            </div>
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {goal.username} / {goal.city}
            </p>
          </div>
        </div>
        {goal.isMine ? (
          <span className="rounded-full border border-red-600/20 bg-red-600/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-600">
            {shared ? t("community.shared") : t("community.privateDraft")}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onFollow(goal.username)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${
              isFollowing
                ? "bg-red-600 text-white"
                : "border border-gray-200 text-gray-500 hover:border-red-500 hover:text-red-600 dark:border-[#333]"
            }`}
          >
            {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
            {isFollowing ? t("community.following") : t("community.follow")}
          </button>
        )}
      </div>

      <div className="relative h-56 bg-gray-100 sm:h-72 dark:bg-[#101010]">
        <img
          src={goal.image}
          alt={goal.title}
          onError={(event) => {
            event.currentTarget.src = fallbackImage;
          }}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-300">
            {goal.brand} / {goal.year}
          </p>
          <h3 className="mt-1 text-3xl font-black italic tracking-tight">
            {goal.model}
          </h3>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-red-600/20 bg-red-600/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-600">
            {t(goal.tagKey)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:border-[#333]">
            <EyeOff size={13} />
            {t(getGoalRangeKey(goal.targetValue))}
          </span>
        </div>

        <p className="text-sm font-medium leading-6 text-gray-600 dark:text-gray-300">
          {goal.note || t(goal.noteKey)}
        </p>

        <div>
          <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-gray-400">{t("community.goalProgress")}</span>
            <span className="text-red-500">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-red-950/30">
            <div
              className="h-full rounded-full bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.55)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
            <ShieldCheck size={15} className="text-red-500" />
            {t("community.privacyLine")}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Metric icon={Flame} label={t("community.streak")} value={`${goal.streak}d`} />
          <Metric
            icon={Heart}
            label={t("community.likes")}
            value={goal.likes + (liked ? 1 : 0)}
          />
          <Metric icon={Star} label={t("community.rating")} value={rating.toFixed(1)} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-gray-100 py-3 dark:border-[#222]">
          <div className="flex items-center gap-2">
            <ActionButton
              active={liked}
              title={t("community.like")}
              onClick={() => onLike(goal.id)}
              icon={<Heart size={18} fill={liked ? "currentColor" : "none"} />}
            />
            <ActionButton
              title={t("community.share")}
              onClick={() => onShare(goal)}
              icon={<Share2 size={18} />}
            />
          </div>
          <RatingControl
            value={rating}
            label={t("community.rate")}
            onRate={(value) => onRate(goal.id, value)}
          />
        </div>

        <div className="space-y-3">
          {comments.slice(-3).map((comment, index) => (
            <div key={`${goal.id}-comment-${index}`} className="flex gap-2 text-sm">
              <MessageCircle size={16} className="mt-0.5 shrink-0 text-gray-400" />
              <p className="font-medium text-gray-600 dark:text-gray-300">
                {comment}
              </p>
            </div>
          ))}
          {!comments.length && (
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              {t("community.noComments")}
            </p>
          )}
        </div>

        <form onSubmit={submitComment} className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("community.commentPlaceholder")}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-red-500 dark:border-[#222] dark:bg-[#101010] dark:text-white"
          />
          <button
            type="submit"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 text-white transition hover:bg-red-700"
            title={t("community.send")}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </article>
  );
}

function Metric({ icon, value, label }) {
  const IconComponent = icon;

  return (
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-[#101010]">
      <IconComponent size={18} className="mb-2 text-red-500" />
      <p className="text-lg font-black text-slate-950 dark:text-white">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
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
          ? "bg-red-600 text-white"
          : "bg-gray-100 text-gray-500 hover:text-red-600 dark:bg-[#101010]"
      }`}
      title={title}
    >
      {icon}
    </button>
  );
}

function VideoCard({ video, t, saved, liked, onSave, onLike }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-[#222] dark:bg-[#151515] dark:shadow-none">
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
          <p className="text-[10px] font-black uppercase tracking-widest text-red-500">
            {video.username}
          </p>
          <h2 className="mt-1 text-2xl font-black italic text-slate-950 dark:text-white">
            {t(video.titleKey)}
          </h2>
          <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-300">
            {t(video.captionKey)}
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-[#222]">
          <button
            type="button"
            onClick={() => onLike(video.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
              liked
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-500 hover:text-red-600 dark:bg-[#101010]"
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
                ? "bg-slate-950 text-white dark:bg-red-600"
                : "bg-gray-100 text-gray-500 hover:text-red-600 dark:bg-[#101010]"
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

function ShareModal({ goals, sharedGoalIds, t, onClose, onShare }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-6 dark:border-[#222] dark:bg-[#111]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black uppercase italic text-slate-950 dark:text-white">
              {t("community.shareModalTitle")}
            </h2>
            <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              {t("community.shareModalCopy")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:text-red-600 dark:bg-[#191919]"
            title={t("common.cancel")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {goals.map((goal) => {
            const shared = sharedGoalIds.includes(goal.id);
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => onShare(goal)}
                className="flex w-full items-center gap-4 rounded-xl border border-gray-200 p-3 text-left transition hover:border-red-500 dark:border-[#222]"
              >
                <img
                  src={goal.image}
                  alt={goal.title}
                  className="h-16 w-20 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black italic text-slate-950 dark:text-white">
                    {goal.title}
                  </p>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                    {getProgress(goal).toFixed(1)}% / {t(getGoalRangeKey(goal.targetValue))}
                  </p>
                </div>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    shared ? "bg-red-600 text-white" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {shared ? <Check size={17} /> : <Share2 size={17} />}
                </span>
              </button>
            );
          })}
          {!goals.length && (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center dark:border-[#333]">
              <Car className="mx-auto mb-3 text-red-500" size={34} />
              <p className="font-bold uppercase italic text-gray-500">
                {t("community.noPersonalGoals")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Community({ cars = [], settings, user }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("feed");
  const [query, setQuery] = useState("");
  const [communityState, setCommunityState] = useState(
    engineDB.getDefaultCommunityState(),
  );
  const [communityGoals, setCommunityGoals] = useState([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const personalGoals = useMemo(
    () => buildUserGoals(cars, settings, user),
    [cars, settings, user],
  );

  const goals = communityGoals;

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
    const unsubscribe = engineDB.subscribeCommunityGoals(setCommunityGoals);
    return () => unsubscribe();
  }, []);

  const persistState = async (updater) => {
    setCommunityState((current) => {
      const next = updater(current);
      engineDB.saveCommunityState(next).catch((error) => console.error(error));
      return next;
    });
  };

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const filteredGoals = goals.filter((goal) =>
    `${goal.author} ${goal.title} ${goal.username}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  const ranking = [...goals]
    .sort((a, b) => {
      const aInteractions = communityState.interactions[a.id] || emptyInteraction;
      const bInteractions = communityState.interactions[b.id] || emptyInteraction;
      const scoreA =
        getProgress(a) * 2 +
        (a.likes + (aInteractions.liked ? 1 : 0)) / 12 +
        (aInteractions.rating || a.rating) * 8 +
        a.streak;
      const scoreB =
        getProgress(b) * 2 +
        (b.likes + (bInteractions.liked ? 1 : 0)) / 12 +
        (bInteractions.rating || b.rating) * 8 +
        b.streak;
      return scoreB - scoreA;
    })
    .slice(0, 5);

  const stats = goals.reduce(
    (acc, goal) => {
      acc.progress += getProgress(goal);
      acc.likes +=
        goal.likes + (communityState.interactions[goal.id]?.liked ? 1 : 0);
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

  const handleRate = (goalId, rating) => {
    engineDB.rateCommunityGoal(goalId, rating, user?.uid).catch((error) =>
      console.error(error),
    );
    flash(t("community.ratingSaved"));
  };

  const handleFollow = (username) => {
    persistState((current) => {
      const isFollowing = current.following.includes(username);
      return {
        ...current,
        following: isFollowing
          ? current.following.filter((item) => item !== username)
          : [...current.following, username],
      };
    });
  };

  const handleShare = async (goal) => {
    const shareText = `${t("community.shareText")} ${goal.title} - ${getProgress(
      goal,
    ).toFixed(1)}%`;

    try {
      await engineDB.shareCommunityGoal(goal, settings, user?.uid);

      persistState((current) => ({
        ...current,
        sharedGoalIds: current.sharedGoalIds.includes(goal.id)
          ? current.sharedGoalIds
          : [...current.sharedGoalIds, goal.id],
      }));

      if (navigator.share) {
        await navigator.share({
          title: "Engine Social",
          text: shareText,
          url: window.location.href,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
      }
      flash(t("community.sharedNotice"));
    } catch {
      flash(t("community.sharedDraftNotice"));
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
    <section className="space-y-8 pb-10">
      {notice && (
        <div className="fixed inset-x-4 top-4 z-50 rounded-xl bg-slate-950 px-5 py-3 text-center text-xs font-black uppercase tracking-widest text-white shadow-2xl sm:left-auto sm:right-6 sm:top-6 sm:text-sm dark:bg-red-600">
          {notice}
        </div>
      )}

      <header className="overflow-hidden rounded-2xl border border-gray-200 bg-white text-slate-950 shadow-xl dark:border-[#222] dark:bg-[#111] dark:text-white dark:shadow-none">
        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.35fr_0.65fr] lg:p-10">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest">
                  <Sparkles size={14} />
                  Engine Social
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.26em] text-gray-500 dark:text-gray-400">
                  {t("community.kicker")}
                </span>
              </div>
              <h1 className="max-w-3xl text-3xl font-black uppercase italic tracking-tight sm:text-5xl md:text-6xl">
                {t("community.title")}
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-gray-600 dark:text-gray-300">
                {t("community.subtitle")}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <HeroStat icon={Users} label={t("community.stats.goals")} value={goals.length} />
              <HeroStat icon={Heart} label={t("community.stats.interactions")} value={stats.likes} />
              <HeroStat
                icon={Award}
                label={t("community.stats.avg")}
                value={`${averageProgress.toFixed(0)}%`}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-[#222] dark:bg-[#151515] dark:shadow-none">
            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
              {t("community.publishTitle")}
            </p>
            <div className="space-y-4">
              {personalGoals.slice(0, 3).map(
                (goal) => {
                  const progress = getProgress(goal);
                  const shared = communityState.sharedGoalIds.includes(goal.id);
                  return (
                    <div
                      key={goal.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-[#222] dark:bg-[#101010]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white">
                        <Car size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black italic text-slate-950 dark:text-white">
                          {goal.title}
                        </p>
                        <div className="mt-2 h-1.5 rounded-full bg-gray-200 dark:bg-white/10">
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      {shared ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : (
                        <EyeOff size={18} className="text-gray-500" />
                      )}
                    </div>
                  );
                },
              )}
              {!personalGoals.length && (
                <div className="rounded-xl border border-dashed border-gray-200 p-5 text-center dark:border-[#333]">
                  <Car className="mx-auto mb-3 text-red-500" size={30} />
                  <p className="text-xs font-black uppercase italic text-gray-500">
                    {t("community.noPersonalGoals")}
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black uppercase italic text-white transition hover:bg-red-700"
            >
              <Plus size={18} />
              {t("community.shareNewGoal")}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 sm:w-fit dark:border-[#222] dark:bg-[#111]">
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
                    ? "bg-red-600 text-white"
                    : "text-gray-500 hover:text-red-600"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <label className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 lg:max-w-sm dark:border-[#222] dark:bg-[#111]">
          <Search size={18} className="text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("community.search")}
            className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none dark:text-white"
          />
        </label>
      </div>

      {activeTab === "feed" && (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
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
                  shared={communityState.sharedGoalIds.includes(goal.id)}
                  onLike={handleLike}
                  onComment={handleComment}
                  onRate={handleRate}
                  onShare={handleShare}
                  onFollow={handleFollow}
                />
              ))
            ) : (
              <EmptyFeed t={t} />
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
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
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
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center dark:border-[#333] dark:bg-[#151515]">
            <Clapperboard className="mb-4 text-red-500" size={44} />
            <h2 className="text-2xl font-black uppercase italic text-slate-950 dark:text-white">
              {t("community.videos.slotTitle")}
            </h2>
            <p className="mt-3 max-w-sm text-sm font-medium text-gray-500 dark:text-gray-400">
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
          t={t}
          onClose={() => setShareModalOpen(false)}
          onShare={handleShare}
        />
      )}
    </section>
  );
}

function HeroStat({ icon, value, label }) {
  const IconComponent = icon;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
      <IconComponent className="mb-3 text-red-400" size={20} />
      <p className="text-2xl font-black text-slate-950 dark:text-white">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
        {label}
      </p>
    </div>
  );
}

function EmptyFeed({ t }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center lg:col-span-2 xl:col-span-1 2xl:col-span-2 dark:border-[#333] dark:bg-[#151515]">
      <Search className="mb-4 text-red-500" size={40} />
      <h2 className="text-2xl font-black uppercase italic text-slate-950 dark:text-white">
        {t("community.noSearchResults")}
      </h2>
      <p className="mt-3 max-w-sm text-sm font-medium text-gray-500 dark:text-gray-400">
        {t("community.noSearchResultsCopy")}
      </p>
    </div>
  );
}

function SidebarRanking({ ranking, t }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-[#222] dark:bg-[#151515]">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase italic tracking-widest text-slate-950 dark:text-white">
        <Trophy size={18} className="text-red-500" />
        {t("community.weekTop")}
      </h2>
      <div className="space-y-3">
        {ranking.slice(0, 3).map((goal, index) => (
          <div key={goal.id} className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-xs font-black text-white">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                {goal.title}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {getProgress(goal).toFixed(0)}% / {goal.likes} likes
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
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-[#222] dark:bg-[#151515]">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase italic tracking-widest text-slate-950 dark:text-white">
        <UserPlus size={18} className="text-red-500" />
        {t("community.suggestions.title")}
      </h2>
      <div className="space-y-3">
        {friendSuggestions.map((friend) => {
          const isFollowing = following.includes(friend.handle);
          return (
            <div key={friend.handle} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950 dark:text-white">
                  {friend.name}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {t(friend.matchKey)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onFollow(friend.handle)}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                  isFollowing
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-red-600 hover:bg-red-600 hover:text-white dark:bg-[#101010]"
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
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-[#222] dark:bg-[#151515]">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tight text-slate-950 dark:text-white">
            {t("community.rankingTitle")}
          </h2>
          <p className="mt-1 text-sm font-medium text-gray-500">
            {t("community.rankingSubtitle")}
          </p>
        </div>
        <Trophy size={36} className="text-red-500" />
      </div>

      <div className="space-y-4">
        {ranking.map((goal, index) => {
          const progress = getProgress(goal);
          return (
            <div
              key={goal.id}
              className="grid gap-4 rounded-xl border border-gray-100 p-4 md:grid-cols-[64px_1fr_160px] md:items-center dark:border-[#222]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-950 text-xl font-black italic text-white dark:bg-red-600">
                #{index + 1}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black italic text-slate-950 dark:text-white">
                  {goal.title}
                </p>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {goal.author} / {goal.username}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-red-950/30">
                  <div
                    className="h-full rounded-full bg-red-600"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center md:grid-cols-1 md:text-right">
                <p className="text-sm font-black text-red-500">
                  {progress.toFixed(1)}%
                </p>
                <p className="text-sm font-black text-slate-950 dark:text-white">
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
