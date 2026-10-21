import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import type { PeriodoOperacao, Turno } from '../../types/database';
import { lacunasDeCobertura } from './coberturaEquipes';

interface ColaboradorComPerfil {
  id: string;
  nome_completo: string;
  equipe_id: string | null;
  equipe_nome: string | null;
  turno_semana_id: string | null;
}

interface DisponibilidadeResposta {
  colaborador_id: string;
  data: string;
  turno_id: string;
  disponivel: boolean;
}

function hojeIso() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

export function useVisaoAdmin() {
  const { session } = useAuth();
  const [periodos, setPeriodos] = useState<PeriodoOperacao[]>([]);
  const [periodoId, setPeriodoId] = useState<string | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorComPerfil[]>([]);
  const [respostas, setRespostas] = useState<DisponibilidadeResposta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);
  const [excluindoDisponibilidade, setExcluindoDisponibilidade] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data: periodosData, error: erroPeriodo } = await supabase
      .from('periodos_operacao')
      .select('id, data_inicio, data_fim, status')
      .order('data_inicio', { ascending: false })
      .limit(60);

    if (erroPeriodo) {
      setErro('Não foi possível carregar o período de operação.');
      setCarregando(false);
      return;
    }

    const lista = periodosData ?? [];
    setPeriodos(lista);

    // Mantém o fim de semana já selecionado; senão abre o próximo que ainda
    // não passou (ou, se não houver, o mais recente).
    setPeriodoId((atual) => {
      if (atual && lista.some((p) => p.id === atual)) return atual;
      const hoje = hojeIso();
      const proximos = lista.filter((p) => p.data_fim >= hoje);
      return (proximos[proximos.length - 1] ?? lista[0])?.id ?? null;
    });

    const { data: turnosData, error: erroTurnos } = await supabase
      .from('turnos')
      .select('id, nome, hora_inicio, hora_fim, ordem_exibicao, ativo_sabado, ativo_domingo')
      .eq('ativo', true)
      .order('ordem_exibicao');

    if (erroTurnos) {
      setErro('Não foi possível carregar os turnos.');
      setCarregando(false);
      return;
    }

    setTurnos(turnosData ?? []);

        const { data: colaboradoresData, error: erroColaboradores } = await supabase
      .from('colaboradores')
      .select(
        'id, equipe_id, turno_semana_id, comissionamento_individual, perfis(nome_completo, papel), equipes(nome)'
      )
      .eq('ativo', true);

    if (erroColaboradores) {
      setErro('Não foi possível carregar os colaboradores.');
      setCarregando(false);
      return;
    }

    // Administradores e colaboradores de comissionamento individual (sem
    // equipe) não aparecem na tela de escala.
    const colaboradoresSemAdmin = (colaboradoresData ?? []).filter((c) => {
      const perfil = c.perfis as unknown as { papel: string } | null;
      return perfil?.papel !== 'administrador' && !c.comissionamento_individual;
    });

    const colaboradoresFormatados: ColaboradorComPerfil[] = colaboradoresSemAdmin.map((c) => {
      const perfil = c.perfis as unknown as { nome_completo: string } | null;
      const equipe = c.equipes as unknown as { nome: string } | null;
      return {
        id: c.id,
        nome_completo: perfil?.nome_completo ?? '(sem nome)',
        equipe_id: c.equipe_id,
        equipe_nome: equipe?.nome ?? null,
        turno_semana_id: c.turno_semana_id,
      };
    });

    colaboradoresFormatados.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    setColaboradores(colaboradoresFormatados);

    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const periodo = periodos.find((p) => p.id === periodoId) ?? null;

  function atualizarStatusLocal(ids: string[], status: PeriodoOperacao['status']) {
    setPeriodos((atual) => atual.map((p) => (ids.includes(p.id) ? { ...p, status } : p)));
  }

  useEffect(() => {
    if (!periodoId) {
      setRespostas([]);
      return;
    }

    let cancelado = false;
    setRespostas([]);
    supabase
      .from('disponibilidades')
      .select('colaborador_id, data, turno_id, disponivel')
      .eq('periodo_id', periodoId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          setErro('Não foi possível carregar as disponibilidades.');
          return;
        }
        setRespostas(data ?? []);
      });

    return () => {
      cancelado = true;
    };
  }, [periodoId]);

  // Escuta mudanças em tempo real na tabela de disponibilidades deste
  // período, para que o admin veja quem enviou sem precisar recarregar.
  useEffect(() => {
    if (!periodo) return;

    const canal = supabase
      .channel(`disponibilidades-periodo-${periodo.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'disponibilidades',
          filter: `periodo_id=eq.${periodo.id}`,
        },
        (payload) => {
          setRespostas((atual) => {
            if (payload.eventType === 'DELETE') {
              const antiga = payload.old as {
                colaborador_id: string;
                data: string;
                turno_id: string;
              };
              return atual.filter(
                (r) =>
                  !(
                    r.colaborador_id === antiga.colaborador_id &&
                    r.data === antiga.data &&
                    r.turno_id === antiga.turno_id
                  )
              );
            }

            const nova = payload.new as DisponibilidadeResposta;
            const semAAntiga = atual.filter(
              (r) =>
                !(
                  r.colaborador_id === nova.colaborador_id &&
                  r.data === nova.data &&
                  r.turno_id === nova.turno_id
                )
            );
            return [...semAAntiga, nova];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [periodo?.id]);

  function respostaDe(colaboradorId: string, data: string, turnoId: string) {
    return respostas.find(
      (r) => r.colaborador_id === colaboradorId && r.data === data && r.turno_id === turnoId
    );
  }

  function temAlgumaResposta(colaboradorId: string) {
    return respostas.some((r) => r.colaborador_id === colaboradorId);
  }

  async function encerrarRecebimento() {
    if (!periodo) return { erro: 'Nenhum período carregado.' };

    setAtualizandoStatus(true);
    const { error } = await supabase
      .from('periodos_operacao')
      .update({ status: 'em_organizacao' })
      .eq('id', periodo.id);
    setAtualizandoStatus(false);

    if (error) {
      return { erro: 'Não foi possível encerrar o recebimento de disponibilidade.' };
    }

    atualizarStatusLocal([periodo.id], 'em_organizacao');
    return { erro: null };
  }

  function formatarData(data: string) {
    const [, mes, dia] = data.split('-');
    return `${dia}/${mes}`;
  }

  // Confere no banco se toda equipe tem alguém em todos os turnos dos fins
  // de semana informados. Devolve a mensagem de erro, ou null se estiver ok.
  async function verificarCobertura(lista: PeriodoOperacao[]) {
    const { data: escalas, error } = await supabase
      .from('escalas')
      .select('colaborador_id, data, turno_id, periodo_id')
      .in('periodo_id', lista.map((p) => p.id));

    if (error) return 'Não foi possível verificar a cobertura das equipes.';

    const lacunas = lista.flatMap((p) =>
      lacunasDeCobertura(
        p,
        turnos,
        colaboradores,
        (escalas ?? []).filter((e) => e.periodo_id === p.id)
      )
    );
    if (lacunas.length === 0) return null;

    const exemplos = lacunas
      .slice(0, 5)
      .map((l) => `${formatarData(l.data)} ${l.equipe} – ${l.turno}`)
      .join('; ');
    return (
      `Não é possível confirmar: ${lacunas.length} turno(s) sem ninguém da equipe ` +
      `(${exemplos}${lacunas.length > 5 ? '…' : ''}).`
    );
  }

  async function confirmarEscala() {
    if (!periodo || !session?.user) return { erro: 'Nenhum período carregado.' };

    setAtualizandoStatus(true);
    const erroCobertura = await verificarCobertura([periodo]);
    if (erroCobertura) {
      setAtualizandoStatus(false);
      return { erro: erroCobertura };
    }

    const { error } = await supabase
      .from('periodos_operacao')
      .update({
        status: 'confirmado',
        confirmed_at: new Date().toISOString(),
        confirmed_by: session.user.id,
      })
      .eq('id', periodo.id);
    setAtualizandoStatus(false);

    if (error) {
      return { erro: 'Não foi possível confirmar a escala.' };
    }

    atualizarStatusLocal([periodo.id], 'confirmado');
    return { erro: null };
  }

  // Confirma de uma vez todos os fins de semana "em organização" informados
  // (ex.: todos os do mês gerado).
  async function confirmarVarios(ids: string[]) {
    if (!session?.user) return { erro: 'Sessão inválida.' };
    if (ids.length === 0) return { erro: null };

    setAtualizandoStatus(true);
    const erroCobertura = await verificarCobertura(periodos.filter((p) => ids.includes(p.id)));
    if (erroCobertura) {
      setAtualizandoStatus(false);
      return { erro: erroCobertura };
    }

    const { error } = await supabase
      .from('periodos_operacao')
      .update({
        status: 'confirmado',
        confirmed_at: new Date().toISOString(),
        confirmed_by: session.user.id,
      })
      .in('id', ids)
      .eq('status', 'em_organizacao');
    setAtualizandoStatus(false);

    if (error) {
      return { erro: 'Não foi possível confirmar as escalas do mês.' };
    }

    atualizarStatusLocal(ids, 'confirmado');
    return { erro: null };
  }

  // Reseta o período para um estado anterior: apaga a escala (e, opcionalmente,
  // as disponibilidades) e volta o status para 'em_organizacao' ou 'aberto'.
  async function resetarPeriodo(apagarDisponibilidades: boolean) {
    if (!periodo) return { erro: 'Nenhum período carregado.' };

    setAtualizandoStatus(true);

    const { error: erroEscalas } = await supabase
      .from('escalas')
      .delete()
      .eq('periodo_id', periodo.id);

    if (erroEscalas) {
      setAtualizandoStatus(false);
      return { erro: 'Não foi possível excluir a escala.' };
    }

    if (apagarDisponibilidades) {
      const { error: erroDisponibilidades } = await supabase
        .from('disponibilidades')
        .delete()
        .eq('periodo_id', periodo.id);

      if (erroDisponibilidades) {
        setAtualizandoStatus(false);
        return { erro: 'Não foi possível excluir as disponibilidades.' };
      }
    }

    const novoStatus = apagarDisponibilidades ? 'aberto' : 'em_organizacao';

    const { error: erroStatus } = await supabase
      .from('periodos_operacao')
      .update({ status: novoStatus, confirmed_at: null, confirmed_by: null })
      .eq('id', periodo.id);

    setAtualizandoStatus(false);

    if (erroStatus) {
      return { erro: 'Não foi possível atualizar o status do período.' };
    }

    atualizarStatusLocal([periodo.id], novoStatus);
    if (apagarDisponibilidades) {
      setRespostas([]);
    }

    return { erro: null };
  }

  // Exclui a disponibilidade de UM único colaborador neste período, sem
  // afetar as respostas de ninguém mais. Não altera o status do período.
  async function excluirDisponibilidadeDoColaborador(colaboradorId: string) {
    if (!periodo) return { erro: 'Nenhum período carregado.' };

    setExcluindoDisponibilidade(colaboradorId);

    const { error } = await supabase
      .from('disponibilidades')
      .delete()
      .eq('periodo_id', periodo.id)
      .eq('colaborador_id', colaboradorId);

    setExcluindoDisponibilidade(null);

    if (error) {
      return { erro: 'Não foi possível excluir a disponibilidade deste colaborador.' };
    }

    setRespostas((atual) => atual.filter((r) => r.colaborador_id !== colaboradorId));
    return { erro: null };
  }

  // Reabre o recebimento de disponibilidade sem apagar nada — nem
  // disponibilidades já enviadas, nem escalas já montadas.
  async function reabrirRecebimento() {
    if (!periodo) return { erro: 'Nenhum período carregado.' };

    setAtualizandoStatus(true);
    const { error } = await supabase
      .from('periodos_operacao')
      .update({ status: 'aberto', confirmed_at: null, confirmed_by: null })
      .eq('id', periodo.id);
    setAtualizandoStatus(false);

    if (error) {
      return { erro: 'Não foi possível reabrir o recebimento.' };
    }

    atualizarStatusLocal([periodo.id], 'aberto');
    return { erro: null };
  }

  return {
    periodo,
    periodos,
    selecionarPeriodo: setPeriodoId,
    temDisponibilidades: respostas.length > 0,
    confirmarVarios,
    turnos,
    colaboradores,
    carregando,
    erro,
    respostaDe,
    temAlgumaResposta,
    recarregar: carregar,
    encerrarRecebimento,
    confirmarEscala,
    resetarPeriodo,
    excluirDisponibilidadeDoColaborador,
    excluindoDisponibilidade,
    reabrirRecebimento,
    atualizandoStatus,
  };
}