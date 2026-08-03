import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Heart,
  MessageCircle,
  Share2,
  Users,
  Trophy,
  ArrowLeft,
  UserPlus,
  UserCheck,
  Mail,
} from "lucide-react";
import { engineDB } from "../services/db";
import { auth } from "../services/firebase";

const fallbackImage =
  "https://images.unsplash.com/photo-1598209279122-8541213a0387?q=80&w=900";

function FollowingUserCard({ userId }) {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const unsubscribe = engineDB.subscribePublicProfiles((profiles) => {
      const user = profiles[userId];
      if (user) {
        setUserData(user);
      }
    });

    return () => unsubscribe?.();
  }, [userId]);

  if (!userData) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--engine-border)] p-3 animate-pulse">
        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-[var(--engine-surface-2)]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-[var(--engine-surface-2)]" />
          <div className="h-2 w-32 rounded bg-[var(--engine-surface-2)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--engine-border)] p-3 transition hover:bg-[var(--engine-surface-2)]">
      {userData.avatar ? (
        <img
          src={userData.avatar}
          alt={userData.author}
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-[var(--engine-surface-2)] flex items-center justify-center text-xs font-bold">
          {userData.avatarInitials || "EN"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--engine-text)]">
          {userData.author || "Usuário Engine"}
        </p>
        <p className="text-xs text-[var(--engine-text-muted)]">
          @{userData.username || "user"}
        </p>
      </div>
    </div>
  );
}

