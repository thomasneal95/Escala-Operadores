import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import type { PeriodoOperacao } from '../../types/database';

export function useAreaColaborador() {
  const { session } = useAuth();
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoOperacao | null>(null);
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
      setCarregando(false);
    }

    carregar();
  }, [session]);

  return { colaboradorId, periodo, carregando, erro };
}