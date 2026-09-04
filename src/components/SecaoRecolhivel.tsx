import { useState, type ReactNode } from 'react';

interface SecaoRecolhivelProps {
  titulo: string;
  children: ReactNode;
  padraoAberta?: boolean;
  tom?: 'neutro' | 'perigo';
  descricao?: string;
}

const iconeChevron = (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    className="h-4 w-4 shrink-0 transition-transform"
  >
    <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Seção com título clicável que expande/recolhe o conteúdo — usada para
// tirar da frente da tela ações raras ou destrutivas, sem escondê-las de
// vez (ver useVisaoAdmin/ColaboradoresPage).
export function SecaoRecolhivel({
  titulo,
  children,
  padraoAberta = true,
  tom = 'neutro',
  descricao,
}: SecaoRecolhivelProps) {
  const [aberta, setAberta] = useState(padraoAberta);

  const corBorda = tom === 'perigo' ? 'border-red-200' : 'border-slate-200';
  const corFundo = tom === 'perigo' ? 'bg-red-50' : 'bg-white';
  const corTitulo = tom === 'perigo' ? 'text-red-600' : 'text-slate-400';

  return (
    <div className={`rounded-lg border ${corBorda} ${corFundo}`}>
      <button
        type="button"
        onClick={() => setAberta((a) => !a)}
        aria-expanded={aberta}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <p className={`font-mono text-xs font-medium uppercase tracking-widest ${corTitulo}`}>
            {titulo}
          </p>
          {descricao && !aberta && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
        </div>
        <span className={`text-slate-400 ${aberta ? 'rotate-180' : ''}`}>{iconeChevron}</span>
      </button>

      {aberta && <div className={`border-t px-5 pb-5 ${corBorda}`}>{children}</div>}
    </div>
  );
}
