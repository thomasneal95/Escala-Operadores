import { useHistoricoAdmin } from '../../features/schedules/useHistoricoAdmin';
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

export function HistoricoAdminPage() {
  const { periodos, carregando, erro, processando, marcarPresenca } = useHistoricoAdmin();

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Histórico
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        Escalas de finais de semana anteriores
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Use os botões ✓ / × ao lado de cada nome para confirmar quem
        realmente compareceu ao turno.
      </p>

      {periodos.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Ainda não há períodos encerrados no histórico.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {periodos.map((periodo) => {
            const dias = [periodo.data_inicio, periodo.data_fim];

            return (
              <div key={periodo.id} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <h2 className="font-display font-semibold text-tinta">
                    {formatarData(periodo.data_inicio)} – {formatarData(periodo.data_fim)}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {rotuloStatus[periodo.status]}
                  </span>
                </div>

                {periodo.escalas.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">
                    Nenhum colaborador foi escalado neste período.
                  </p>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {dias.map((data) => {
                      const escalasDoDia = periodo.escalas.filter((e) => e.data === data);

                      return (
                        <div key={data} className="rounded-md border border-slate-100 p-3">
                          <p className="font-medium text-tinta">
                            {nomeDoDia(data, periodo.data_inicio)}
                            <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                              {formatarData(data)}
                            </span>
                          </p>

                          {escalasDoDia.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-400">Ninguém escalado</p>
                          ) : (
                            <div className="mt-2 space-y-1.5">
                              {escalasDoDia.map((e) => {
                                const cor = corTurno(e.turno_nome_snapshot);
                                return (
                                  <div
                                    key={e.id}
                                    className={`flex items-center justify-between rounded-md ${cor.bgLight} px-2 py-1.5 text-sm`}
                                  >
                                    <div className="flex flex-col leading-tight">
                                      <span className="text-tinta">{e.colaborador_nome}</span>
                                      <span className={`font-mono text-xs ${cor.text}`}>
                                        {e.turno_nome_snapshot} ·{' '}
                                        {e.turno_hora_inicio_snapshot.slice(0, 5)}–
                                        {e.turno_hora_fim_snapshot.slice(0, 5)}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => marcarPresenca(e.id, true)}
                                        disabled={processando === e.id}
                                        title="Confirmar que compareceu"
                                        className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                                          e.compareceu === true
                                            ? 'bg-esmeralda text-white'
                                            : 'bg-white/70 text-slate-600 hover:bg-white'
                                        }`}
                                      >
                                        ✓
                                      </button>
                                      <button
                                        onClick={() => marcarPresenca(e.id, false)}
                                        disabled={processando === e.id}
                                        title="Marcar que faltou"
                                        className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                                          e.compareceu === false
                                            ? 'bg-red-500 text-white'
                                            : 'bg-white/70 text-slate-600 hover:bg-white'
                                        }`}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}