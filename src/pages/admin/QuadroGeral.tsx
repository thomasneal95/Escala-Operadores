import { Fragment, useState, type ReactNode } from 'react';
import type { LinhaFechamento } from '../../features/schedules/useFechamentoMensal';
import type { useOutrasOperacoes } from '../../features/operacoes/useOutrasOperacoes';
import {
  normalizarNome,
  OPERACAO_PRINCIPAL,
  type EquipeOperacao,
  type PessoaOperacao,
} from '../../features/operacoes/calculoOperacoes';

type OutrasOperacoes = ReturnType<typeof useOutrasOperacoes>;

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

const arredondar = (v: number) => Math.round(v * 100) / 100;

interface ParteOperacao {
  pessoa: PessoaOperacao;
  equipe: EquipeOperacao | null;
  valorPorFtd: number;
}

interface LinhaGeral {
  chave: string;
  nome: string;
  semCadastro: boolean;
  tnt: LinhaFechamento[];
  // Por operação: o que a pessoa recebe (sem taxa) e de onde vem.
  outras: Map<string, ParteOperacao[]>;
}

// Aba "Quadro geral": junta, por pessoa, o total a pagar da TNT e o das
// outras operações num valor só, com o detalhe de onde vem cada parte. As
// outras operações recebem a mesma taxa do "total a pagar" da TNT.
export function QuadroGeral({
  linhas,
  ops,
  taxa,
}: {
  linhas: LinhaFechamento[];
  ops: OutrasOperacoes;
  taxa: number;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
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
  const valorTnt = (l: LinhaGeral) => l.tnt.reduce((s, t) => s + t.total_a_pagar, 0);
  const valorOperacao = (l: LinhaGeral, opId: string) =>
    comTaxa((l.outras.get(opId) ?? []).reduce((s, p) => s + p.pessoa.valor, 0));
  const total = (l: LinhaGeral) => valorTnt(l) + operacoes.reduce((s, o) => s + valorOperacao(l, o.id), 0);

  const lista = [...mapa.values()]
    .filter((l) => l.tnt.some((t) => t.total_a_pagar !== 0) || l.outras.size > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const soma = (f: (l: LinhaGeral) => number) => lista.reduce((s, l) => s + f(l), 0);

  const semValor = operacoes.filter((o) => {
    const r = ops.resultados.get(o.id);
    return r && r.totalFtds > 0 && r.valorPorFtd === 0;
  });
  const semCadastro = lista.filter((l) => l.semCadastro);
  const direita = 'whitespace-nowrap px-3 py-2 text-right tabular-nums';
  const colunas = 3 + operacoes.length;
  const percentual = `${(taxa * 100).toLocaleString('pt-BR')}%`;

  return (
    <div>
      <p className="text-sm text-slate-500">
        Quanto pagar a cada pessoa no mês, somando a {OPERACAO_PRINCIPAL} e as outras operações. Cada coluna já
        tem a taxa de {percentual} do total a pagar. Clique numa pessoa para ver de onde vem cada valor.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cartao titulo="Total geral a pagar" valor={formatarMoeda(soma(total))} destaque />
        <Cartao titulo={OPERACAO_PRINCIPAL} valor={formatarMoeda(soma(valorTnt))} />
        {operacoes.map((o) => (
          <Cartao key={o.id} titulo={o.nome} valor={formatarMoeda(soma((l) => valorOperacao(l, o.id)))} />
        ))}
      </div>

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
              <th className="px-3 py-3 text-right font-medium">{OPERACAO_PRINCIPAL}</th>
              {operacoes.map((o) => (
                <th key={o.id} className="whitespace-nowrap px-3 py-3 text-right font-medium">
                  {o.nome}
                </th>
              ))}
              <th className="whitespace-nowrap px-3 py-3 text-right font-medium">Total a pagar</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.length === 0 ? (
              <tr>
                <td colSpan={colunas + 1} className="px-4 py-6 text-center text-slate-400">
                  Nenhum valor calculado para este mês.
                </td>
              </tr>
            ) : (
              lista.map((l) => {
                const estaAberta = aberta === l.chave;
                return (
                  <Fragment key={l.chave}>
                    <tr
                      onClick={() => setAberta(estaAberta ? null : l.chave)}
                      className={`cursor-pointer hover:bg-slate-50 ${estaAberta ? 'bg-slate-50' : ''}`}
                    >
                      <td className="px-3 py-2 font-medium text-tinta">
                        {l.nome}
                        {l.semCadastro && (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            Sem cadastro
                          </span>
                        )}
                      </td>
                      <td className={direita}>{l.tnt.length ? formatarMoeda(valorTnt(l)) : '—'}</td>
                      {operacoes.map((o) => (
                        <td key={o.id} className={direita}>
                          {l.outras.has(o.id) ? formatarMoeda(valorOperacao(l, o.id)) : '—'}
                        </td>
                      ))}
                      <td className={`${direita} font-semibold text-esmeralda-dark`}>{formatarMoeda(total(l))}</td>
                      <td className="px-2 text-center text-slate-400" aria-hidden>
                        {estaAberta ? '▴' : '▾'}
                      </td>
                    </tr>
                    {estaAberta && (
                      <tr className="bg-slate-50">
                        <td colSpan={colunas + 1} className="px-3 pb-4 pt-1">
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3">
                            {l.tnt.map((t) => (
                              <DetalheTnt key={t.chave} linha={t} percentual={percentual} />
                            ))}
                            {operacoes
                              .filter((o) => l.outras.has(o.id))
                              .map((o) => (
                                <DetalheOperacao
                                  key={o.id}
                                  nome={o.nome}
                                  partes={l.outras.get(o.id)!}
                                  total={valorOperacao(l, o.id)}
                                  percentual={percentual}
                                />
                              ))}
                          </div>
                          <p className="mt-3 text-right text-sm font-semibold text-tinta">
                            Total a pagar: {formatarMoeda(total(l))}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
          {lista.length > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-tinta">
              <tr>
                <td className="px-3 py-2">Total</td>
                <td className={direita}>{formatarMoeda(soma(valorTnt))}</td>
                {operacoes.map((o) => (
                  <td key={o.id} className={direita}>
                    {formatarMoeda(soma((l) => valorOperacao(l, o.id)))}
                  </td>
                ))}
                <td className={`${direita} text-esmeralda-dark`}>{formatarMoeda(soma(total))}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// Uma linha do detalhamento: rótulo à esquerda, valor à direita.
function Item({ rotulo, valor, negativo, forte }: { rotulo: string; valor: number; negativo?: boolean; forte?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${forte ? 'border-t border-slate-200 pt-1 font-semibold text-tinta' : 'text-slate-600'}`}>
      <dt>{rotulo}</dt>
      <dd className="whitespace-nowrap tabular-nums">
        {negativo ? '− ' : ''}
        {formatarMoeda(valor)}
      </dd>
    </div>
  );
}

function Bloco({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="font-medium text-tinta">{titulo}</p>
      {subtitulo && <p className="text-xs text-slate-400">{subtitulo}</p>}
      <dl className="mt-2 space-y-1 text-sm">{children}</dl>
    </div>
  );
}

function DetalheTnt({ linha: t, percentual }: { linha: LinhaFechamento; percentual: string }) {
  const porFtd = t.tipo === 'externo' || t.tipo === 'individual';
  const rotuloBase =
    t.tipo === 'salario_fixo' ? 'Salário fixo' : t.tipo === 'auxilio_fixo' ? 'Auxílio fixo' : 'Auxílio';
  return (
    <Bloco
      titulo={OPERACAO_PRINCIPAL}
      subtitulo={[t.ftds ? `${t.ftds} FTD(s)` : null, t.equipe ? `Equipe ${t.equipe}` : null].filter(Boolean).join(' · ') || undefined}
    >
      {t.auxilio !== 0 && <Item rotulo={rotuloBase} valor={t.auxilio} />}
      {porFtd && t.comissao_propria !== 0 && <Item rotulo="FTDs em dias úteis" valor={t.comissao_propria} />}
      {t.comissao_equipe !== 0 && <Item rotulo="Comissão de equipe" valor={t.comissao_equipe} />}
      {t.comissao_fds !== 0 && (
        <Item rotulo={porFtd ? 'FTDs no fim de semana' : 'Comissão de fim de semana'} valor={t.comissao_fds} />
      )}
      {t.comissao_infoprodutos !== 0 && <Item rotulo="Comissão de infoprodutos" valor={t.comissao_infoprodutos} />}
      {t.adiantamento !== 0 && <Item rotulo="Adiantamento" valor={t.adiantamento} negativo />}
      {t.ja_pago !== 0 && <Item rotulo="Já pago (acerto)" valor={t.ja_pago} negativo />}
      <Item rotulo="Salário" valor={t.salario_total} forte />
      <Item rotulo={`Taxa (${percentual})`} valor={arredondar(t.total_a_pagar - t.salario_total)} />
      <Item rotulo={`Total ${OPERACAO_PRINCIPAL}`} valor={t.total_a_pagar} forte />
    </Bloco>
  );
}

function DetalheOperacao({
  nome,
  partes,
  total,
  percentual,
}: {
  nome: string;
  partes: ParteOperacao[];
  total: number;
  percentual: string;
}) {
  const subtotal = partes.reduce((s, p) => s + p.pessoa.valor, 0);
  return (
    <Bloco
      titulo={nome}
      subtitulo={partes
        .map(({ pessoa: p, equipe }) =>
          equipe ? `Equipe ${equipe.nome}: ${equipe.membros.join(', ')}` : `${p.ftds} venda(s) de ${p.nome_base}`
        )
        .join(' · ')}
    >
      {partes.map(({ pessoa: p, equipe, valorPorFtd }) =>
        equipe ? (
          <Fragment key={p.nome_base}>
            <Item rotulo={`Vendas da equipe: ${equipe.ftds} × ${formatarMoeda(valorPorFtd)}`} valor={equipe.valor} />
            <Item rotulo={`Dividido por ${equipe.membros.length} (${p.ftds} venda(s) suas)`} valor={p.valor} />
          </Fragment>
        ) : (
          <Item key={p.nome_base} rotulo={`Individual: ${p.ftds} × ${formatarMoeda(valorPorFtd)}`} valor={p.valor} />
        )
      )}
      <Item rotulo="Comissão" valor={subtotal} forte />
      <Item rotulo={`Taxa (${percentual})`} valor={arredondar(total - subtotal)} />
      <Item rotulo={`Total ${nome}`} valor={total} forte />
    </Bloco>
  );
}

function Cartao({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        destaque ? 'border-esmeralda/30 bg-esmeralda-light' : 'border-slate-200 bg-white'
      }`}
    >
      <p
        className={`text-xs font-medium uppercase tracking-wide ${
          destaque ? 'text-esmeralda-dark' : 'text-slate-400'
        }`}
      >
        {titulo}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold text-tinta">{valor}</p>
    </div>
  );
}
