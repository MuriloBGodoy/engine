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
import { EditProfileModal } from "../components/EditProfileModal";

// Banner will be solid color gradient - no default image
const DEFAULT_BANNER_GRADIENT = "from-[var(--engine-accent)] to-[var(--engine-accent)]/70";

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
          {(userData.username || "user").replace(/^@/, "") ? `@${(userData.username || "user").replace(/^@/, "")}` : "@user"}
        </p>
      </div>
    </div>
  );
}

export function UserProfile({ settings = {}, user = null }) {
  const { identifier } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const currentUserId = user?.uid || auth.currentUser?.uid;

  const [profile, setProfile] = useState(null);
  const [userGoals, setUserGoals] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [loading, setLoading] = useState(true);
  const [myFollowing, setMyFollowing] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const isOwnProfile = currentUserId === profile?.userId;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const cleanUsername = identifier?.replace(/^@/, "").toLowerCase().trim() || "";

        if (!cleanUsername) {
          navigate("/community");
          return;
        }

        // Subscribe to public profiles to find the user
        const unsubscribe = engineDB.subscribePublicProfiles((profiles) => {
          const userProfile = Object.values(profiles || {}).find(
            (p) => (p.username || "").replace(/^@/, "").toLowerCase() === cleanUsername
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
  }, [identifier, currentUserId, navigate]);

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

  const coverImage = profile.coverImage || null;
  const avatar = profile.avatar || null;
  const initials = profile.author
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "EN";

  return (
    <div className="min-h-screen bg-[var(--engine-bg)]">
      {/* Header com Back Button */}
      <div className="sticky top-0 z-40 border-b border-[var(--engine-border)] bg-[var(--engine-surface)]/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => navigate("/community")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--engine-text-muted)] transition hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-accent)]"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-sm font-bold text-[var(--engine-text)]">
            {profile.author || "Usuário"}
          </h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        {/* Profile Info - Instagram Style */}
        <div className="border-b border-[var(--engine-border)] px-4 py-6 sm:px-6">
          {/* Avatar + Name/Username Row */}
          <div className="mb-4 flex items-start gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-2 border-[var(--engine-border)] bg-[var(--engine-surface-2)] sm:h-24 sm:w-24">
              {avatar ? (
                <img
                  src={avatar}
                  alt={profile.author}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[var(--engine-text-muted)] sm:text-3xl">
                  {initials}
                </div>
              )}
            </div>

            {/* Stats - next to avatar on desktop, below on mobile */}
            <div className="flex-1">
              <div className="mb-3 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="text-center">
                  <p className="text-lg font-black text-[var(--engine-accent)] sm:text-xl">
                    {userGoals.length}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-[var(--engine-text-muted)] sm:text-[11px]">
                    Metas
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-[var(--engine-accent)] sm:text-xl">
                    {followers.length}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-[var(--engine-text-muted)] sm:text-[11px]">
                    Seguidores
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-[var(--engine-accent)] sm:text-xl">
                    {following.length}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-[var(--engine-text-muted)] sm:text-[11px]">
                    Seguindo
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Name & Username */}
          <div className="mb-3">
            <h2 className="text-base font-black text-[var(--engine-text)] sm:text-lg">
              {profile.author || "Usuário Engine"}
            </h2>
            <p className="text-sm font-medium text-[var(--engine-text-muted)]">
              {(profile.username || "engine").replace(/^@/, "") ? `@${(profile.username || "engine").replace(/^@/, "")}` : "@engine"}
            </p>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mb-4 text-sm text-[var(--engine-text)] leading-relaxed">
              {profile.bio}
            </p>
          )}

          {/* Location */}
          {profile.city && (
            <p className="mb-4 text-xs text-[var(--engine-text-muted)]">
              {profile.city}
            </p>
          )}

          {/* Action Buttons - Full width on mobile */}
          <div className="flex w-full gap-2 sm:gap-3">
            {isOwnProfile ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 rounded-lg bg-[var(--engine-accent)] py-2 text-xs font-black uppercase tracking-wide text-white transition hover:brightness-95 sm:py-2.5"
              >
                Editar Perfil
              </button>
            ) : currentUserId && currentUserId !== profile?.userId && (
              <>
                <button
                  onClick={handleFollow}
                  className={`flex-1 rounded-lg py-2 text-xs font-black uppercase tracking-wide transition sm:py-2.5 ${
                    isFollowing
                      ? "border border-[var(--engine-border)] text-[var(--engine-text-muted)] hover:border-[var(--engine-accent)] hover:text-[var(--engine-accent)]"
                      : "bg-[var(--engine-accent)] text-white hover:brightness-95"
                  }`}
                >
                  {isFollowing ? "Seguindo" : "Seguir"}
                </button>
                <button
                  onClick={handleMessage}
                  className="flex-1 rounded-lg border border-[var(--engine-border)] py-2 text-xs font-black uppercase tracking-wide text-[var(--engine-text-muted)] transition hover:border-[var(--engine-accent)] hover:text-[var(--engine-accent)] sm:py-2.5"
                >
                  Mensagem
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[var(--engine-border)]">
          <div className="flex gap-6 overflow-x-auto px-4 sm:px-6">
            {[
              { id: "posts", label: "Metas" },
              { id: "followers", label: "Seguidores" },
              { id: "following", label: "Seguindo" },
              { id: "achievements", label: "Conquistas" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 py-4 text-sm font-bold uppercase tracking-wide transition ${
                  activeTab === tab.id
                    ? "border-[var(--engine-accent)] text-[var(--engine-accent)]"
                    : "border-transparent text-[var(--engine-text-muted)] hover:text-[var(--engine-text)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 py-6 sm:px-6">
          {activeTab === "posts" && (
            <div>
              {userGoals.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {userGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="group overflow-hidden rounded-lg border border-[var(--engine-border)] bg-[var(--engine-surface-2)] p-3 transition hover:border-[var(--engine-accent)]"
                    >
                      <div className="mb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--engine-text-muted)]">
                          Meta
                        </h3>
                        <p className="mt-1 line-clamp-2 text-sm font-bold text-[var(--engine-text)]">
                          {goal.title || `${goal.brand} ${goal.model}`}
                        </p>
                      </div>
                      <div className="mb-3 space-y-1 text-xs text-[var(--engine-text-muted)]">
                        <p>
                          Alvo: R${goal.targetValue ? (goal.targetValue / 1000).toFixed(1) : "—"}k
                        </p>
                        <p>
                          Poupado: R${goal.savedValue ? (goal.savedValue / 1000).toFixed(1) : "0"}k
                        </p>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--engine-border)]">
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
                  ))}
                </div>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <p className="text-sm font-bold text-[var(--engine-text)]">
                    Nenhuma meta compartilhada
                  </p>
                  <p className="mt-1 text-xs text-[var(--engine-text-muted)]">
                    {isOwnProfile ? "Crie uma meta na Garagem" : "Este usuário não compartilhou metas"}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "followers" && (
            <div className="space-y-3">
              {followers.length ? (
                followers.map((follower) => (
                  <div
                    key={follower.userId || follower.followerId}
                    className="flex items-center gap-3 rounded-lg border border-[var(--engine-border)] p-3 transition hover:bg-[var(--engine-surface-2)]"
                  >
                    {follower.avatar ? (
                      <img
                        src={follower.avatar}
                        alt={follower.author}
                        className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 flex-shrink-0 rounded-full bg-[var(--engine-surface-2)] flex items-center justify-center text-xs font-bold">
                        {follower.avatarInitials || "EN"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[var(--engine-text)]">
                        {follower.author || "Usuário Engine"}
                      </p>
                      <p className="text-xs text-[var(--engine-text-muted)]">
                        {(follower.username || "user").replace(/^@/, "") ? `@${(follower.username || "user").replace(/^@/, "")}` : "@user"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <Users size={48} className="mb-3 text-[var(--engine-text-subtle)]" />
                  <p className="text-sm font-bold text-[var(--engine-text)]">
                    Sem seguidores ainda
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "following" && (
            <div className="space-y-3">
              {following.length ? (
                following.map((userId) => (
                  <FollowingUserCard key={userId} userId={userId} />
                ))
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <Users size={48} className="mb-3 text-[var(--engine-text-subtle)]" />
                  <p className="text-sm font-bold text-[var(--engine-text)]">
                    Não segue ninguém ainda
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "achievements" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg border border-[var(--engine-border)] p-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--engine-accent)]/10">
                  <Trophy size={24} className="text-[var(--engine-accent)]" />
                </div>
                <div>
                  <p className="font-bold text-[var(--engine-text)]">Primeira Meta</p>
                  <p className="text-xs text-[var(--engine-text-muted)]">Desbloqueado</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isEditing && (
        <EditProfileModal
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          profileSettings={settings.profile || profile}
          onSave={(updated) => {
            setProfile(prev => ({ ...prev, ...updated }));
          }}
        />
      )}
    </div>
  );
}
