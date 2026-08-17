import { useEffect, useState } from 'react';
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

interface EscalaHistorico {
  id: string;
  data: string;
  turno_nome_snapshot: string;
  turno_hora_inicio_snapshot: string;
  turno_hora_fim_snapshot: string;
  compareceu: boolean | null;
}

function agruparPorTurno(escalas: EscalaHistorico[]) {
  const grupos = new Map<string, EscalaHistorico[]>();

  for (const e of escalas) {
    const lista = grupos.get(e.turno_nome_snapshot) ?? [];
    lista.push(e);
    grupos.set(e.turno_nome_snapshot, lista);
  }

  return Array.from(grupos.entries()).sort(([, listaA], [, listaB]) => {
    return listaA[0].turno_hora_inicio_snapshot.localeCompare(
      listaB[0].turno_hora_inicio_snapshot
    );
  });
}

export function HistoricoEscalasPage() {
  const { periodos, carregando, erro } = useHistoricoEscalas();
  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState<string | null>(null);

  useEffect(() => {
    if (!periodoSelecionadoId && periodos.length > 0) {
      setPeriodoSelecionadoId(periodos[0].id);
    }
  }, [periodos, periodoSelecionadoId]);

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  const periodoSelecionado = periodos.find((p) => p.id === periodoSelecionadoId) ?? null;

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
        <>
          <div className="mt-5">
            <label className="block text-sm font-medium text-slate-700">
              Selecione o final de semana
            </label>
            <select
              value={periodoSelecionadoId ?? ''}
              onChange={(e) => setPeriodoSelecionadoId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
            >
              {periodos.map((periodo) => (
                <option key={periodo.id} value={periodo.id}>
                  {formatarData(periodo.data_inicio)} – {formatarData(periodo.data_fim)} ·{' '}
                  {rotuloStatus[periodo.status]}
                </option>
              ))}
            </select>
          </div>

          {periodoSelecionado && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
              {periodoSelecionado.escalas.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Você não trabalhou neste final de semana.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {agruparPorTurno(periodoSelecionado.escalas).map(
                    ([nomeTurno, escalasDoTurno]) => {
                      const cor = corTurno(nomeTurno);
                      const horario = escalasDoTurno[0];

                      return (
                        <div key={nomeTurno} className="rounded-md border border-slate-100 p-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${cor.dot}`} />
                            <p className="font-medium text-tinta">{nomeTurno}</p>
                          </div>
                          <p className="font-mono text-xs text-slate-400">
                            {horario.turno_hora_inicio_snapshot.slice(0, 5)} –{' '}
                            {horario.turno_hora_fim_snapshot.slice(0, 5)}
                          </p>

                          <div className="mt-3 space-y-1.5">
                            {escalasDoTurno.map((e) => (
                              <div
                                key={e.id}
                                className={`flex items-center justify-between rounded-md ${cor.bgLight} px-2 py-1.5 text-sm`}
                              >
                                <span className={cor.text}>
                                  {nomeDoDia(e.data, periodoSelecionado.data_inicio)}
                                </span>
                                {e.compareceu === true && (
                                  <span className="rounded-full bg-esmeralda px-2 py-0.5 text-xs font-medium text-white">
                                    Presente
                                  </span>
                                )}
                                {e.compareceu === false && (
                                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                                    Ausente
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}