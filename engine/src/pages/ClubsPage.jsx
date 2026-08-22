import { useEffect, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "../components/ToastProvider";
import { useMyClubs, useCreateClub } from "../services/clubs";
import { ClubCard } from "../components/clubs/ClubCard";
import { ClubCreateModal } from "../components/clubs/ClubCreateModal";
import { ClubDiscoveryTab } from "../components/clubs/ClubDiscoveryTab";

export function ClubsPage() {
  const showToast = useToast();
  const { clubs, loading, error, fetch } = useMyClubs();
  const { create: createClub, loading: creatingClub } = useCreateClub();

  const [activeTab, setActiveTab] = useState("my-clubs");
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    } catch (error) {
      showToast(error.message || "Erro ao criar clube", "error");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-[var(--engine-text)]">Clubes</h1>
            <p className="text-[var(--engine-text-muted)] mt-2">
              Conecte-se com entusiastas de carros da sua região
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--engine-accent)] text-white rounded-xl font-semibold hover:opacity-90 transition whitespace-nowrap"
          >
            <Plus size={20} />
            Criar Clube
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--engine-border)]">
        {[
          { id: "my-clubs", label: "Meus Clubes" },
          { id: "discover", label: "Descobrir" },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-6 py-3 font-semibold border-b-2 transition ${
              activeTab === id
                ? "border-[var(--engine-accent)] text-[var(--engine-accent)]"
                : "border-transparent text-[var(--engine-text-muted)] hover:text-[var(--engine-text)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* My Clubs Tab */}
        {activeTab === "my-clubs" && (
          <div className="space-y-6">
            {/* Error State */}
            {error && (
              <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-[var(--engine-accent)]" />
              </div>
            )}

            {/* Empty State */}
            {!loading && clubs.length === 0 && !error && (
              <div className="text-center py-12 rounded-xl bg-[var(--engine-surface)] border border-[var(--engine-border)]">
                <Plus size={48} className="mx-auto text-[var(--engine-text-muted)] mb-4" />
                <p className="text-lg font-semibold text-[var(--engine-text)] mb-2">
                  Você ainda não está em nenhum clube
                </p>
                <p className="text-sm text-[var(--engine-text-muted)] mb-6">
                  Crie um novo clube ou explore clubes existentes
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-2 bg-[var(--engine-accent)] text-white rounded-lg font-semibold hover:opacity-90 transition"
                  >
                    Criar Clube
                  </button>
                  <button
                    onClick={() => setActiveTab("discover")}
                    className="px-6 py-2 bg-[var(--engine-surface-2)] text-[var(--engine-text)] rounded-lg font-semibold hover:bg-[var(--engine-border)] transition"
                  >
                    Descobrir Clubes
                  </button>
                </div>
              </div>
            )}

            {/* Clubs Grid */}
            {!loading && clubs.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {clubs.map((club) => (
                  <ClubCard key={club.id} club={club} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Discover Tab */}
        {activeTab === "discover" && <ClubDiscoveryTab />}
      </div>

      {/* Create Club Modal */}
      <ClubCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateClub}
        loading={creatingClub}
      />
    </div>
  );
}
