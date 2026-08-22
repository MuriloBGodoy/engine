import { useState, useMemo, useEffect } from "react";
import { Plus } from "lucide-react";
import { useMyClubs, useCreateClub } from "../../services/clubs";
import { useToast } from "../ToastProvider";
import { ClubCard } from "../clubs/ClubCard";
import { ClubCreateModal } from "../clubs/ClubCreateModal";
import { ClubDiscoveryTab } from "../clubs/ClubDiscoveryTab";
import { ClubDetailModal } from "../clubs/ClubDetailModal";

export function ClubsTab({ searchParams, setSearchParams }) {
  const showToast = useToast();
  const { clubs, loading, error, fetch } = useMyClubs();
  const { create: createClub, loading: creatingClub } = useCreateClub();

  const [activeSubTab, setActiveSubTab] = useState("my-clubs");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Get club ID from URL params for modal
  const selectedClubId = searchParams.get("club");

  // Fetch my clubs on mount
  useEffect(() => {
    fetch();
  }, []);

  const handleCreateClub = async (clubData) => {
    try {
      const newClub = await createClub(clubData);
      showToast("Clube criado com sucesso!", "success");
      setShowCreateModal(false);
      // Reload clubs
      fetch();
      // Open the new club's detail
      const params = new URLSearchParams(searchParams);
      params.set("tab", "clubes");
      params.set("club", newClub.id);
      setSearchParams(params);
    } catch (error) {
      showToast(error.message || "Erro ao criar clube", "error");
    }
  };

  const handleClubSelect = (clubId) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", "clubes");
    params.set("club", clubId);
    setSearchParams(params);
  };

  const handleCloseDetail = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("club");
    setSearchParams(params);
  };

  const handleClubCardClick = (clubId) => {
    handleClubSelect(clubId);
  };

  return (
    <div className="space-y-4">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 border-b border-[var(--engine-border)] flex-1">
          {[
            { id: "my-clubs", label: "Meus Clubes" },
            { id: "discover", label: "Descobrir" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveSubTab(id)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                activeSubTab === id
                  ? "border-[var(--engine-accent)] text-[var(--engine-accent)]"
                  : "border-transparent text-[var(--engine-text-muted)] hover:text-[var(--engine-text)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Create Club Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--engine-accent)] text-white rounded-xl font-semibold hover:opacity-90 transition whitespace-nowrap shrink-0"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Criar</span>
        </button>
      </div>

      {/* My Clubs Tab */}
      {activeSubTab === "my-clubs" && (
        <div className="space-y-4">
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {loading && clubs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-[var(--engine-text-muted)]">Carregando clubes...</p>
            </div>
          ) : clubs.length === 0 ? (
            <div className="text-center py-8 rounded-xl bg-[var(--engine-surface)] border border-[var(--engine-border)]">
              <Plus size={40} className="mx-auto text-[var(--engine-text-muted)] mb-3" />
              <p className="text-sm font-semibold text-[var(--engine-text)] mb-2">
                Você ainda não está em nenhum clube
              </p>
              <p className="text-xs text-[var(--engine-text-muted)] mb-4">
                Crie um novo ou descubra clubes existentes
              </p>
              <button
                onClick={() => setActiveSubTab("discover")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--engine-accent)] text-white rounded-lg font-semibold hover:opacity-90 transition text-sm"
              >
                Descobrir Clubes
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clubs.map((club) => (
                <button
                  key={club.id}
                  onClick={() => handleClubCardClick(club.id)}
                  className="text-left hover:opacity-90 transition"
                >
                  <ClubCard club={club} isDiscovery={false} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Discover Tab */}
      {activeSubTab === "discover" && (
        <ClubDiscoveryTab onSelectClub={handleClubCardClick} />
      )}

      {/* Create Club Modal */}
      {showCreateModal && (
        <ClubCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateClub}
          loading={creatingClub}
        />
      )}

      {/* Club Detail Modal */}
      {selectedClubId && (
        <ClubDetailModal clubId={selectedClubId} onClose={handleCloseDetail} />
      )}
    </div>
  );
}
