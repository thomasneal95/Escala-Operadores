import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import type { LinhaFechamento } from '../../../supabase/functions/_shared/calculoFechamento';

// "Meus ganhos" do operador (função meu-fechamento): o mesmo cálculo do
// fechamento do admin, só com os dados da própria pessoa e números
// agregados da equipe.

export interface DiaMeu {
  dia: string;
  ftds: number;
  comissao_equipe: number;
  comissao_fds: number;
  comissao_infoprodutos: number;
}

export interface MeuFechamento {
  mes: string;
  ultimaData: string | null;
  arquivadoEm: string | null;
  nomeNaBaseConfigurado: boolean;
  minhaLinha: LinhaFechamento | null;
  meusDias: DiaMeu[];
  ftdsMesAnterior: number | null;
  rejeitadas: { dia: string; hora: string; cliente: string | null }[];
  equipe: { nome: string; ativos: number; porDia: { dia: string; ftds: number; valor: number }[] } | null;
  regras: {
    inicio_regra_nova: string;
    valor_regra_nova: number;
    valor_antigo_dia_util: number;
    valor_antigo_fds: number;
    hora_virada_dia: number;
    percentual_infoproduto: number;
    taxa_total_a_pagar: number;
  };
}

export function useMeuFechamento(mes: string) {
  const [dados, setDados] = useState<MeuFechamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    const { data, error } = await supabase.functions.invoke('meu-fechamento', { body: { mes } });
    if (error || !data || data.erro) {
      setErro(data?.erro ?? 'Não foi possível carregar seus ganhos. Tente novamente.');
      setCarregando(false);
      return;
    }
    setDados(data as MeuFechamento);
    setCarregando(false);
  }, [mes]);

  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [carregar]);

  return { dados, carregando, erro, recarregar: carregar };
}
