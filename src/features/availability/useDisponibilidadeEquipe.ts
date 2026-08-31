import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import type { Turno } from '../../types/database';

// Chave usada para indexar a disponibilidade por dia+turno: "2026-08-15|turno-id"
function chave(data: string, turnoId: string) {
  return `${data}|${turnoId}`;
}

export interface ColegaDisponibilidade {
  id: string;
  nomeCompleto: string;
  souEu: boolean;
  turnoSemanaId: string | null;
  jaDeclarou: boolean;
  respostas: Record<string, boolean>;
}

export function useDisponibilidadeEquipe(periodoId: string | null, aberto: boolean) {
  const { session } = useAuth();
  const [equipeNome, setEquipeNome] = useState<string | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [colegas, setColegas] = useState<ColegaDisponibilidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!session?.user || !periodoId) return;

    setCarregando(true);
    setErro(null);

    // 1. Descobre a própria equipe.
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
      setColegas([]);
      setCarregando(false);
      return;
    }

    // 2. Turnos e colaboradores da equipe em paralelo.
    const [turnosResultado, colaboradoresResultado] = await Promise.all([
      supabase
        .from('turnos')
        .select('id, nome, hora_inicio, hora_fim, ordem_exibicao, ativo_sabado, ativo_domingo')
        .eq('ativo', true)
        .order('ordem_exibicao'),
      supabase
        .from('colaboradores')
        .select('id, perfil_id, turno_semana_id, perfis(nome_completo)')
        .eq('equipe_id', equipeId)
        .eq('ativo', true),
    ]);

    if (turnosResultado.error || colaboradoresResultado.error) {
      setErro('Não foi possível carregar os dados da equipe.');
      setCarregando(false);
      return;
    }

    setTurnos(turnosResultado.data ?? []);

    // 3. Disponibilidade de todos os colegas para este período (RLS permite
    // ler colegas da mesma equipe — ver migration
    // 20260814020000_contagem_disponibilidade_equipe.sql).
    const { data: disponibilidadesEquipe, error: erroDisponibilidades } = await supabase
      .from('disponibilidades')
      .select('colaborador_id, data, turno_id, disponivel')
      .eq('periodo_id', periodoId);

    if (erroDisponibilidades) {
      setErro('Não foi possível carregar a disponibilidade da equipe.');
      setCarregando(false);
      return;
    }

    const respostasPorColaborador = new Map<string, Record<string, boolean>>();
    for (const d of disponibilidadesEquipe ?? []) {
      if (!respostasPorColaborador.has(d.colaborador_id)) {
        respostasPorColaborador.set(d.colaborador_id, {});
      }
      respostasPorColaborador.get(d.colaborador_id)![chave(d.data, d.turno_id)] = d.disponivel;
    }

    const lista: ColegaDisponibilidade[] = (colaboradoresResultado.data ?? []).map((c) => {
      const perfil = c.perfis as unknown as { nome_completo: string } | null;
      const respostas = respostasPorColaborador.get(c.id) ?? {};
      return {
        id: c.id,
        nomeCompleto: perfil?.nome_completo ?? '(sem nome)',
        souEu: c.perfil_id === session.user.id,
        turnoSemanaId: c.turno_semana_id,
        jaDeclarou: Object.keys(respostas).length > 0,
        respostas,
      };
    });

    lista.sort((a, b) => {
      if (a.jaDeclarou !== b.jaDeclarou) return a.jaDeclarou ? -1 : 1;
      if (a.souEu) return -1;
      if (b.souEu) return 1;
      return a.nomeCompleto.localeCompare(b.nomeCompleto);
    });

    setColegas(lista);
    setCarregando(false);
  }, [session, periodoId]);

  useEffect(() => {
    if (aberto) carregar();
  }, [aberto, carregar]);

  return { equipeNome, turnos, colegas, carregando, erro };
}
