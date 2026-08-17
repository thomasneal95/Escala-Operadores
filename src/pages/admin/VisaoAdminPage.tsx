import { useEffect, useState } from 'react';
import { useVisaoAdmin } from '../../features/schedules/useVisaoAdmin';
import { useAuth } from '../../features/auth/AuthContext';
import { useEscala } from '../../features/schedules/useEscala';
import { useGerarEscalaAutomatica } from '../../features/schedules/useGerarEscalaAutomatica';
import { useVagasEquipe } from '../../features/teams/useVagasEquipe';
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
    temAlgumaResposta,
    encerrarRecebimento,
    confirmarEscala,
    criarNovoPeriodo,
    resetarPeriodo,
    excluirDisponibilidadeDoColaborador,
    excluindoDisponibilidade,
    reabrirRecebimento,
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
    marcarPresenca,
    recarregar: recarregarEscala,
  } = useEscala(periodo?.id ?? null);
  const { gerar, gerando } = useGerarEscalaAutomatica();
  const { vagas } = useVagasEquipe();
  const { session } = useAuth();


  const [edicaoHabilitada, setEdicaoHabilitada] = useState(false);
  const [erroLinha, setErroLinha] = useState<Record<string, string>>({});
  const [mensagemGeracao, setMensagemGeracao] = useState<string | null>(null);

  useEffect(() => {
    setEdicaoHabilitada(false);
  }, [periodo?.id]);

  function turnosDoDia(data: string) {
    if (!periodo) return [];
    const ehSabado = data === periodo.data_inicio;
    return turnos.filter((t) => (ehSabado ? t.ativo_sabado : t.ativo_domingo));
  }

  function nomePorId(colaboradorId: string) {
    return colaboradores.find((c) => c.id === colaboradorId)?.nome_completo ?? '(desconhecido)';
  }

  function equipeNomePorId(colaboradorId: string) {
    return colaboradores.find((c) => c.id === colaboradorId)?.equipe_nome ?? 'Sem equipe';
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

  async function handleReabrirRecebimento() {
    const confirmou = window.confirm(
      'Isso vai reabrir o recebimento de disponibilidade (status volta para "Aberto"), ' +
        'sem apagar nada do que já foi enviado ou já foi escalado. Deseja continuar?'
    );
    if (confirmou) {
      await reabrirRecebimento();
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

  async function handleExcluirDisponibilidade(colaboradorId: string, nome: string) {
    const confirmou = window.confirm(
      `Excluir a disponibilidade enviada por "${nome}"?\n\n` +
        'As respostas dos demais colaboradores não serão afetadas. ' +
        'Se o período ainda estiver "Aberto", esta pessoa poderá enviar a disponibilidade de novo.'
    );
    if (!confirmou) return;

    setErroLinha((atual) => ({ ...atual, [colaboradorId]: '' }));
    const resultado = await excluirDisponibilidadeDoColaborador(colaboradorId);
    if (resultado.erro) {
      setErroLinha((atual) => ({ ...atual, [colaboradorId]: resultado.erro as string }));
    }
  }

  async function handleGerarAutomatico() {
    if (!periodo) return;
    setMensagemGeracao(null);

    const confirmou = window.confirm(
      'Isso vai preencher automaticamente as vagas ainda vazias, priorizando quem ' +
        'trabalha aquele turno durante a semana. Escalas já feitas manualmente não ' +
        'serão alteradas. Deseja continuar?'
    );
    if (!confirmou) return;

    const dias = [periodo.data_inicio, periodo.data_fim];
    const escalasExistentes: { colaborador_id: string; data: string; turno_id: string }[] = [];
    const disponibilidadesFlat: {
      colaborador_id: string;
      data: string;
      turno_id: string;
      disponivel: boolean;
    }[] = [];

    for (const data of dias) {
      for (const turno of turnosDoDia(data)) {
        for (const e of escaladosEm(data, turno.id)) {
          escalasExistentes.push({ colaborador_id: e.colaborador_id, data, turno_id: turno.id });
        }
        for (const c of colaboradores) {
          const resposta = respostaDe(c.id, data, turno.id);
          if (resposta) {
            disponibilidadesFlat.push({
              colaborador_id: c.id,
              data,
              turno_id: turno.id,
              disponivel: resposta.disponivel,
            });
          }
        }
      }
    }

    if (!session?.user) return;

    const resultado = await gerar({
      periodo,
      adminId: session.user.id,
      colaboradores: colaboradores.map((c) => ({
        id: c.id,
        equipe_id: c.equipe_id,
        turno_semana_id: c.turno_semana_id,
      })),
      turnos,
      escalasExistentes,
      disponibilidades: disponibilidadesFlat,
      vagas,
    });

    if (resultado.erro) {
      setMensagemGeracao(resultado.erro);
      return;
    }

    setMensagemGeracao(
      resultado.quantidadeAdicionada > 0
        ? `${resultado.quantidadeAdicionada} colaborador(es) adicionado(s) automaticamente.`
        : 'Nenhuma vaga livre para preencher (tudo já escalado ou sem disponibilidade suficiente).'
    );

    await recarregarEscala();
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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-tinta">
              {formatarData(periodo.data_inicio)} – {formatarData(periodo.data_fim)}
            </h1>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${corStatus[periodo.status]}`}
            >
              {rotuloStatus[periodo.status]}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {periodo.status === 'aberto' && (
              <button
                onClick={handleEncerrarRecebimento}
                disabled={atualizandoStatus}
                className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 sm:w-auto"
              >
                {atualizandoStatus ? 'Encerrando...' : 'Encerrar recebimento'}
              </button>
            )}

            {periodo.status === 'em_organizacao' && (
              <button
                onClick={handleConfirmarEscala}
                disabled={atualizandoStatus}
                className="w-full rounded-md bg-esmeralda px-4 py-2.5 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-60 sm:w-auto"
              >
                {atualizandoStatus ? 'Confirmando...' : 'Confirmar escala'}
              </button>
            )}

            {(periodo.status === 'em_organizacao' || periodo.status === 'confirmado') && (
              <button
                onClick={handleReabrirRecebimento}
                disabled={atualizandoStatus}
                className="w-full rounded-md bg-ceruleo-light px-4 py-2.5 text-sm font-medium text-ceruleo hover:bg-ceruleo/20 disabled:opacity-60 sm:w-auto"
              >
                {atualizandoStatus ? 'Reabrindo...' : 'Reabrir recebimento'}
              </button>
            )}

            {escalaEstaTrancada && (
              <button
                onClick={handleHabilitarEdicao}
                className="w-full rounded-md border border-profundo/30 px-4 py-2.5 text-sm font-medium text-profundo hover:bg-profundo-light sm:w-auto"
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
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Colaborador</th>
                  {[periodo.data_inicio, periodo.data_fim].map((data) =>
                    turnosDoDia(data).map((turno) => (
                      <th key={`${data}-${turno.id}`} className="px-4 py-3 font-medium">
                        {nomeDoDia(data, periodo.data_inicio)}
                        <br />
                        <span className="text-xs font-normal text-slate-400">{turno.nome}</span>
                      </th>
                    ))
                  )}
                  <th className="px-4 py-3 font-medium">Ações</th>
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
                      turnosDoDia(data).map((turno) => {
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
                    <td className="px-4 py-3">
                      {temAlgumaResposta(colaborador.id) ? (
                        <>
                          <button
                            onClick={() =>
                              handleExcluirDisponibilidade(
                                colaborador.id,
                                colaborador.nome_completo
                              )
                            }
                            disabled={excluindoDisponibilidade === colaborador.id}
                            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            {excluindoDisponibilidade === colaborador.id
                              ? 'Excluindo...'
                              : 'Excluir envio'}
                          </button>
                          {erroLinha[colaborador.id] && (
                            <p className="mt-1 text-xs text-red-600">
                              {erroLinha[colaborador.id]}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Montagem da escala */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-slate-400">
              Escala
            </p>
            {periodo.status === 'em_organizacao' && (
              <button
                onClick={handleGerarAutomatico}
                disabled={gerando}
                className="rounded-md bg-profundo px-3 py-1.5 text-sm font-medium text-white hover:bg-profundo/90 disabled:opacity-60"
              >
                {gerando ? 'Gerando...' : 'Gerar escala automaticamente'}
              </button>
            )}
          </div>

          {mensagemGeracao && (
            <p className="mt-2 text-sm text-slate-600">{mensagemGeracao}</p>
          )}

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
              {[periodo.data_inicio, periodo.data_fim].map((data) => {
                const turnosDisponiveisNesseDia = turnosDoDia(data);

                return (
                  <div key={data} className="rounded-lg border border-slate-200 bg-white p-5">
                    <h2 className="font-display font-semibold text-tinta">
                      {nomeDoDia(data, periodo.data_inicio)}
                      <span className="ml-2 font-mono text-sm font-normal text-slate-400">
                        {formatarData(data)}
                      </span>
                    </h2>

                    {turnosDisponiveisNesseDia.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-400">Não há operação neste dia.</p>
                    ) : (
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {turnosDisponiveisNesseDia.map((turno) => {
                          const escalados = escaladosEm(data, turno.id);
                          const cor = corTurno(turno.nome);

                          const disponiveis = colaboradores.filter(
                            (c) =>
                              respostaDe(c.id, data, turno.id)?.disponivel &&
                              !colaboradorJaEscalado(c.id, data, turno.id)
                          );

                          const contagemPorEquipe: Record<string, number> = {};
                          for (const e of escalados) {
                            const nomeEquipe = equipeNomePorId(e.colaborador_id);
                            contagemPorEquipe[nomeEquipe] =
                              (contagemPorEquipe[nomeEquipe] ?? 0) + 1;
                          }

                          return (
                            <div
                              key={turno.id}
                              className="rounded-md border border-slate-200 p-3"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${cor.dot}`} />
                                <p className="font-medium text-tinta">{turno.nome}</p>
                              </div>
                              <p className="font-mono text-xs text-slate-400">
                                {turno.hora_inicio.slice(0, 5)} – {turno.hora_fim.slice(0, 5)}
                              </p>

                              {escalados.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {Object.entries(contagemPorEquipe).map(
                                    ([nomeEquipe, contagem]) => (
                                      <span
                                        key={nomeEquipe}
                                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                                      >
                                        {nomeEquipe} · {contagem}
                                      </span>
                                    )
                                  )}
                                </div>
                              )}

                              <div className="mt-2 space-y-1.5">
                                {escalados.map((e) => {
                                  const podeConfirmarPresenca =
                                    periodo.status === 'confirmado' ||
                                    periodo.status === 'encerrado';

                                  return (
                                    <div
                                      key={e.id}
                                      className={`flex items-center justify-between rounded-md ${cor.bgLight} px-2 py-1.5 text-sm ${cor.text}`}
                                    >
                                      <div className="flex flex-col leading-tight">
                                        <span>{nomePorId(e.colaborador_id)}</span>
                                        <span className="text-[11px] opacity-70">
                                          {equipeNomePorId(e.colaborador_id)}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {podeConfirmarPresenca && (
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() => marcarPresenca(e.id, true)}
                                              disabled={processando === e.id}
                                              title="Confirmar que compareceu"
                                              className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                                                e.compareceu === true
                                                  ? 'bg-esmeralda text-white'
                                                  : 'bg-white/60 hover:bg-white'
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
                                                  : 'bg-white/60 hover:bg-white'
                                              }`}
                                            >
                                              ×
                                            </button>
                                          </div>
                                        )}
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
                                    </div>
                                  );
                                })}
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
                    )}
                  </div>
                );
              })}
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