import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

const QUANTIDADE_PERIODOS = 10;

interface DiaPreenchimento {
  periodoId: string;
  data: string;
  ehSabado: boolean;
  vagasTotais: number;
  preenchidas: number;
}

export function usePreenchimentoDias(equipeIdFiltro: string | null) {
  const [dias, setDias] = useState<DiaPreenchimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro(null);

      const { data: turnosData, error: erroTurnos } = await supabase
        .from('turnos')
        .select('id, ativo_sabado, ativo_domingo')
        .eq('ativo', true);

      if (erroTurnos) {
        setErro('Não foi possível carregar os turnos.');
        setCarregando(false);
        return;
      }

      const { data: periodosData, error: erroPeriodos } = await supabase
        .from('periodos_operacao')
        .select('id, data_inicio, data_fim')
        .in('status', ['confirmado', 'encerrado'])
        .order('data_inicio', { ascending: false })
        .limit(QUANTIDADE_PERIODOS);

      if (erroPeriodos) {
        setErro('Não foi possível carregar os períodos.');
        setCarregando(false);
        return;
      }

      const periodosOrdenados = (periodosData ?? []).slice().reverse();
      const idsPeriodos = periodosOrdenados.map((p) => p.id);

      let vagasQuery = supabase.from('vagas_equipe_turno').select('equipe_id, turno_id, vagas');
      if (equipeIdFiltro) {
        vagasQuery = vagasQuery.eq('equipe_id', equipeIdFiltro);
      }
      const { data: vagasData } = await vagasQuery;

      let idsColaboradoresFiltro: string[] | null = null;
      if (equipeIdFiltro) {
        const { data: colaboradoresDaEquipe } = await supabase
          .from('colaboradores')
          .select('id')
          .eq('equipe_id', equipeIdFiltro);
        idsColaboradoresFiltro = (colaboradoresDaEquipe ?? []).map((c) => c.id);
      }

      let escalasQuery = supabase
        .from('escalas')
        .select('periodo_id, data, colaborador_id')
        .in('periodo_id', idsPeriodos.length > 0 ? idsPeriodos : ['00000000-0000-0000-0000-000000000000']);

      if (idsColaboradoresFiltro) {
        escalasQuery = escalasQuery.in(
          'colaborador_id',
          idsColaboradoresFiltro.length > 0 ? idsColaboradoresFiltro : ['00000000-0000-0000-0000-000000000000']
        );
      }

      const { data: escalasData, error: erroEscalas } = await escalasQuery;

      if (erroEscalas) {
        setErro('Não foi possível carregar as escalas.');
        setCarregando(false);
        return;
      }

      const vagasPorTurno = new Map<string, number>();
      for (const v of vagasData ?? []) {
        vagasPorTurno.set(v.turno_id, (vagasPorTurno.get(v.turno_id) ?? 0) + v.vagas);
      }

      const novosDias: DiaPreenchimento[] = [];

      for (const periodo of periodosOrdenados) {
        const diasDoPeriodo: { data: string; ehSabado: boolean }[] = [
          { data: periodo.data_inicio, ehSabado: true },
          { data: periodo.data_fim, ehSabado: false },
        ];

        for (const dia of diasDoPeriodo) {
          let vagasTotais = 0;
          for (const turno of turnosData ?? []) {
            const ativoNesseDia = dia.ehSabado ? turno.ativo_sabado : turno.ativo_domingo;
            if (!ativoNesseDia) continue;
            vagasTotais += vagasPorTurno.get(turno.id) ?? 0;
          }

          const preenchidas = (escalasData ?? []).filter(
            (e) => e.periodo_id === periodo.id && e.data === dia.data
          ).length;

          novosDias.push({
            periodoId: periodo.id,
            data: dia.data,
            ehSabado: dia.ehSabado,
            vagasTotais,
            preenchidas,
          });
        }
      }

      setDias(novosDias);
      setCarregando(false);
    }

    carregar();
  }, [equipeIdFiltro]);

  return { dias, carregando, erro };
}