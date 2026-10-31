import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import {
  calcularOperacao,
  normalizarNome,
  OPERACAO_PRINCIPAL,
  type DivisaoPessoa,
  type ModoDivisao,
  type ResultadoOperacao,
  type VendaOperacao,
} from './calculoOperacoes';

// Outras operações: cadastro, base de vendas (Excel) e divisão do mês de
// cada uma. O fechamento é calculado aqui no navegador (calculoOperacoes) e
// somado ao da TNT (operação principal) na aba "Quadro geral".

export interface Operacao {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface ColaboradorOperacao {
  id: string;
  nome: string;
  nome_base: string | null;
  ativo: boolean;
}

interface Vinculo {
  operacao_id: string;
  nome_base: string;
  colaborador_id: string | null;
}

const ehPrincipal = (nome: string) => normalizarNome(nome) === normalizarNome(OPERACAO_PRINCIPAL);

function ultimoDiaDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

function diaSeguinte(data: string) {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

// O Supabase devolve no máximo 1000 linhas por consulta: busca em páginas.
async function buscarVendasDoMes(mes: string) {
  const vendas: VendaOperacao[] = [];
  const tamanho = 1000;
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await supabase
      .from('vendas_operacoes')
      .select('operacao_id, operador, etapa, data, hora')
      // Até o dia 1º do mês seguinte: vendas antes da hora de virada contam
      // para o último dia deste mês.
      .gte('data', mes)
      .lte('data', diaSeguinte(ultimoDiaDoMes(mes)))
      .order('id')
      .range(inicio, inicio + tamanho - 1);
    if (error) return null;
    vendas.push(...((data ?? []) as VendaOperacao[]));
    if ((data ?? []).length < tamanho) return vendas;
  }
}

export function useOutrasOperacoes(mes: string, horaVirada: number) {
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorOperacao[]>([]);
  const [vendas, setVendas] = useState<VendaOperacao[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [valores, setValores] = useState<Map<string, number>>(new Map());
  const [divisao, setDivisao] = useState<DivisaoPessoa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [operacoesRes, colaboradoresRes, vinculosRes, valoresRes, divisaoRes, vendasDoMes] = await Promise.all([
      supabase.from('operacoes').select('id, nome, ativo').order('nome'),
      supabase.from('colaboradores').select('id, nome_base, ativo, perfis(nome_completo, papel)'),
      supabase.from('operacao_operadores').select('operacao_id, nome_base, colaborador_id'),
      supabase.from('operacao_fechamentos').select('operacao_id, valor_por_ftd').eq('mes', mes),
      supabase.from('operacao_divisao').select('operacao_id, nome_base, modo, equipe').eq('mes', mes),
      buscarVendasDoMes(mes),
    ]);

    if (
      operacoesRes.error ||
      colaboradoresRes.error ||
      vinculosRes.error ||
      valoresRes.error ||
      divisaoRes.error ||
      !vendasDoMes
    ) {
      setErro('Não foi possível carregar as outras operações.');
      setCarregando(false);
      return;
    }

    setOperacoes(operacoesRes.data ?? []);
    setColaboradores(
      (colaboradoresRes.data ?? [])
        .filter((c) => (c.perfis as unknown as { papel: string } | null)?.papel !== 'administrador')
        .map((c) => ({
          id: c.id,
          nome: (c.perfis as unknown as { nome_completo: string } | null)?.nome_completo ?? '(sem nome)',
          nome_base: c.nome_base,
          ativo: c.ativo,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    );
    setVinculos(vinculosRes.data ?? []);
    setValores(new Map((valoresRes.data ?? []).map((v) => [v.operacao_id, Number(v.valor_por_ftd)])));
    setDivisao((divisaoRes.data ?? []) as DivisaoPessoa[]);
    setVendas(vendasDoMes);
    setErro(null);
    setCarregando(false);
  }, [mes]);

  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [carregar]);

  // Nome na base → colaborador: o vínculo salvo na operação; senão, quem tem
  // o mesmo "nome na base" da TNT ou o mesmo nome completo.
  const colaboradorDe = useCallback(
    (operacaoId: string, nomeBase: string) => {
      const chave = normalizarNome(nomeBase);
      const salvo = vinculos.find((v) => v.operacao_id === operacaoId && normalizarNome(v.nome_base) === chave);
      if (salvo) return salvo.colaborador_id;
      const porNome = colaboradores.find(
        (c) => (c.nome_base && normalizarNome(c.nome_base) === chave) || normalizarNome(c.nome) === chave
      );
      return porNome?.id ?? null;
    },
    [vinculos, colaboradores]
  );

  const resultados = useMemo(() => {
    const mapa = new Map<string, ResultadoOperacao>();
    for (const op of operacoes) {
      mapa.set(
        op.id,
        calcularOperacao({
          operacao_id: op.id,
          mes,
          horaVirada,
          valorPorFtd: valores.get(op.id) ?? 0,
          vendas: vendas.filter((v) => v.operacao_id === op.id),
          divisao: divisao.filter((d) => d.operacao_id === op.id),
          colaboradorDe: (nome) => colaboradorDe(op.id, nome),
        })
      );
    }
    return mapa;
  }, [operacoes, mes, horaVirada, valores, vendas, divisao, colaboradorDe]);

  async function executar(acao: PromiseLike<{ error: { code?: string } | null }>, mensagem: string) {
    const { error } = await acao;
    if (error) {
      return { erro: error.code === '23505' ? 'Já existe uma operação com esse nome.' : mensagem };
    }
    await carregar();
    return { erro: null };
  }

  // Lê o Excel no navegador (mesmo leitor da base principal) e grava a base
  // da operação, substituindo os meses que vierem no arquivo.
  async function importar(operacaoId: string, arquivo: File) {
    setImportando(true);
    try {
      const { lerBaseExcel } = await import('../../lib/lerBaseExcel');
      const { linhas, aba, ignoradas } = await lerBaseExcel(arquivo);
      if (linhas.length === 0) {
        return { erro: `A aba "${aba}" não tem nenhuma venda para importar.` };
      }
      const { data, error } = await supabase.rpc('importar_vendas_operacao', {
        p_operacao_id: operacaoId,
        p_linhas: linhas,
      });
      if (error) {
        return { erro: 'Não foi possível gravar a base. Nada foi alterado.' };
      }
      await carregar();
      const meses = [...new Set(linhas.map((l) => l.data.slice(0, 7)))].sort();
      return { erro: null, gravadas: (data as number) ?? linhas.length, ignoradas, aba, meses };
    } catch (e) {
      return { erro: e instanceof Error ? e.message : 'Não foi possível ler o arquivo.' };
    } finally {
      setImportando(false);
    }
  }

  return {
    operacoes,
    colaboradores,
    resultados,
    carregando,
    importando,
    erro,
    recarregar: carregar,
    importar,
    criarOperacao: async (nome: string): Promise<{ erro: string | null; id?: string }> => {
      if (ehPrincipal(nome)) return { erro: `${OPERACAO_PRINCIPAL} já é a operação principal.` };
      const { data, error } = await supabase.from('operacoes').insert({ nome: nome.trim() }).select('id').single();
      if (error) {
        return { erro: error.code === '23505' ? 'Já existe uma operação com esse nome.' : 'Não foi possível criar a operação.' };
      }
      await carregar();
      return { erro: null, id: data.id as string };
    },
    renomearOperacao: async (id: string, nome: string) =>
      ehPrincipal(nome)
        ? { erro: `${OPERACAO_PRINCIPAL} já é a operação principal.` }
        : executar(
        supabase.from('operacoes').update({ nome: nome.trim() }).eq('id', id),
        'Não foi possível renomear a operação.'
      ),
    alternarAtiva: (id: string, ativo: boolean) =>
      executar(supabase.from('operacoes').update({ ativo }).eq('id', id), 'Não foi possível alterar a operação.'),
    definirValor: (operacaoId: string, valor: number) =>
      executar(
        supabase
          .from('operacao_fechamentos')
          .upsert({ operacao_id: operacaoId, mes, valor_por_ftd: valor, atualizado_em: new Date().toISOString() }),
        'Não foi possível salvar o valor por venda.'
      ),
    definirDivisao: (operacaoId: string, nomeBase: string, modo: ModoDivisao, equipe: string | null) =>
      executar(
        supabase.from('operacao_divisao').upsert({
          operacao_id: operacaoId,
          mes,
          nome_base: nomeBase,
          modo,
          equipe: modo === 'equipe' ? equipe?.trim() || null : null,
        }),
        'Não foi possível salvar a divisão.'
      ),
    vincular: (operacaoId: string, nomeBase: string, colaboradorId: string | null) =>
      executar(
        supabase
          .from('operacao_operadores')
          .upsert({ operacao_id: operacaoId, nome_base: nomeBase, colaborador_id: colaboradorId }),
        'Não foi possível ligar o operador ao colaborador.'
      ),
  };
}
