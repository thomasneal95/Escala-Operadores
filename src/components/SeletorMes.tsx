import { useEffect, useRef, useState } from 'react';
import { mesAtual } from '../lib/formatoPortal';

const NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// "YYYY-MM" somando (ou subtraindo) meses.
function somarMeses(mes: string, n: number) {
  const [a, m] = mes.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

// Seletor de mês ("YYYY-MM"): setas para o mês anterior/seguinte e, ao
// clicar no nome, a grade com os meses do ano. Com `max`, não passa dele.
export function SeletorMes({
  valor,
  onMudar,
  max,
}: {
  valor: string;
  onMudar: (v: string) => void;
  max?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [anoGrade, setAnoGrade] = useState(() => Number(valor.slice(0, 4)));
  const caixa = useRef<HTMLDivElement>(null);
  const atual = mesAtual();
  const [ano, m] = valor.split('-').map(Number);
  const permitido = (v: string) => !max || v <= max;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  function escolher(v: string) {
    if (!permitido(v)) return;
    onMudar(v);
    setAberto(false);
  }

  const seta =
    'flex h-10 w-10 items-center justify-center text-lg text-slate-500 transition hover:bg-slate-50 hover:text-tinta disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent';

  return (
    <div ref={caixa} className="relative inline-block min-w-64">
      <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <button type="button" onClick={() => escolher(somarMeses(valor, -1))} className={seta} aria-label="Mês anterior">
          ‹
        </button>
        <button
          type="button"
          onClick={() => {
            setAnoGrade(ano);
            setAberto((a) => !a);
          }}
          aria-haspopup="dialog"
          aria-expanded={aberto}
          className="min-w-44 flex-1 border-x border-slate-200 px-4 text-sm font-semibold text-tinta transition hover:bg-slate-50"
        >
          {NOMES[m - 1]} de {ano}
          <span className="ml-2 text-xs text-slate-400" aria-hidden>
            ▾
          </span>
        </button>
        <button
          type="button"
          onClick={() => escolher(somarMeses(valor, 1))}
          disabled={!permitido(somarMeses(valor, 1))}
          className={seta}
          aria-label="Mês seguinte"
        >
          ›
        </button>
      </div>

      {aberto && (
        <div
          role="dialog"
          aria-label="Escolher mês"
          className="absolute inset-x-0 z-30 mt-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setAnoGrade((a) => a - 1)}
              className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-tinta"
              aria-label="Ano anterior"
            >
              ‹
            </button>
            <span className="font-semibold text-tinta">{anoGrade}</span>
            <button
              type="button"
              onClick={() => setAnoGrade((a) => a + 1)}
              disabled={!!max && anoGrade >= Number(max.slice(0, 4))}
              className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-tinta disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
              aria-label="Ano seguinte"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {NOMES.map((nome, i) => {
              const v = `${anoGrade}-${String(i + 1).padStart(2, '0')}`;
              const selecionado = v === valor;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => escolher(v)}
                  disabled={!permitido(v)}
                  className={`rounded-md py-2 text-sm transition disabled:cursor-not-allowed disabled:text-slate-300 ${
                    selecionado
                      ? 'bg-esmeralda font-semibold text-white'
                      : v === atual
                        ? 'font-semibold text-esmeralda-dark ring-1 ring-esmeralda/40 hover:bg-esmeralda-light'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-tinta'
                  }`}
                >
                  {nome.slice(0, 3)}
                </button>
              );
            })}
          </div>
          {valor !== atual && permitido(atual) && (
            <button
              type="button"
              onClick={() => escolher(atual)}
              className="mt-3 w-full rounded-md py-1.5 text-sm font-medium text-esmeralda-dark hover:bg-esmeralda-light"
            >
              Ir para o mês atual
            </button>
          )}
        </div>
      )}
    </div>
  );
}
