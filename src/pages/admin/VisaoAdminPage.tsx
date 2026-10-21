import { useEffect, useState } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { SecaoRecolhivel } from '../../components/SecaoRecolhivel';
import { useVisaoAdmin } from '../../features/schedules/useVisaoAdmin';
import { useAuth } from '../../features/auth/AuthContext';
import { useEscala } from '../../features/schedules/useEscala';
import { SeletorColaborador } from '../../features/schedules/SeletorColaborador';
import { GerarEscalaMesForm } from '../../features/schedules/GerarEscalaMesForm';
import { useGerarEscalaMensal } from '../../features/schedules/useGerarEscalaMensal';
import { lacunasDeCobertura } from '../../features/schedules/coberturaEquipes';
import { corTurno } from '../../lib/turnoColors';
import { useToast } from '../../components/FeedbackProvider';
import { useConfirm } from '../../components/FeedbackProvider';

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

const nomesMeses = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// Fins de semana "abertos" vêm do esquema antigo de disponibilidade e são
// tratados como em organização.
function emOrganizacao(status: string) {
  return status === 'aberto' || status === 'em_organizacao';
}

const corStatus: Record<string, string> = {
  aberto: 'bg-esmeralda-light text-esmeralda-dark',
  em_organizacao: 'bg-ceruleo-light text-ceruleo',
  confirmado: 'bg-profundo-light text-profundo',
  encerrado: 'bg-slate-200 text-slate-700',
};

