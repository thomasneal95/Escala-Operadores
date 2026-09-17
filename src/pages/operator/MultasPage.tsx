import { useState } from 'react';
import { useMuralMultas } from '../../features/multas/useMuralMultas';
import { ApontarMultaModal } from '../../components/ApontarMultaModal';
import { RegrasMultasDashboard } from '../../components/RegrasMultasDashboard';
import { useToast } from '../../components/FeedbackProvider';

const rotuloStatus: Record<string, string> = {
  pendente: 'Em análise',
  aprovada: 'Multa aplicada',
  recusada: 'Recusada',
};

const corStatus: Record<string, string> = {
  pendente: 'bg-amber-50 text-amber-700',
  aprovada: 'bg-esmeralda-light text-esmeralda-dark',
  recusada: 'bg-slate-200 text-slate-700',
};

function formatarDataHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR').slice(0, 5);
}

export function MultasPage() {
  const { itens, carregando: carregandoMural, erro, recarregar } = useMuralMultas();
  const [modalAberto, setModalAberto] = useState(false);
  const toast = useToast();

  function handleEnviado() {
    toast('Apontamento enviado. O administrador vai avaliar.');
    recarregar();
  }

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Multas
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        Organização e limpeza
      </h1>

      <div className="mt-4">
        <RegrasMultasDashboard />
      </div>

      <div className="mt-4">
        <button
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center gap-2 rounded-md border border-ceruleo bg-ceruleo px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-ceruleo/90"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M10 2a1 1 0 0 1 1 1v1.06a7.002 7.002 0 0 1 5.94 5.94H18a1 1 0 1 1 0 2h-1.06a7.002 7.002 0 0 1-5.94 5.94V19a1 1 0 1 1-2 0v-1.06A7.002 7.002 0 0 1 3.06 12H2a1 1 0 1 1 0-2h1.06A7.002 7.002 0 0 1 9 4.06V3a1 1 0 0 1 1-1Zm0 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"
              clipRule="evenodd"
            />
          </svg>
          Apontar multa
        </button>
      </div>

      <p className="mt-8 font-mono text-xs font-medium uppercase tracking-widest text-slate-400">
        Mural
      </p>

      {erro && (
        <p className="mt-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      {carregandoMural ? (
        <p className="mt-3 text-sm text-slate-400">Carregando...</p>
      ) : itens.length === 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Nenhum apontamento de multa ainda.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {itens.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-tinta">
                    {item.colaborador_nome ?? 'A definir'}
                    <span className="ml-2 font-normal text-slate-400">· {item.turno_nome}</span>
                  </p>
                  <p className="font-mono text-xs text-slate-400">
                    {formatarDataHora(item.criado_em)}
                    {item.eu_reportei && ' · você reportou'}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${corStatus[item.status]}`}
                >
                  {rotuloStatus[item.status]}
                </span>
              </div>

              {item.justificativa_admin && (
                <p className="mt-2 text-sm text-slate-500">{item.justificativa_admin}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <ApontarMultaModal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onEnviado={handleEnviado}
      />
    </div>
  );
}
