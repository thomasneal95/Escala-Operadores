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

interface CelulaHeatmap {
  periodoId: string;
  turnoId: string;
  vagas: number;
  disponiveis: number;
}

interface DiaPreenchimento {
  periodoId: string;
  data: string;
  ehSabado: boolean;
  vagasTotais: number;
  preenchidas: number;
}

interface PontoEvolucao {
  periodoId: string;
  dataInicio: string;
  percentual: number;
}

interface ResumoAutomatico {
  mediaGeral: number | null;
  turnoMaisFraco: { nome: string; media: number } | null;
  turnoMaisForte: { nome: string; media: number } | null;
  tendencia: 'melhorando' | 'piorando' | 'estavel' | null;
}

export function useAnalises(equipeIdFiltro: string | null) {
  const [turnos, setTurnos] = useState<TurnoResumo[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoResumo[]>([]);
  const [celulasHeatmap, setCelulasHeatmap] = useState<CelulaHeatmap[]>([]);
  const [dias, setDias] = useState<DiaPreenchimento[]>([]);
  const [evolucao, setEvolucao] = useState<PontoEvolucao[]>([]);
  const [resumo, setResumo] = useState<ResumoAutomatico>({
    mediaGeral: null,
    turnoMaisFraco: null,
    turnoMaisForte: null,
    tendencia: null,
  });
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

      const periodosOrdenados = (periodosData ?? []).slice().reverse();
      const idsPeriodos = periodosOrdenados.map((p) => p.id);

      let vagasQuery = supabase.from('vagas_equipe_turno').select('equipe_id, turno_id, vagas');
      if (equipeIdFiltro) vagasQuery = vagasQuery.eq('equipe_id', equipeIdFiltro);
      const { data: vagasData } = await vagasQuery;

      let idsColaboradoresFiltro: string[] | null = null;
      if (equipeIdFiltro) {
        const { data: colaboradoresDaEquipe } = await supabase
          .from('colaboradores')
          .select('id')
          .eq('equipe_id', equipeIdFiltro);
        idsColaboradoresFiltro = (colaboradoresDaEquipe ?? []).map((c) => c.id);
      }

      const idsSeguro =
        idsPeriodos.length > 0 ? idsPeriodos : ['00000000-0000-0000-0000-000000000000'];

      let disponibilidadesQuery = supabase
        .from('disponibilidades')
        .select('periodo_id, turno_id, colaborador_id')
        .in('periodo_id', idsSeguro)
        .eq('disponivel', true);

      if (idsColaboradoresFiltro) {
        disponibilidadesQuery = disponibilidadesQuery.in(
          'colaborador_id',
          idsColaboradoresFiltro.length > 0
            ? idsColaboradoresFiltro
            : ['00000000-0000-0000-0000-000000000000']
        );
      }

      const { data: disponibilidadesData, error: erroDisponibilidades } =
        await disponibilidadesQuery;

      if (erroDisponibilidades) {
        setErro('Não foi possível carregar as disponibilidades.');
        setCarregando(false);
        return;
      }

      let escalasQuery = supabase
        .from('escalas')
        .select('periodo_id, data, turno_id, colaborador_id')
        .in('periodo_id', idsSeguro);

      if (idsColaboradoresFiltro) {
        escalasQuery = escalasQuery.in(
          'colaborador_id',
          idsColaboradoresFiltro.length > 0
            ? idsColaboradoresFiltro
            : ['00000000-0000-0000-0000-000000000000']
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

      // ---- 1. Mapa de calor (turno x período, baseado em disponibilidade) ----
      const novasCelulas: CelulaHeatmap[] = [];
      for (const periodo of periodosOrdenados) {
        for (const turno of turnosData ?? []) {
          const diasAtivos = (turno.ativo_sabado ? 1 : 0) + (turno.ativo_domingo ? 1 : 0);
          const vagasTotais = (vagasPorTurno.get(turno.id) ?? 0) * diasAtivos;
          const disponiveis = (disponibilidadesData ?? []).filter(
            (d) => d.periodo_id === periodo.id && d.turno_id === turno.id
          ).length;
          novasCelulas.push({ periodoId: periodo.id, turnoId: turno.id, vagas: vagasTotais, disponiveis });
        }
      }

      // ---- 2. Barras por dia (baseado em escalas reais) ----
      const novosDias: DiaPreenchimento[] = [];
      for (const periodo of periodosOrdenados) {
        const diasDoPeriodo = [
          { data: periodo.data_inicio, ehSabado: true },
          { data: periodo.data_fim, ehSabado: false },
        ];
        for (const dia of diasDoPeriodo) {
          let vagasTotais = 0;
          for (const turno of turnosData ?? []) {
            const ativoNesseDia = dia.ehSabado ? turno.ativo_sabado : turno.ativo_domingo;
            if (ativoNesseDia) vagasTotais += vagasPorTurno.get(turno.id) ?? 0;
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

      // ---- 3. Evolução por período (agregando os 2 dias de cada um) ----
      const porPeriodo = new Map<string, { dataInicio: string; vagas: number; preenchidas: number }>();
      for (const dia of novosDias) {
        const atual = porPeriodo.get(dia.periodoId) ?? { dataInicio: '', vagas: 0, preenchidas: 0 };
        atual.vagas += dia.vagasTotais;
        atual.preenchidas += dia.preenchidas;
        if (dia.ehSabado) atual.dataInicio = dia.data;
        porPeriodo.set(dia.periodoId, atual);
      }
      const novaEvolucao: PontoEvolucao[] = Array.from(porPeriodo.entries())
        .map(([periodoId, v]) => ({
          periodoId,
          dataInicio: v.dataInicio,
          percentual: v.vagas > 0 ? v.preenchidas / v.vagas : 0,
        }))
        .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));

      // ---- 4. Resumo automático ----
      const mediasPorTurno = new Map<string, number>();
      for (const turno of turnosData ?? []) {
        const proporcoes: number[] = [];
        for (const p of periodosOrdenados) {
          const c = novasCelulas.find((x) => x.periodoId === p.id && x.turnoId === turno.id);
          if (c && c.vagas > 0) proporcoes.push(c.disponiveis / c.vagas);
        }
        if (proporcoes.length > 0) {
          mediasPorTurno.set(turno.id, proporcoes.reduce((a, b) => a + b, 0) / proporcoes.length);
        }
      }

      let turnoMaisFraco: ResumoAutomatico['turnoMaisFraco'] = null;
      let turnoMaisForte: ResumoAutomatico['turnoMaisForte'] = null;
      for (const turno of turnosData ?? []) {
        const media = mediasPorTurno.get(turno.id);
        if (media === undefined) continue;
        if (!turnoMaisFraco || media < turnoMaisFraco.media) turnoMaisFraco = { nome: turno.nome, media };
        if (!turnoMaisForte || media > turnoMaisForte.media) turnoMaisForte = { nome: turno.nome, media };
      }

      const mediaGeral =
        novaEvolucao.length > 0
          ? novaEvolucao.reduce((soma, p) => soma + p.percentual, 0) / novaEvolucao.length
          : null;

      let tendencia: ResumoAutomatico['tendencia'] = null;
      if (novaEvolucao.length >= 4) {
        const metade = Math.floor(novaEvolucao.length / 2);
        const primeiraMetade = novaEvolucao.slice(0, metade);
        const segundaMetade = novaEvolucao.slice(metade);
        const mediaPrimeira =
          primeiraMetade.reduce((s, p) => s + p.percentual, 0) / primeiraMetade.length;
        const mediaSegunda =
          segundaMetade.reduce((s, p) => s + p.percentual, 0) / segundaMetade.length;
        const diferenca = mediaSegunda - mediaPrimeira;
        if (diferenca > 0.05) tendencia = 'melhorando';
        else if (diferenca < -0.05) tendencia = 'piorando';
        else tendencia = 'estavel';
      }

      setTurnos(turnosData ?? []);
      setPeriodos(periodosOrdenados);
      setCelulasHeatmap(novasCelulas);
      setDias(novosDias);
      setEvolucao(novaEvolucao);
      setResumo({ mediaGeral, turnoMaisFraco, turnoMaisForte, tendencia });
      setCarregando(false);
    }

    carregar();
  }, [equipeIdFiltro]);

  function celula(periodoId: string, turnoId: string) {
    return celulasHeatmap.find((c) => c.periodoId === periodoId && c.turnoId === turnoId);
  }

  return { turnos, periodos, celula, dias, evolucao, resumo, carregando, erro };
}