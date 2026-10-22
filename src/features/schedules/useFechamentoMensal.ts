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
// (função calcular-fechamento-mensal). A cada cálculo, as linhas dos
// colaboradores são salvas em fechamentos_mensais (foto do mês).
export function useFechamentoMensal() {
  const [dados, setDados] = useState<DadosFechamento | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const persistir = useCallback(async (resultado: ResultadoFechamento, adminId: string) => {
    const agora = new Date().toISOString();
    const linhas = resultado.linhas
      .filter((l) => l.colaborador_id)
      .map((l) => ({
        mes: resultado.mes,
        colaborador_id: l.colaborador_id as string,
        nome_snapshot: l.nome,
        equipe_nome: l.equipe,
        auxilio: l.auxilio,
        comissao_dia_semana: l.comissao_equipe,
        comissao_fim_semana: l.comissao_fds,
        comissao_propria: l.comissao_propria,
        adiantamento: l.adiantamento,
        salario_total: l.salario_total,
        total_a_pagar: l.total_a_pagar,
        ftds: l.ftds,
        total_leads_convertidos: resultado.totalFtds,
        calculado_em: agora,
        calculado_por: adminId,
      }));

    // Substitui a foto do mês inteira, para não sobrar quem saiu do cálculo.
    await supabase.from('fechamentos_mensais').delete().eq('mes', resultado.mes);
    if (linhas.length > 0) await supabase.from('fechamentos_mensais').insert(linhas);
    return agora;
  }, []);

  const calcular = useCallback(
    async (mes: string, adminId: string) => {
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

      const resultado = data as ResultadoFechamento;
      const calculadoEm = await persistir(resultado, adminId);
      setDados({ ...resultado, calculadoEm });
      setCarregando(false);
    },
    [persistir]
  );

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

  async function editarAdiantamento(mes: string, adminId: string, colaboradorId: string, valor: number) {
    await supabase
      .from('adiantamentos_mensais')
      .upsert(
        { colaborador_id: colaboradorId, mes, valor, atualizado_em: new Date().toISOString() },
        { onConflict: 'colaborador_id,mes' }
      );
    await calcular(mes, adminId);
  }

  return { dados, carregando, importando, erro, calcular, importar, editarAdiantamento };
}
