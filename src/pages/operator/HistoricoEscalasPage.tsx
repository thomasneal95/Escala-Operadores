import { useHistoricoEscalas } from '../../features/schedules/useHistoricoEscalas';
import { corTurno } from '../../lib/turnoColors';

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function nomeDoDia(data: string, dataInicio: string) {
  return data === dataInicio ? 'Sábado' : 'Domingo';
}

const rotuloStatus: Record<string, string> = {
  confirmado: 'Confirmado',
  encerrado: 'Encerrado',
};

export function HistoricoEscalasPage() {
  const { periodos, carregando, erro } = useHistoricoEscalas();

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  return (
    <div>
      {erro && (
        <p className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Histórico
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        Escalas de finais de semana anteriores
      </h1>

      {periodos.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Ainda não há períodos encerrados no histórico.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {periodos.map((periodo) => (
            <div key={periodo.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <h2 className="font-display font-semibold text-tinta">
                  {formatarData(periodo.data_inicio)} – {formatarData(periodo.data_fim)}
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {rotuloStatus[periodo.status]}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {[periodo.data_inicio, periodo.data_fim].map((data) => {
                  const escala = periodo.escalas.find((e) => e.data === data);
                  const cor = escala ? corTurno(escala.turno_nome_snapshot) : null;

                  return (
                    <div
                      key={data}
                      className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2"
                    >
                      <span className="text-sm text-slate-500">
                        {nomeDoDia(data, periodo.data_inicio)}{' '}
                        <span className="font-mono text-xs text-slate-400">
                          ({formatarData(data)})
                        </span>
                      </span>
                      {escala && cor ? (
                        <span className={`font-mono text-sm font-medium ${cor.text}`}>
                          {escala.turno_nome_snapshot} ·{' '}
                          {escala.turno_hora_inicio_snapshot.slice(0, 5)}–
                          {escala.turno_hora_fim_snapshot.slice(0, 5)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">Não trabalhou</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}