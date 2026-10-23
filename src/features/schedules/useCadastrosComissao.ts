import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

// Cadastros usados no fechamento pela base do Excel: parâmetros das regras,
// operadores externos, pagamentos fixos e o "nome na base" de cada
// colaborador (como aparece na coluna Operador).

export interface ConfiguracaoComissao {
  inicio_regra_nova: string;
  valor_regra_nova: number;
  valor_antigo_dia_util: number;
  valor_antigo_fds: number;
  valor_ftd_individual: number;
  taxa_total_a_pagar: number;
  hora_virada_dia: number;
  percentual_infoproduto: number;
}

export interface OperadorExterno {
  nome_base: string;
  valor_por_ftd: number | null;
}

export interface PagamentoFixo {
  id: string;
  nome: string;
  tipo: 'salario_fixo' | 'auxilio_fixo';
  valor: number;
  data_inicio: string | null;
  adiantamento: number;
}

export interface ColaboradorNomeBase {
  id: string;
  nome: string;
  nome_base: string | null;
  ativo: boolean;
  desativado_em: string | null;
}

export function useCadastrosComissao() {
  const [config, setConfig] = useState<ConfiguracaoComissao | null>(null);
  const [externos, setExternos] = useState<OperadorExterno[]>([]);
  const [fixos, setFixos] = useState<PagamentoFixo[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorNomeBase[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [configRes, externosRes, fixosRes, colaboradoresRes] = await Promise.all([
      supabase.from('configuracao_comissao').select('*').single(),
      supabase.from('operadores_externos').select('nome_base, valor_por_ftd').order('nome_base'),
      supabase
        .from('pagamentos_fixos')
        .select('id, nome, tipo, valor, data_inicio, adiantamento')
        .eq('ativo', true)
        .order('nome'),
      supabase
        .from('colaboradores')
        // Inclui os desligados: as vendas do mês em que saíram também precisam
        // ser ligadas a eles.
        .select('id, nome_base, ativo, desativado_em, perfis(nome_completo, papel)'),
    ]);

    if (configRes.error || externosRes.error || fixosRes.error || colaboradoresRes.error) {
      setErro('Não foi possível carregar os cadastros do comissionamento.');
      return;
    }

    const c = configRes.data;
    setConfig({
      inicio_regra_nova: c.inicio_regra_nova,
      valor_regra_nova: Number(c.valor_regra_nova),
      valor_antigo_dia_util: Number(c.valor_antigo_dia_util),
      valor_antigo_fds: Number(c.valor_antigo_fds),
      valor_ftd_individual: Number(c.valor_ftd_individual),
      taxa_total_a_pagar: Number(c.taxa_total_a_pagar),
      hora_virada_dia: Number(c.hora_virada_dia),
      percentual_infoproduto: Number(c.percentual_infoproduto),
    });
    setExternos(
      (externosRes.data ?? []).map((e) => ({
        nome_base: e.nome_base,
        valor_por_ftd: e.valor_por_ftd === null ? null : Number(e.valor_por_ftd),
      }))
    );
    setFixos(
      (fixosRes.data ?? []).map((f) => ({
        ...f,
        valor: Number(f.valor),
        adiantamento: Number(f.adiantamento),
      }))
    );
    setColaboradores(
      (colaboradoresRes.data ?? [])
        .filter((c) => (c.perfis as unknown as { papel: string } | null)?.papel !== 'administrador')
        .map((c) => ({
          id: c.id,
          nome: (c.perfis as unknown as { nome_completo: string } | null)?.nome_completo ?? '(sem nome)',
          nome_base: c.nome_base,
          ativo: c.ativo,
          desativado_em: c.desativado_em,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome))
    );
    setErro(null);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function executar(acao: PromiseLike<{ error: { code?: string } | null }>, mensagem: string) {
    const { error } = await acao;
    if (error) {
      return {
        erro: error.code === '23505' ? 'Esse nome já está ligado a outra pessoa.' : mensagem,
      };
    }
    await carregar();
    return { erro: null };
  }

  return {
    config,
    externos,
    fixos,
    colaboradores,
    erro,
    recarregar: carregar,
    salvarConfig: (novo: ConfiguracaoComissao) =>
      executar(
        supabase
          .from('configuracao_comissao')
          .update({ ...novo, atualizado_em: new Date().toISOString() })
          .eq('id', true),
        'Não foi possível salvar os parâmetros.'
      ),
    definirNomeBase: (colaboradorId: string, nomeBase: string | null) =>
      executar(
        supabase
          .from('colaboradores')
          .update({ nome_base: nomeBase?.trim() || null })
          .eq('id', colaboradorId),
        'Não foi possível salvar o nome na base.'
      ),
    salvarExterno: (externo: OperadorExterno) =>
      executar(
        supabase
          .from('operadores_externos')
          .upsert({ nome_base: externo.nome_base.trim(), valor_por_ftd: externo.valor_por_ftd }),
        'Não foi possível salvar o operador externo.'
      ),
    removerExterno: (nomeBase: string) =>
      executar(
        supabase.from('operadores_externos').delete().eq('nome_base', nomeBase),
        'Não foi possível remover o operador externo.'
      ),
    salvarFixo: (fixo: Omit<PagamentoFixo, 'id'> & { id?: string }) =>
      executar(
        fixo.id
          ? supabase.from('pagamentos_fixos').update(fixo).eq('id', fixo.id)
          : supabase.from('pagamentos_fixos').insert(fixo),
        'Não foi possível salvar o pagamento fixo.'
      ),
    removerFixo: (id: string) =>
      executar(
        supabase.from('pagamentos_fixos').update({ ativo: false }).eq('id', id),
        'Não foi possível remover o pagamento fixo.'
      ),
  };
}
