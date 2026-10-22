import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import { blocoDaEscala, type BlocoDeTrabalho, type EscalaDoBloco } from '../../lib/blocosDeTrabalho';


interface SolicitacaoTrocaAdmin {
  id: string;
  status: string;
  criado_em: string;
  tipo: 'troca' | 'cobertura';
  solicitanteNome: string;
  colegaNome: string;
  blocoSolicitante: BlocoDeTrabalho | null;
  blocoColega: BlocoDeTrabalho | null;
}

function formatarEscala(row: unknown): EscalaDoBloco | null {
  return (row as EscalaDoBloco | null) ?? null;
}

// Busca todas as linhas dos blocos (pessoa + data) das escalas referenciadas.
async function carregarBlocos(referencias: (EscalaDoBloco | null)[]) {
  const validas = referencias.filter((e): e is EscalaDoBloco => !!e);
  if (validas.length === 0) return [];
  const { data } = await supabase
    .from('escalas')
    .select(
      'id, colaborador_id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot'
    )
    .in('colaborador_id', [...new Set(validas.map((e) => e.colaborador_id as string))])
    .in('data', [...new Set(validas.map((e) => e.data))]);
  return data ?? [];
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
        `id, status, criado_em, tipo,
         escala_solicitante:escalas!solicitacoes_troca_escala_solicitante_id_fkey(id, colaborador_id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot),
         escala_colega:escalas!solicitacoes_troca_escala_colega_id_fkey(id, colaborador_id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot),
         solicitante:colaboradores!solicitacoes_troca_solicitante_id_fkey(perfis(nome_completo)),
         colega:colaboradores!solicitacoes_troca_colega_id_fkey(perfis(nome_completo))`
      )
      .order('criado_em', { ascending: false });

    if (error) {
      setErro('Não foi possível carregar as solicitações de troca.');
      setCarregando(false);
      return;
    }

    const blocos = await carregarBlocos(
      (data ?? []).flatMap((s) => [formatarEscala(s.escala_solicitante), formatarEscala(s.escala_colega)])
    );

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
        tipo: s.tipo,
        solicitanteNome: solicitantePerfil?.nome_completo ?? '(desconhecido)',
        colegaNome: colegaPerfil?.nome_completo ?? '(desconhecido)',
        blocoSolicitante: blocoDaEscala(formatarEscala(s.escala_solicitante), blocos),
        blocoColega: blocoDaEscala(formatarEscala(s.escala_colega), blocos),
      };
    });

    setSolicitacoes(lista);
    setCarregando(false);
  }, []);

    useEffect(() => {
    carregar();
  }, [carregar]);

  // Escuta em tempo real qualquer mudança nas solicitações de troca.
  useEffect(() => {
    const canal = supabase
      .channel('solicitacoes-troca-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solicitacoes_troca' },
        () => carregar()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  // Os dois blocos de trabalho trocam de dono numa única transação no banco
  // (função aprovar_troca); se algo falhar, nada é alterado.
  async function aprovar(solicitacaoId: string) {
    if (!session?.user) return { erro: 'Sessão inválida.', turnosTrocados: 0 };

    setProcessando(solicitacaoId);
    const { data, error } = await supabase.rpc('aprovar_troca', {
      p_solicitacao_id: solicitacaoId,
    });
    setProcessando(null);

    if (error) {
      // Erros de regra da função (ex.: nenhum turno mudaria) vêm com mensagem
      // própria; conflito de horário vem como erro de restrição.
      const conflito = error.code === '23P01' || error.code === '23505';
      return {
        erro: conflito
          ? 'Não foi possível executar a troca: alguém já trabalha no horário que receberia. Nada foi alterado.'
          : `Não foi possível executar a troca. Nada foi alterado. ${error.message ?? ''}`.trim(),
        turnosTrocados: 0,
      };
    }

    await carregar();
    return { erro: null, turnosTrocados: (data as number | null) ?? 0 };
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