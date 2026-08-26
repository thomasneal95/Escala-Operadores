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
  origem: 'salvo' | 'recalculado';
  calculadoEm: string | null;
}

export function useFechamentoMensal() {
  const [dados, setDados] = useState<RespostaFechamento | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Busca o que já está salvo no banco pra este mês (rápido, sem chamar a
  // API externa). Usado ao abrir a tela ou trocar de mês.
  async function carregarSalvo(mes: string) {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase
      .from('fechamentos_mensais')
      .select(
        'colaborador_id, nome_snapshot, auxilio, comissao_dia_semana, comissao_fim_semana, adiantamento, salario_total, total_leads_convertidos, calculado_em'
      )
      .eq('mes', mes)
      .order('salario_total', { ascending: false });

    setCarregando(false);

    if (error) {
      setErro('Não foi possível carregar o fechamento salvo.');
      return;
    }

    if (!data || data.length === 0) {
      setDados(null);
      return;
    }

    setDados({
      mes,
      totalLeadsConvertidos: data[0]?.total_leads_convertidos ?? 0,
      resultado: data.map((r) => ({
        colaborador_id: r.colaborador_id,
        nome: r.nome_snapshot,
        auxilio: Number(r.auxilio),
        comissaoDiaSemana: Number(r.comissao_dia_semana),
        comissaoFimDeSemana: Number(r.comissao_fim_semana),
        adiantamento: Number(r.adiantamento),
        salarioTotal: Number(r.salario_total),
      })),
      avisos: { leadsSemColaboradorConhecido: [], diasDeFimDeSemanaSemPresencaConfirmada: [] },
      origem: 'salvo',
      calculadoEm: data[0]?.calculado_em ?? null,
    });
  }

  // Recalcula de verdade, buscando os leads na API externa (mais lento).
  async function recalcular(mes: string) {
    setCarregando(true);
    setErro(null);

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

    setDados({ ...data, origem: 'recalculado', calculadoEm: new Date().toISOString() });
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
    totalLeadsConvertidos: number,
    itens: {
      colaboradorId: string;
      nome: string;
      auxilio: number;
      comissaoDiaSemana: number;
      comissaoFimDeSemana: number;
      adiantamento: number;
      salarioTotal: number;
    }[]
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
      total_leads_convertidos: totalLeadsConvertidos,
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

  return {
    dados,
    carregando,
    salvando,
    erro,
    carregarSalvo,
    recalcular,
    salvarAdiantamento,
    salvarFechamento,
  };
}