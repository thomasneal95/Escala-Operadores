import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import type { PeriodoOperacao, Turno } from '../../types/database';

interface ColaboradorComPerfil {
  id: string;
  nome_completo: string;
  equipe_nome: string | null;
}

interface DisponibilidadeResposta {
  colaborador_id: string;
  data: string;
  turno_id: string;
  disponivel: boolean;
}

export function useVisaoAdmin() {
  const { session } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoOperacao | null>(null);
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

    const { data: periodoData, error: erroPeriodo } = await supabase
      .from('periodos_operacao')
      .select('id, data_inicio, data_fim, status')
      .order('data_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (erroPeriodo) {
      setErro('Não foi possível carregar o período de operação.');
      setCarregando(false);
      return;
    }

    setPeriodo(periodoData ?? null);

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
      .select('id, perfis(nome_completo), equipes(nome)')
      .eq('ativo', true);

    if (erroColaboradores) {
      setErro('Não foi possível carregar os colaboradores.');
      setCarregando(false);
      return;
    }

    const colaboradoresFormatados: ColaboradorComPerfil[] = (colaboradoresData ?? []).map(
      (c) => {
        const perfil = c.perfis as unknown as { nome_completo: string } | null;
        const equipe = c.equipes as unknown as { nome: string } | null;
        return {
          id: c.id,
          nome_completo: perfil?.nome_completo ?? '(sem nome)',
          equipe_nome: equipe?.nome ?? null,
        };
      }
    );

    colaboradoresFormatados.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    setColaboradores(colaboradoresFormatados);

    if (periodoData) {
      const { data: disponibilidadesData, error: erroDisponibilidades } = await supabase
        .from('disponibilidades')
        .select('colaborador_id, data, turno_id, disponivel')
        .eq('periodo_id', periodoData.id);

      if (erroDisponibilidades) {
        setErro('Não foi possível carregar as disponibilidades.');
        setCarregando(false);
        return;
      }

      setRespostas(disponibilidadesData ?? []);
    } else {
      setRespostas([]);
    }

    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

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

    setPeriodo({ ...periodo, status: 'em_organizacao' });
    return { erro: null };
  }

  async function confirmarEscala() {
    if (!periodo || !session?.user) return { erro: 'Nenhum período carregado.' };

    setAtualizandoStatus(true);
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

    setPeriodo({ ...periodo, status: 'confirmado' });
    return { erro: null };
  }

  async function criarNovoPeriodo(dataInicio: string, dataFim: string) {
    if (!session?.user) return { erro: 'Sessão inválida.' };

    setAtualizandoStatus(true);
    const { error } = await supabase.from('periodos_operacao').insert({
      data_inicio: dataInicio,
      data_fim: dataFim,
      created_by: session.user.id,
    });
    setAtualizandoStatus(false);

    if (error) {
      let mensagem = 'Não foi possível criar o período.';
      if (error.code === '23505') {
        mensagem = 'Já existe um período com essas datas.';
      } else if (error.code === '23514') {
        mensagem = 'A data final não pode ser anterior à data inicial.';
      }
      return { erro: mensagem };
    }

    await carregar();
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

    setPeriodo({ ...periodo, status: novoStatus });
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

  return {
    periodo,
    turnos,
    colaboradores,
    carregando,
    erro,
    respostaDe,
    temAlgumaResposta,
    recarregar: carregar,
    encerrarRecebimento,
    confirmarEscala,
    criarNovoPeriodo,
    resetarPeriodo,
    excluirDisponibilidadeDoColaborador,
    excluindoDisponibilidade,
    atualizandoStatus,
  };
}