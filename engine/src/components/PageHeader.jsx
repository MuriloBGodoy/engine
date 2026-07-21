/**
 * Cabeçalho padrão das páginas internas do Engine.
 * Escala compacta e sóbria (título ~20px, caixa normal) — a pegada racing
 * (itálico/caixa-alta) fica reservada à marca "Engine", como no protótipo
 * aprovado. Mantém consistência entre Garagem, Dashboard, Comunidade,
 * Serviços e Ajustes.
 *
 * - eyebrow: rótulo curto em vermelho (opcional)
 * - title: título da página (peso alto, caixa normal)
 * - subtitle: descrição legível e discreta
 * - actions: slot à direita para botões (opcional)
 */
export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--engine-accent)]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--engine-text)] sm:text-[28px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[var(--engine-text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {/* No mobile as ações ocupam a linha inteira (alvo de toque maior);
          a partir de sm voltam para o canto direito do cabeçalho. */}
      {actions && (
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          {actions}
        </div>
      )}
    </header>
  );
}
