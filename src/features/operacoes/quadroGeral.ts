import type { LinhaFechamento } from '../schedules/useFechamentoMensal';
import type { useOutrasOperacoes } from './useOutrasOperacoes';
import { normalizarNome, type EquipeOperacao, type PessoaOperacao } from './calculoOperacoes';

type OutrasOperacoes = ReturnType<typeof useOutrasOperacoes>;

const arredondar = (v: number) => Math.round(v * 100) / 100;

export interface ParteOperacao {
  pessoa: PessoaOperacao;
  equipe: EquipeOperacao | null;
  valorPorFtd: number;
}

export interface LinhaGeral {
  // `c:<colaborador_id>` ou `n:<nome normalizado>` (quem não é colaborador).
  chave: string;
  nome: string;
  semCadastro: boolean;
  tnt: LinhaFechamento[];
  // Por operação: o que a pessoa recebe (sem taxa) e de onde vem.
  outras: Map<string, ParteOperacao[]>;
}

// Junta, por pessoa, o total a pagar da TNT e o das outras operações (com a
// mesma taxa do "total a pagar" da TNT). Usado pelo Quadro geral e pelos
// Pagamentos, para os dois mostrarem sempre o mesmo valor.
export function montarQuadroGeral(linhas: LinhaFechamento[], ops: OutrasOperacoes, taxa: number) {
  const operacoes = ops.operacoes.filter((o) => o.ativo);
  const mapa = new Map<string, LinhaGeral>();
  const nomeColaborador = new Map(ops.colaboradores.map((c) => [c.id, c.nome]));

  function linha(chave: string, nome: string, semCadastro: boolean) {
    let l = mapa.get(chave);
    if (!l) {
      l = { chave, nome, semCadastro, tnt: [], outras: new Map() };
      mapa.set(chave, l);
    }
    return l;
  }

  for (const l of linhas) {
    const chave = l.colaborador_id ? `c:${l.colaborador_id}` : `n:${normalizarNome(l.nome)}`;
    linha(chave, l.nome, false).tnt.push(l);
  }
  for (const op of operacoes) {
    const resultado = ops.resultados.get(op.id);
    for (const p of resultado?.pessoas ?? []) {
      if (p.valor === 0) continue;
      const l = p.colaborador_id
        ? linha(`c:${p.colaborador_id}`, nomeColaborador.get(p.colaborador_id) ?? p.nome_base, false)
        : linha(`n:${normalizarNome(p.nome_base)}`, p.nome_base, true);
      const equipe =
        p.modo === 'equipe' && p.equipe
          ? (resultado?.equipes.find((e) => normalizarNome(e.nome) === normalizarNome(p.equipe!)) ?? null)
          : null;
      l.outras.set(op.id, [...(l.outras.get(op.id) ?? []), { pessoa: p, equipe, valorPorFtd: resultado!.valorPorFtd }]);
    }
  }

  const comTaxa = (v: number) => arredondar(v * (1 + taxa));
  // A comissão de infoprodutos vem no fechamento da TNT, mas aparece numa
  // coluna própria (com a mesma taxa); a coluna TNT fica com o resto.
  const valorInfo = (l: LinhaGeral) => l.tnt.reduce((s, t) => s + comTaxa(t.comissao_infoprodutos), 0);
  const valorTnt = (l: LinhaGeral) => l.tnt.reduce((s, t) => s + t.total_a_pagar - comTaxa(t.comissao_infoprodutos), 0);
  const valorOperacao = (l: LinhaGeral, opId: string) =>
    comTaxa((l.outras.get(opId) ?? []).reduce((s, p) => s + p.pessoa.valor, 0));
  const total = (l: LinhaGeral) =>
    arredondar(valorTnt(l) + operacoes.reduce((s, o) => s + valorOperacao(l, o.id), 0) + valorInfo(l));

  const lista = [...mapa.values()]
    .filter((l) => l.tnt.some((t) => t.total_a_pagar !== 0) || l.outras.size > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return { operacoes, lista, comTaxa, valorInfo, valorTnt, valorOperacao, total };
}
