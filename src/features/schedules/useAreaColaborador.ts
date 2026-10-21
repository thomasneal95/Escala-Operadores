import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import type { PeriodoOperacao } from '../../types/database';

function hojeIso() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

export function useAreaColaborador() {
  const { session } = useAuth();
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoOperacao | null>(null);
  // Fins de semana já confirmados que ainda não passaram — com a escala
  // gerada por mês, podem ser vários de uma vez.
  const [periodosPublicados, setPeriodosPublicados] = useState<PeriodoOperacao[]>([]);
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

      setColaboradorId(colaborador.id);

      const { data: periodosData, error: erroPeriodo } = await supabase
        .from('periodos_operacao')
        .select('id, data_inicio, data_fim, status')
        .order('data_inicio', { ascending: false });

      if (erroPeriodo) {
        setErro('Não foi possível carregar o período de operação.');
        setCarregando(false);
        return;
      }

      const lista = periodosData ?? [];
      const hoje = hojeIso();
      setPeriodo(lista[0] ?? null);
      // Sem limite de quantidade: a escala é gerada por mês e todos os fins
      // de semana futuros confirmados precisam aparecer.
      setPeriodosPublicados(
        lista
          .filter(
            (p) => (p.status === 'confirmado' || p.status === 'encerrado') && p.data_fim >= hoje
          )
          .reverse()
      );
      setCarregando(false);
    }

    carregar();
  }, [session]);

  return { colaboradorId, periodo, periodosPublicados, carregando, erro };
}