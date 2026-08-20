import { useAssiduidade } from '../../features/schedules/useAssiduidade';

function corDaBarra(percentual: number) {
  if (percentual >= 0.9) return 'bg-esmeralda';
  if (percentual >= 0.75) return 'bg-lime-400';
  if (percentual >= 0.5) return 'bg-amber-400';
  return 'bg-red-400';
}

export function AssiduidadePage() {
  const { dados, diasPossiveis, carregando, erro } = useAssiduidade();

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Assiduidade
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        Dias trabalhados por colaborador
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Quantos dias de fim de semana cada colaborador trabalhou, em relação ao total de{' '}
        <span className="font-medium text-tinta">{diasPossiveis}</span> dias de operação já
        confirmados no histórico.
      </p>

      {carregando ? (
        <p className="mt-6 text-sm text-slate-400">Carregando...</p>
      ) : dados.length === 0 || diasPossiveis === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">
            Ainda não há períodos suficientes no histórico para calcular isso.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <div className="space-y-4">
            {dados.map((c) => {
              const percentual = c.percentual ?? 0;
              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-tinta">{c.nome_completo}</span>
                    <span className="text-slate-500">
                      {c.diasTrabalhados}/{diasPossiveis} dias ({Math.round(percentual * 100)}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${corDaBarra(percentual)}`}
                      style={{ width: `${Math.max(percentual * 100, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-esmeralda" /> 90%+
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-lime-400" /> 75–89%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-400" /> 50–74%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-red-400" /> Abaixo de 50%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}