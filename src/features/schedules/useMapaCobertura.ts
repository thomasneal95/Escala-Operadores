import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

const QUANTIDADE_PERIODOS = 10;

interface TurnoResumo {
  id: string;
  nome: string;
  ativo_sabado: boolean;
  ativo_domingo: boolean;
}

interface PeriodoResumo {
  id: string;
  data_inicio: string;
  data_fim: string;
}

interface CelulaMapa {
  periodoId: string;
  turnoId: string;
  vagas: number;
  disponiveis: number;
}

export function useMapaCobertura(equipeIdFiltro: string | null) {
  const [turnos, setTurnos] = useState<TurnoResumo[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoResumo[]>([]);
  const [celulas, setCelulas] = useState<CelulaMapa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro(null);

      const { data: turnosData, error: erroTurnos } = await supabase
        .from('turnos')
        .select('id, nome, ativo_sabado, ativo_domingo, ordem_exibicao')
        .eq('ativo', true)
        .order('ordem_exibicao');

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

      // Cronológico (mais antigo primeiro), para o mapa ler da esquerda pra direita.
      const periodosOrdenados = (periodosData ?? []).slice().reverse();
      const idsPeriodos = periodosOrdenados.map((p) => p.id);

      let vagasQuery = supabase.from('vagas_equipe_turno').select('equipe_id, turno_id, vagas');
      if (equipeIdFiltro) {
        vagasQuery = vagasQuery.eq('equipe_id', equipeIdFiltro);
      }
      const { data: vagasData } = await vagasQuery;

      // Se filtrando por equipe, restringe as disponibilidades aos colaboradores dessa equipe.
      let idsColaboradoresFiltro: string[] | null = null;
      if (equipeIdFiltro) {
        const { data: colaboradoresDaEquipe } = await supabase
          .from('colaboradores')
          .select('id')
          .eq('equipe_id', equipeIdFiltro);
        idsColaboradoresFiltro = (colaboradoresDaEquipe ?? []).map((c) => c.id);
      }

      let disponibilidadesQuery = supabase
        .from('disponibilidades')
        .select('periodo_id, turno_id, colaborador_id, disponivel')
        .in('periodo_id', idsPeriodos.length > 0 ? idsPeriodos : ['00000000-0000-0000-0000-000000000000'])
        .eq('disponivel', true);

      if (idsColaboradoresFiltro) {
        disponibilidadesQuery = disponibilidadesQuery.in(
          'colaborador_id',
          idsColaboradoresFiltro.length > 0 ? idsColaboradoresFiltro : ['00000000-0000-0000-0000-000000000000']
        );
      }

      const { data: disponibilidadesData, error: erroDisponibilidades } = await disponibilidadesQuery;

      if (erroDisponibilidades) {
        setErro('Não foi possível carregar as disponibilidades.');
        setCarregando(false);
        return;
      }

      const vagasPorTurno = new Map<string, number>();
      for (const v of vagasData ?? []) {
        vagasPorTurno.set(v.turno_id, (vagasPorTurno.get(v.turno_id) ?? 0) + v.vagas);
      }

      const novasCelulas: CelulaMapa[] = [];
      for (const periodo of periodosOrdenados) {
        for (const turno of turnosData ?? []) {
          const diasAtivos = (turno.ativo_sabado ? 1 : 0) + (turno.ativo_domingo ? 1 : 0);
          const vagasBase = vagasPorTurno.get(turno.id) ?? 0;
          const vagasTotais = vagasBase * diasAtivos;

          const disponiveis = (disponibilidadesData ?? []).filter(
            (d) => d.periodo_id === periodo.id && d.turno_id === turno.id
          ).length;

          novasCelulas.push({
            periodoId: periodo.id,
            turnoId: turno.id,
            vagas: vagasTotais,
            disponiveis,
          });
        }
      }

      setTurnos(turnosData ?? []);
      setPeriodos(periodosOrdenados);
      setCelulas(novasCelulas);
      setCarregando(false);
    }

    carregar();
  }, [equipeIdFiltro]);

  function celula(periodoId: string, turnoId: string) {
    return celulas.find((c) => c.periodoId === periodoId && c.turnoId === turnoId);
  }

  return { turnos, periodos, carregando, erro, celula };
}