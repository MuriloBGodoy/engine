import { useState, useEffect } from "react";
import { Search, Filter, Loader2 } from "lucide-react";
import { useDiscoverClubs, api } from "../../services/clubs";
import { ClubCard } from "./ClubCard";
import { useToast } from "../ToastProvider";

const CATEGORIES = [
  { value: "", label: "Todas" },
  { value: "Classic Cars", label: "Classic Cars" },
  { value: "Hybrids", label: "Hybrids" },
  { value: "SUVs", label: "SUVs" },
  { value: "Racing", label: "Racing" },
];

const SORT_OPTIONS = [
  { value: "trending", label: "Trending" },
  { value: "new", label: "Novo" },
  { value: "members", label: "Mais Membros" },
];

export function ClubDiscoveryTab({ onSelectClub = null }) {
  const { showToast } = useToast();
  const { clubs, loading, error, fetch } = useDiscoverClubs();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("trending");
  const [offset, setOffset] = useState(0);
  const [allClubs, setAllClubs] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [joining, setJoining] = useState({});

  // Load clubs on filter change
  useEffect(() => {
    setOffset(0);
    loadClubs(0);
  }, [search, category, sort]);

  const loadClubs = async (newOffset = offset) => {
    try {
      await fetch({
        search: search || undefined,
        category: category || undefined,
        sort,
        limit: 20,
        offset: newOffset,
      });

      // The fetch updates the clubs state, but we need to append for "load more"
      // For now, we'll manage this manually
      // In production, use React Query for better pagination handling
    } catch (err) {
      showToast(err.message || "Erro ao carregar clubes", "error");
    }
  };

  useEffect(() => {
    if (offset === 0) {
      setAllClubs(clubs);
    } else {
      setAllClubs((prev) => [...prev, ...clubs]);
    }
    setHasMore(clubs.length === 20);
  }, [clubs, offset]);

  const handleLoadMore = () => {
    const newOffset = offset + 20;
    setOffset(newOffset);
    loadClubs(newOffset);
  };

  const handleJoinClub = async (clubId) => {
    setJoining((prev) => ({ ...prev, [clubId]: true }));
    try {
      await api.clubs.joinClub(clubId);
      showToast("Você entrou no clube com sucesso!", "success");
      // Reload clubs to update UI
      loadClubs(0);
    } catch (err) {
      showToast(err.message || "Erro ao entrar no clube", "error");
    } finally {
      setJoining((prev) => ({ ...prev, [clubId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search
            size={20}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--engine-text-muted)]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar clubes..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] text-[var(--engine-text)] placeholder-[var(--engine-text-subtle)] focus:outline-none focus:border-[var(--engine-accent)] transition"
          />
        </div>

        {/* Filter & Sort Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Category Filter */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[var(--engine-text-muted)] mb-2">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-[var(--engine-border)] bg-[var(--engine-surface-2)] text-[var(--engine-text)] focus:outline-none focus:border-[var(--engine-accent)] transition"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[var(--engine-text-muted)] mb-2">
              Ordenar por
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-[var(--engine-border)] bg-[var(--engine-surface-2)] text-[var(--engine-text)] focus:outline-none focus:border-[var(--engine-accent)] transition"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && allClubs.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-[var(--engine-accent)]" />
        </div>
      )}

      {/* Empty State */}
      {!loading && allClubs.length === 0 && !error && (
        <div className="text-center py-12">
          <Filter size={48} className="mx-auto text-[var(--engine-text-muted)] mb-4" />
          <p className="text-lg font-semibold text-[var(--engine-text)] mb-2">
            Nenhum clube encontrado
          </p>
          <p className="text-sm text-[var(--engine-text-muted)]">
            Tente ajustar seus filtros ou criar um novo clube
          </p>
        </div>
      )}

      {/* Clubs Grid */}
      {allClubs.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allClubs.map((club) => (
              <ClubCard
                key={club.id}
                club={club}
                isDiscovery={true}
                onJoin={handleJoinClub}
                joinLoading={joining[club.id]}
                onClick={onSelectClub}
              />
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-6">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-8 py-3 bg-[var(--engine-accent)] text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? "Carregando..." : "Carregar Mais"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
