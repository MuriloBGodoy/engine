import { Heart, Trash2, MessageCircle } from "lucide-react";
import { useState } from "react";

export function ClubPostCard({
  post,
  currentUserId,
  onLike,
  onDelete,
  likeLoading = false,
  deleteLoading = false,
}) {
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likeCount, setLikeCount] = useState(post.likes || 0);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (likeLoading) return;

    setIsLiked(!isLiked);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));

    try {
      await onLike(post.id);
    } catch (error) {
      // Revert on error
      setIsLiked(isLiked);
      setLikeCount((prev) => (isLiked ? prev + 1 : prev - 1));
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (window.confirm("Tem certeza que deseja deletar este post?")) {
      try {
        await onDelete(post.id);
      } catch (error) {
        console.error("Erro ao deletar post:", error);
      }
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";

    const date =
      typeof timestamp === "string"
        ? new Date(timestamp)
        : timestamp.toDate?.() || new Date(timestamp);

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;

    return date.toLocaleDateString("pt-BR");
  };

  const isAuthor = currentUserId === post.authorId;

  return (
    <div className="rounded-xl bg-[var(--engine-surface)] border border-[var(--engine-border)] p-4 hover:shadow-md transition">
      {/* Author Info */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {post.authorAvatar ? (
            <img
              src={post.authorAvatar}
              alt={post.authorName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--engine-accent)] to-[var(--engine-border-strong)] flex items-center justify-center text-white font-semibold text-sm">
              {post.authorName?.charAt(0)?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-[var(--engine-text)] truncate">
              {post.authorName || "Anônimo"}
            </p>
            <p className="text-xs text-[var(--engine-text-muted)]">
              {formatDate(post.createdAt)}
            </p>
          </div>
        </div>

        {/* Delete Button (Author Only) */}
        {isAuthor && (
          <button
            onClick={handleDelete}
            disabled={deleteLoading}
            className="ml-2 p-2 text-[var(--engine-text-muted)] hover:text-red-500 transition disabled:opacity-50"
            title="Deletar post"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-[var(--engine-text)] mb-3 whitespace-pre-wrap break-words text-sm">
        {post.content}
      </p>

      {/* Images */}
      {post.imageUrls && post.imageUrls.length > 0 && (
        <div className="mb-3">
          {post.imageUrls.length === 1 ? (
            <img
              src={post.imageUrls[0]}
              alt="Post image"
              className="w-full rounded-lg object-cover max-h-96"
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {post.imageUrls.slice(0, 4).map((url, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={url}
                    alt={`Post image ${idx + 1}`}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  {idx === 3 && post.imageUrls.length > 4 && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <span className="text-white font-semibold">
                        +{post.imageUrls.length - 4}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-3 border-t border-[var(--engine-border)] text-sm">
        {/* Like Button */}
        <button
          onClick={handleLike}
          disabled={likeLoading}
          className={`flex items-center gap-2 transition disabled:opacity-50 ${
            isLiked
              ? "text-[var(--engine-accent)]"
              : "text-[var(--engine-text-muted)] hover:text-[var(--engine-accent)]"
          }`}
        >
          <Heart
            size={18}
            className={isLiked ? "fill-current" : ""}
          />
          <span>{likeCount}</span>
        </button>

        {/* Comment (Placeholder for Phase 2) */}
        <div className="flex items-center gap-2 text-[var(--engine-text-muted)]">
          <MessageCircle size={18} />
          <span>{post.commentCount || 0}</span>
        </div>
      </div>
    </div>
  );
}
