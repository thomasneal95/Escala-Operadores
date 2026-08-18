import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

interface EscalaResumo {
  id: string;
  data: string;
  turno_nome_snapshot: string;
  turno_hora_inicio_snapshot: string;
  turno_hora_fim_snapshot: string;
}

interface SolicitacaoTroca {
  id: string;
  periodo_id: string;
  status:
    | 'pendente'
    | 'aceito_pelo_colega'
    | 'aprovado'
    | 'rejeitado_pelo_colega'
    | 'rejeitado_pelo_admin'
    | 'cancelado';
  criado_em: string;
  souSolicitante: boolean;
  outraPessoaNome: string;
  minhaEscala: EscalaResumo | null;
  escalaOutraPessoa: EscalaResumo | null;
}

function formatarEscala(row: unknown): EscalaResumo | null {
  const e = row as {
    id: string;
    data: string;
    turno_nome_snapshot: string;
    turno_hora_inicio_snapshot: string;
    turno_hora_fim_snapshot: string;
  } | null;
  if (!e) return null;
  return {
    id: e.id,
    data: e.data,
    turno_nome_snapshot: e.turno_nome_snapshot,
    turno_hora_inicio_snapshot: e.turno_hora_inicio_snapshot,
    turno_hora_fim_snapshot: e.turno_hora_fim_snapshot,
  };
}

export function useSolicitacoesTroca() {
  const { session } = useAuth();
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoTroca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!session?.user) return;

    setCarregando(true);
    setErro(null);

    const { data: colaborador, error: erroColaborador } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('perfil_id', session.user.id)
      .single();

    if (erroColaborador || !colaborador) {
      setErro('Não foi possível encontrar seu cadastro de colaborador.');
      setCarregando(false);
      return;
    }

    setColaboradorId(colaborador.id);

    const { data, error } = await supabase
      .from('solicitacoes_troca')
      .select(
        `id, periodo_id, status, criado_em, solicitante_id, colega_id,
         escala_solicitante:escalas!solicitacoes_troca_escala_solicitante_id_fkey(id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot),
         escala_colega:escalas!solicitacoes_troca_escala_colega_id_fkey(id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot),
         solicitante:colaboradores!solicitacoes_troca_solicitante_id_fkey(perfis(nome_completo)),
         colega:colaboradores!solicitacoes_troca_colega_id_fkey(perfis(nome_completo))`
      )
      .or(`solicitante_id.eq.${colaborador.id},colega_id.eq.${colaborador.id}`)
      .order('criado_em', { ascending: false });

    if (error) {
      setErro('Não foi possível carregar as solicitações de troca.');
      setCarregando(false);
      return;
    }

    const lista: SolicitacaoTroca[] = (data ?? []).map((s) => {
      const souSolicitante = s.solicitante_id === colaborador.id;
      const solicitantePerfil = (
        s.solicitante as unknown as { perfis: { nome_completo: string } | null }
      )?.perfis;
      const colegaPerfil = (s.colega as unknown as { perfis: { nome_completo: string } | null })
        ?.perfis;

      return {
        id: s.id,
        periodo_id: s.periodo_id,
        status: s.status,
        criado_em: s.criado_em,
        souSolicitante,
        outraPessoaNome: souSolicitante
          ? colegaPerfil?.nome_completo ?? '(desconhecido)'
          : solicitantePerfil?.nome_completo ?? '(desconhecido)',
        minhaEscala: souSolicitante
          ? formatarEscala(s.escala_solicitante)
          : formatarEscala(s.escala_colega),
        escalaOutraPessoa: souSolicitante
          ? formatarEscala(s.escala_colega)
          : formatarEscala(s.escala_solicitante),
      };
    });

    setSolicitacoes(lista);
    setCarregando(false);
  }, [session]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarSolicitacao(periodoId: string, escalaSolicitanteId: string, colegaId: string) {
    if (!colaboradorId) return { erro: 'Não foi possível identificar seus dados.' };

    setProcessando('nova');
    const { error } = await supabase.from('solicitacoes_troca').insert({
      periodo_id: periodoId,
      solicitante_id: colaboradorId,
      escala_solicitante_id: escalaSolicitanteId,
      colega_id: colegaId,
    });
    setProcessando(null);

    if (error) {
      return { erro: 'Não foi possível criar a solicitação de troca.' };
    }

    await carregar();
    return { erro: null };
  }

  async function aceitarSolicitacao(solicitacaoId: string, escalaColegaId: string) {
    setProcessando(solicitacaoId);
    const { error } = await supabase
      .from('solicitacoes_troca')
      .update({
        escala_colega_id: escalaColegaId,
        status: 'aceito_pelo_colega',
        respondido_colega_em: new Date().toISOString(),
      })
      .eq('id', solicitacaoId);
    setProcessando(null);

    if (error) {
      return { erro: 'Não foi possível aceitar a solicitação.' };
    }

    await carregar();
    return { erro: null };
  }

  async function recusarSolicitacao(solicitacaoId: string) {
    setProcessando(solicitacaoId);
    const { error } = await supabase
      .from('solicitacoes_troca')
      .update({
        status: 'rejeitado_pelo_colega',
        respondido_colega_em: new Date().toISOString(),
      })
      .eq('id', solicitacaoId);
    setProcessando(null);

    if (error) {
      return { erro: 'Não foi possível recusar a solicitação.' };
    }

    await carregar();
    return { erro: null };
  }

  async function cancelarSolicitacao(solicitacaoId: string) {
    setProcessando(solicitacaoId);
    const { error } = await supabase
      .from('solicitacoes_troca')
      .update({ status: 'cancelado' })
      .eq('id', solicitacaoId);
    setProcessando(null);

    if (error) {
      return { erro: 'Não foi possível cancelar a solicitação.' };
    }

    await carregar();
    return { erro: null };
  }

  return {
    colaboradorId,
    solicitacoes,
    carregando,
    erro,
    processando,
    criarSolicitacao,
    aceitarSolicitacao,
    recusarSolicitacao,
    cancelarSolicitacao,
    recarregar: carregar,
  };
}