import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface Equipe {
  id: string;
  nome: string;
  ativo: boolean;
}

export function useEquipes() {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase
      .from('equipes')
      .select('id, nome, ativo')
      .order('nome');

    if (error) {
      setErro('Não foi possível carregar as equipes.');
      setCarregando(false);
      return;
    }

    setEquipes(data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criar(nome: string) {
    setProcessando(true);
    const { error } = await supabase.from('equipes').insert({ nome });
    setProcessando(false);

    if (error) {
      const mensagem =
        error.code === '23505' ? 'Já existe uma equipe com esse nome.' : 'Não foi possível criar a equipe.';
      return { erro: mensagem };
    }

    await carregar();
    return { erro: null };
  }

  async function renomear(id: string, novoNome: string) {
    setProcessando(true);
    const { error } = await supabase.from('equipes').update({ nome: novoNome }).eq('id', id);
    setProcessando(false);

    if (error) {
      const mensagem =
        error.code === '23505' ? 'Já existe uma equipe com esse nome.' : 'Não foi possível renomear a equipe.';
      return { erro: mensagem };
    }

    await carregar();
    return { erro: null };
  }

  async function alternarAtivo(id: string, ativo: boolean) {
    setProcessando(true);
    const { error } = await supabase.from('equipes').update({ ativo }).eq('id', id);
    setProcessando(false);

    if (error) {
      return { erro: 'Não foi possível atualizar o status da equipe.' };
    }

    await carregar();
    return { erro: null };
  }

  return { equipes, carregando, erro, processando, criar, renomear, alternarAtivo };
}