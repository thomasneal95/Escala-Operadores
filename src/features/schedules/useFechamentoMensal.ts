import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface ResultadoColaborador {
  colaborador_id: string;
  nome: string;
  auxilio: number;
  comissaoDiaSemana: number;
  comissaoFimDeSemana: number;
  comissaoIndividual: number;
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
  calculadoEm: string | null;
}

export function useFechamentoMensal() {
  const [dados, setDados] = useState<RespostaFechamento | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function buscarSalvo(mes: string): Promise<RespostaFechamento | null> {
        const { data, error } = await supabase
      .from('fechamentos_mensais')
      .select(
        'colaborador_id, nome_snapshot, auxilio, comissao_dia_semana, comissao_fim_semana, comissao_individual, adiantamento, salario_total, total_leads_convertidos, calculado_em'
      )
      .eq('mes', mes)
      .order('salario_total', { ascending: false });

    if (error || !data || data.length === 0) return null;

    return {
      mes,
      totalLeadsConvertidos: data[0]?.total_leads_convertidos ?? 0,
            resultado: data.map((r) => ({
        colaborador_id: r.colaborador_id,
        nome: r.nome_snapshot,
        auxilio: Number(r.auxilio),
        comissaoDiaSemana: Number(r.comissao_dia_semana),
        comissaoFimDeSemana: Number(r.comissao_fim_semana),
        comissaoIndividual: Number(r.comissao_individual ?? 0),
        adiantamento: Number(r.adiantamento),
        salarioTotal: Number(r.salario_total),
      })),
      avisos: { leadsSemColaboradorConhecido: [], diasDeFimDeSemanaSemPresencaConfirmada: [] },
      calculadoEm: data[0]?.calculado_em ?? null,
    };
  }

  async function buscarAoVivo(mes: string): Promise<{ dados?: RespostaFechamento; erro?: string }> {
    const { data, error } = await supabase.functions.invoke('calcular-fechamento-mensal', {
      body: { mes },
    });

    if (error) return { erro: 'Não foi possível calcular o fechamento. Tente novamente.' };
    if (data?.erro) return { erro: data.erro };

    return { dados: { ...data, calculadoEm: new Date().toISOString() } };
  }

  async function persistir(
    mes: string,
    adminId: string,
    totalLeadsConvertidos: number,
    itens: ResultadoColaborador[]
  ) {
    const agora = new Date().toISOString();
        const linhas = itens.map((item) => ({
      mes,
      colaborador_id: item.colaborador_id,
      nome_snapshot: item.nome,
      auxilio: item.auxilio,
      comissao_dia_semana: item.comissaoDiaSemana,
      comissao_fim_semana: item.comissaoFimDeSemana,
      comissao_individual: item.comissaoIndividual,
      adiantamento: item.adiantamento,
      salario_total: item.salarioTotal,
      total_leads_convertidos: totalLeadsConvertidos,
      calculado_em: agora,
      calculado_por: adminId,
    }));

    const { error } = await supabase
      .from('fechamentos_mensais')
      .upsert(linhas, { onConflict: 'mes,colaborador_id' });

    return { erro: error ? 'Não foi possível salvar automaticamente.' : null, calculadoEm: agora };
  }

  // Carrega a tela: tenta o que já está salvo; se não existir nada ainda
  // pra esse mês, calcula ao vivo e já salva sozinho, sem pedir confirmação.
  async function carregarOuCalcular(mes: string, adminId: string) {
    setCarregando(true);
    setErro(null);

    const salvo = await buscarSalvo(mes);
    if (salvo) {
      setDados(salvo);
      setCarregando(false);
      return;
    }

    const resultado = await buscarAoVivo(mes);
    if (resultado.erro || !resultado.dados) {
      setErro(resultado.erro ?? 'Não foi possível calcular o fechamento.');
      setCarregando(false);
      return;
    }

    const persistencia = await persistir(mes, adminId, resultado.dados.totalLeadsConvertidos, resultado.dados.resultado);

    setDados({
      ...resultado.dados,
      calculadoEm: persistencia.calculadoEm,
    });
    setCarregando(false);
  }

  // Botão "Atualizar": busca de novo na API e salva sozinho.
  async function atualizar(mes: string, adminId: string) {
    setAtualizando(true);
    setErro(null);

    const resultado = await buscarAoVivo(mes);
    if (resultado.erro || !resultado.dados) {
      setErro(resultado.erro ?? 'Não foi possível atualizar o fechamento.');
      setAtualizando(false);
      return;
    }

    const persistencia = await persistir(mes, adminId, resultado.dados.totalLeadsConvertidos, resultado.dados.resultado);

    setDados({
      ...resultado.dados,
      calculadoEm: persistencia.calculadoEm,
    });
    setAtualizando(false);
  }

  // Edita o adiantamento de UMA pessoa e já salva sozinho (linha inteira).
  async function editarAdiantamento(mes: string, adminId: string, colaboradorId: string, novoValor: number) {
    if (!dados) return;

        const novoResultado = dados.resultado.map((r) =>
      r.colaborador_id === colaboradorId
        ? {
            ...r,
            adiantamento: novoValor,
            salarioTotal:
              Math.round(
                (r.auxilio + r.comissaoDiaSemana + r.comissaoFimDeSemana + r.comissaoIndividual - novoValor) * 100
              ) / 100,
          }
        : r
    );

    setDados({ ...dados, resultado: novoResultado });

    await supabase.from('adiantamentos_mensais').upsert(
      { colaborador_id: colaboradorId, mes, valor: novoValor, atualizado_em: new Date().toISOString() },
      { onConflict: 'colaborador_id,mes' }
    );

    const persistencia = await persistir(mes, adminId, dados.totalLeadsConvertidos, novoResultado);
    setDados((atual) => (atual ? { ...atual, calculadoEm: persistencia.calculadoEm } : atual));
  }

  return { dados, carregando, atualizando, erro, carregarOuCalcular, atualizar, editarAdiantamento };
}