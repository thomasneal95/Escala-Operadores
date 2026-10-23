import { mesAtual } from '../lib/formatoPortal';

// Seletor de mês (até o mês atual) das telas do portal do operador.
export function SeletorMes({ valor, onMudar }: { valor: string; onMudar: (v: string) => void }) {
  return (
    <label className="block text-sm text-slate-700">
      Mês
      <input
        type="month"
        value={valor}
        max={mesAtual()}
        onChange={(e) => e.target.value && onMudar(e.target.value)}
        className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
      />
    </label>
  );
}
