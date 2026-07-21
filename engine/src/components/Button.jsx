/**
 * Botão padrão do Engine — unifica raio, padding, peso e estados
 * que antes variavam de página para página.
 *
 * variant: "primary" (vermelho sólido) | "secondary" (contorno) | "ghost"
 * size: "md" (padrão) | "sm"
 */
const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 disabled:cursor-not-allowed disabled:opacity-60";

const variants = {
  primary:
    "bg-[var(--engine-accent)] text-white shadow-[0_2px_10px_var(--engine-accent-soft)] hover:brightness-95 active:brightness-90",
  secondary:
    "border border-[var(--engine-border-strong)] text-[var(--engine-text-muted)] hover:border-[var(--engine-accent)] hover:text-[var(--engine-accent)]",
  ghost:
    "text-[var(--engine-text-muted)] hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)]",
};

/* Alturas maiores no mobile (alvo de toque de ~44px, recomendação de
   acessibilidade) e a escala compacta original a partir de sm. */
const sizes = {
  md: "h-11 px-4 text-[13px] sm:h-10",
  sm: "h-9 px-3 text-xs sm:h-8",
  lg: "h-12 px-6 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
