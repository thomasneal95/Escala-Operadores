import type { ReactElement } from 'react';

// Conjunto fixo de ícones disponíveis pras categorias de regras de multa.
// O banco guarda só a chave (ex.: "cozinha") — o desenho fica aqui, então o
// admin escolhe de uma lista fechada em vez de digitar SVG.
export const ICONES_MULTAS = {
  cozinha: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M5 9h11a3 3 0 0 1 0 6h-.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9v7a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3V9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 4v2M11 4v2M14 4v2" strokeLinecap="round" />
    </svg>
  ),
  banheiro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 3c2 2.2 4 5 4 7.5a4 4 0 1 1-8 0C8 8 10 5.2 12 3Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 10.5c0 1.4 1.1 2.5 2.5 2.5" strokeLinecap="round" />
    </svg>
  ),
  mesa: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3.5" y="5" width="17" height="11" rx="1.5" />
      <path d="M8 20h8M12 16v4" strokeLinecap="round" />
    </svg>
  ),
  mochila: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M7 9V7a5 5 0 0 1 10 0v2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="5" y="9" width="14" height="12" rx="2.5" />
      <path d="M9 13h6M9 17h6" strokeLinecap="round" />
    </svg>
  ),
  estrela: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path
        d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  relogio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3.2 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ferramenta: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path
        d="M14.7 6.3a3.5 3.5 0 0 0-4.6 4.2L4 16.6V20h3.4l6.1-6.1a3.5 3.5 0 0 0 4.2-4.6l-2.6 2.6-2-2 2.6-2.6Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  lista: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" />
      <path d="M9 12h6M9 15.5h6M9 8.5h3" strokeLinecap="round" />
    </svg>
  ),
  geladeira: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="6" y="2.5" width="12" height="19" rx="1.5" />
      <path d="M6 9.5h12" strokeLinecap="round" />
      <path d="M9 5v2M9 12v2" strokeLinecap="round" />
    </svg>
  ),
  lixo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M5 7h14" strokeLinecap="round" />
      <path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M7 7l1 12.2A1.5 1.5 0 0 0 9.5 20.7h5A1.5 1.5 0 0 0 16 19.2L17 7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 10.5v6M14 10.5v6" strokeLinecap="round" />
    </svg>
  ),
  atraso: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5v4l2.8 1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 5 7.8 7.3M18.5 5l-2.3 2.3" strokeLinecap="round" />
    </svg>
  ),
} satisfies Record<string, ReactElement>;

export type ChaveIconeMulta = keyof typeof ICONES_MULTAS;

export const ICONE_ALERTA_MULTA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M12 3.5 21 19H3L12 3.5Z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 10v4" strokeLinecap="round" />
    <path d="M12 16.8h.01" strokeLinecap="round" />
  </svg>
);

export const ROTULOS_ICONES_MULTAS: Record<ChaveIconeMulta, string> = {
  cozinha: 'Xícara',
  banheiro: 'Gota',
  mesa: 'Monitor',
  mochila: 'Mochila',
  estrela: 'Estrela',
  relogio: 'Relógio',
  ferramenta: 'Ferramenta',
  lista: 'Lista',
  geladeira: 'Geladeira',
  lixo: 'Lixo',
  atraso: 'Atraso',
};

export function iconePorChave(chave: string) {
  return ICONES_MULTAS[chave as ChaveIconeMulta] ?? ICONES_MULTAS.lista;
}
