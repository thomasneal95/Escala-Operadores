import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import type { Turno } from '../../types/database';

export interface EscaladoEquipe {
  colaboradorId: string;
  nome: string;
  souEu: boolean;
  data: string;
  turnoId: string;
}

export function useEscalaEquipe(periodoId: string | null, aberto: boolean) {
  const { session } = useAuth();
  const [equipeNome, setEquipeNome] = useState<string | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [escalados, setEscalados] = useState<EscaladoEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!session?.user || !periodoId) return;

    setCarregando(true);
    setErro(null);

    const { data: meuColaborador, error: erroMeu } = await supabase
      .from('colaboradores')
      .select('equipe_id, equipes(nome)')
      .eq('perfil_id', session.user.id)
      .single();

    if (erroMeu || !meuColaborador) {
      setErro('Não foi possível carregar seus dados.');
      setCarregando(false);
      return;
    }

    const equipeId = meuColaborador.equipe_id;
    const equipe = meuColaborador.equipes as unknown as { nome: string } | null;
    setEquipeNome(equipe?.nome ?? null);

    if (!equipeId) {
      setTurnos([]);
      setEscalados([]);
      setCarregando(false);
      return;
    }

    const [turnosResultado, colaboradoresResultado, escalasResultado] = await Promise.all([
      supabase
        .from('turnos')
        .select('id, nome, hora_inicio, hora_fim, ordem_exibicao, ativo_sabado, ativo_domingo')
        .eq('ativo', true)
        .order('ordem_exibicao'),
      supabase
        .from('colaboradores')
        .select('id, perfil_id, perfis(nome_completo)')
        .eq('equipe_id', equipeId)
        .eq('ativo', true),
      supabase.from('escalas').select('colaborador_id, data, turno_id').eq('periodo_id', periodoId),
    ]);

    if (turnosResultado.error || colaboradoresResultado.error || escalasResultado.error) {
      setErro('Não foi possível carregar a escala da equipe.');
      setCarregando(false);
      return;
    }

    setTurnos(turnosResultado.data ?? []);

    const colaboradorPorId = new Map(
      (colaboradoresResultado.data ?? []).map((c) => {
        const perfil = c.perfis as unknown as { nome_completo: string } | null;
        return [
          c.id,
          {
            nome: perfil?.nome_completo ?? '(sem nome)',
            souEu: c.perfil_id === session.user.id,
          },
        ] as const;
      })
    );

    const lista: EscaladoEquipe[] = (escalasResultado.data ?? [])
      .filter((e) => colaboradorPorId.has(e.colaborador_id))
      .map((e) => {
        const colaborador = colaboradorPorId.get(e.colaborador_id)!;
        return {
          colaboradorId: e.colaborador_id,
          nome: colaborador.nome,
          souEu: colaborador.souEu,
          data: e.data,
          turnoId: e.turno_id,
        };
      });

    setEscalados(lista);
    setCarregando(false);
  }, [session, periodoId]);

  useEffect(() => {
    if (aberto) carregar();
  }, [aberto, carregar]);

  return { equipeNome, turnos, escalados, carregando, erro };
}
