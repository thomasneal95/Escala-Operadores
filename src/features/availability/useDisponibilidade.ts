import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import type { Turno, PeriodoOperacao } from '../../types/database';

// Chave usada para indexar a disponibilidade por dia+turno: "2026-08-15|turno-id"
function chave(data: string, turnoId: string) {
  return `${data}|${turnoId}`;
}

interface ContagemTurno {
  total: number;
  preferencial: number;
}

export function useDisponibilidade() {
  const { session } = useAuth();
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoOperacao | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [respostasSalvas, setRespostasSalvas] = useState<Record<string, boolean>>({});
  const [rascunho, setRascunho] = useState<Record<string, boolean>>({});
  const [jaEnviouAntes, setJaEnviouAntes] = useState(false);
  const [contagensEquipe, setContagensEquipe] = useState<Record<string, ContagemTurno>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviadoComSucesso, setEnviadoComSucesso] = useState(false);

  const carregar = useCallback(async () => {
    if (!session?.user) return;

    setCarregando(true);
    setErro(null);
    setEnviadoComSucesso(false);

    // 1. Colaborador correspondente ao usuário logado.
    const { data: colaborador, error: erroColaborador } = await supabase
      .from('colaboradores')
      .select('id, equipe_id')
      .eq('perfil_id', session.user.id)
      .single();

    if (erroColaborador || !colaborador) {
      setErro('Não foi possível encontrar seu cadastro de colaborador.');
      setCarregando(false);
      return;
    }

    setColaboradorId(colaborador.id);

    // 2. Período aberto (no máximo um, por regra de negócio).
    const { data: periodoAberto, error: erroPeriodo } = await supabase
      .from('periodos_operacao')
      .select('id, data_inicio, data_fim, status')
      .eq('status', 'aberto')
      .maybeSingle();

    if (erroPeriodo) {
      setErro('Não foi possível carregar o período de operação.');
      setCarregando(false);
      return;
    }

    setPeriodo(periodoAberto ?? null);

    // 3. Turnos disponíveis (cadastro global).
    const { data: turnosData, error: erroTurnos } = await supabase
      .from('turnos')
      .select('id, nome, hora_inicio, hora_fim, ordem_exibicao, ativo_sabado, ativo_domingo')
      .eq('ativo', true)
      .order('ordem_exibicao');

    if (erroTurnos) {
      setErro('Não foi possível carregar os turnos.');
      setCarregando(false);
      return;
    }

    setTurnos(turnosData ?? []);

    // 4. Disponibilidade já registrada para este período (só a própria).
    if (periodoAberto) {
      const { data: disponibilidades, error: erroDisponibilidade } = await supabase
        .from('disponibilidades')
        .select('data, turno_id, disponivel')
        .eq('colaborador_id', colaborador.id)
        .eq('periodo_id', periodoAberto.id);

      if (erroDisponibilidade) {
        setErro('Não foi possível carregar sua disponibilidade.');
        setCarregando(false);
        return;
      }

      const mapa: Record<string, boolean> = {};
      for (const d of disponibilidades ?? []) {
        mapa[chave(d.data, d.turno_id)] = d.disponivel;
      }
      setRespostasSalvas(mapa);
      setRascunho(mapa);
      setJaEnviouAntes((disponibilidades ?? []).length > 0);

      // 5. Contagem por turno entre os colegas de equipe (só números,
      // nunca nomes — usado para ajudar na escolha do turno).
      if (colaborador.equipe_id) {
        const { data: colegas } = await supabase
          .from('colaboradores')
          .select('id, turno_semana_id')
          .eq('equipe_id', colaborador.equipe_id)
          .eq('ativo', true);

        const { data: disponibilidadesEquipe } = await supabase
          .from('disponibilidades')
          .select('colaborador_id, data, turno_id, disponivel')
          .eq('periodo_id', periodoAberto.id)
          .eq('disponivel', true);

        const mapaTurnoSemana = new Map(
          (colegas ?? []).map((c) => [c.id, c.turno_semana_id])
        );

        const contagens: Record<string, ContagemTurno> = {};
        for (const d of disponibilidadesEquipe ?? []) {
          if (!mapaTurnoSemana.has(d.colaborador_id)) continue; // só da mesma equipe
          const k = chave(d.data, d.turno_id);
          if (!contagens[k]) contagens[k] = { total: 0, preferencial: 0 };
          contagens[k].total += 1;
          if (mapaTurnoSemana.get(d.colaborador_id) === d.turno_id) {
            contagens[k].preferencial += 1;
          }
        }
        setContagensEquipe(contagens);
      } else {
        setContagensEquipe({});
      }
    } else {
      setRespostasSalvas({});
      setRascunho({});
      setJaEnviouAntes(false);
      setContagensEquipe({});
    }

    setCarregando(false);
  }, [session]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function alternar(data: string, turnoId: string) {
    const chaveAtual = chave(data, turnoId);
    setRascunho((atual) => ({ ...atual, [chaveAtual]: !(atual[chaveAtual] ?? false) }));
    setEnviadoComSucesso(false);
  }

  function estaDisponivel(data: string, turnoId: string) {
    return rascunho[chave(data, turnoId)] ?? false;
  }

  function contagemDe(data: string, turnoId: string): ContagemTurno {
    return contagensEquipe[chave(data, turnoId)] ?? { total: 0, preferencial: 0 };
  }

  const temAlteracoesPendentes = useMemo(() => {
    const todasAsChaves = new Set([
      ...Object.keys(respostasSalvas),
      ...Object.keys(rascunho),
    ]);
    for (const k of todasAsChaves) {
      if ((respostasSalvas[k] ?? false) !== (rascunho[k] ?? false)) {
        return true;
      }
    }
    return false;
  }, [respostasSalvas, rascunho]);

  const podeEnviar = temAlteracoesPendentes || !jaEnviouAntes;

  useEffect(() => {
    function handler(event: BeforeUnloadEvent) {
      if (temAlteracoesPendentes) {
        event.preventDefault();
        event.returnValue = '';
      }
    }

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [temAlteracoesPendentes]);

  async function enviarDisponibilidade() {
    if (!colaboradorId || !periodo) {
      return { erro: 'Não foi possível identificar seus dados.' };
    }

    if (turnos.length === 0) {
      return { erro: 'Nenhum turno disponível para enviar.' };
    }

    const dias = [periodo.data_inicio, periodo.data_fim];
    const linhas = dias.flatMap((data) => {
      const ehSabado = data === periodo.data_inicio;
      return turnos
        .filter((turno) => (ehSabado ? turno.ativo_sabado : turno.ativo_domingo))
        .map((turno) => ({
          colaborador_id: colaboradorId,
          periodo_id: periodo.id,
          data,
          turno_id: turno.id,
          disponivel: rascunho[chave(data, turno.id)] ?? false,
        }));
    });

    if (linhas.length === 0) {
      return { erro: 'Não há turnos disponíveis para enviar neste período.' };
    }

    setEnviando(true);
    setErro(null);

    const { error } = await supabase
      .from('disponibilidades')
      .upsert(linhas, { onConflict: 'colaborador_id,periodo_id,data,turno_id' });

    setEnviando(false);

    if (error) {
      const mensagem = 'Não foi possível enviar sua disponibilidade. Tente novamente.';
      setErro(mensagem);
      return { erro: mensagem };
    }

    const mapaCompleto: Record<string, boolean> = {};
    for (const linha of linhas) {
      mapaCompleto[chave(linha.data, linha.turno_id)] = linha.disponivel;
    }
    setRespostasSalvas(mapaCompleto);
    setRascunho(mapaCompleto);
    setJaEnviouAntes(true);
    setEnviadoComSucesso(true);

    // Recarrega para atualizar as contagens da equipe também.
    await carregar();

    return { erro: null };
  }

    async function repetirAnterior() {
    if (!colaboradorId || !periodo) {
      return { erro: 'Não foi possível identificar seus dados.' };
    }

    // Busca o período mais recente ANTES do atual.
    const { data: periodoAnterior, error: erroPeriodoAnterior } = await supabase
      .from('periodos_operacao')
      .select('id')
      .lt('data_inicio', periodo.data_inicio)
      .order('data_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (erroPeriodoAnterior || !periodoAnterior) {
      return { erro: 'Não há um período anterior para repetir.' };
    }

    const { data: disponibilidadesAnteriores, error: erroDisponibilidades } = await supabase
      .from('disponibilidades')
      .select('data, turno_id, disponivel')
      .eq('colaborador_id', colaboradorId)
      .eq('periodo_id', periodoAnterior.id);

    if (erroDisponibilidades || !disponibilidadesAnteriores) {
      return { erro: 'Não foi possível carregar a disponibilidade anterior.' };
    }

    if (disponibilidadesAnteriores.length === 0) {
      return { erro: 'Você não enviou disponibilidade no período anterior.' };
    }

    // Precisamos saber as datas do período anterior para identificar se
    // cada linha era "sábado" ou "domingo", e aplicar no dia correspondente
    // do período atual (as datas mudam toda semana, o dia da semana não).
    const { data: infoPeriodoAnterior } = await supabase
      .from('periodos_operacao')
      .select('data_inicio, data_fim')
      .eq('id', periodoAnterior.id)
      .single();

    if (!infoPeriodoAnterior) {
      return { erro: 'Não foi possível identificar as datas do período anterior.' };
    }

    const novoRascunho: Record<string, boolean> = { ...rascunho };

    for (const d of disponibilidadesAnteriores) {
      const eraSabado = d.data === infoPeriodoAnterior.data_inicio;
      const dataCorrespondenteAtual = eraSabado ? periodo.data_inicio : periodo.data_fim;
      novoRascunho[chave(dataCorrespondenteAtual, d.turno_id)] = d.disponivel;
    }

    setRascunho(novoRascunho);
    setEnviadoComSucesso(false);
    return { erro: null };
  }

  return {
    periodo,
    turnos,
    carregando,
    erro,
    alternar,
    estaDisponivel,
    contagemDe,
    temAlteracoesPendentes,
    podeEnviar,
    enviando,
    enviadoComSucesso,
    enviarDisponibilidade,
    repetirAnterior,
  };
}