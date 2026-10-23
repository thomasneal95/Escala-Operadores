import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

// Vendas de infoprodutos do próprio operador: ele registra as dele, que
// ficam "pendentes" até o admin conferir. O banco só devolve as dele.

export interface MinhaVendaInfoproduto {
  id: string;
  data: string;
  produto: string;
  email_lead: string | null;
  valor: number;
  status: 'pendente' | 'confirmada' | 'recusada';
}

export interface NovaVenda {
  data: string;
  produto: string;
  email_lead: string;
  valor: number;
}

function ultimoDiaDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

export function useMinhasVendasInfoprodutos(mes: string) {
  const [vendas, setVendas] = useState<MinhaVendaInfoproduto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('vendas_infoprodutos')
      .select('id, data, produto, email_lead, valor, status')
      .gte('data', mes)
      .lte('data', ultimoDiaDoMes(mes))
      .order('data', { ascending: false });
    setVendas((data ?? []).map((v) => ({ ...v, valor: Number(v.valor) })));
    setCarregando(false);
  }, [mes]);

  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [carregar]);

  async function executar(acao: PromiseLike<{ error: { message?: string } | null }>) {
    setProcessando(true);
    const { error } = await acao;
    await carregar();
    setProcessando(false);
    return { erro: error ? error.message || 'Não foi possível salvar.' : null };
  }

  return {
    vendas,
    carregando,
    processando,
    registrar: (v: NovaVenda) =>
      executar(
        supabase.rpc('registrar_venda_infoproduto', {
          p_data: v.data,
          p_produto: v.produto,
          p_email_lead: v.email_lead,
          p_valor: v.valor,
        })
      ),
    editar: (id: string, v: NovaVenda) =>
      executar(
        supabase.rpc('editar_venda_infoproduto_pendente', {
          p_id: id,
          p_data: v.data,
          p_produto: v.produto,
          p_email_lead: v.email_lead,
          p_valor: v.valor,
        })
      ),
    excluir: (id: string) => executar(supabase.rpc('excluir_venda_infoproduto_pendente', { p_id: id })),
  };
}
