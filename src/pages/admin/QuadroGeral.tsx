import { Fragment, useRef, useState, type ReactNode } from 'react';
import { useToast } from '../../components/FeedbackProvider';
import type { LinhaFechamento } from '../../features/schedules/useFechamentoMensal';
import type { useOutrasOperacoes } from '../../features/operacoes/useOutrasOperacoes';
import { OPERACAO_PRINCIPAL } from '../../features/operacoes/calculoOperacoes';
import { montarQuadroGeral, type LinhaGeral, type ParteOperacao } from '../../features/operacoes/quadroGeral';

type OutrasOperacoes = ReturnType<typeof useOutrasOperacoes>;

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

const arredondar = (v: number) => Math.round(v * 100) / 100;

// Aba "Quadro geral": junta, por pessoa, o total a pagar da TNT e o das
// outras operações num valor só, com o detalhe de onde vem cada parte. As
// outras operações recebem a mesma taxa do "total a pagar" da TNT.
const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function QuadroGeral({
  mes,
  linhas,
  ops,
  taxa,
}: {
  mes: string; // YYYY-MM-01
  linhas: LinhaFechamento[];
  ops: OutrasOperacoes;
  taxa: number;
}) {
  const toast = useToast();
  const [aberta, setAberta] = useState<string | null>(null);
  const [capturando, setCapturando] = useState(false);
  const imagem = useRef<HTMLDivElement>(null);
  const { operacoes, lista, comTaxa, valorInfo, valorTnt, valorOperacao, total } = montarQuadroGeral(linhas, ops, taxa);
  const soma = (f: (l: LinhaGeral) => number) => lista.reduce((s, l) => s + f(l), 0);

  const semValor = operacoes.filter((o) => {
    const r = ops.resultados.get(o.id);
    return r && r.totalFtds > 0 && r.valorPorFtd === 0;
  });
  const semCadastro = lista.filter((l) => l.semCadastro);
  const direita = 'whitespace-nowrap px-3 py-2 text-right tabular-nums';
  const compacta = 'whitespace-nowrap px-3 py-1 text-right tabular-nums';
  const colunas = 4 + operacoes.length;
  const percentual = `${(taxa * 100).toLocaleString('pt-BR')}%`;
  const [ano, numMes] = mes.split('-').map(Number);
  const nomeMes = `${NOMES_MESES[numMes - 1]} de ${ano}`;

  // Gera um PNG com a tabela inteira (versão compacta, montada fora da tela
  // só durante a captura), para mandar como print.
  async function baixarImagem() {
    setCapturando(true);
    try {
      // Espera o React montar a versão compacta.
      await new Promise((r) => setTimeout(r, 50));
      const no = imagem.current;
      if (!no) throw new Error();
      const { toPng } = await import('html-to-image');
      const opcoes = { pixelRatio: 2, backgroundColor: '#ffffff' };
      // Se as fontes não puderem ser embutidas, gera com as do sistema.
      const url = await toPng(no, opcoes).catch(() => toPng(no, { ...opcoes, skipFonts: true }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `quadro-geral-${mes.slice(0, 7)}.png`;
      link.click();
    } catch {
      toast('Não foi possível gerar a imagem.', 'erro');
    } finally {
      setCapturando(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-slate-500">
          Quanto pagar a cada pessoa no mês, somando a {OPERACAO_PRINCIPAL}, as outras operações e os infoprodutos. Cada
          coluna já tem a taxa de {percentual} do total a pagar. Clique numa pessoa para ver de onde vem cada valor.
        </p>
        <button
          type="button"
          onClick={baixarImagem}
          disabled={capturando || lista.length === 0}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-tinta transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {capturando ? 'Gerando imagem...' : 'Baixar imagem'}
        </button>
      </div>

      {capturando && (
        <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden>
          <div ref={imagem} className="w-max min-w-[40rem] bg-white p-6 text-tinta">
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">Quadro geral</p>
            <p className="mt-1 font-display text-2xl font-semibold">{nomeMes}</p>
            <p className="mt-1 text-xs text-slate-400">Valores já com a taxa de {percentual}.</p>
            <div className="mt-4 flex gap-3">
              <Cartao titulo="Total geral a pagar" valor={formatarMoeda(soma(total))} destaque />
              <Cartao titulo={OPERACAO_PRINCIPAL} valor={formatarMoeda(soma(valorTnt))} />
              {operacoes.map((o) => (
                <Cartao key={o.id} titulo={o.nome} valor={formatarMoeda(soma((l) => valorOperacao(l, o.id)))} />
              ))}
              <Cartao titulo="Infoprodutos" valor={formatarMoeda(soma(valorInfo))} />
            </div>
            <table className="mt-4 w-full border border-slate-200 text-left text-[13px]">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Nome</th>
                  <th className="px-3 py-1.5 text-right font-medium">{OPERACAO_PRINCIPAL}</th>
                  {operacoes.map((o) => (
                    <th key={o.id} className="whitespace-nowrap px-3 py-1.5 text-right font-medium">
                      {o.nome}
                    </th>
                  ))}
                  <th className="px-3 py-1.5 text-right font-medium">Infoprodutos</th>
                  <th className="whitespace-nowrap px-3 py-1.5 text-right font-medium">Total a pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((l, i) => (
                  <tr key={l.chave} className={i % 2 ? 'bg-slate-50/60' : ''}>
                    <td className="whitespace-nowrap px-3 py-1 font-medium">{l.nome}</td>
                    <td className={compacta}>{valorTnt(l) !== 0 ? formatarMoeda(valorTnt(l)) : '—'}</td>
                    {operacoes.map((o) => (
                      <td key={o.id} className={compacta}>
                        {l.outras.has(o.id) ? formatarMoeda(valorOperacao(l, o.id)) : '—'}
                      </td>
                    ))}
                    <td className={compacta}>{valorInfo(l) !== 0 ? formatarMoeda(valorInfo(l)) : '—'}</td>
                    <td className={`${compacta} font-semibold text-esmeralda-dark`}>{formatarMoeda(total(l))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-3 py-1.5">Total</td>
                  <td className={compacta}>{formatarMoeda(soma(valorTnt))}</td>
                  {operacoes.map((o) => (
                    <td key={o.id} className={compacta}>
                      {formatarMoeda(soma((l) => valorOperacao(l, o.id)))}
                    </td>
                  ))}
                  <td className={compacta}>{formatarMoeda(soma(valorInfo))}</td>
                  <td className={`${compacta} text-esmeralda-dark`}>{formatarMoeda(soma(total))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Cartao titulo="Total geral a pagar" valor={formatarMoeda(soma(total))} destaque />
        <Cartao titulo={OPERACAO_PRINCIPAL} valor={formatarMoeda(soma(valorTnt))} />
        {operacoes.map((o) => (
          <Cartao key={o.id} titulo={o.nome} valor={formatarMoeda(soma((l) => valorOperacao(l, o.id)))} />
        ))}
        <Cartao titulo="Infoprodutos" valor={formatarMoeda(soma(valorInfo))} />
      </div>

      {(semValor.length > 0 || semCadastro.length > 0) && (
        <div className="mt-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {semValor.map((o) => (
            <p key={o.id}>⚠ {o.nome}: há vendas no mês, mas o valor por venda ainda não foi definido.</p>
          ))}
          {semCadastro.length > 0 && (
            <p>
              ⚠ Sem colaborador ligado (aparecem separados): {semCadastro.map((l) => l.nome).join(', ')}. Ligue na aba da operação, na coluna "Colaborador".
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
              <th className="whitespace-nowrap px-3 py-3 text-right font-medium">Infoprodutos</th>
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
                      <td className={direita}>{valorTnt(l) !== 0 ? formatarMoeda(valorTnt(l)) : '—'}</td>
                      {operacoes.map((o) => (
                        <td key={o.id} className={direita}>
                          {l.outras.has(o.id) ? formatarMoeda(valorOperacao(l, o.id)) : '—'}
                        </td>
                      ))}
                      <td className={direita}>{valorInfo(l) !== 0 ? formatarMoeda(valorInfo(l)) : '—'}</td>
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
                              <DetalheTnt key={t.chave} linha={t} infoComTaxa={comTaxa(t.comissao_infoprodutos)} percentual={percentual} />
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
                            {valorInfo(l) !== 0 && (
                              <Bloco titulo="Infoprodutos">
                                <Item rotulo="Comissão de infoprodutos" valor={l.tnt.reduce((s, t) => s + t.comissao_infoprodutos, 0)} />
                                <Item
                                  rotulo={`Taxa (${percentual})`}
                                  valor={arredondar(valorInfo(l) - l.tnt.reduce((s, t) => s + t.comissao_infoprodutos, 0))}
                                />
                                <Item rotulo="Total infoprodutos" valor={valorInfo(l)} forte />
                              </Bloco>
                            )}
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
                <td className={direita}>{formatarMoeda(soma(valorInfo))}</td>
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

// Bloco da TNT sem a comissão de infoprodutos (que tem bloco e coluna próprios).
function DetalheTnt({
  linha: t,
  infoComTaxa,
  percentual,
}: {
  linha: LinhaFechamento;
  infoComTaxa: number;
  percentual: string;
}) {
  const salario = arredondar(t.salario_total - t.comissao_infoprodutos);
  const totalTnt = arredondar(t.total_a_pagar - infoComTaxa);
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
      {t.adiantamento !== 0 && <Item rotulo="Adiantamento" valor={t.adiantamento} negativo />}
      {t.ja_pago !== 0 && <Item rotulo="Já pago (acerto)" valor={t.ja_pago} negativo />}
      <Item rotulo="Salário" valor={salario} forte />
      <Item rotulo={`Taxa (${percentual})`} valor={arredondar(totalTnt - salario)} />
      <Item rotulo={`Total ${OPERACAO_PRINCIPAL}`} valor={totalTnt} forte />
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
