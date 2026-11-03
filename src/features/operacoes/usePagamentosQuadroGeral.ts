import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

// Salários fixos que entram só no Quadro geral (ex.: o do administrador):
// somam no Total a pagar, com a taxa, em todo mês a partir de `desde`.

export interface PagamentoQuadroGeral {
  id: string;
  nome: string;
  valor: number;
  desde: string; // YYYY-MM-01
}

export function usePagamentosQuadroGeral() {
  const [pagamentos, setPagamentos] = useState<PagamentoQuadroGeral[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('pagamentos_quadro_geral')
      .select('id, nome, valor, desde')
      .order('nome');
    if (error) {
      setErro('Não foi possível carregar os pagamentos do quadro geral.');
      return;
    }
    setPagamentos((data ?? []).map((p) => ({ ...p, valor: Number(p.valor) })));
    setErro(null);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function executar(acao: PromiseLike<{ error: unknown }>, mensagem: string) {
    const { error } = await acao;
    if (error) return { erro: mensagem };
    await carregar();
    return { erro: null };
  }

  return {
    pagamentos,
    erro,
    // Pagamentos que valem no mês (YYYY-MM-01).
    doMes: (mes: string) => pagamentos.filter((p) => p.desde <= mes),
    adicionar: (nome: string, valor: number, desde: string) =>
      executar(
        supabase.from('pagamentos_quadro_geral').insert({ nome: nome.trim(), valor, desde }),
        'Não foi possível adicionar o pagamento.'
      ),
    atualizar: (id: string, dados: { nome: string; valor: number; desde: string }) =>
      executar(
        supabase
          .from('pagamentos_quadro_geral')
          .update({ ...dados, nome: dados.nome.trim() })
          .eq('id', id),
        'Não foi possível salvar o pagamento.'
      ),
    remover: (id: string) =>
      executar(supabase.from('pagamentos_quadro_geral').delete().eq('id', id), 'Não foi possível remover o pagamento.'),
  };
}
