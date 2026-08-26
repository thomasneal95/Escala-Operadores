import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface ResultadoColaborador {
  colaborador_id: string;
  nome: string;
  comissao: number;
}

interface LeadSemDono {
  id: number;
  email: string;
}

interface DiaSemPresenca {
  equipeId: string;
  data: string;
  leads: number;
}

interface RespostaComissionamento {
  periodo: { inicio: string; fim: string };
  totalLeadsConvertidos: number;
  resultado: ResultadoColaborador[];
  avisos: {
    leadsSemColaboradorConhecido: LeadSemDono[];
    diasDeFimDeSemanaSemPresencaConfirmada: DiaSemPresenca[];
  };
}

export function useComissionamento() {
  const [dados, setDados] = useState<RespostaComissionamento | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function calcular(inicio: string, fim: string) {
    setCarregando(true);
    setErro(null);
    setDados(null);

    const { data, error } = await supabase.functions.invoke('calcular-comissionamento', {
      body: { inicio, fim },
    });

    setCarregando(false);

    if (error) {
      setErro('Não foi possível calcular o comissionamento. Tente novamente.');
      return;
    }

    if (data?.erro) {
      setErro(data.erro);
      return;
    }

    setDados(data);
  }

  return { dados, carregando, erro, calcular };
}