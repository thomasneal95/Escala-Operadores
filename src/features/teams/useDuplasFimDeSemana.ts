import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

export interface DuplaFimDeSemana {
  equipe_id: string;
  numero: number;
  manha_tarde_id: string | null;
  tarde_noite_id: string | null;
}

export interface MembroEquipe {
  id: string;
  nome: string;
  equipe_id: string;
}

export function useDuplasFimDeSemana() {
  const [duplas, setDuplas] = useState<DuplaFimDeSemana[]>([]);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const [duplasResultado, colaboradoresResultado] = await Promise.all([
      supabase
        .from('duplas_fim_de_semana')
        .select('equipe_id, numero, manha_tarde_id, tarde_noite_id'),
      supabase
        .from('colaboradores')
        .select('id, equipe_id, comissionamento_individual, perfis(nome_completo, papel)')
        .eq('ativo', true)
        .not('equipe_id', 'is', null),
    ]);

    if (duplasResultado.error || colaboradoresResultado.error) {
      setErro('Não foi possível carregar as duplas das equipes.');
      setCarregando(false);
      return;
    }

    setDuplas(duplasResultado.data ?? []);
    setMembros(
      (colaboradoresResultado.data ?? [])
        .filter((c) => {
          const perfil = c.perfis as unknown as { papel: string } | null;
          return perfil?.papel !== 'administrador' && !c.comissionamento_individual;
        })
        .map((c) => {
          const perfil = c.perfis as unknown as { nome_completo: string } | null;
          return {
            id: c.id,
            nome: perfil?.nome_completo ?? '(sem nome)',
            equipe_id: c.equipe_id as string,
          };
        })
        .sort((a, b) => a.nome.localeCompare(b.nome))
    );
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function duplasDaEquipe(equipeId: string) {
    return duplas.filter((d) => d.equipe_id === equipeId);
  }

  function membrosDaEquipe(equipeId: string) {
    return membros.filter((m) => m.equipe_id === equipeId);
  }

  // Substitui as 3 duplas da equipe de uma vez (apaga e grava de novo, para
  // permitir trocar pessoas de dupla sem esbarrar na regra de "uma pessoa
  // em uma posição só").
  async function salvarDuplasDaEquipe(equipeId: string, novas: Omit<DuplaFimDeSemana, 'equipe_id'>[]) {
    const pessoas = novas.flatMap((d) => [d.manha_tarde_id, d.tarde_noite_id]).filter(Boolean);
    if (new Set(pessoas).size !== pessoas.length) {
      return { erro: 'Cada pessoa só pode estar em uma posição das duplas.' };
    }

    setSalvando(true);

    const { error: erroApagar } = await supabase
      .from('duplas_fim_de_semana')
      .delete()
      .eq('equipe_id', equipeId);

    if (erroApagar) {
      setSalvando(false);
      return { erro: 'Não foi possível salvar as duplas.' };
    }

    const { error } = await supabase
      .from('duplas_fim_de_semana')
      .insert(novas.map((d) => ({ ...d, equipe_id: equipeId })));

    setSalvando(false);
    await carregar();

    if (error) {
      return {
        erro:
          error.code === '23505'
            ? 'Alguém já está em uma dupla de outra equipe.'
            : 'Não foi possível salvar as duplas.',
      };
    }

    return { erro: null };
  }

  return {
    carregando,
    erro,
    salvando,
    duplasDaEquipe,
    membrosDaEquipe,
    salvarDuplasDaEquipe,
  };
}
