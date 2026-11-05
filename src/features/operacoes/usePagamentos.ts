import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

// Seção "Pagamentos" do comissionamento: carteiras de cada pessoa (guardadas
// para os próximos meses) e os pagamentos confirmados no mês. A pessoa é
// identificada pela chave do Quadro geral (`c:<colaborador_id>` ou
// `n:<nome normalizado>`).

export interface Carteira {
  chave: string;
  nome: string;
  rede: string;
  endereco: string;
  observacao: string | null;
}

export interface PagamentoRealizado {
  id: string;
  chave: string;
  nome: string;
  valor: number;
  rede: string | null;
  endereco: string | null;
  transacao: string | null;
  pago_em: string;
}

export function usePagamentos(mes: string) {
  const { session } = useAuth();
  const [carteiras, setCarteiras] = useState<Map<string, Carteira>>(new Map());
  const [pagamentos, setPagamentos] = useState<Map<string, PagamentoRealizado>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    const [carteirasRes, pagamentosRes] = await Promise.all([
      supabase.from('carteiras_pagamento').select('chave, nome, rede, endereco, observacao'),
      supabase
        .from('pagamentos_realizados')
        .select('id, chave, nome, valor, rede, endereco, transacao, pago_em')
        .eq('mes', mes),
    ]);
    if (carteirasRes.error || pagamentosRes.error) {
      setErro('Não foi possível carregar os pagamentos.');
      setCarregando(false);
      return;
    }
    setCarteiras(new Map((carteirasRes.data ?? []).map((c) => [c.chave, c])));
    setPagamentos(new Map((pagamentosRes.data ?? []).map((p) => [p.chave, { ...p, valor: Number(p.valor) }])));
    setCarregando(false);
  }, [mes]);

  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [carregar]);

  async function salvarCarteira(carteira: Carteira) {
    const { error } = await supabase.from('carteiras_pagamento').upsert({
      chave: carteira.chave,
      nome: carteira.nome,
      rede: carteira.rede.trim(),
      endereco: carteira.endereco.trim(),
      observacao: carteira.observacao?.trim() || null,
      atualizado_em: new Date().toISOString(),
    });
    if (error) return { erro: 'Não foi possível salvar a carteira.' };
    await carregar();
    return { erro: null };
  }

  async function removerCarteira(chave: string) {
    const { error } = await supabase.from('carteiras_pagamento').delete().eq('chave', chave);
    if (error) return { erro: 'Não foi possível remover a carteira.' };
    await carregar();
    return { erro: null };
  }

  // Guarda o valor e a carteira do momento do pagamento.
  async function marcarPago(dados: { chave: string; nome: string; valor: number; transacao: string | null }) {
    const carteira = carteiras.get(dados.chave);
    const { error } = await supabase.from('pagamentos_realizados').insert({
      mes,
      chave: dados.chave,
      nome: dados.nome,
      valor: dados.valor,
      rede: carteira?.rede ?? null,
      endereco: carteira?.endereco ?? null,
      transacao: dados.transacao?.trim() || null,
      pago_por: session?.user?.id ?? null,
    });
    if (error) {
      if (error.code === '23505') {
        await carregar();
        return { erro: `${dados.nome} já estava marcado como pago neste mês.` };
      }
      return { erro: 'Não foi possível marcar como pago.' };
    }
    await carregar();
    return { erro: null };
  }

  async function desfazerPagamento(id: string) {
    const { error } = await supabase.from('pagamentos_realizados').delete().eq('id', id);
    if (error) return { erro: 'Não foi possível desfazer o pagamento.' };
    await carregar();
    return { erro: null };
  }

  return { carteiras, pagamentos, carregando, erro, salvarCarteira, removerCarteira, marcarPago, desfazerPagamento };
}
