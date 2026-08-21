import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface DadosNovoColaborador {
  nome_completo: string;
  email: string;
  senha: string;
  equipe_id: string | null;
  telefone: string | null;
  matricula: string | null;
  turno_semana_id: string | null;
  data_admissao: string | null;
}

export function useCriarColaborador() {
  const [processando, setProcessando] = useState(false);

  async function criar(dados: DadosNovoColaborador) {
    setProcessando(true);

    const { data, error } = await supabase.functions.invoke('criar-colaborador', {
      body: dados,
    });

    setProcessando(false);

    if (error) {
      return { erro: 'Não foi possível criar o colaborador.' };
    }

    if (data?.erro) {
      return { erro: data.erro as string };
    }

    return { erro: null };
  }

  return { criar, processando };
}