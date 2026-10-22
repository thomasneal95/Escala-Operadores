import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import type { ResultadoFechamento } from '../../../supabase/functions/_shared/calculoFechamento';

// Histórico de comissões: fotos dos meses fechados (botão "Arquivar mês",
// como na planilha) e meses importados da aba Historico do Excel.

export interface MesArquivado {
  mes: string;
  origem: 'site' | 'planilha';
  total_ftds: number | null;
  arquivado_em: string;
  pessoas: number;
  salario_total: number;
  total_a_pagar: number | null;
}

export interface LinhaHistorico {
  id: string;
  tipo: string;
  colaborador_id: string | null;
  nome: string;
  equipe: string | null;
  data_inicio: string | null;
  auxilio: number;
  comissao_propria: number;
  comissao_equipe: number;
  comissao_fds: number;
  adiantamento: number;
  salario_total: number;
  ftds: number | null;
  total_a_pagar: number | null;
}

const numero = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function useHistoricoComissoes() {
  const [meses, setMeses] = useState<MesArquivado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    const [mesesRes, linhasRes] = await Promise.all([
      supabase.from('meses_arquivados').select('mes, origem, total_ftds, arquivado_em').order('mes', { ascending: false }),
      supabase.from('historico_comissoes').select('mes, salario_total, total_a_pagar'),
    ]);

    if (mesesRes.error || linhasRes.error) {
      setErro('Não foi possível carregar o histórico de comissões.');
      setCarregando(false);
      return;
    }

    setMeses(
      (mesesRes.data ?? []).map((m) => {
        const doMes = (linhasRes.data ?? []).filter((l) => l.mes === m.mes);
        const comTotal = doMes.filter((l) => l.total_a_pagar !== null);
        return {
          mes: m.mes,
          origem: m.origem,
          total_ftds: m.total_ftds,
          arquivado_em: m.arquivado_em,
          pessoas: doMes.length,
          salario_total: doMes.reduce((s, l) => s + Number(l.salario_total), 0),
          total_a_pagar:
            comTotal.length === doMes.length && doMes.length > 0
              ? comTotal.reduce((s, l) => s + Number(l.total_a_pagar), 0)
              : null,
        };
      })
    );
    setErro(null);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function linhasDoMes(mes: string): Promise<LinhaHistorico[]> {
    const { data } = await supabase
      .from('historico_comissoes')
      .select('*')
      .eq('mes', mes)
      .order('nome');
    return (data ?? []).map((l) => ({
      ...l,
      auxilio: Number(l.auxilio),
      comissao_propria: Number(l.comissao_propria),
      comissao_equipe: Number(l.comissao_equipe),
      comissao_fds: Number(l.comissao_fds),
      adiantamento: Number(l.adiantamento),
      salario_total: Number(l.salario_total),
      total_a_pagar: numero(l.total_a_pagar),
    }));
  }

  async function gravar(mes: string, linhas: unknown[], origem: 'site' | 'planilha', totalFtds: number | null) {
    const { error } = await supabase.rpc('arquivar_mes_comissoes', {
      p_mes: mes,
      p_linhas: linhas,
      p_origem: origem,
      p_total_ftds: totalFtds,
    });
    return error ? 'Não foi possível arquivar o mês. Nada foi alterado.' : null;
  }

  // Foto do fechamento calculado no site (substitui se o mês já existir).
  async function arquivar(resultado: ResultadoFechamento) {
    setProcessando(true);
    const erroGravar = await gravar(resultado.mes, resultado.linhas, 'site', resultado.totalFtds);
    await carregar();
    setProcessando(false);
    return { erro: erroGravar };
  }

  // Traz os meses da aba Historico do Excel. Liga cada nome ao colaborador
  // pelo "nome na base"; meses que já existem no site são substituídos.
  async function importarDaPlanilha(arquivo: File) {
    setProcessando(true);
    try {
      const { lerHistoricoExcel } = await import('../../lib/lerBaseExcel');
      const linhas = await lerHistoricoExcel(arquivo);
      if (linhas.length === 0) return { erro: 'A aba Historico não tem nenhum mês.' };

      const { data: colaboradores } = await supabase.from('colaboradores').select('id, nome_base');
      const idPorNome = new Map(
        (colaboradores ?? [])
          .filter((c) => c.nome_base)
          .map((c) => [String(c.nome_base).trim().toLowerCase(), c.id])
      );

      const mesesDoArquivo = [...new Set(linhas.map((l) => l.mes))].sort();
      for (const mes of mesesDoArquivo) {
        const doMes = linhas
          .filter((l) => l.mes === mes)
          .map((l) => ({
            ...l,
            tipo: 'colaborador',
            colaborador_id: idPorNome.get(l.nome.trim().toLowerCase()) ?? null,
          }));
        const erroGravar = await gravar(mes, doMes, 'planilha', null);
        if (erroGravar) return { erro: erroGravar };
      }
      return { erro: null, meses: mesesDoArquivo };
    } catch (e) {
      return { erro: e instanceof Error ? e.message : 'Não foi possível ler o arquivo.' };
    } finally {
      await carregar();
      setProcessando(false);
    }
  }

  async function excluir(mes: string) {
    setProcessando(true);
    const { error } = await supabase.from('meses_arquivados').delete().eq('mes', mes);
    await carregar();
    setProcessando(false);
    return { erro: error ? 'Não foi possível excluir o mês do histórico.' : null };
  }

  return { meses, carregando, erro, processando, linhasDoMes, arquivar, importarDaPlanilha, excluir };
}
