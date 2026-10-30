import type { LinhaFechamento } from '../../features/schedules/useFechamentoMensal';
import type { useOutrasOperacoes } from '../../features/operacoes/useOutrasOperacoes';
import { normalizarNome } from '../../features/operacoes/calculoOperacoes';

type OutrasOperacoes = ReturnType<typeof useOutrasOperacoes>;

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

interface LinhaGeral {
  chave: string;
  nome: string;
  semCadastro: boolean;
  principal: number;
  porOperacao: Map<string, number>;
}

// Aba "Pagamento geral": quanto pagar a cada pessoa somando a operação
// principal (total a pagar do fechamento) e as outras operações. As outras
// operações recebem a mesma taxa do "total a pagar" da principal.
export function PagamentoGeral({
  linhas,
  ops,
  taxa,
}: {
  linhas: LinhaFechamento[];
  ops: OutrasOperacoes;
  taxa: number;
}) {
  const operacoes = ops.operacoes.filter((o) => o.ativo);
  const mapa = new Map<string, LinhaGeral>();
  const nomeColaborador = new Map(ops.colaboradores.map((c) => [c.id, c.nome]));

  function linha(chave: string, nome: string, semCadastro: boolean) {
    let l = mapa.get(chave);
    if (!l) {
      l = { chave, nome, semCadastro, principal: 0, porOperacao: new Map() };
      mapa.set(chave, l);
    }
    return l;
  }

  for (const l of linhas) {
    const chave = l.colaborador_id ? `c:${l.colaborador_id}` : `n:${normalizarNome(l.nome)}`;
    linha(chave, l.nome, false).principal += l.total_a_pagar;
  }
  for (const op of operacoes) {
    for (const p of ops.resultados.get(op.id)?.pessoas ?? []) {
      if (p.valor === 0) continue;
      const l = p.colaborador_id
        ? linha(`c:${p.colaborador_id}`, nomeColaborador.get(p.colaborador_id) ?? p.nome_base, false)
        : linha(`n:${normalizarNome(p.nome_base)}`, p.nome_base, true);
      l.porOperacao.set(op.id, (l.porOperacao.get(op.id) ?? 0) + p.valor);
    }
  }

  const somaOutras = (l: LinhaGeral) => [...l.porOperacao.values()].reduce((s, v) => s + v, 0);
  const total = (l: LinhaGeral) => l.principal + somaOutras(l) * (1 + taxa);
  const lista = [...mapa.values()]
    .filter((l) => l.principal !== 0 || l.porOperacao.size > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const soma = (f: (l: LinhaGeral) => number) => lista.reduce((s, l) => s + f(l), 0);

  const semValor = operacoes.filter((o) => {
    const r = ops.resultados.get(o.id);
    return r && r.totalFtds > 0 && r.valorPorFtd === 0;
  });
  const semCadastro = lista.filter((l) => l.semCadastro);
  const direita = 'whitespace-nowrap px-3 py-2 text-right tabular-nums';

  return (
    <div>
      <p className="text-sm text-slate-500">
        Quanto pagar a cada pessoa no mês: o total a pagar da operação principal mais o que ela recebe em
        cada outra operação. Sobre as outras operações entra a mesma taxa de {(taxa * 100).toLocaleString('pt-BR')}%
        do total a pagar.
      </p>

      {(semValor.length > 0 || semCadastro.length > 0) && (
        <div className="mt-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {semValor.map((o) => (
            <p key={o.id}>⚠ {o.nome}: há vendas no mês, mas o valor por venda ainda não foi definido.</p>
          ))}
          {semCadastro.length > 0 && (
            <p>
              ⚠ Sem colaborador ligado (aparecem separados): {semCadastro.map((l) => l.nome).join(', ')}. Ligue na aba
              "Outras operações".
            </p>
          )}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-3 font-medium">Nome</th>
              <th className="px-3 py-3 text-right font-medium">Operação principal</th>
              {operacoes.map((o) => (
                <th key={o.id} className="px-3 py-3 text-right font-medium">
                  {o.nome}
                </th>
              ))}
              <th className="px-3 py-3 text-right font-medium">Total a pagar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((l) => (
              <tr key={l.chave}>
                <td className="px-3 py-2 font-medium text-tinta">
                  {l.nome}
                  {l.semCadastro && <span className="ml-1 text-xs font-normal text-amber-700">(sem cadastro)</span>}
                </td>
                <td className={direita}>{l.principal ? formatarMoeda(l.principal) : '—'}</td>
                {operacoes.map((o) => {
                  const v = l.porOperacao.get(o.id) ?? 0;
                  return (
                    <td key={o.id} className={direita}>
                      {v ? formatarMoeda(v) : '—'}
                    </td>
                  );
                })}
                <td className={`${direita} font-semibold text-tinta`}>{formatarMoeda(total(l))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-tinta">
            <tr>
              <td className="px-3 py-2">Total</td>
              <td className={direita}>{formatarMoeda(soma((l) => l.principal))}</td>
              {operacoes.map((o) => (
                <td key={o.id} className={direita}>
                  {formatarMoeda(soma((l) => l.porOperacao.get(o.id) ?? 0))}
                </td>
              ))}
              <td className={direita}>{formatarMoeda(soma(total))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
