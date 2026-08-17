import { useEffect, useState } from 'react';
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

interface EscalaComDia {
  id: string;
  colaborador_id: string;
  colaborador_nome: string;
  data: string;
  turno_nome_snapshot: string;
  turno_hora_inicio_snapshot: string;
  turno_hora_fim_snapshot: string;
  compareceu: boolean | null;
}

function agruparPorTurno(escalas: EscalaComDia[]) {
  const grupos = new Map<string, EscalaComDia[]>();

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

export function HistoricoAdminPage() {
  const { periodos, carregando, erro, processando, marcarPresenca } = useHistoricoAdmin();
  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState<string | null>(null);
  const [editandoPresenca, setEditandoPresenca] = useState<Set<string>>(new Set());

  // Seleciona automaticamente o período mais recente assim que a lista carrega.
  useEffect(() => {
    if (!periodoSelecionadoId && periodos.length > 0) {
      setPeriodoSelecionadoId(periodos[0].id);
    }
  }, [periodos, periodoSelecionadoId]);

  function alternarEdicao(escalaId: string) {
    setEditandoPresenca((atual) => {
      const novo = new Set(atual);
      if (novo.has(escalaId)) {
        novo.delete(escalaId);
      } else {
        novo.add(escalaId);
      }
      return novo;
    });
  }

  async function handleMarcarPresenca(escalaId: string, compareceu: boolean) {
    await marcarPresenca(escalaId, compareceu);
    setEditandoPresenca((atual) => {
      const novo = new Set(atual);
      novo.delete(escalaId);
      return novo;
    });
  }

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  const periodoSelecionado = periodos.find((p) => p.id === periodoSelecionadoId) ?? null;

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

      {periodos.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Ainda não há períodos encerrados no histórico.</p>
        </div>
      ) : (
        <>
          {/* Seletor de período */}
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {periodos.map((periodo) => {
              const total = periodo.escalas.length;
              const confirmados = periodo.escalas.filter((e) => e.compareceu !== null).length;
              const selecionado = periodo.id === periodoSelecionadoId;

              return (
                <button
                  key={periodo.id}
                  onClick={() => setPeriodoSelecionadoId(periodo.id)}
                  className={`shrink-0 rounded-lg border px-4 py-2.5 text-left transition ${
                    selecionado
                      ? 'border-tinta bg-tinta text-white'
                      : 'border-slate-200 bg-white text-tinta hover:border-slate-300'
                  }`}
                >
                  <p className="whitespace-nowrap font-medium">
                    {formatarData(periodo.data_inicio)} – {formatarData(periodo.data_fim)}
                  </p>
                  <p
                    className={`mt-0.5 text-xs ${
                      selecionado ? 'text-white/70' : 'text-slate-400'
                    }`}
                  >
                    {rotuloStatus[periodo.status]}
                    {total > 0 && ` · ${confirmados}/${total} confirmados`}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Detalhe do período selecionado */}
          {periodoSelecionado && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">
                Clique em <span className="font-medium text-esmeralda-dark">✓</span> ou{' '}
                <span className="font-medium text-red-600">×</span> para confirmar quem
                compareceu. Clique numa etiqueta já confirmada para corrigi-la.
              </p>

              {(() => {
                const gruposPorTurno = agruparPorTurno(periodoSelecionado.escalas);

                if (gruposPorTurno.length === 0) {
                  return (
                    <p className="mt-3 text-sm text-slate-400">
                      Nenhum colaborador foi escalado neste período.
                    </p>
                  );
                }

                return (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {gruposPorTurno.map(([nomeTurno, escalasDoTurno]) => {
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

                          <div className="mt-3 space-y-1">
                            {escalasDoTurno
                              .slice()
                              .sort((a, b) => a.colaborador_nome.localeCompare(b.colaborador_nome))
                              .map((e) => {
                                const emEdicao = editandoPresenca.has(e.id) || e.compareceu === null;

                                return (
                                  <div
                                    key={e.id}
                                    className={`flex items-center justify-between rounded-md ${cor.bgLight} px-2 py-1 text-sm`}
                                  >
                                    <div className="flex flex-col leading-tight">
                                      <span className="text-tinta">{e.colaborador_nome}</span>
                                      <span className={`font-mono text-[11px] ${cor.text}`}>
                                        {nomeDoDia(e.data, periodoSelecionado.data_inicio)}
                                      </span>
                                    </div>

                                    {emEdicao ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => handleMarcarPresenca(e.id, true)}
                                          disabled={processando === e.id}
                                          title="Confirmar que compareceu"
                                          className="rounded bg-white/80 px-1.5 py-0.5 text-xs font-bold text-esmeralda-dark hover:bg-white"
                                        >
                                          ✓
                                        </button>
                                        <button
                                          onClick={() => handleMarcarPresenca(e.id, false)}
                                          disabled={processando === e.id}
                                          title="Marcar que faltou"
                                          className="rounded bg-white/80 px-1.5 py-0.5 text-xs font-bold text-red-600 hover:bg-white"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => alternarEdicao(e.id)}
                                        title="Clique para corrigir"
                                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                          e.compareceu
                                            ? 'bg-esmeralda text-white'
                                            : 'bg-red-500 text-white'
                                        }`}
                                      >
                                        {e.compareceu ? '✓' : '✗'}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}