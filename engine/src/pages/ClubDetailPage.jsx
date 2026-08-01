import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, FileText, Info, Plus, Loader2 } from "lucide-react";
import { useToast } from "../components/ToastProvider";
import {
  useClubDetail,
  useCreatePost,
  useToggleClubMembership,
  api,
} from "../services/clubs";
import { auth } from "../services/firebase";
import { ClubPostFeed } from "../components/clubs/ClubPostFeed";
import { ClubMemberList } from "../components/clubs/ClubMemberList";
import { CreatePostModal } from "../components/clubs/CreatePostModal";

export function ClubDetailPage() {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const { club, loading, error, isMember, fetch: fetchClub } = useClubDetail(clubId);
  const { create: createPost, loading: creatingPost } = useCreatePost(clubId);
  const { toggle: toggleMembership, loading: membershipLoading } =
    useToggleClubMembership(clubId);

  const [activeTab, setActiveTab] = useState("about");
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [currentIsMember, setCurrentIsMember] = useState(isMember);

  useEffect(() => {
    if (clubId) {
      fetchClub();
    }
  }, [clubId]);

  useEffect(() => {
    setCurrentIsMember(isMember);
  }, [isMember]);

  const handleJoinLeave = async () => {
    try {
      await toggleMembership(currentIsMember);
      setCurrentIsMember(!currentIsMember);
      showToast(
        currentIsMember ? "Você saiu do clube" : "Você entrou no clube!",
        "success"
      );
      fetchClub();
    } catch (error) {
      showToast(error.message || "Erro ao alterar membership", "error");
    }
  };

  const handleCreatePost = async (postData) => {
    try {
      await createPost(postData);
      showToast("Post criado com sucesso!", "success");
      // Refresh the posts
      setActiveTab("posts");
    } catch (error) {
      showToast(error.message || "Erro ao criar post", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-[var(--engine-accent)]" />
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate("/clubs")}
          className="inline-flex items-center gap-2 mb-6 text-[var(--engine-accent)] hover:opacity-80 transition"
        >
          <ArrowLeft size={20} />
          Voltar aos Clubes
        </button>

        <div className="p-6 bg-red-500/20 border border-red-500/30 rounded-lg text-center">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error || "Clube não encontrado"}
          </p>
        </div>
      </div>
    );
  }

  const isOwner = club.createdBy === auth.currentUser?.uid;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with Back Button */}
      <button
        onClick={() => navigate("/clubs")}
        className="inline-flex items-center gap-2 text-[var(--engine-accent)] hover:opacity-80 transition"
      >
        <ArrowLeft size={20} />
        Voltar aos Clubes
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Club Card */}
          <div className="rounded-xl bg-[var(--engine-surface)] border border-[var(--engine-border)] overflow-hidden">
            {/* Club Image */}
            <div className="h-48 bg-gradient-to-br from-[var(--engine-accent)] to-[var(--engine-border-strong)]">
              {club.imageUrl && (
                <img
                  src={club.imageUrl}
                  alt={club.name}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Club Info */}
            <div className="p-4 space-y-4">
              <div>
                <h1 className="text-2xl font-bold text-[var(--engine-text)]">
                  {club.name}
                </h1>
                {club.category && (
                  <span className="inline-block mt-2 px-3 py-1 bg-[var(--engine-accent)]/20 text-[var(--engine-accent)] rounded-full text-xs font-semibold">
                    {club.category}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="space-y-2 border-y border-[var(--engine-border)] py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--engine-text-muted)] flex items-center gap-2">
                    <Users size={16} />
                    Membros
                  </span>
                  <span className="font-semibold text-[var(--engine-text)]">
                    {club.memberCount || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--engine-text-muted)] flex items-center gap-2">
                    <FileText size={16} />
                    Posts
                  </span>
                  <span className="font-semibold text-[var(--engine-text)]">
                    {club.postCount || 0}
                  </span>
                </div>
              </div>

              {/* Creator Info */}
              <div>
                <p className="text-xs text-[var(--engine-text-muted)] mb-1">
                  Criado por
                </p>
                <p className="font-semibold text-[var(--engine-text)]">
                  {club.creatorName || "Anônimo"}
                </p>
              </div>

              {/* Public/Private Badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    club.isPublic
                      ? "bg-green-500/20 text-green-600 dark:text-green-400"
                      : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {club.isPublic ? "Público" : "Privado"}
                </span>
              </div>

              {/* Join/Leave Button */}
              {!isOwner && (
                <button
                  onClick={handleJoinLeave}
                  disabled={membershipLoading}
                  className={`w-full py-2 px-4 rounded-lg font-semibold transition disabled:opacity-50 ${
                    currentIsMember
                      ? "bg-[var(--engine-border)] text-[var(--engine-text)] hover:bg-[var(--engine-border-strong)]"
                      : "bg-[var(--engine-accent)] text-white hover:opacity-90"
                  }`}
                >
                  {membershipLoading
                    ? "Aguarde..."
                    : currentIsMember
                      ? "Sair do Clube"
                      : "Entrar no Clube"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-[var(--engine-border)]">
            {[
              { id: "about", label: "Sobre", icon: Info },
              { id: "posts", label: "Posts", icon: FileText },
              { id: "members", label: "Membros", icon: Users },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-2 px-4 py-3 font-semibold border-b-2 transition ${
                  activeTab === id
                    ? "border-[var(--engine-accent)] text-[var(--engine-accent)]"
                    : "border-transparent text-[var(--engine-text-muted)] hover:text-[var(--engine-text)]"
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {/* About Tab */}
            {activeTab === "about" && (
              <div className="rounded-xl bg-[var(--engine-surface)] border border-[var(--engine-border)] p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-[var(--engine-text)] mb-2">
                    Descrição
                  </h3>
                  <p className="text-[var(--engine-text-muted)] whitespace-pre-wrap">
                    {club.description || "Sem descrição"}
                  </p>
                </div>

                {club.tags && club.tags.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-[var(--engine-text)] mb-2">
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {club.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-[var(--engine-accent)]/20 text-[var(--engine-accent)] rounded-full text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {isOwner && (
                  <div className="pt-4 border-t border-[var(--engine-border)]">
                    <p className="text-sm text-[var(--engine-text-muted)] mb-2">
                      Você é o proprietário deste clube
                    </p>
                    <button className="px-4 py-2 bg-[var(--engine-surface-2)] text-[var(--engine-text)] rounded-lg hover:bg-[var(--engine-border)] transition">
                      Editar Clube
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Posts Tab */}
            {activeTab === "posts" && (
              <div className="space-y-4">
                {currentIsMember && (
                  <button
                    onClick={() => setShowCreatePostModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[var(--engine-accent)] text-white rounded-xl font-semibold hover:opacity-90 transition"
                  >
                    <Plus size={20} />
                    Novo Post
                  </button>
                )}

                {currentIsMember ? (
                  <ClubPostFeed clubId={clubId} />
                ) : (
                  <div className="text-center py-12 rounded-xl bg-[var(--engine-surface)] border border-[var(--engine-border)]">
                    <p className="text-lg font-semibold text-[var(--engine-text)] mb-2">
                      Você precisa entrar no clube para ver os posts
                    </p>
                    <p className="text-sm text-[var(--engine-text-muted)]">
                      Clique em "Entrar no Clube" na barra lateral
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Members Tab */}
            {activeTab === "members" && <ClubMemberList clubId={clubId} />}
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      {currentIsMember && (
        <CreatePostModal
          isOpen={showCreatePostModal}
          onClose={() => setShowCreatePostModal(false)}
          onCreate={handleCreatePost}
          loading={creatingPost}
        />
      )}
    </div>
  );
}
