import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

export interface ColaboradorOpcao {
  id: string;
  nome_completo: string;
}

export interface FaltaAdmin {
  id: string;
  colaboradorId: string;
  colaboradorNome: string;
  data: string;
  motivo: string | null;
  justificada: boolean;
  registradoPorNome: string;
  criadoEm: string;
}

interface DadosNovaFalta {
  colaboradorId: string;
  data: string;
  motivo: string | null;
  justificada: boolean;
}

interface DadosEdicaoFalta {
  motivo: string | null;
  justificada: boolean;
}

export function useFaltas() {
  const { session } = useAuth();
  const [colaboradores, setColaboradores] = useState<ColaboradorOpcao[]>([]);
  const [faltas, setFaltas] = useState<FaltaAdmin[]>([]);
  const [mesReferencia, setMesReferencia] = useState(() => new Date().toISOString().slice(0, 7));
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Traz todas as faltas (sem filtro de mês) — a visão geral precisa
  // enxergar todos os meses de uma vez. A tela filtra por mês só na lista
  // de lançamentos detalhados, do lado do cliente.
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const [colaboradoresResultado, faltasResultado] = await Promise.all([
      supabase
        .from('colaboradores')
        .select('id, perfis(nome_completo)')
        .eq('ativo', true)
        .eq('comissionamento_individual', false),
      supabase
        .from('faltas')
        .select(
          `id, data, motivo, justificada, created_at, colaborador_id,
           colaborador:colaboradores(perfis(nome_completo)),
           responsavel:perfis!faltas_registrado_por_fkey(nome_completo)`
        )
        .order('data', { ascending: false }),
    ]);

    if (colaboradoresResultado.error || faltasResultado.error) {
      setErro('Não foi possível carregar as faltas.');
      setCarregando(false);
      return;
    }

    const listaColaboradores: ColaboradorOpcao[] = (colaboradoresResultado.data ?? [])
      .map((c) => {
        const perfil = c.perfis as unknown as { nome_completo: string } | null;
        return { id: c.id, nome_completo: perfil?.nome_completo ?? '(sem nome)' };
      })
      .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));

    const listaFaltas: FaltaAdmin[] = (faltasResultado.data ?? []).map((f) => {
      const colaborador = f.colaborador as unknown as { perfis: { nome_completo: string } | null } | null;
      const responsavel = f.responsavel as unknown as { nome_completo: string } | null;
      return {
        id: f.id,
        colaboradorId: f.colaborador_id,
        colaboradorNome: colaborador?.perfis?.nome_completo ?? '(sem nome)',
        data: f.data,
        motivo: f.motivo,
        justificada: f.justificada,
        registradoPorNome: responsavel?.nome_completo ?? '(desconhecido)',
        criadoEm: f.created_at,
      };
    });

    setColaboradores(listaColaboradores);
    setFaltas(listaFaltas);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function registrar(dados: DadosNovaFalta) {
    if (!session?.user) return { erro: 'Sessão expirada.' };

    setProcessando('novo');
    const { error } = await supabase.from('faltas').insert({
      colaborador_id: dados.colaboradorId,
      data: dados.data,
      motivo: dados.motivo,
      justificada: dados.justificada,
      registrado_por: session.user.id,
    });
    setProcessando(null);

    if (error) {
      if (error.code === '23505') {
        return { erro: 'Já existe uma falta registrada para esse colaborador nesse dia.' };
      }
      return { erro: 'Não foi possível registrar a falta.' };
    }

    await carregar();
    // Pula pro mês da falta recém-lançada, pra ela aparecer de cara na
    // lista de lançamentos detalhados.
    setMesReferencia(dados.data.slice(0, 7));
    return { erro: null };
  }

  async function atualizar(id: string, dados: DadosEdicaoFalta) {
    setProcessando(id);
    const { error } = await supabase
      .from('faltas')
      .update({ motivo: dados.motivo, justificada: dados.justificada })
      .eq('id', id);
    setProcessando(null);

    if (error) return { erro: 'Não foi possível atualizar a falta.' };
    await carregar();
    return { erro: null };
  }

  async function excluir(id: string) {
    setProcessando(id);
    const { error } = await supabase.from('faltas').delete().eq('id', id);
    setProcessando(null);

    if (error) return { erro: 'Não foi possível excluir a falta.' };
    await carregar();
    return { erro: null };
  }

  return {
    colaboradores,
    faltas,
    mesReferencia,
    setMesReferencia,
    carregando,
    processando,
    erro,
    registrar,
    atualizar,
    excluir,
  };
}
