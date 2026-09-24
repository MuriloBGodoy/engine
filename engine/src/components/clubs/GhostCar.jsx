/**
 * A silhueta que decora a faixa do card e a capa do clube.
 *
 * É outline, nunca foto: o clube não tem imagem própria (Storage desligado) e
 * um contorno de carro na cor da faixa dá textura sem prometer conteúdo que
 * não existe. Puramente decorativa — fica fora da árvore de acessibilidade.
 */
export function GhostCar({ className = "" }) {
  return (
    <svg viewBox="0 0 240 100" fill="none" aria-hidden="true" className={className}>
      <path
        d="M8 74h224M26 74c0-9 7-16 16-16s16 7 16 16M182 74c0-9 7-16 16-16s16 7 16 16"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M14 70V56c0-5 4-9 9-9h14l20-19c3-3 7-5 11-5h48c5 0 9 2 12 6l16 18h30c11 0 20 7 22 17l1 6"
        stroke="#fff"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M62 47l18-16h22v16H62zM112 31h20l14 16h-34V31z" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}
