import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import type { LinhaFechamento } from './useFechamentoMensal';

// Acertos de desligamento: o pagamento a quem saiu no meio do mês. Fica
// registrado (foto dos valores) e é descontado no fechamento do mês.

export interface AcertoDesligamento {
  id: string;
  colaborador_id: string;
  data_desligamento: string;
  valor_pago: number;
  total_a_pagar: number;
  base_ate: string | null;
  pago_em: string;
}

export function useAcertosDesligamento(mes: string) {
  const [acertos, setAcertos] = useState<AcertoDesligamento[]>([]);
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('acertos_desligamento')
      .select('id, colaborador_id, data_desligamento, valor_pago, total_a_pagar, base_ate, pago_em')
      .eq('mes', mes);
    setAcertos(
      (data ?? []).map((a) => ({ ...a, valor_pago: Number(a.valor_pago), total_a_pagar: Number(a.total_a_pagar) }))
    );
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Registra o pagamento com os valores ganhos até a saída. `linha` vem do
  // fechamento atual (já sem nenhum acerto anterior descontado).
  async function registrar(linha: LinhaFechamento, taxa: number, baseAte: string | null) {
    if (!linha.colaborador_id || !linha.desligado_em) return { erro: 'Linha inválida para acerto.' };
    const valorPago = Math.round((linha.salario_total + linha.ja_pago) * 100) / 100;
    setProcessando(true);
    const { error } = await supabase.from('acertos_desligamento').upsert(
      {
        colaborador_id: linha.colaborador_id,
        mes,
        data_desligamento: linha.desligado_em,
        auxilio: linha.auxilio,
        comissao_equipe: linha.comissao_equipe,
        comissao_fds: linha.comissao_fds,
        comissao_infoprodutos: linha.comissao_infoprodutos,
        adiantamento: linha.adiantamento,
        valor_pago: valorPago,
        total_a_pagar: Math.round(valorPago * (1 + taxa) * 100) / 100,
        ftds: linha.ftds,
        base_ate: baseAte,
        pago_em: new Date().toISOString(),
      },
      { onConflict: 'colaborador_id,mes' }
    );
    await carregar();
    setProcessando(false);
    return { erro: error ? 'Não foi possível registrar o acerto.' : null };
  }

  async function desfazer(id: string) {
    setProcessando(true);
    const { error } = await supabase.from('acertos_desligamento').delete().eq('id', id);
    await carregar();
    setProcessando(false);
    return { erro: error ? 'Não foi possível desfazer o registro.' : null };
  }

  // Para quem saiu sem equipe registrada no histórico: grava a equipe em que
  // a pessoa estava (e mantém a data de desligamento).
  async function definirEquipe(colaboradorId: string, dataDesligamento: string, equipeId: string) {
    setProcessando(true);
    const { error } = await supabase.rpc('ajustar_desligamento', {
      p_colaborador_id: colaboradorId,
      p_data_desligamento: dataDesligamento,
      p_equipe_id: equipeId,
    });
    setProcessando(false);
    return { erro: error ? error.message || 'Não foi possível registrar a equipe.' : null };
  }

  return { acertos, processando, registrar, desfazer, definirEquipe };
}
