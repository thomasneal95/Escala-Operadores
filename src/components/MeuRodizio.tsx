import { useMinhaDupla } from '../features/ganhos/useMinhaDupla';
import { papelDaDupla, rotuloPapel, type PapelDupla } from '../lib/rodizioDuplas';

const SEMANAS = 9;

const cor: Record<PapelDupla, string> = {
  sabado: 'bg-ceruleo-light text-ceruleo',
  domingo: 'bg-amber-50 text-amber-800',
  folga: 'bg-esmeralda-light text-esmeralda-dark',
};

function proximosSabados(quantidade: number) {
  const h = new Date();
  const base = new Date(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate()));
  // Domingo ainda conta o fim de semana em andamento.
  const ateSabado = (6 - base.getUTCDay() + 7) % 7;
  base.setUTCDate(base.getUTCDate() + (base.getUTCDay() === 0 ? -1 : ateSabado));
  return Array.from({ length: quantidade }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i * 7);
    return d.toISOString().slice(0, 10);
  });
}

function diaMes(data: string, somar = 0) {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + somar);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Data mostrada para cada fim de semana: o dia em que a pessoa trabalha, ou
// o fim de semana inteiro quando é folga.
function quando(papel: PapelDupla, sabado: string) {
  if (papel === 'sabado') return `sáb ${diaMes(sabado)}`;
  if (papel === 'domingo') return `dom ${diaMes(sabado, 1)}`;
  return `${diaMes(sabado)} e ${diaMes(sabado, 1)}`;
}

// Previsão do rodízio Sábado → Domingo → Folga da dupla do operador nos
// próximos fins de semana. A escala publicada (com as trocas) é o que vale.
export function MeuRodizio() {
  const { dupla, carregando } = useMinhaDupla();
  if (carregando || !dupla) return null;

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
      <p className="font-medium text-tinta">Meu rodízio de fim de semana</p>
      <p className="mt-1 text-sm text-slate-500">
        Dupla {dupla.numero} da equipe {dupla.equipe}
        {dupla.parceiro ? ` com ${dupla.parceiro}` : ''} ·{' '}
        {dupla.posicao === 'manha_tarde' ? 'manhã + tarde' : 'tarde + noite'}
      </p>
      <ul className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        {proximosSabados(SEMANAS).map((sabado) => {
          const papel = papelDaDupla(dupla.numero, sabado);
          return (
            <li key={sabado} className={`rounded-md px-2 py-2 ${cor[papel]}`}>
              <p className="text-[11px] opacity-80">{quando(papel, sabado)}</p>
              <p className="font-medium">{rotuloPapel[papel]}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-400">
        Previsão pelo rodízio das duplas. O que vale é a escala publicada, que já inclui as trocas.
      </p>
    </div>
  );
}
