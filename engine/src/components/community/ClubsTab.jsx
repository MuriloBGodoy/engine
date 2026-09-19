import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { SubTabsHeader } from "./SubTabsHeader";
import { useMyClubs, useCreateClub } from "../../services/clubs";
import { useToast } from "../ToastProvider";
import { ClubCard } from "../clubs/ClubCard";
import { ClubCreateModal } from "../clubs/ClubCreateModal";
import { ClubDiscoveryTab } from "../clubs/ClubDiscoveryTab";
import { ClubDetailModal } from "../clubs/ClubDetailModal";

export function ClubsTab({ searchParams, setSearchParams }) {
  const { t } = useTranslation();
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
      showToast(t("clubs.toast.created"), "success");
      setShowCreateModal(false);
      // Reload clubs
      fetch();
      // Open the new club's detail
      const params = new URLSearchParams(searchParams);
      params.set("tab", "clubes");
      params.set("club", newClub.id);
      setSearchParams(params);
    } catch (error) {
      showToast(error.message || t("clubs.toast.createError"), "error");
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
      <SubTabsHeader
        tabs={[
          { id: "my-clubs", label: t("clubs.tabs.mine") },
          { id: "discover", label: t("clubs.tabs.discover") },
        ]}
        active={activeSubTab}
        onChange={setActiveSubTab}
        createLabel={t("clubs.create")}
        createShortLabel={t("clubs.createShort")}
        onCreate={() => setShowCreateModal(true)}
      />

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
              <p className="text-[var(--engine-text-muted)]">{t("clubs.loading")}</p>
            </div>
          ) : clubs.length === 0 ? (
            <div className="text-center py-8 rounded-xl bg-[var(--engine-surface)] border border-[var(--engine-border)]">
              <Plus size={40} className="mx-auto text-[var(--engine-text-muted)] mb-3" />
              <p className="text-sm font-semibold text-[var(--engine-text)] mb-2">
                {t("clubs.emptyTitle")}
              </p>
              <p className="text-xs text-[var(--engine-text-muted)] mb-4">
                {t("clubs.emptyCopy")}
              </p>
              <button
                onClick={() => setActiveSubTab("discover")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--engine-accent)] text-white rounded-lg font-semibold hover:opacity-90 transition text-sm"
              >
                {t("clubs.emptyDiscover")}
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
