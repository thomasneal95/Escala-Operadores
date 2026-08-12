import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

interface EscalaHistorico {
  data: string;
  turno_nome_snapshot: string;
  turno_hora_inicio_snapshot: string;
  turno_hora_fim_snapshot: string;
}

interface PeriodoHistorico {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: 'confirmado' | 'encerrado';
  escalas: EscalaHistorico[];
}

export function useHistoricoEscalas() {
  const { session } = useAuth();
  const [periodos, setPeriodos] = useState<PeriodoHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
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
        .select('periodo_id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot')
        .eq('colaborador_id', colaborador.id)
        .in('periodo_id', idsPeriodos.length > 0 ? idsPeriodos : ['00000000-0000-0000-0000-000000000000']);

      if (erroEscalas) {
        setErro('Não foi possível carregar suas escalas anteriores.');
        setCarregando(false);
        return;
      }

      const historico: PeriodoHistorico[] = (periodosData ?? []).map((p) => ({
        id: p.id,
        data_inicio: p.data_inicio,
        data_fim: p.data_fim,
        status: p.status as 'confirmado' | 'encerrado',
        escalas: (escalasData ?? [])
          .filter((e) => e.periodo_id === p.id)
          .map((e) => ({
            data: e.data,
            turno_nome_snapshot: e.turno_nome_snapshot,
            turno_hora_inicio_snapshot: e.turno_hora_inicio_snapshot,
            turno_hora_fim_snapshot: e.turno_hora_fim_snapshot,
          })),
      }));

      setPeriodos(historico);
      setCarregando(false);
    }

    carregar();
  }, [session]);

  return { periodos, carregando, erro };
}