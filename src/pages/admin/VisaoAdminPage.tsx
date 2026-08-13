import { useEffect, useState } from 'react';
import { useVisaoAdmin } from '../../features/schedules/useVisaoAdmin';
import { useEscala } from '../../features/schedules/useEscala';
import { SeletorColaborador } from '../../features/schedules/SeletorColaborador';
import { NovoPeriodoForm } from '../../features/schedules/NovoPeriodoForm';
import { corTurno } from '../../lib/turnoColors';

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function nomeDoDia(data: string, dataInicio: string) {
  return data === dataInicio ? 'Sábado' : 'Domingo';
}

const rotuloStatus: Record<string, string> = {
  aberto: 'Aberto',
  em_organizacao: 'Em organização',
  confirmado: 'Confirmado',
  encerrado: 'Encerrado',
};

const corStatus: Record<string, string> = {
  aberto: 'bg-esmeralda-light text-esmeralda-dark',
  em_organizacao: 'bg-ceruleo-light text-ceruleo',
  confirmado: 'bg-profundo-light text-profundo',
  encerrado: 'bg-slate-200 text-slate-700',
};

export function VisaoAdminPage() {
  const {
    periodo,
    turnos,
    colaboradores,
    carregando,
    erro,
    respostaDe,
    encerrarRecebimento,
    confirmarEscala,
    criarNovoPeriodo,
    resetarPeriodo,
    atualizandoStatus,
  } = useVisaoAdmin();
  const {
    carregando: carregandoEscala,
    erro: erroEscala,
    processando,
    escaladosEm,
    colaboradorJaEscalado,
    adicionar,
    remover,
  } = useEscala(periodo?.id ?? null);

  const [edicaoHabilitada, setEdicaoHabilitada] = useState(false);

  useEffect(() => {
    setEdicaoHabilitada(false);
  }, [periodo?.id]);

  function nomePorId(colaboradorId: string) {
    return colaboradores.find((c) => c.id === colaboradorId)?.nome_completo ?? '(desconhecido)';
  }

  async function handleAdicionar(colaboradorId: string, data: string, turnoId: string) {
    await adicionar(colaboradorId, data, turnoId);
  }

  async function handleEncerrarRecebimento() {
    const confirmou = window.confirm(
      'Ao encerrar o recebimento, os colaboradores não poderão mais alterar a disponibilidade. Deseja continuar?'
    );
    if (confirmou) {
      await encerrarRecebimento();
    }
  }

  async function handleConfirmarEscala() {
    const confirmou = window.confirm(
      'Ao confirmar a escala, os colaboradores poderão visualizar suas respectivas escalas. Deseja continuar?'
    );
    if (confirmou) {
      await confirmarEscala();
    }
  }

  function handleHabilitarEdicao() {
    const confirmou = window.confirm(
      'Esta escala já foi confirmada e os colaboradores já podem ter visto seus turnos. ' +
        'Alterações feitas agora NÃO enviam nenhum aviso automático a eles. ' +
        'Deseja mesmo habilitar a edição desta escala confirmada?'
    );
    if (confirmou) {
      setEdicaoHabilitada(true);
    }
  }

  async function handleResetarComDisponibilidades() {
    const confirmou = window.confirm(
      'Isso vai EXCLUIR a escala e TODAS as disponibilidades enviadas para este período, ' +
        'e reabrir o recebimento de disponibilidade do zero (status volta para "Aberto"). ' +
        'Os colaboradores precisarão enviar a disponibilidade novamente. Esta ação não pode ser desfeita. Deseja continuar?'
    );
    if (confirmou) {
      await resetarPeriodo(true);
    }
  }

  async function handleResetarSoEscala() {
    const confirmou = window.confirm(
      'Isso vai EXCLUIR apenas a escala montada, mantendo as disponibilidades já enviadas. ' +
        'O status volta para "Em organização", para você remontar a escala. Esta ação não pode ser desfeita. Deseja continuar?'
    );
    if (confirmou) {
      await resetarPeriodo(false);
    }
  }

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  const podeSeCriarNovoPeriodo =
    !periodo || periodo.status === 'confirmado' || periodo.status === 'encerrado';

  const escalaEstaTrancada =
    periodo != null &&
    (periodo.status === 'confirmado' || periodo.status === 'encerrado') &&
    !edicaoHabilitada;

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}
      {erroEscala && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erroEscala}</p>
      )}

      {podeSeCriarNovoPeriodo && (
        <div className="mb-8">
          <NovoPeriodoForm onCriar={criarNovoPeriodo} processando={atualizandoStatus} />
        </div>
      )}

      {!periodo ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Nenhum período de operação foi criado ainda.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-tinta">
              {formatarData(periodo.data_inicio)} – {formatarData(periodo.data_fim)}
            </h1>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${corStatus[periodo.status]}`}
            >
              {rotuloStatus[periodo.status]}
            </span>

            {periodo.status === 'aberto' && (
              <button
                onClick={handleEncerrarRecebimento}
                disabled={atualizandoStatus}
                className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {atualizandoStatus ? 'Encerrando...' : 'Encerrar recebimento'}
              </button>
            )}

            {periodo.status === 'em_organizacao' && (
              <button
                onClick={handleConfirmarEscala}
                disabled={atualizandoStatus}
                className="ml-auto rounded-md bg-esmeralda px-3 py-1.5 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-60"
              >
                {atualizandoStatus ? 'Confirmando...' : 'Confirmar escala'}
              </button>
            )}

            {escalaEstaTrancada && (
              <button
                onClick={handleHabilitarEdicao}
                className="ml-auto rounded-md border border-profundo/30 px-3 py-1.5 text-sm font-medium text-profundo hover:bg-profundo-light"
              >
                Editar escala confirmada
              </button>
            )}
          </div>

          {/* Tabela de disponibilidades */}
          <p className="mt-6 font-mono text-xs font-medium uppercase tracking-widest text-slate-400">
            Disponibilidade informada
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Colaborador</th>
                  {[periodo.data_inicio, periodo.data_fim].map((data) =>
                    turnos.map((turno) => (
                      <th key={`${data}-${turno.id}`} className="px-4 py-3 font-medium">
                        {nomeDoDia(data, periodo.data_inicio)}
                        <br />
                        <span className="text-xs font-normal text-slate-400">{turno.nome}</span>
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {colaboradores.map((colaborador) => (
                  <tr key={colaborador.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-tinta">{colaborador.nome_completo}</p>
                      {colaborador.equipe_nome && (
                        <p className="text-xs text-slate-400">{colaborador.equipe_nome}</p>
                      )}
                    </td>
                    {[periodo.data_inicio, periodo.data_fim].map((data) =>
                      turnos.map((turno) => {
                        const resposta = respostaDe(colaborador.id, data, turno.id);
                        const cor = corTurno(turno.nome);
                        return (
                          <td key={`${data}-${turno.id}`} className="px-4 py-3">
                            {resposta === undefined ? (
                              <span className="text-slate-300">—</span>
                            ) : resposta.disponivel ? (
                              <span
                                className={`rounded-full ${cor.bgLight} px-2 py-0.5 text-xs font-medium ${cor.text}`}
                              >
                                Disponível
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                                Indisponível
                              </span>
                            )}
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Montagem da escala */}
          <p className="mt-10 font-mono text-xs font-medium uppercase tracking-widest text-slate-400">
            Escala
          </p>

          {escalaEstaTrancada && (
            <p className="mt-3 rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600">
              Esta escala já foi confirmada. Clique em "Editar escala confirmada" acima
              para poder alterá-la.
            </p>
          )}

          {carregandoEscala ? (
            <p className="mt-3 text-sm text-slate-400">Carregando escala...</p>
          ) : (
            <div className="mt-3 space-y-6">
              {[periodo.data_inicio, periodo.data_fim].map((data) => (
                <div key={data} className="rounded-lg border border-slate-200 bg-white p-5">
                  <h2 className="font-display font-semibold text-tinta">
                    {nomeDoDia(data, periodo.data_inicio)}
                    <span className="ml-2 font-mono text-sm font-normal text-slate-400">
                      {formatarData(data)}
                    </span>
                  </h2>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {turnos.map((turno) => {
                      const escalados = escaladosEm(data, turno.id);
                      const cor = corTurno(turno.nome);

                      const disponiveis = colaboradores.filter(
                        (c) =>
                          respostaDe(c.id, data, turno.id)?.disponivel &&
                          !colaboradorJaEscalado(c.id, data, turno.id)
                      );

                      return (
                        <div key={turno.id} className="rounded-md border border-slate-200 p-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${cor.dot}`} />
                            <p className="font-medium text-tinta">{turno.nome}</p>
                          </div>
                          <p className="font-mono text-xs text-slate-400">
                            {turno.hora_inicio.slice(0, 5)} – {turno.hora_fim.slice(0, 5)}
                          </p>

                          <div className="mt-3 space-y-1.5">
                            {escalados.map((e) => (
                              <div
                                key={e.id}
                                className={`flex items-center justify-between rounded-md ${cor.bgLight} px-2 py-1 text-sm ${cor.text}`}
                              >
                                <span>{nomePorId(e.colaborador_id)}</span>
                                {!escalaEstaTrancada && (
                                  <button
                                    onClick={() => remover(e.id)}
                                    disabled={processando === e.id}
                                    className="opacity-70 hover:opacity-100 disabled:opacity-40"
                                    title="Remover da escala"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {!escalaEstaTrancada && (
                            <div className="mt-2">
                              <SeletorColaborador
                                disponiveis={disponiveis}
                                onSelecionar={(colaboradorId) =>
                                  handleAdicionar(colaboradorId, data, turno.id)
                                }
                                desabilitado={processando !== null}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Zona de risco */}
          <div className="mt-10 rounded-lg border border-red-200 bg-red-50 p-5">
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-red-600">
              Zona de risco
            </p>
            <p className="mt-1 text-sm text-red-700">
              Estas ações apagam dados permanentemente e não podem ser desfeitas.
              Use apenas se precisar corrigir um erro de teste ou reiniciar o
              processo deste período.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={handleResetarComDisponibilidades}
                disabled={atualizandoStatus}
                className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                Excluir escala e disponibilidades
              </button>
              <button
                onClick={handleResetarSoEscala}
                disabled={atualizandoStatus}
                className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                Excluir apenas a escala
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}