export function VisaoAdminPage() {
  const {
    periodo,
    periodos,
    selecionarPeriodo,
    confirmarVarios,
    turnos,
    colaboradores,
    carregando,
    erro,
    confirmarEscala,
    resetarEscala,
    atualizandoStatus,
    recarregar,
  } = useVisaoAdmin();
  const {
    carregando: carregandoEscala,
    erro: erroEscala,
    processando,
    escaladosEm,
    colaboradorJaEscalado,
    adicionar,
    remover,
    recarregar: recarregarEscala,
  } = useEscala(periodo?.id ?? null);
  const { gerarMes, gerarFimDeSemana, gerando: gerandoMensal } = useGerarEscalaMensal();
  const [maxFinsDeSemana, setMaxFinsDeSemana] = useState('');
  const { session } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();


  const [edicaoHabilitada, setEdicaoHabilitada] = useState(false);
  const [mensagemGeracao, setMensagemGeracao] = useState<string | null>(null);
  const [visualizacaoEscala, setVisualizacaoEscala] = useState<'turno' | 'equipe'>('turno');

  useEffect(() => {
    setEdicaoHabilitada(false);
  }, [periodo?.id]);

  function turnosDoDia(data: string) {
    if (!periodo) return [];
    const ehSabado = data === periodo.data_inicio;
    return turnos.filter((t) => (ehSabado ? t.ativo_sabado : t.ativo_domingo));
  }

  function limiteMensal() {
    const valor = Number(maxFinsDeSemana);
    return maxFinsDeSemana.trim() !== '' && Number.isInteger(valor) && valor > 0 ? valor : null;
  }

  function colaboradoresParaGeracao() {
    return colaboradores.map((c) => ({
      id: c.id,
      nome_completo: c.nome_completo,
      equipe_id: c.equipe_id,
      turno_semana_id: c.turno_semana_id,
    }));
  }

  async function handleGerarMes(ano: number, mes: number) {
    if (!session?.user) return;
    setMensagemGeracao(null);

    const limite = limiteMensal();
    const confirmou = await confirmar(
      `Gerar a escala de todos os fins de semana de ${nomesMeses[mes - 1]}/${ano}?\n\n` +
        'Os fins de semana que ainda não existem serão criados. Escalas já montadas ' +
        'e fins de semana já confirmados não serão alterados.' +
        (limite ? `\n\nLimite: ${limite} fim(ns) de semana por pessoa no mês.` : '')
    );
    if (!confirmou) return;

    const resultado = await gerarMes({
      ano,
      mes,
      adminId: session.user.id,
      colaboradores: colaboradoresParaGeracao(),
      turnos,
      maxFinsDeSemanaNoMes: limite,
    });

    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }

    toast(
      resultado.finsDeSemana === 0
        ? 'Nenhum fim de semana em organização para preencher neste mês.'
        : `${resultado.finsDeSemana} fim(ns) de semana preparado(s), ${resultado.adicionadas} turno(s) escalado(s).` +
            (resultado.duplasSemGente > 0
              ? ` ${resultado.duplasSemGente} dupla(s) ficaram sem pessoa disponível.`
              : '')
    );

    await recarregar();
    if (resultado.primeiroPeriodoId) selecionarPeriodo(resultado.primeiroPeriodoId);
  }

  // Fins de semana "em organização" do mesmo mês do fim de semana aberto.
  const periodosEmOrganizacaoDoMes = periodo
    ? periodos.filter(
        (p) =>
          emOrganizacao(p.status) && p.data_inicio.slice(0, 7) === periodo.data_inicio.slice(0, 7)
      )
    : [];

  async function handleConfirmarMes() {
    if (!periodo) return;
    const [ano, mes] = periodo.data_inicio.split('-').map(Number);
    const confirmou = await confirmar(
      `Confirmar os ${periodosEmOrganizacaoDoMes.length} fins de semana em organização de ` +
        `${nomesMeses[mes - 1]}/${ano}? Os colaboradores passarão a ver suas escalas.`
    );
    if (!confirmou) return;

    const resultado = await confirmarVarios(periodosEmOrganizacaoDoMes.map((p) => p.id));
    if (resultado.erro) toast(resultado.erro, 'erro');
  }

  function nomePorId(colaboradorId: string) {
    return colaboradores.find((c) => c.id === colaboradorId)?.nome_completo ?? '(desconhecido)';
  }

  function equipeNomePorId(colaboradorId: string) {
    return colaboradores.find((c) => c.id === colaboradorId)?.equipe_nome ?? 'Sem equipe';
  }

  interface MembroEscalado {
    colaboradorId: string;
    nome: string;
  }

  // Matriz equipe × turno para um dia: uma linha por equipe, uma coluna por
  // turno — deixa claro, lado a lado, quem de cada equipe trabalha em cada
  // período, em vez de misturar tudo numa lista só.
  function matrizEquipePorDia(data: string) {
    const porEquipeETurno = new Map<string, Map<string, MembroEscalado[]>>();

    for (const turno of turnosDoDia(data)) {
      for (const e of escaladosEm(data, turno.id)) {
        const nomeEquipe = equipeNomePorId(e.colaborador_id);
        const porTurno = porEquipeETurno.get(nomeEquipe) ?? new Map<string, MembroEscalado[]>();
        const lista = porTurno.get(turno.id) ?? [];
        lista.push({ colaboradorId: e.colaborador_id, nome: nomePorId(e.colaborador_id) });
        porTurno.set(turno.id, lista);
        porEquipeETurno.set(nomeEquipe, porTurno);
      }
    }

    for (const porTurno of porEquipeETurno.values()) {
      for (const lista of porTurno.values()) {
        lista.sort((a, b) => a.nome.localeCompare(b.nome));
      }
    }

    const equipes = [...porEquipeETurno.keys()].sort((equipeA, equipeB) => {
      if (equipeA === 'Sem equipe') return 1;
      if (equipeB === 'Sem equipe') return -1;
      return equipeA.localeCompare(equipeB);
    });

    return { equipes, porEquipeETurno };
  }

  async function handleAdicionar(colaboradorId: string, data: string, turnoId: string) {
    await adicionar(colaboradorId, data, turnoId);
  }

  async function handleConfirmarEscala() {
    const confirmou = await confirmar(
      'Ao confirmar a escala, os colaboradores poderão visualizar suas respectivas escalas. Deseja continuar?'
    );
    if (confirmou) {
      const resultado = await confirmarEscala();
      if (resultado.erro) toast(resultado.erro, 'erro');
    }
  }

    async function handleHabilitarEdicao() {
    const confirmou = await confirmar(
      'Esta escala já foi confirmada e os colaboradores já podem ter visto seus turnos. ' +
        'Alterações feitas agora NÃO enviam nenhum aviso automático a eles. ' +
        'Deseja mesmo habilitar a edição desta escala confirmada?'
    );
    if (confirmou) {
      setEdicaoHabilitada(true);
    }
  }

  async function handleResetarSoEscala() {
    const confirmou = await confirmar(
      'Isso vai EXCLUIR a escala montada deste fim de semana. O status volta para ' +
        '"Em organização", para você remontar a escala. Esta ação não pode ser desfeita. Deseja continuar?'
    );
    if (confirmou) {
      const resultado = await resetarEscala();
      if (resultado.erro) toast(resultado.erro, 'erro');
    }
  }

  async function handleGerarAutomatico() {
    if (!periodo) return;
    setMensagemGeracao(null);

    if (!session?.user) return;
    const confirmou = await confirmar(
      'Isso vai preencher as duplas ainda vazias deste fim de semana pelo histórico ' +
        '(Manhã + Tarde e Tarde + Noite, por equipe). Escalas já montadas não serão ' +
        'alteradas. Deseja continuar?'
    );
    if (!confirmou) return;

    const resultado = await gerarFimDeSemana({
      periodo,
      adminId: session.user.id,
      colaboradores: colaboradoresParaGeracao(),
      turnos,
      maxFinsDeSemanaNoMes: limiteMensal(),
    });

    if (resultado.erro) {
      setMensagemGeracao(resultado.erro);
      return;
    }

    setMensagemGeracao(
      (resultado.adicionadas > 0
        ? `${resultado.adicionadas} turno(s) escalado(s) automaticamente.`
        : 'Nenhuma dupla vazia para preencher.') +
        (resultado.duplasSemGente > 0
          ? ` ${resultado.duplasSemGente} dupla(s) ficaram sem pessoa disponível.`
          : '')
    );
    await recarregarEscala();
  }

    if (carregando) {
    return (
      <div>
        <Skeleton className="h-7 w-56" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="mt-8 h-4 w-40" />
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white p-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="mt-3 h-8 w-full first:mt-0" />
          ))}
        </div>
      </div>
    );
  }

  // Turnos em que alguma equipe ficou sem ninguém neste fim de semana.
  const lacunas =
    periodo && !carregandoEscala
      ? lacunasDeCobertura(
          periodo,
          turnos,
          colaboradores,
          [periodo.data_inicio, periodo.data_fim].flatMap((data) =>
            turnos.flatMap((t) =>
              escaladosEm(data, t.id).map((e) => ({
                colaborador_id: e.colaborador_id,
                data,
                turno_id: t.id,
              }))
            )
          )
        )
      : [];

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

      <div className="mb-8">
        <GerarEscalaMesForm
          maxFinsDeSemana={maxFinsDeSemana}
          onMudarMaxFinsDeSemana={setMaxFinsDeSemana}
          onGerar={handleGerarMes}
          gerando={gerandoMensal}
        />
      </div>

      {!periodo ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Nenhum período de operação foi criado ainda.</p>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="seletor_fim_semana" className="block text-sm font-medium text-slate-700">
                Fim de semana
              </label>
              <select
                id="seletor_fim_semana"
                value={periodo.id}
                onChange={(e) => selecionarPeriodo(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
              >
                {periodos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatarData(p.data_inicio)} – {formatarData(p.data_fim)} · {rotuloStatus[p.status]}
                  </option>
                ))}
              </select>
            </div>

            {periodosEmOrganizacaoDoMes.length > 1 && (
              <button
                onClick={handleConfirmarMes}
                disabled={atualizandoStatus}
                className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-60"
              >
                Confirmar todos do mês ({periodosEmOrganizacaoDoMes.length})
              </button>
            )}
          </div>

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
            {emOrganizacao(periodo.status) && (
              <button
                onClick={handleConfirmarEscala}
                disabled={atualizandoStatus || lacunas.length > 0}
                title={lacunas.length > 0 ? 'Há turnos sem ninguém de alguma equipe' : undefined}
                className="w-full rounded-md bg-esmeralda px-4 py-2.5 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-60 sm:w-auto"
              >
                {atualizandoStatus ? 'Confirmando...' : 'Confirmar escala'}
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

          {/* Montagem da escala */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-slate-400">
              Escala
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-sm">
                <button
                  onClick={() => setVisualizacaoEscala('turno')}
                  className={`rounded px-3 py-1 font-medium transition ${
                    visualizacaoEscala === 'turno'
                      ? 'bg-white text-tinta shadow-sm'
                      : 'text-slate-500 hover:text-tinta'
                  }`}
                >
                  Por turno
                </button>
                <button
                  onClick={() => setVisualizacaoEscala('equipe')}
                  className={`rounded px-3 py-1 font-medium transition ${
                    visualizacaoEscala === 'equipe'
                      ? 'bg-white text-tinta shadow-sm'
                      : 'text-slate-500 hover:text-tinta'
                  }`}
                >
                  Por equipe
                </button>
              </div>

              {emOrganizacao(periodo.status) && (
                <button
                  onClick={handleGerarAutomatico}
                  disabled={gerandoMensal}
                  className="rounded-md bg-profundo px-3 py-1.5 text-sm font-medium text-white hover:bg-profundo/90 disabled:opacity-60"
                >
                  {gerandoMensal ? 'Gerando...' : 'Gerar escala automaticamente'}
                </button>
              )}
            </div>
          </div>

          {lacunas.length > 0 &&
            (emOrganizacao(periodo.status) || edicaoHabilitada) && (
            <div className="mt-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-medium">
                Toda equipe precisa ter alguém em todos os turnos. Faltam {lacunas.length}:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {lacunas.map((l) => (
                  <li key={`${l.data}-${l.equipe}-${l.turno}`}>
                    {nomeDoDia(l.data, periodo.data_inicio)} ({formatarData(l.data)}) — {l.equipe},{' '}
                    {l.turno}
                  </li>
                ))}
              </ul>
              {emOrganizacao(periodo.status) && (
                <p className="mt-1">A escala só pode ser confirmada depois que todos forem cobertos.</p>
              )}
            </div>
          )}

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
            <div className="mt-3 space-y-6">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white p-5">
                  <Skeleton className="h-5 w-32" />
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[0, 1, 2].map((j) => (
                      <Skeleton key={j} className="h-24 w-full" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : visualizacaoEscala === 'equipe' ? (
            <div className="mt-3 space-y-6">
              {[periodo.data_inicio, periodo.data_fim].map((data) => {
                const turnosDisponiveisNesseDia = turnosDoDia(data);
                const { equipes, porEquipeETurno } = matrizEquipePorDia(data);

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
                    ) : equipes.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-400">Ninguém escalado neste dia.</p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {equipes.map((nomeEquipe) => {
                          const totalEquipe = turnosDisponiveisNesseDia.reduce(
                            (soma, turno) =>
                              soma + (porEquipeETurno.get(nomeEquipe)?.get(turno.id)?.length ?? 0),
                            0
                          );

                          return (
                            <div
                              key={nomeEquipe}
                              className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"
                            >
                              <div className="flex items-center justify-between">
                                <p className="font-display font-semibold text-tinta">
                                  {nomeEquipe}
                                </p>
                                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                                  {totalEquipe} escalado{totalEquipe !== 1 ? 's' : ''}
                                </span>
                              </div>

                              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {turnosDisponiveisNesseDia.map((turno) => {
                                  const membros =
                                    porEquipeETurno.get(nomeEquipe)?.get(turno.id) ?? [];
                                  const cor = corTurno(turno.nome);

                                  return (
                                    <div
                                      key={turno.id}
                                      className="rounded-md border border-slate-200 bg-white p-3"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className={`h-2 w-2 rounded-full ${cor.dot}`} />
                                        <p className="text-sm font-medium text-tinta">
                                          {turno.nome}
                                        </p>
                                      </div>
                                      <p className="font-mono text-xs text-slate-400">
                                        {turno.hora_inicio.slice(0, 5)}–
                                        {turno.hora_fim.slice(0, 5)}
                                      </p>

                                      <div className="mt-2 space-y-1">
                                        {membros.length === 0 ? (
                                          <p className="text-xs text-slate-300">Ninguém</p>
                                        ) : (
                                          membros.map((m) => (
                                            <p
                                              key={m.colaboradorId}
                                              className={`truncate rounded px-2 py-1 text-xs font-medium ${cor.bgLight} ${cor.text}`}
                                            >
                                              {m.nome}
                                            </p>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
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
                      <>
                        {!escalaEstaTrancada && (
                          <div className="mt-4 hidden flex-wrap gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 sm:flex">
                            {colaboradores.map((c) => (
                                <span
                                  key={c.id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/colaborador-id', c.id);
                                  }}
                                  className="cursor-grab rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-tinta active:cursor-grabbing"
                                  title="Arraste para um turno"
                                >
                                  {c.nome_completo}
                                </span>
                              ))}
                          </div>
                        )}
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {turnosDisponiveisNesseDia.map((turno) => {
                          const escalados = escaladosEm(data, turno.id);
                          const cor = corTurno(turno.nome);

                          const disponiveis = colaboradores.filter(
                            (c) =>
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
                              onDragOver={(e) => {
                                if (!escalaEstaTrancada) e.preventDefault();
                              }}
                              onDrop={(e) => {
                                if (escalaEstaTrancada) return;
                                e.preventDefault();
                                const colaboradorId = e.dataTransfer.getData('text/colaborador-id');
                                if (!colaboradorId) return;

                                const podeEscalar =
                                  !colaboradorJaEscalado(colaboradorId, data, turno.id);

                                if (!podeEscalar) {
                                  toast(
                                    'Esta pessoa já está escalada neste turno.',
                                    'erro'
                                  );
                                  return;
                                }

                                handleAdicionar(colaboradorId, data, turno.id);
                              }}
                              className="rounded-md border border-slate-200 p-3 transition sm:border-dashed sm:hover:border-esmeralda sm:hover:bg-esmeralda-light/30"
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
                                {escalados.map((e) => (
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
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Zona de risco */}
          <div className="mt-10">
            <SecaoRecolhivel
              titulo="Zona de risco"
              tom="perigo"
              padraoAberta={false}
              descricao="Ações que apagam dados permanentemente."
            >
              <p className="text-sm text-red-700">
                Estas ações apagam dados permanentemente e não podem ser desfeitas.
                Use apenas se precisar corrigir um erro de teste ou reiniciar o
                processo deste período.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={handleResetarSoEscala}
                  disabled={atualizandoStatus}
                  className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  Excluir a escala
                </button>
              </div>
            </SecaoRecolhivel>
          </div>
        </div>
      )}
    </div>
  );
}