export function UserProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const currentUserId = auth.currentUser?.uid;

  const [profile, setProfile] = useState(null);
  const [userGoals, setUserGoals] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [loading, setLoading] = useState(true);
  const [myFollowing, setMyFollowing] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const cleanUsername = username?.startsWith("@") ? username.slice(1) : username;

        // Subscribe to public profiles to find the user
        const unsubscribe = engineDB.subscribePublicProfiles((profiles) => {
          const userProfile = Object.values(profiles || {}).find(
            (p) => (p.username || "").toLowerCase() === cleanUsername?.toLowerCase()
          );

          if (!userProfile) {
            navigate("/community");
            return;
          }

          setProfile(userProfile);

          // Fetch user's goals, followers, and following
          Promise.all([
            engineDB.getUserGoals(userProfile.userId),
            engineDB.getUserFollowers(userProfile.userId),
            engineDB.getUserFollowing(userProfile.userId),
          ]).then(([goals, followers, following]) => {
            setUserGoals(goals || []);
            setFollowers(followers || []);
            setFollowing(following || []);
          });

          // Check if current user follows this profile
          if (currentUserId) {
            engineDB.getUserFollowing(currentUserId).then((currentFollowing) => {
              setMyFollowing(currentFollowing || []);
              setIsFollowing((currentFollowing || []).includes(userProfile.userId));
            });
          }

          setLoading(false);
        });

        return () => unsubscribe?.();
      } catch (error) {
        console.error("Error loading user profile:", error);
        setLoading(false);
      }
    })();
  }, [username, currentUserId, navigate]);

  const handleFollow = async () => {
    if (!currentUserId || !profile) return;
    try {
      if (isFollowing) {
        await engineDB.unfollowUser(currentUserId, profile.userId);
      } else {
        await engineDB.followUser(currentUserId, profile.userId);
      }
      setIsFollowing(!isFollowing);
    } catch (error) {
      console.error("Error updating follow status:", error);
    }
  };

  const handleMessage = async () => {
    if (!currentUserId || !profile) return;
    try {
      // Navigate to messages - conversation creation can happen on the Messages page
      navigate(`/messages?user=${profile.userId}`);
    } catch (error) {
      console.error("Error starting conversation:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--engine-text-muted)]">{t("common.loading")}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p className="mb-4 text-[var(--engine-text)]">Usuário não encontrado</p>
        <button
          onClick={() => navigate("/community")}
          className="text-[var(--engine-accent)] hover:underline"
        >
          Voltar para Comunidade
        </button>
      </div>
    );
  }

  const coverImage = profile.coverImage || fallbackImage;
  const avatar = profile.avatar || null;
  const initials = profile.author
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "EN";

  return (
    <div className="min-h-screen bg-[var(--engine-bg)]">
      {/* Header Sticky */}
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-[var(--engine-border)] bg-[var(--engine-surface)]/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <button
          onClick={() => navigate("/community")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--engine-border)] text-[var(--engine-text-muted)] transition hover:border-[var(--engine-accent)] hover:text-[var(--engine-accent)]"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="flex-1 truncate text-sm font-bold text-[var(--engine-text)]">
          {profile.author || "Usuário Engine"}
        </h1>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 lg:py-8">
        {/* Hero Section */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-[var(--engine-surface)]">
          {/* Cover Image */}
          <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[var(--engine-accent)] to-[var(--engine-accent)]/70 sm:h-56 lg:h-64">
            {coverImage && (
              <img
                src={coverImage}
                alt="Cover"
                className="h-full w-full object-cover"
              />
            )}
          </div>

          {/* Avatar & Info */}
          <div className="px-6 pb-6 pt-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
                {/* Avatar */}
                <div className="relative -mt-16 h-28 w-28 overflow-hidden rounded-2xl border-4 border-[var(--engine-surface)] bg-[var(--engine-surface-2)] sm:h-32 sm:w-32">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={profile.author}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-[var(--engine-text-muted)]">
                      {initials}
                    </div>
                  )}
                </div>

                {/* Name & Username */}
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-[var(--engine-text)] sm:text-2xl">
                    {profile.author || "Usuário Engine"}
                  </h2>
                  <p className="text-sm font-medium text-[var(--engine-text-muted)]">
                    @{profile.username || "engine"}
                  </p>
                  {profile.city && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-[var(--engine-text-subtle)]">
                      📍 {profile.city}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex w-full gap-2 sm:w-auto">
                {currentUserId && currentUserId !== profile.userId && (
                  <>
                    <button
                      onClick={handleFollow}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition sm:flex-initial ${
                        isFollowing
                          ? "border border-[var(--engine-border)] text-[var(--engine-text-muted)] hover:border-[var(--engine-accent)] hover:text-[var(--engine-accent)]"
                          : "bg-[var(--engine-accent)] text-white hover:brightness-95"
                      }`}
                    >
                      {isFollowing ? (
                        <UserCheck size={14} />
                      ) : (
                        <UserPlus size={14} />
                      )}
                      {isFollowing ? "Seguindo" : "Seguir"}
                    </button>
                    <button
                      onClick={handleMessage}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--engine-border)] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--engine-text-muted)] transition hover:border-[var(--engine-accent)] hover:text-[var(--engine-accent)] sm:flex-initial"
                    >
                      <Mail size={14} />
                      <span className="hidden min-[420px]:inline">Mensagem</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="mt-4 text-sm text-[var(--engine-text)]">
                {profile.bio}
              </p>
            )}

            {/* Stats */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-[var(--engine-border)] p-3 text-center transition hover:border-[var(--engine-accent)] hover:bg-[var(--engine-surface-2)]">
                <p className="text-lg font-bold text-[var(--engine-accent)]">
                  {userGoals.length}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--engine-text-muted)]">
                  Metas
                </p>
              </div>
              <div className="rounded-xl border border-[var(--engine-border)] p-3 text-center transition hover:border-[var(--engine-accent)] hover:bg-[var(--engine-surface-2)]">
                <p className="text-lg font-bold text-[var(--engine-accent)]">
                  {followers.length}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--engine-text-muted)]">
                  Seguidores
                </p>
              </div>
              <div className="rounded-xl border border-[var(--engine-border)] p-3 text-center transition hover:border-[var(--engine-accent)] hover:bg-[var(--engine-surface-2)]">
                <p className="text-lg font-bold text-[var(--engine-accent)]">
                  {following.length}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--engine-text-muted)]">
                  Seguindo
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-[var(--engine-border)]">
          {[
            { id: "posts", label: "Metas", icon: "🎯" },
            { id: "followers", label: "Seguidores", icon: "👥" },
            { id: "following", label: "Seguindo", icon: "✔️" },
            { id: "achievements", label: "Conquistas", icon: "🏆" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "border-[var(--engine-accent)] text-[var(--engine-accent)]"
                  : "border-transparent text-[var(--engine-text-muted)] hover:text-[var(--engine-text)]"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "posts" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {userGoals.length ? (
                userGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="rounded-xl border border-[var(--engine-border)] p-4 transition hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-2xl">🚗</span>
                      <span className="text-xs font-bold uppercase tracking-wide text-[var(--engine-text-muted)]">
                        Meta
                      </span>
                    </div>
                    <h3 className="mb-2 font-bold text-[var(--engine-text)]">
                      {goal.title || `${goal.brand} ${goal.model}`}
                    </h3>
                    <div className="mb-3 space-y-1 text-xs text-[var(--engine-text-muted)]">
                      <p>
                        Alvo: R${
                          goal.targetValue
                            ? (goal.targetValue / 1000).toFixed(1)
                            : "—"
                        }k
                      </p>
                      <p>
                        Poupado: R${
                          goal.savedValue ? (goal.savedValue / 1000).toFixed(1) : "0"
                        }k
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--engine-surface-2)]">
                      <div
                        className="h-full bg-[var(--engine-accent)]"
                        style={{
                          width: `${Math.min(
                            (goal.savedValue / goal.targetValue) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 flex min-h-48 flex-col items-center justify-center text-center">
                  <p className="text-sm font-bold text-[var(--engine-text)]">
                    Nenhuma meta compartilhada
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "followers" && (
            <div className="grid gap-3">
              {followers.length ? (
                followers.map((follower) => (
                  <div
                    key={follower.userId || follower.followerId}
                    className="flex items-center gap-3 rounded-xl border border-[var(--engine-border)] p-3 transition hover:bg-[var(--engine-surface-2)]"
                  >
                    {follower.avatar ? (
                      <img
                        src={follower.avatar}
                        alt={follower.author}
                        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 flex-shrink-0 rounded-full bg-[var(--engine-surface-2)] flex items-center justify-center text-xs font-bold">
                        {follower.avatarInitials || "EN"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[var(--engine-text)]">
                        {follower.author || "Usuário Engine"}
                      </p>
                      <p className="text-xs text-[var(--engine-text-muted)]">
                        @{follower.username || "user"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex min-h-48 flex-col items-center justify-center text-center">
                  <Users size={40} className="mb-3 text-[var(--engine-text-subtle)]" />
                  <p className="text-sm font-bold text-[var(--engine-text)]">
                    Sem seguidores ainda
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "following" && (
            <div className="grid gap-3">
              {following.length ? (
                following.map((userId) => (
                  <FollowingUserCard key={userId} userId={userId} />
                ))
              ) : (
                <div className="flex min-h-48 flex-col items-center justify-center text-center">
                  <Users size={40} className="mb-3 text-[var(--engine-text-subtle)]" />
                  <p className="text-sm font-bold text-[var(--engine-text)]">
                    Não segue ninguém ainda
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "achievements" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-[var(--engine-border)] p-4">
                <span className="text-3xl">🏆</span>
                <div>
                  <p className="font-bold text-[var(--engine-text)]">
                    Primeira Meta
                  </p>
                  <p className="text-xs text-[var(--engine-text-muted)]">
                    Desbloqueado
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
