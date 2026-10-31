import { diaReal } from '../../../supabase/functions/_shared/calculoFechamento';

// Fechamento das outras operações. Mesmas regras da base da TNT para
// contar as vendas (Dia Real pela hora de virada e "Rejeitado" não conta);
// a divisão é escolhida pelo admin mês a mês:
//
//   - individual: vendas da pessoa × valor por venda;
//   - equipe: vendas de todos da equipe × valor, divididas igualmente entre
//     os membros;
//   - sem pagamento: aparece na lista, mas não recebe.
//
// Quem não tem divisão definida no mês recebe como individual.

// Nome da operação que já existia no site (base de FTDs, equipes, FDS,
// infoprodutos). As demais são cadastradas em "+ Operação".
export const OPERACAO_PRINCIPAL = 'TNT';

export type ModoDivisao = 'individual' | 'equipe' | 'sem_pagamento';

export interface VendaOperacao {
  operacao_id: string;
  operador: string;
  etapa: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM[:SS]
}

export interface DivisaoPessoa {
  operacao_id: string;
  nome_base: string;
  modo: ModoDivisao;
  equipe: string | null;
}

export interface PessoaOperacao {
  nome_base: string;
  colaborador_id: string | null;
  ftds: number;
  rejeitados: number;
  dias: number;
  modo: ModoDivisao;
  equipe: string | null;
  valor: number;
}

export interface EquipeOperacao {
  nome: string;
  membros: string[];
  ftds: number;
  valor: number;
}

export interface ResultadoOperacao {
  operacao_id: string;
  valorPorFtd: number;
  pessoas: PessoaOperacao[];
  equipes: EquipeOperacao[];
  totalFtds: number;
  total: number;
  ultimaData: string | null;
}

export function normalizarNome(nome: string) {
  return nome.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function calcularOperacao(entrada: {
  operacao_id: string;
  mes: string; // YYYY-MM-01
  horaVirada: number;
  valorPorFtd: number;
  vendas: VendaOperacao[];
  divisao: DivisaoPessoa[];
  colaboradorDe: (nomeBase: string) => string | null;
}): ResultadoOperacao {
  const { mes, horaVirada, valorPorFtd } = entrada;
  const prefixo = mes.slice(0, 7);

  // Agrupa por pessoa (pelo nome normalizado, guardando a 1ª grafia).
  const porPessoa = new Map<string, { nome: string; ftds: number; rejeitados: number; dias: Set<string> }>();
  let ultimaData: string | null = null;
  for (const v of entrada.vendas) {
    const dia = diaReal(v, horaVirada);
    if (dia.slice(0, 7) !== prefixo) continue;
    const chave = normalizarNome(v.operador);
    const p = porPessoa.get(chave) ?? { nome: v.operador.trim(), ftds: 0, rejeitados: 0, dias: new Set<string>() };
    if (normalizarNome(v.etapa) === 'rejeitado') {
      p.rejeitados++;
    } else {
      p.ftds++;
      p.dias.add(dia);
      if (!ultimaData || dia > ultimaData) ultimaData = dia;
    }
    porPessoa.set(chave, p);
  }

  const divisaoPorNome = new Map(entrada.divisao.map((d) => [normalizarNome(d.nome_base), d]));

  const pessoas: PessoaOperacao[] = [...porPessoa.entries()].map(([chave, p]) => {
    const d = divisaoPorNome.get(chave);
    const modo = d?.modo ?? 'individual';
    return {
      nome_base: p.nome,
      colaborador_id: entrada.colaboradorDe(p.nome),
      ftds: p.ftds,
      rejeitados: p.rejeitados,
      dias: p.dias.size,
      modo,
      equipe: modo === 'equipe' ? (d?.equipe?.trim() ?? null) : null,
      valor: modo === 'individual' ? p.ftds * valorPorFtd : 0,
    };
  });

  // Equipes: soma das vendas dos membros, dividida igualmente.
  const equipesMap = new Map<string, EquipeOperacao>();
  for (const p of pessoas) {
    if (p.modo !== 'equipe' || !p.equipe) continue;
    const chave = normalizarNome(p.equipe);
    const e = equipesMap.get(chave) ?? { nome: p.equipe, membros: [], ftds: 0, valor: 0 };
    e.membros.push(p.nome_base);
    e.ftds += p.ftds;
    equipesMap.set(chave, e);
  }
  for (const e of equipesMap.values()) {
    e.valor = e.ftds * valorPorFtd;
    const parte = e.valor / e.membros.length;
    for (const p of pessoas) {
      if (p.modo === 'equipe' && p.equipe && normalizarNome(p.equipe) === normalizarNome(e.nome)) p.valor = parte;
    }
  }

  pessoas.sort((a, b) => b.ftds - a.ftds || a.nome_base.localeCompare(b.nome_base, 'pt-BR'));

  return {
    operacao_id: entrada.operacao_id,
    valorPorFtd,
    pessoas,
    equipes: [...equipesMap.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    totalFtds: pessoas.reduce((s, p) => s + p.ftds, 0),
    total: pessoas.reduce((s, p) => s + p.valor, 0),
    ultimaData,
  };
}
