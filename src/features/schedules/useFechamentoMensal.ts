import { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import type {
  LinhaFechamento,
  ResultadoFechamento,
} from '../../../supabase/functions/_shared/calculoFechamento';

export type { LinhaFechamento };

export interface DadosFechamento extends ResultadoFechamento {
  calculadoEm: string;
}

// Fechamento mensal calculado a partir da base de vendas importada do Excel
// (função calcular-fechamento-mensal). A foto do mês fica no histórico
// quando o admin arquiva (useHistoricoComissoes).
export function useFechamentoMensal() {
  const [dados, setDados] = useState<DadosFechamento | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const calcular = useCallback(async (mes: string) => {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase.functions.invoke('calcular-fechamento-mensal', {
      body: { mes },
    });

    if (error || !data || data.erro) {
      setErro(data?.erro ?? 'Não foi possível calcular o fechamento. Tente novamente.');
      setCarregando(false);
      return;
    }

    setDados({ ...(data as ResultadoFechamento), calculadoEm: new Date().toISOString() });
    setCarregando(false);
  }, []);

  // Lê o Excel no navegador e grava a base (substitui os meses do arquivo).
  async function importar(arquivo: File) {
    setImportando(true);
    setErro(null);
    try {
      // Carregado só aqui: a leitura de Excel é pesada e só o admin usa.
      const { lerBaseExcel } = await import('../../lib/lerBaseExcel');
      const { linhas, aba, ignoradas } = await lerBaseExcel(arquivo);
      if (linhas.length === 0) {
        return { erro: `A aba "${aba}" não tem nenhuma venda para importar.` };
      }

      const { data, error } = await supabase.rpc('importar_vendas_base', { p_linhas: linhas });
      if (error) {
        return { erro: 'Não foi possível gravar a base. Nada foi alterado.' };
      }

      const meses = [...new Set(linhas.map((l) => l.data.slice(0, 7)))].sort();
      return { erro: null, gravadas: (data as number) ?? linhas.length, ignoradas, aba, meses };
    } catch (e) {
      return { erro: e instanceof Error ? e.message : 'Não foi possível ler o arquivo.' };
    } finally {
      setImportando(false);
    }
  }

  async function editarAdiantamento(mes: string, colaboradorId: string, valor: number) {
    await supabase
      .from('adiantamentos_mensais')
      .upsert(
        { colaborador_id: colaboradorId, mes, valor, atualizado_em: new Date().toISOString() },
        { onConflict: 'colaborador_id,mes' }
      );
    await calcular(mes);
  }

  return { dados, carregando, importando, erro, calcular, importar, editarAdiantamento };
}
