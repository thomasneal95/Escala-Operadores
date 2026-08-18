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

interface SolicitacaoTrocaAdmin {
  id: string;
  status: string;
  criado_em: string;
  solicitanteNome: string;
  colegaNome: string;
  escalaSolicitante: EscalaResumo | null;
  escalaColega: EscalaResumo | null;
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

export function useSolicitacoesTrocaAdmin() {
  const { session } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoTrocaAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase
      .from('solicitacoes_troca')
      .select(
        `id, status, criado_em,
         escala_solicitante:escalas!solicitacoes_troca_escala_solicitante_id_fkey(id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot),
         escala_colega:escalas!solicitacoes_troca_escala_colega_id_fkey(id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot),
         solicitante:colaboradores!solicitacoes_troca_solicitante_id_fkey(perfis(nome_completo)),
         colega:colaboradores!solicitacoes_troca_colega_id_fkey(perfis(nome_completo))`
      )
      .order('criado_em', { ascending: false });

    if (error) {
      setErro('Não foi possível carregar as solicitações de troca.');
      setCarregando(false);
      return;
    }

    const lista: SolicitacaoTrocaAdmin[] = (data ?? []).map((s) => {
      const solicitantePerfil = (
        s.solicitante as unknown as { perfis: { nome_completo: string } | null }
      )?.perfis;
      const colegaPerfil = (s.colega as unknown as { perfis: { nome_completo: string } | null })
        ?.perfis;

      return {
        id: s.id,
        status: s.status,
        criado_em: s.criado_em,
        solicitanteNome: solicitantePerfil?.nome_completo ?? '(desconhecido)',
        colegaNome: colegaPerfil?.nome_completo ?? '(desconhecido)',
        escalaSolicitante: formatarEscala(s.escala_solicitante),
        escalaColega: formatarEscala(s.escala_colega),
      };
    });

    setSolicitacoes(lista);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function aprovar(solicitacaoId: string, escalaSolicitanteId: string, escalaColegaId: string) {
    if (!session?.user) return { erro: 'Sessão inválida.' };

    setProcessando(solicitacaoId);

    // Busca quem está em cada linha de escala hoje, para trocar os dois.
    const { data: escalasAtuais, error: erroConsulta } = await supabase
      .from('escalas')
      .select('id, colaborador_id')
      .in('id', [escalaSolicitanteId, escalaColegaId]);

    if (erroConsulta || !escalasAtuais || escalasAtuais.length !== 2) {
      setProcessando(null);
      return { erro: 'Não foi possível localizar as escalas envolvidas na troca.' };
    }

    const escalaA = escalasAtuais.find((e) => e.id === escalaSolicitanteId)!;
    const escalaB = escalasAtuais.find((e) => e.id === escalaColegaId)!;

    // Troca os dois colaborador_id entre si.
    const { error: erroA } = await supabase
      .from('escalas')
      .update({ colaborador_id: escalaB.colaborador_id })
      .eq('id', escalaSolicitanteId);

    if (erroA) {
      setProcessando(null);
      return { erro: 'Não foi possível executar a troca (etapa 1).' };
    }

    const { error: erroB } = await supabase
      .from('escalas')
      .update({ colaborador_id: escalaA.colaborador_id })
      .eq('id', escalaColegaId);

    if (erroB) {
      // Tenta reverter a primeira alteração para não deixar inconsistente.
      await supabase
        .from('escalas')
        .update({ colaborador_id: escalaA.colaborador_id })
        .eq('id', escalaSolicitanteId);
      setProcessando(null);
      return { erro: 'Não foi possível executar a troca (etapa 2). Nada foi alterado.' };
    }

    const { error: erroStatus } = await supabase
      .from('solicitacoes_troca')
      .update({
        status: 'aprovado',
        respondido_admin_em: new Date().toISOString(),
        admin_id: session.user.id,
      })
      .eq('id', solicitacaoId);

    setProcessando(null);

    if (erroStatus) {
      return { erro: 'A troca foi executada, mas não foi possível atualizar o status da solicitação.' };
    }

    await carregar();
    return { erro: null };
  }

  async function rejeitar(solicitacaoId: string) {
    if (!session?.user) return { erro: 'Sessão inválida.' };

    setProcessando(solicitacaoId);
    const { error } = await supabase
      .from('solicitacoes_troca')
      .update({
        status: 'rejeitado_pelo_admin',
        respondido_admin_em: new Date().toISOString(),
        admin_id: session.user.id,
      })
      .eq('id', solicitacaoId);
    setProcessando(null);

    if (error) {
      return { erro: 'Não foi possível rejeitar a solicitação.' };
    }

    await carregar();
    return { erro: null };
  }

  return { solicitacoes, carregando, erro, processando, aprovar, rejeitar };
}