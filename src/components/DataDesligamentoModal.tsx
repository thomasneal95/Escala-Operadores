import { useState, type FormEvent } from 'react';
import { useModalAcessivel } from '../hooks/useModalAcessivel';

interface DataDesligamentoModalProps {
  aberto: boolean;
  nome: string;
  titulo: string;
  textoConfirmar: string;
  dataInicial?: string | null;
  onFechar: () => void;
  onConfirmar: (data: string) => void;
}

function hojeIso() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

// Pede a data de desligamento (último dia ativo). Ela define o auxílio
// proporcional e até quando a pessoa entra na divisão de comissão da equipe.
export function DataDesligamentoModal({
  aberto,
  nome,
  titulo,
  textoConfirmar,
  dataInicial,
  onFechar,
  onConfirmar,
}: DataDesligamentoModalProps) {
  const ref = useModalAcessivel(aberto, onFechar);
  const [data, setData] = useState(dataInicial ?? hojeIso());

  if (!aberto) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (data) onConfirmar(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-data-desligamento"
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
      >
        <h3 id="titulo-data-desligamento" className="font-display text-lg font-semibold text-tinta">
          {titulo}
        </h3>
        <form onSubmit={handleSubmit} className="mt-3 space-y-4">
          <label className="block text-sm text-slate-700">
            Último dia trabalhado de {nome}
            <input
              type="date"
              required
              max={hojeIso()}
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
            />
          </label>
          <p className="text-xs text-slate-500">
            Usada no acerto: auxílio proporcional até esse dia e comissão de equipe só até ele.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              {textoConfirmar}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
