import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface Turno {
  id: string;
  nome: string;
  hora_inicio: string;
  hora_fim: string;
  ordem_exibicao: number | null;
  ativo: boolean;
}

interface DadosTurno {
  nome: string;
  hora_inicio: string;
  hora_fim: string;
  ordem_exibicao: number | null;
}

export function useTurnos() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase
      .from('turnos')
      .select('id, nome, hora_inicio, hora_fim, ordem_exibicao, ativo')
      .order('ordem_exibicao', { nullsFirst: false });

    if (error) {
      setErro('Não foi possível carregar os turnos.');
      setCarregando(false);
      return;
    }

    setTurnos(data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function mensagemDeErro(codigo: string | undefined) {
    if (codigo === '23505') return 'Já existe um turno com esse nome.';
    if (codigo === '23514') return 'O horário de início não pode ser igual ao horário de fim.';
    return 'Não foi possível salvar o turno.';
  }

  async function criar(dados: DadosTurno) {
    setProcessando(true);
    const { error } = await supabase.from('turnos').insert(dados);
    setProcessando(false);

    if (error) {
      return { erro: mensagemDeErro(error.code) };
    }

    await carregar();
    return { erro: null };
  }

  async function atualizar(id: string, dados: DadosTurno) {
    setProcessando(true);
    const { error } = await supabase.from('turnos').update(dados).eq('id', id);
    setProcessando(false);

    if (error) {
      return { erro: mensagemDeErro(error.code) };
    }

    await carregar();
    return { erro: null };
  }

  async function alternarAtivo(id: string, ativo: boolean) {
    setProcessando(true);
    const { error } = await supabase.from('turnos').update({ ativo }).eq('id', id);
    setProcessando(false);

    if (error) {
      return { erro: 'Não foi possível atualizar o status do turno.' };
    }

    await carregar();
    return { erro: null };
  }

  return { turnos, carregando, erro, processando, criar, atualizar, alternarAtivo };
}