import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import type { Turno, PeriodoOperacao } from '../../types/database';

// Chave usada para indexar a disponibilidade por dia+turno: "2026-08-15|turno-id"
function chave(data: string, turnoId: string) {
  return `${data}|${turnoId}`;
}

export function useDisponibilidade() {
  const { session } = useAuth();
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoOperacao | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [respostasSalvas, setRespostasSalvas] = useState<Record<string, boolean>>({});
  const [rascunho, setRascunho] = useState<Record<string, boolean>>({});
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
      .select('id')
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
      .select('id, nome, hora_inicio, hora_fim, ordem_exibicao')
      .eq('ativo', true)
      .order('ordem_exibicao');

    if (erroTurnos) {
      setErro('Não foi possível carregar os turnos.');
      setCarregando(false);
      return;
    }

    setTurnos(turnosData ?? []);

    // 4. Disponibilidade já registrada para este período.
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
    } else {
      setRespostasSalvas({});
      setRascunho({});
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

  // Avisa o navegador ao tentar sair/recarregar com alterações não enviadas.
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

    // Envia TODOS os turnos de ambos os dias, explicitamente — inclusive os
    // que ficaram no padrão "Indisponível" e nunca foram clicados. Isso
    // garante que o administrador veja "Indisponível" em vez de "—" (sem
    // resposta) para qualquer turno que o colaborador já revisou e enviou.
    const dias = [periodo.data_inicio, periodo.data_fim];
    const linhas = dias.flatMap((data) =>
      turnos.map((turno) => ({
        colaborador_id: colaboradorId,
        periodo_id: periodo.id,
        data,
        turno_id: turno.id,
        disponivel: rascunho[chave(data, turno.id)] ?? false,
      }))
    );

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
    setEnviadoComSucesso(true);
    return { erro: null };
  }

  return {
    periodo,
    turnos,
    carregando,
    erro,
    alternar,
    estaDisponivel,
    temAlteracoesPendentes,
    enviando,
    enviadoComSucesso,
    enviarDisponibilidade,
  };
}