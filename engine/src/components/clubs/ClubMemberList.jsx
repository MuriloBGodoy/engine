import { useEffect, useRef, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { useClubMembers } from "../../services/clubs";
import { useToast } from "../ToastProvider";

export function ClubMemberList({ clubId }) {
  const { showToast } = useToast();
  const { members, loading, error, hasMore, fetch } = useClubMembers(clubId);
  const [allMembers, setAllMembers] = useState([]);
  const [offset, setOffset] = useState(0);
  const observerTarget = useRef(null);

  // Initial load
  useEffect(() => {
    if (clubId) {
      setAllMembers([]);
      setOffset(0);
      fetch(50, 0);
    }
  }, [clubId]);

  // Update allMembers when members change
  useEffect(() => {
    if (offset === 0) {
      setAllMembers(members);
    } else {
      setAllMembers((prev) => [...prev, ...members]);
    }
  }, [members, offset]);

  // Infinite scroll observer
  useEffect(() => {
    if (!observerTarget.current || loading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const newOffset = offset + 50;
          setOffset(newOffset);
          fetch(50, newOffset);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [offset, loading, hasMore]);

  const getRoleLabel = (role) => {
    const labels = {
      owner: "Proprietário",
      moderator: "Moderador",
      member: "Membro",
    };
    return labels[role] || role;
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "owner":
        return "bg-[var(--engine-accent)]/20 text-[var(--engine-accent)]";
      case "moderator":
        return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
      default:
        return "bg-[var(--engine-border)] text-[var(--engine-text-muted)]";
    }
  };

  // Error state
  if (error && allMembers.length === 0) {
    return (
      <div className="p-6 bg-red-500/20 border border-red-500/30 rounded-lg text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!loading && allMembers.length === 0 && !error) {
    return (
      <div className="text-center py-12">
        <Users size={48} className="mx-auto text-[var(--engine-text-muted)] mb-4" />
        <p className="text-lg font-semibold text-[var(--engine-text)] mb-2">
          Nenhum membro ainda
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Members List */}
      {allMembers.map((member) => (
        <div
          key={member.userId}
          className="rounded-lg bg-[var(--engine-surface-2)] p-4 flex items-center justify-between hover:bg-[var(--engine-surface)] transition"
        >
          {/* Member Info */}
          <div className="flex items-center gap-3 min-w-0">
            {member.userAvatar ? (
              <img
                src={member.userAvatar}
                alt={member.userName}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--engine-accent)] to-[var(--engine-border-strong)] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {member.userName?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-[var(--engine-text)] truncate">
                {member.userName || "Anônimo"}
              </p>
              <p className="text-xs text-[var(--engine-text-muted)]">
                Entrou em{" "}
                {new Date(member.joinedAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>

          {/* Role Badge */}
          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${getRoleColor(
              member.role
            )}`}
          >
            {getRoleLabel(member.role)}
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {loading && allMembers.length > 0 && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={24} className="animate-spin text-[var(--engine-accent)]" />
        </div>
      )}

      {/* Intersection observer target */}
      {hasMore && <div ref={observerTarget} className="h-4" />}

      {/* End of list message */}
      {!hasMore && allMembers.length > 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-[var(--engine-text-muted)]">
            Total de {allMembers.length} membro{allMembers.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
