import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface PainelDados {
  periodoAtual: {
    id: string;
    data_inicio: string;
    data_fim: string;
    status: 'aberto' | 'em_organizacao' | 'confirmado' | 'encerrado';
  } | null;
  colaboradoresQueEnviaram: number;
  totalColaboradoresAtivos: number;
  escalasPreenchidas: number;
  vagasTotais: number;
  totalEquipesAtivas: number;
  periodoPresencaPendente: {
    id: string;
    data_inicio: string;
    data_fim: string;
    pendentes: number;
  } | null;
}

export function usePainelAdmin() {
  const [dados, setDados] = useState<PainelDados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data: periodoAtual, error: erroPeriodo } = await supabase
      .from('periodos_operacao')
      .select('id, data_inicio, data_fim, status')
      .order('data_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (erroPeriodo) {
      setErro('Não foi possível carregar o painel.');
      setCarregando(false);
      return;
    }

        const { count: totalColaboradoresAtivos } = await supabase
      .from('colaboradores')
      .select('id, perfis!inner(papel)', { count: 'exact', head: true })
      .eq('ativo', true)
      .eq('perfis.papel', 'colaborador');

    const { count: totalEquipesAtivas } = await supabase
      .from('equipes')
      .select('id', { count: 'exact', head: true })
      .eq('ativo', true);

    let colaboradoresQueEnviaram = 0;
    let escalasPreenchidas = 0;
    let vagasTotais = 0;

    if (periodoAtual) {
      if (periodoAtual.status === 'aberto') {
        const { data: disponibilidades } = await supabase
          .from('disponibilidades')
          .select('colaborador_id')
          .eq('periodo_id', periodoAtual.id);

        colaboradoresQueEnviaram = new Set((disponibilidades ?? []).map((d) => d.colaborador_id))
          .size;
      }

      if (periodoAtual.status === 'em_organizacao' || periodoAtual.status === 'confirmado') {
        const { count: contagemEscalas } = await supabase
          .from('escalas')
          .select('id', { count: 'exact', head: true })
          .eq('periodo_id', periodoAtual.id);
        escalasPreenchidas = contagemEscalas ?? 0;

        const { data: turnosData } = await supabase
          .from('turnos')
          .select('id, ativo_sabado, ativo_domingo')
          .eq('ativo', true);

        const { data: vagasData } = await supabase
          .from('vagas_equipe_turno')
          .select('turno_id, vagas, equipes!inner(ativo)')
          .eq('equipes.ativo', true);

        for (const v of vagasData ?? []) {
          const turno = (turnosData ?? []).find((t) => t.id === v.turno_id);
          if (!turno) continue;
          const dias = (turno.ativo_sabado ? 1 : 0) + (turno.ativo_domingo ? 1 : 0);
          vagasTotais += v.vagas * dias;
        }
      }
    }

    // Período mais recente já confirmado/encerrado, para checar presença pendente.
    const { data: periodoPresenca } = await supabase
      .from('periodos_operacao')
      .select('id, data_inicio, data_fim')
      .in('status', ['confirmado', 'encerrado'])
      .order('data_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();

    let periodoPresencaPendente: PainelDados['periodoPresencaPendente'] = null;

    if (periodoPresenca) {
      const { count: pendentes } = await supabase
        .from('escalas')
        .select('id', { count: 'exact', head: true })
        .eq('periodo_id', periodoPresenca.id)
        .is('compareceu', null);

      if ((pendentes ?? 0) > 0) {
        periodoPresencaPendente = {
          id: periodoPresenca.id,
          data_inicio: periodoPresenca.data_inicio,
          data_fim: periodoPresenca.data_fim,
          pendentes: pendentes ?? 0,
        };
      }
    }

    setDados({
      periodoAtual,
      colaboradoresQueEnviaram,
      totalColaboradoresAtivos: totalColaboradoresAtivos ?? 0,
      escalasPreenchidas,
      vagasTotais,
      totalEquipesAtivas: totalEquipesAtivas ?? 0,
      periodoPresencaPendente,
    });
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { dados, carregando, erro, recarregar: carregar };
}