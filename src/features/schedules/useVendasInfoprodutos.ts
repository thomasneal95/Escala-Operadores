import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

// Vendas de infoprodutos lançadas no site (uma por venda). A comissão é
// calculada no fechamento do mês (função calcular-fechamento-mensal).

export interface VendaInfoproduto {
  id: string;
  data: string;
  produto: string;
  email_lead: string | null;
  operador: string;
  valor: number;
}

export type NovaVendaInfoproduto = Omit<VendaInfoproduto, 'id'>;

function ultimoDiaDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

export function useVendasInfoprodutos(mes: string) {
  const [vendas, setVendas] = useState<VendaInfoproduto[]>([]);
  const [produtosConhecidos, setProdutosConhecidos] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    const [vendasRes, produtosRes] = await Promise.all([
      supabase
        .from('vendas_infoprodutos')
        .select('id, data, produto, email_lead, operador, valor')
        .gte('data', mes)
        .lte('data', ultimoDiaDoMes(mes))
        .order('data')
        .order('criado_em'),
      supabase.from('vendas_infoprodutos').select('produto'),
    ]);

    if (vendasRes.error) {
      setErro('Não foi possível carregar as vendas de infoprodutos.');
      setCarregando(false);
      return;
    }

    setVendas((vendasRes.data ?? []).map((v) => ({ ...v, valor: Number(v.valor) })));
    setProdutosConhecidos(
      [...new Set((produtosRes.data ?? []).map((p) => p.produto as string))].sort()
    );
    setErro(null);
    setCarregando(false);
  }, [mes]);

  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [carregar]);

  async function executar(acao: PromiseLike<{ error: unknown }>, mensagem: string) {
    setProcessando(true);
    const { error } = await acao;
    await carregar();
    setProcessando(false);
    return { erro: error ? mensagem : null };
  }

  const limpar = (v: NovaVendaInfoproduto) => ({
    data: v.data,
    produto: v.produto.trim(),
    email_lead: v.email_lead?.trim() || null,
    operador: v.operador.trim(),
    valor: v.valor,
  });

  return {
    vendas,
    produtosConhecidos,
    carregando,
    erro,
    processando,
    adicionar: (v: NovaVendaInfoproduto) =>
      executar(supabase.from('vendas_infoprodutos').insert(limpar(v)), 'Não foi possível salvar a venda.'),
    atualizar: (id: string, v: NovaVendaInfoproduto) =>
      executar(
        supabase.from('vendas_infoprodutos').update(limpar(v)).eq('id', id),
        'Não foi possível salvar a venda.'
      ),
    remover: (id: string) =>
      executar(supabase.from('vendas_infoprodutos').delete().eq('id', id), 'Não foi possível excluir a venda.'),
    // Importação única da aba "Vendas Infoprodutos" do Excel.
    importarDaPlanilha: async (arquivo: File) => {
      try {
        const { lerInfoprodutosExcel } = await import('../../lib/lerBaseExcel');
        const linhas = await lerInfoprodutosExcel(arquivo);
        if (linhas.length === 0) return { erro: 'A aba não tem nenhuma venda.', quantidade: 0 };
        const resultado = await executar(
          supabase.from('vendas_infoprodutos').insert(linhas.map(limpar)),
          'Não foi possível importar as vendas.'
        );
        return { ...resultado, quantidade: linhas.length };
      } catch (e) {
        return { erro: e instanceof Error ? e.message : 'Não foi possível ler o arquivo.', quantidade: 0 };
      }
    },
  };
}
