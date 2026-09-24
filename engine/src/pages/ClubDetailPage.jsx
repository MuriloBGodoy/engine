import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { ClubDetail } from "../components/clubs/ClubDetail";

/**
 * A rota `/clubs/:id`. O conteúdo é o `ClubDetail`, o mesmo que o modal da
 * Comunidade monta — aqui entra só a navegação de volta.
 */
export function ClubDetailPage() {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <button
        type="button"
        onClick={() => navigate("/clubs")}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--engine-text-muted)] transition-colors hover:text-[var(--engine-text)]"
      >
        <ArrowLeft size={18} />
        {t("clubs.title")}
      </button>
      <ClubDetail clubId={clubId} />
    </div>
  );
}
