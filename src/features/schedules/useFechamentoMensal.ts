import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface ResultadoColaborador {
  colaborador_id: string;
  nome: string;
  auxilio: number;
  comissaoDiaSemana: number;
  comissaoFimDeSemana: number;
  adiantamento: number;
  salarioTotal: number;
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

interface RespostaFechamento {
  mes: string;
  totalLeadsConvertidos: number;
  resultado: ResultadoColaborador[];
  avisos: {
    leadsSemColaboradorConhecido: LeadSemDono[];
    diasDeFimDeSemanaSemPresencaConfirmada: DiaSemPresenca[];
  };
}

export function useFechamentoMensal() {
  const [dados, setDados] = useState<RespostaFechamento | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function calcular(mes: string) {
    setCarregando(true);
    setErro(null);
    setDados(null);

    const { data, error } = await supabase.functions.invoke('calcular-fechamento-mensal', {
      body: { mes },
    });

    setCarregando(false);

    if (error) {
      setErro('Não foi possível calcular o fechamento. Tente novamente.');
      return;
    }

    if (data?.erro) {
      setErro(data.erro);
      return;
    }

    setDados(data);
  }

  async function salvarAdiantamento(colaboradorId: string, mes: string, valor: number) {
    const { error } = await supabase.from('adiantamentos_mensais').upsert(
      {
        colaborador_id: colaboradorId,
        mes,
        valor,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'colaborador_id,mes' }
    );

    if (error) return { erro: 'Não foi possível salvar o adiantamento.' };
    return { erro: null };
  }

  async function salvarFechamento(
    mes: string,
    adminId: string,
    itens: { colaboradorId: string; nome: string; auxilio: number; comissaoDiaSemana: number; comissaoFimDeSemana: number; adiantamento: number; salarioTotal: number }[]
  ) {
    setSalvando(true);

    const linhas = itens.map((item) => ({
      mes,
      colaborador_id: item.colaboradorId,
      nome_snapshot: item.nome,
      auxilio: item.auxilio,
      comissao_dia_semana: item.comissaoDiaSemana,
      comissao_fim_semana: item.comissaoFimDeSemana,
      adiantamento: item.adiantamento,
      salario_total: item.salarioTotal,
      calculado_em: new Date().toISOString(),
      calculado_por: adminId,
    }));

    const { error } = await supabase
      .from('fechamentos_mensais')
      .upsert(linhas, { onConflict: 'mes,colaborador_id' });

    setSalvando(false);

    if (error) return { erro: 'Não foi possível salvar o fechamento.' };
    return { erro: null };
  }

  return { dados, carregando, salvando, erro, calcular, salvarAdiantamento, salvarFechamento };
}