import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

interface EscalaHistoricoAdmin {
  id: string;
  colaborador_id: string;
  colaborador_nome: string;
  data: string;
  turno_nome_snapshot: string;
  turno_hora_inicio_snapshot: string;
  turno_hora_fim_snapshot: string;
  compareceu: boolean | null;
}

interface PeriodoHistoricoAdmin {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: 'confirmado' | 'encerrado';
  escalas: EscalaHistoricoAdmin[];
}

export function useHistoricoAdmin() {
  const { session } = useAuth();
  const [periodos, setPeriodos] = useState<PeriodoHistoricoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data: periodosData, error: erroPeriodos } = await supabase
      .from('periodos_operacao')
      .select('id, data_inicio, data_fim, status')
      .in('status', ['confirmado', 'encerrado'])
      .order('data_inicio', { ascending: false });

    if (erroPeriodos) {
      setErro('Não foi possível carregar o histórico de períodos.');
      setCarregando(false);
      return;
    }

    const idsPeriodos = (periodosData ?? []).map((p) => p.id);

    const { data: escalasData, error: erroEscalas } = await supabase
      .from('escalas')
      .select(
        'id, periodo_id, colaborador_id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot, compareceu, colaboradores(perfis(nome_completo))'
      )
      .in('periodo_id', idsPeriodos.length > 0 ? idsPeriodos : ['00000000-0000-0000-0000-000000000000']);

    if (erroEscalas) {
      setErro('Não foi possível carregar as escalas do histórico.');
      setCarregando(false);
      return;
    }

    const historico: PeriodoHistoricoAdmin[] = (periodosData ?? []).map((p) => ({
      id: p.id,
      data_inicio: p.data_inicio,
      data_fim: p.data_fim,
      status: p.status as 'confirmado' | 'encerrado',
      escalas: (escalasData ?? [])
        .filter((e) => e.periodo_id === p.id)
        .map((e) => {
          const colaborador = e.colaboradores as unknown as {
            perfis: { nome_completo: string } | null;
          } | null;
          return {
            id: e.id,
            colaborador_id: e.colaborador_id,
            colaborador_nome: colaborador?.perfis?.nome_completo ?? '(desconhecido)',
            data: e.data,
            turno_nome_snapshot: e.turno_nome_snapshot,
            turno_hora_inicio_snapshot: e.turno_hora_inicio_snapshot,
            turno_hora_fim_snapshot: e.turno_hora_fim_snapshot,
            compareceu: e.compareceu,
          };
        })
        .sort((a, b) => a.colaborador_nome.localeCompare(b.colaborador_nome)),
    }));

    setPeriodos(historico);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function marcarPresenca(escalaId: string, compareceu: boolean) {
    if (!session?.user) return { erro: 'Sessão inválida.' };

    setProcessando(escalaId);

    const { error } = await supabase
      .from('escalas')
      .update({
        compareceu,
        presenca_confirmada_em: new Date().toISOString(),
        presenca_confirmada_por: session.user.id,
      })
      .eq('id', escalaId);

    setProcessando(null);

    if (error) {
      return { erro: 'Não foi possível confirmar a presença.' };
    }

    // Atualiza só esta linha em memória, sem recarregar tudo do banco —
    // evita que a lista "pisque" e a página role para o topo.
    setPeriodos((atual) =>
      atual.map((periodo) => ({
        ...periodo,
        escalas: periodo.escalas.map((e) =>
          e.id === escalaId ? { ...e, compareceu } : e
        ),
      }))
    );

    return { erro: null };
  }

  return { periodos, carregando, erro, processando, marcarPresenca };
}