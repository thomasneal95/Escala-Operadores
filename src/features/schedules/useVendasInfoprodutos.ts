import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

// Vendas de infoprodutos lançadas no site (uma por venda). A comissão é
// calculada no fechamento do mês (função calcular-fechamento-mensal).
// As registradas pelos operadores chegam "pendentes" e só entram no
// fechamento depois de confirmadas aqui.

export interface VendaInfoproduto {
  id: string;
  data: string;
  produto: string;
  email_lead: string | null;
  operador: string;
  valor: number;
  status: 'pendente' | 'confirmada' | 'recusada';
  // Preenchido quando o próprio operador registrou a venda pelo portal.
  colaborador_id: string | null;
}

// Venda que foi excluída e está na lixeira (pode ser restaurada).
export interface VendaExcluida extends VendaInfoproduto {
  excluido_em: string;
  excluido_por: string | null;
}

export type NovaVendaInfoproduto = Omit<VendaInfoproduto, 'id' | 'status' | 'colaborador_id'>;

function ultimoDiaDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

export function useVendasInfoprodutos(mes: string) {
  const { session } = useAuth();
  const [vendas, setVendas] = useState<VendaInfoproduto[]>([]);
  // Meses (YYYY-MM) de outras vendas pendentes, para o admin não esquecer.
  const [excluidas, setExcluidas] = useState<VendaExcluida[]>([]);
  const [pendentesEmOutrosMeses, setPendentesEmOutrosMeses] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    const [vendasRes, pendentesRes, excluidasRes] = await Promise.all([
      supabase
        .from('vendas_infoprodutos')
        .select('id, data, produto, email_lead, operador, valor, status, colaborador_id')
        .gte('data', mes)
        .lte('data', ultimoDiaDoMes(mes))
        .order('data')
        .order('criado_em'),
      supabase.from('vendas_infoprodutos').select('data').eq('status', 'pendente'),
      supabase
        .from('vendas_infoprodutos_excluidas')
        .select('id, dados, excluido_em, perfis(nome_completo)')
        .gte('data', mes)
        .lte('data', ultimoDiaDoMes(mes))
        .order('excluido_em', { ascending: false }),
    ]);

    if (vendasRes.error) {
      setErro('Não foi possível carregar as vendas de infoprodutos.');
      setCarregando(false);
      return;
    }

    setVendas((vendasRes.data ?? []).map((v) => ({ ...v, valor: Number(v.valor) })));
    setExcluidas(
      (excluidasRes.data ?? []).map((e) => {
        const d = e.dados as VendaInfoproduto;
        return {
          ...d,
          id: e.id,
          valor: Number(d.valor),
          excluido_em: e.excluido_em,
          excluido_por: (e.perfis as unknown as { nome_completo: string } | null)?.nome_completo ?? null,
        };
      })
    );
    setPendentesEmOutrosMeses(
      [...new Set((pendentesRes.data ?? []).map((p) => (p.data as string).slice(0, 7)))]
        .filter((m) => m !== mes.slice(0, 7))
        .sort()
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
    excluidas,
    pendentesEmOutrosMeses,
    carregando,
    erro,
    processando,
    adicionar: (v: NovaVendaInfoproduto) =>
      executar(supabase.from('vendas_infoprodutos').insert(limpar(v)), 'Não foi possível salvar a venda.'),
    // Confere quantas linhas mudaram: se a venda foi excluída enquanto estava
    // aberta para edição, o update não acha nada e isso precisa aparecer.
    atualizar: async (id: string, v: NovaVendaInfoproduto) => {
      setProcessando(true);
      const { data, error } = await supabase.from('vendas_infoprodutos').update(limpar(v)).eq('id', id).select('id');
      await carregar();
      setProcessando(false);
      if (error) return { erro: 'Não foi possível salvar a venda.' };
      if (!data || data.length === 0) {
        return { erro: 'Esta venda não existe mais (foi excluída). Cancele a edição e lance de novo como venda nova.' };
      }
      return { erro: null };
    },
    conferir: (ids: string[], status: 'confirmada' | 'recusada') =>
      executar(
        supabase
          .from('vendas_infoprodutos')
          .update({ status, conferido_em: new Date().toISOString(), conferido_por: session?.user.id ?? null })
          .in('id', ids),
        'Não foi possível salvar a conferência.'
      ),
    restaurar: (id: string) =>
      executar(
        supabase.rpc('restaurar_venda_infoproduto', { p_id: id }),
        'Não foi possível restaurar a venda.'
      ),
    // A venda excluída vai para a lixeira (vendas_infoprodutos_excluidas).
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
