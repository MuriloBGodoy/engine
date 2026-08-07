import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Moldura das páginas legais (termos e privacidade).
 *
 * Texto corrido, sem depender de login: precisa abrir para visitante, para o
 * Google e para a revisão das lojas de aplicativo.
 */
export function LegalPage({ title, updatedAt, children }) {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `${title} · Engine`;
  }, [title]);

  return (
    <div className="min-h-screen bg-[var(--engine-bg)]">
      <div className="sticky top-0 z-40 border-b border-[var(--engine-border)] bg-[var(--engine-bg)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--engine-text-muted)] transition hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-accent)]"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-black text-[var(--engine-text)]">{title}</h1>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
          Atualizado em {updatedAt}
        </p>

        <div className="legal-body mt-6 space-y-6 text-sm leading-7 text-[var(--engine-text-muted)]">
          {children}
        </div>
      </article>
    </div>
  );
}

/** Seção com título, para o documento ter âncoras visuais claras. */
export function LegalSection({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-black text-[var(--engine-text)]">{title}</h2>
      {children}
    </section>
  );
}
