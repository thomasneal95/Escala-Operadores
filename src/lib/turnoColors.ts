// Mapeamento de cor por turno — a "linguagem visual" do sistema.
// Cada turno tem uma cor fixa e consistente em toda a aplicação, permitindo
// reconhecer o turno visualmente sem precisar ler o texto.

interface CorTurno {
  bg: string;
  bgLight: string;
  text: string;
  border: string;
  dot: string;
}

const mapa: Record<string, CorTurno> = {
  'Manhã': {
    bg: 'bg-ceruleo',
    bgLight: 'bg-ceruleo-light',
    text: 'text-ceruleo',
    border: 'border-ceruleo',
    dot: 'bg-ceruleo',
  },
  Tarde: {
    bg: 'bg-esmeralda',
    bgLight: 'bg-esmeralda-light',
    text: 'text-esmeralda-dark',
    border: 'border-esmeralda',
    dot: 'bg-esmeralda',
  },
  Noite: {
    bg: 'bg-profundo',
    bgLight: 'bg-profundo-light',
    text: 'text-profundo',
    border: 'border-profundo',
    dot: 'bg-profundo',
  },
};

const padrao: CorTurno = {
  bg: 'bg-esmeralda',
  bgLight: 'bg-esmeralda-light',
  text: 'text-esmeralda-dark',
  border: 'border-esmeralda',
  dot: 'bg-esmeralda',
};

export function corTurno(nome: string): CorTurno {
  return mapa[nome] ?? padrao;
}