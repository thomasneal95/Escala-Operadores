import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import { blocoDaEscala, type BlocoDeTrabalho, type EscalaDoBloco } from '../../lib/blocosDeTrabalho';


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
  // 'troca': os dois dias trocam de dono; 'cobertura': o colega só cobre o
  // dia de quem pediu, sem devolver nenhum.
  tipo: 'troca' | 'cobertura';
  souSolicitante: boolean;
  outraPessoaNome: string;
  meuBloco: BlocoDeTrabalho | null;
  blocoOutraPessoa: BlocoDeTrabalho | null;
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

export function useSolicitacoesTroca() {
  // Identifica esta instância do hook de forma única — se dois componentes
  // chamarem useSolicitacoesTroca ao mesmo tempo para o mesmo colaborador,
  // o Supabase reaproveita o canal (mesmo topic) e o segundo `.on()` lança
  // erro por já estar inscrito. Ver mesmo problema em useMinhaEscala.
  const idInstancia = useId();
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
        `id, periodo_id, status, criado_em, tipo, solicitante_id, colega_id,
         escala_solicitante:escalas!solicitacoes_troca_escala_solicitante_id_fkey(id, colaborador_id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot),
         escala_colega:escalas!solicitacoes_troca_escala_colega_id_fkey(id, colaborador_id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot),
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

    const blocos = await carregarBlocos(
      (data ?? []).flatMap((s) => [formatarEscala(s.escala_solicitante), formatarEscala(s.escala_colega)])
    );

    const lista: SolicitacaoTroca[] = (data ?? []).map((s) => {
      const blocoSolicitante = blocoDaEscala(formatarEscala(s.escala_solicitante), blocos);
      const blocoColega = blocoDaEscala(formatarEscala(s.escala_colega), blocos);
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
        tipo: s.tipo,
        souSolicitante,
        outraPessoaNome: souSolicitante
          ? colegaPerfil?.nome_completo ?? '(desconhecido)'
          : solicitantePerfil?.nome_completo ?? '(desconhecido)',
        meuBloco: souSolicitante ? blocoSolicitante : blocoColega,
        blocoOutraPessoa: souSolicitante ? blocoColega : blocoSolicitante,
      };
    });

    setSolicitacoes(lista);
    setCarregando(false);
  }, [session]);

    useEffect(() => {
    carregar();
  }, [carregar]);

  // Escuta em tempo real solicitações onde sou solicitante OU colega.
  useEffect(() => {
    if (!colaboradorId) return;

    const canal = supabase
      .channel(`solicitacoes-troca-${colaboradorId}-${idInstancia}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitacoes_troca',
          filter: `solicitante_id=eq.${colaboradorId}`,
        },
        () => carregar()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitacoes_troca',
          filter: `colega_id=eq.${colaboradorId}`,
        },
        () => carregar()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [colaboradorId, carregar, idInstancia]);

  // escalaColegaId: dia do colega que quem pede quer pegar (opcional; sem
  // ele, o colega escolhe ao aceitar). Na cobertura não há dia de volta.
  async function criarSolicitacao(
    periodoId: string,
    escalaSolicitanteId: string,
    colegaId: string,
    opcoes: { tipo: 'troca' | 'cobertura'; escalaColegaId: string | null }
  ) {
    if (!colaboradorId) return { erro: 'Não foi possível identificar seus dados.' };

    setProcessando('nova');
    const { error } = await supabase.from('solicitacoes_troca').insert({
      periodo_id: periodoId,
      solicitante_id: colaboradorId,
      escala_solicitante_id: escalaSolicitanteId,
      colega_id: colegaId,
      tipo: opcoes.tipo,
      escala_colega_id: opcoes.tipo === 'troca' ? opcoes.escalaColegaId : null,
    });
    setProcessando(null);

    if (error) {
      return { erro: 'Não foi possível criar a solicitação de troca.' };
    }

    await carregar();
    return { erro: null };
  }

  // escalaColegaId null: o dia de volta já foi escolhido por quem pediu,
  // ou é uma cobertura (sem dia de volta).
  async function aceitarSolicitacao(solicitacaoId: string, escalaColegaId: string | null) {
    setProcessando(solicitacaoId);
    const { error } = await supabase
      .from('solicitacoes_troca')
      .update({
        ...(escalaColegaId ? { escala_colega_id: escalaColegaId } : {}),
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