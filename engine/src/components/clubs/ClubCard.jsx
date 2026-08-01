import { useNavigate } from "react-router-dom";
import { Users, FileText } from "lucide-react";

export function ClubCard({ club, onJoin, isDiscovery = false, joinLoading = false, onClick = null }) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (onClick) {
      onClick(club.id);
    } else if (!isDiscovery) {
      navigate(`/clubs/${club.id}`);
    }
  };

  const handleJoinClick = async (e) => {
    e.stopPropagation();
    if (onJoin) {
      await onJoin(club.id);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`rounded-xl bg-[var(--engine-surface)] border border-[var(--engine-border)] shadow hover:shadow-lg transition overflow-hidden group ${
        isDiscovery ? "" : "cursor-pointer"
      }`}
    >
      {/* Club Avatar/Image */}
      <div className="relative h-40 bg-gradient-to-br from-[var(--engine-accent)] to-[var(--engine-border-strong)] overflow-hidden">
        {club.imageUrl ? (
          <img
            src={club.imageUrl}
            alt={club.name}
            className="w-full h-full object-cover group-hover:scale-105 transition"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[var(--engine-surface-2)]" />
        )}
        {club.category && (
          <div className="absolute top-3 right-3 bg-[var(--engine-accent)] text-white px-3 py-1 rounded-lg text-xs font-semibold">
            {club.category}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Name */}
        <h3 className="font-semibold text-lg text-[var(--engine-text)] truncate">
          {club.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-[var(--engine-text-muted)] mb-3 line-clamp-2">
          {club.description || "Sem descrição"}
        </p>

        {/* Stats */}
        <div className="space-y-2 text-sm mb-4">
          <div className="flex items-center gap-2 text-[var(--engine-text-muted)]">
            <Users size={16} className="text-[var(--engine-accent)]" />
            <span>
              {club.memberCount || 0} membro{club.memberCount !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[var(--engine-text-muted)]">
            <FileText size={16} className="text-[var(--engine-accent)]" />
            <span>
              {club.postCount || 0} post{club.postCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Join Button (Discovery mode) */}
        {isDiscovery && (
          <button
            onClick={handleJoinClick}
            disabled={joinLoading}
            className="w-full py-2 px-4 bg-[var(--engine-accent)] text-white rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {joinLoading ? "Entrando..." : "Entrar"}
          </button>
        )}
      </div>
    </div>
  );
}
