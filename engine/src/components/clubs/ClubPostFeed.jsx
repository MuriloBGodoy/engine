import { useEffect, useRef, useState } from "react";
import { Loader2, FileText } from "lucide-react";
import { useClubPosts, api } from "../../services/clubs";
import { ClubPostCard } from "./ClubPostCard";
import { useToast } from "../ToastProvider";
import { auth } from "../../services/firebase";

export function ClubPostFeed({ clubId }) {
  const showToast = useToast();
  const { posts, loading, error, hasMore, fetch } = useClubPosts(clubId);
  const [allPosts, setAllPosts] = useState([]);
  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState({});
  const observerTarget = useRef(null);

  // Initial load
  useEffect(() => {
    if (clubId) {
      setAllPosts([]);
      setOffset(0);
      fetch(20, 0);
    }
  }, [clubId]);

  // Update allPosts when posts change
  useEffect(() => {
    if (offset === 0) {
      setAllPosts(posts);
    } else {
      setAllPosts((prev) => [...prev, ...posts]);
    }
  }, [posts, offset]);

  // Infinite scroll observer
  useEffect(() => {
    if (!observerTarget.current || loading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const newOffset = offset + 20;
          setOffset(newOffset);
          fetch(20, newOffset);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [offset, loading, hasMore]);

  const handleLike = async (postId) => {
    try {
      await api.clubs.likePost(clubId, postId);
    } catch (error) {
      showToast("Erro ao dar like", "error");
      throw error;
    }
  };

  const handleDelete = async (postId) => {
    setDeleting((prev) => ({ ...prev, [postId]: true }));
    try {
      await api.clubs.deletePost(clubId, postId);
      setAllPosts((prev) => prev.filter((p) => p.id !== postId));
      showToast("Post deletado", "success");
    } catch (error) {
      showToast(error.message || "Erro ao deletar post", "error");
    } finally {
      setDeleting((prev) => ({ ...prev, [postId]: false }));
    }
  };

  // Error state
  if (error && allPosts.length === 0) {
    return (
      <div className="p-6 bg-red-500/20 border border-red-500/30 rounded-lg text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!loading && allPosts.length === 0 && !error) {
    return (
      <div className="text-center py-12">
        <FileText size={48} className="mx-auto text-[var(--engine-text-muted)] mb-4" />
        <p className="text-lg font-semibold text-[var(--engine-text)] mb-2">
          Nenhum post ainda
        </p>
        <p className="text-sm text-[var(--engine-text-muted)]">
          Seja o primeiro a postar neste clube!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Posts */}
      {allPosts.map((post) => (
        <ClubPostCard
          key={post.id}
          post={post}
          currentUserId={auth.currentUser?.uid}
          onLike={() => handleLike(post.id)}
          onDelete={() => handleDelete(post.id)}
          deleteLoading={deleting[post.id]}
        />
      ))}

      {/* Loading indicator for infinite scroll */}
      {loading && allPosts.length > 0 && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={24} className="animate-spin text-[var(--engine-accent)]" />
        </div>
      )}

      {/* Intersection observer target */}
      {hasMore && <div ref={observerTarget} className="h-4" />}

      {/* End of feed message */}
      {!hasMore && allPosts.length > 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-[var(--engine-text-muted)]">
            Você chegou ao final da página
          </p>
        </div>
      )}
    </div>
  );
}
