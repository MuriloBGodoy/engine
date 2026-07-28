/**
 * Logotipo do Engine. A marca (o "E") é desenhada em SVG — nunca é cortada
 * por overflow nem depende do carregamento de fonte, e fica nítida em
 * qualquer tamanho. O wordmark "Engine" mantém a pegada racing (itálico).
 */

export function LogoMark({ size = 32, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Engine"
      className={`shrink-0 ${className}`}
    >
      <rect width="64" height="64" rx="15" fill="var(--engine-accent)" />
      {/* "E" itálico — mesmo traçado do favicon. Vetor, nunca corta nem depende de fonte. */}
      <path
        fill="#fff"
        d="M18 46 24.4 18h23.2l-1.5 6.4H30.2l-1 4.3h14.5l-1.4 6.1H27.8l-1.1 4.8h16.4L41.6 46H18Z"
      />
    </svg>
  );
}

export function Logo({ collapsed = false, markSize = 32, className = "" }) {
  return (
    <div
      className={`flex items-center overflow-hidden ${
        collapsed ? "gap-0" : "gap-2.5"
      } ${className}`}
    >
      <LogoMark size={markSize} />
      <span
        className={`whitespace-nowrap font-display text-[19px] font-extrabold italic uppercase leading-none tracking-tight text-[var(--engine-text)] transition-all duration-300 ${
          collapsed ? "w-0 pr-0 opacity-0" : "w-auto pr-1.5 opacity-100"
        }`}
      >
        Engine
      </span>
    </div>
  );
}
