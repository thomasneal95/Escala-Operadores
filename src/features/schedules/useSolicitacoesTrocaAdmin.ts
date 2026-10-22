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
  // Troca aprovada (de dias que ainda não passaram) que não está refletida
  // por inteiro na escala — pode ser aplicada com aplicar().
  naoAplicada: boolean;
}

function hojeIso() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
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
    setErro(null);

    const { data, error } = await supabase
      .from('solicitacoes_troca')
      .select(
        `id, status, criado_em, tipo, solicitante_id, colega_id,
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

    // Mesma regra da função aplicar_troca_aprovada: ainda há turno com a
    // pessoa errada no dia entregue (ou, no mesmo dia, nada foi aplicado).
    const hoje = hojeIso();
    const aprovadasFuturas = (data ?? []).filter((s) => {
      const a = formatarEscala(s.escala_solicitante);
      const b = formatarEscala(s.escala_colega);
      return s.status === 'aprovado' && a && a.data >= hoje && (!b || b.data >= hoje);
    });
    const linhasDasPessoas = aprovadasFuturas.length
      ? (
          await supabase
            .from('escalas')
            .select('colaborador_id, data')
            .in(
              'colaborador_id',
              [...new Set(aprovadasFuturas.flatMap((s) => [s.solicitante_id, s.colega_id]))]
            )
            .in(
              'data',
              [
                ...new Set(
                  aprovadasFuturas.flatMap((s) =>
                    [formatarEscala(s.escala_solicitante)?.data, formatarEscala(s.escala_colega)?.data].filter(
                      (d): d is string => !!d
                    )
                  )
                ),
              ]
            )
        ).data ?? []
      : [];
    const trabalha = (colaboradorId: string, dia: string) =>
      linhasDasPessoas.some((l) => l.colaborador_id === colaboradorId && l.data === dia);

    function naoAplicada(s: (typeof aprovadasFuturas)[number]) {
      if (!aprovadasFuturas.includes(s)) return false;
      const a = formatarEscala(s.escala_solicitante)!;
      const b = formatarEscala(s.escala_colega);
      if (s.tipo === 'cobertura') return trabalha(s.solicitante_id, a.data);
      if (!b) return false;
      if (a.data !== b.data) {
        return trabalha(s.solicitante_id, a.data) || trabalha(s.colega_id, b.data);
      }
      return a.colaborador_id === s.solicitante_id && b.colaborador_id === s.colega_id;
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
        tipo: s.tipo,
        solicitanteNome: solicitantePerfil?.nome_completo ?? '(desconhecido)',
        colegaNome: colegaPerfil?.nome_completo ?? '(desconhecido)',
        blocoSolicitante: blocoDaEscala(formatarEscala(s.escala_solicitante), blocos),
        blocoColega: blocoDaEscala(formatarEscala(s.escala_colega), blocos),
        naoAplicada: naoAplicada(s),
      };
    });

    setSolicitacoes(lista);
    setCarregando(false);
  }, []);

  // "Carregando" só na primeira carga; depois de aprovar ou aplicar, a lista
  // é atualizada sem esconder a tela.
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

  // Completa na escala uma troca já aprovada que não chegou (ou chegou só em
  // parte) aos turnos dos operadores.
  async function aplicar(solicitacaoId: string) {
    setProcessando(solicitacaoId);
    const { data, error } = await supabase.rpc('aplicar_troca_aprovada', {
      p_solicitacao_id: solicitacaoId,
    });
    setProcessando(null);

    // Já refletida (ex.: outra troca do mesmo dia já moveu o bloco inteiro).
    if (error?.message?.includes('Nada a aplicar')) {
      await carregar();
      return { erro: null, turnosTrocados: 0 };
    }

    if (error) {
      const conflito = error.code === '23P01' || error.code === '23505';
      return {
        erro: conflito
          ? 'Não foi possível aplicar: alguém já trabalha no horário que receberia. Nada foi alterado.'
          : `Não foi possível aplicar a troca. ${error.message ?? ''}`.trim(),
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

  return { solicitacoes, carregando, erro, processando, aprovar, aplicar, rejeitar };
}