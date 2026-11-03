import { Fragment, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useConfirm, useToast } from '../../components/FeedbackProvider';
import { SecaoRecolhivel } from '../../components/SecaoRecolhivel';
import { SeletorMes } from '../../components/SeletorMes';
import type { LinhaFechamento } from '../../features/schedules/useFechamentoMensal';
import type { useOutrasOperacoes } from '../../features/operacoes/useOutrasOperacoes';
import {
  usePagamentosQuadroGeral,
  type PagamentoQuadroGeral,
} from '../../features/operacoes/usePagamentosQuadroGeral';
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
  // Salários fixos que só entram no quadro geral (sem taxa).
  fixos: PagamentoQuadroGeral[];
}

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Aba "Quadro geral": junta, por pessoa, o total a pagar da TNT e o das
// outras operações num valor só, com o detalhe de onde vem cada parte. As
// outras operações recebem a mesma taxa do "total a pagar" da TNT. Os
// salários fixos do quadro geral entram só no Total a pagar.

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
  const fixos = usePagamentosQuadroGeral();
  const operacoes = ops.operacoes.filter((o) => o.ativo);
  const mapa = new Map<string, LinhaGeral>();
  const nomeColaborador = new Map(ops.colaboradores.map((c) => [c.id, c.nome]));

  function linha(chave: string, nome: string, semCadastro: boolean) {
    let l = mapa.get(chave);
    if (!l) {
      l = { chave, nome, semCadastro, tnt: [], outras: new Map(), fixos: [] };
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

  for (const p of fixos.doMes(mes)) linha(`q:${p.id}`, p.nome, false).fixos.push(p);

  const comTaxa = (v: number) => arredondar(v * (1 + taxa));
  // A comissão de infoprodutos vem no fechamento da TNT, mas aparece numa
  // coluna própria (com a mesma taxa); a coluna TNT fica com o resto.
  const valorInfo = (l: LinhaGeral) => l.tnt.reduce((s, t) => s + comTaxa(t.comissao_infoprodutos), 0);
  const valorTnt = (l: LinhaGeral) => l.tnt.reduce((s, t) => s + t.total_a_pagar - comTaxa(t.comissao_infoprodutos), 0);
  const valorOperacao = (l: LinhaGeral, opId: string) =>
    comTaxa((l.outras.get(opId) ?? []).reduce((s, p) => s + p.pessoa.valor, 0));
  const valorFixo = (l: LinhaGeral) => comTaxa(l.fixos.reduce((s, p) => s + p.valor, 0));
  const total = (l: LinhaGeral) =>
    valorTnt(l) + operacoes.reduce((s, o) => s + valorOperacao(l, o.id), 0) + valorInfo(l) + valorFixo(l);

  const lista = [...mapa.values()]
    .filter((l) => l.tnt.some((t) => t.total_a_pagar !== 0) || l.outras.size > 0 || l.fixos.length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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
                            {l.fixos.map((p) => (
                              <Bloco key={p.id} titulo="Salário fixo" subtitulo="Entra só no quadro geral">
                                <Item rotulo="Salário" valor={p.valor} />
                                <Item rotulo={`Taxa (${percentual})`} valor={arredondar(comTaxa(p.valor) - p.valor)} />
                                <Item rotulo="Total" valor={comTaxa(p.valor)} forte />
                              </Bloco>
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

      <div className="mt-6">
        <SalariosFixos fixos={fixos} mes={mes} />
      </div>
    </div>
  );
}

// Cadastro dos salários fixos que entram só no quadro geral.
function SalariosFixos({ fixos, mes }: { fixos: ReturnType<typeof usePagamentosQuadroGeral>; mes: string }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [editando, setEditando] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [desde, setDesde] = useState(mes.slice(0, 7));
  const [salvando, setSalvando] = useState(false);

  function limpar() {
    setEditando(null);
    setNome('');
    setValor('');
    setDesde(mes.slice(0, 7));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const numero = Number(valor.replace(',', '.'));
    if (!nome.trim() || !Number.isFinite(numero) || numero < 0 || !desde) {
      toast('Preencha o nome, o valor e o mês de início.', 'erro');
      return;
    }
    setSalvando(true);
    const dados = { nome, valor: numero, desde: `${desde}-01` };
    const { erro } = editando ? await fixos.atualizar(editando, dados) : await fixos.adicionar(dados.nome, dados.valor, dados.desde);
    setSalvando(false);
    if (erro) {
      toast(erro, 'erro');
      return;
    }
    toast(editando ? 'Salário atualizado.' : 'Salário adicionado ao quadro geral.');
    limpar();
  }

  async function remover(p: PagamentoQuadroGeral) {
    if (!(await confirmar(`Tirar o salário de ${p.nome} do quadro geral? Ele some de todos os meses.`))) return;
    const { erro } = await fixos.remover(p.id);
    if (erro) toast(erro, 'erro');
    else {
      toast('Salário removido do quadro geral.');
      if (editando === p.id) limpar();
    }
  }

  const campo =
    'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda';

  return (
    <SecaoRecolhivel
      titulo={`Salários fixos do quadro geral (${fixos.pagamentos.length})`}
      padraoAberta={false}
      descricao="Salários pagos junto com os dos operadores que não fazem parte de nenhuma operação (ex.: o seu). Aparecem só nesta tela, no Total a pagar, com a taxa, em todo mês a partir do mês de início."
    >
      {fixos.erro && <p className="mb-3 text-sm text-red-600">{fixos.erro}</p>}
      {fixos.pagamentos.length > 0 && (
        <ul className="mb-4 divide-y divide-slate-100 text-sm">
          {fixos.pagamentos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-medium text-tinta">{p.nome}</span>
                <span className="text-slate-500">
                  {' '}
                  · {formatarMoeda(p.valor)} por mês · desde {p.desde.slice(5, 7)}/{p.desde.slice(0, 4)}
                </span>
              </span>
              <span className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditando(p.id);
                    setNome(p.nome);
                    setValor(String(p.valor));
                    setDesde(p.desde.slice(0, 7));
                  }}
                  className="font-medium text-ceruleo hover:underline"
                >
                  Editar
                </button>
                <button type="button" onClick={() => remover(p)} className="font-medium text-red-600 hover:underline">
                  Remover
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={salvar} className="grid gap-3 md:grid-cols-[1fr_10rem_auto_auto] md:items-end">
        <label className="text-sm text-slate-700">
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} placeholder="Ex.: Thomas" />
        </label>
        <label className="text-sm text-slate-700">
          Valor por mês (US$)
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            className={campo}
            placeholder="0,00"
          />
        </label>
        <div className="text-sm text-slate-700">
          A partir de
          <div className="mt-1">
            <SeletorMes valor={desde} onMudar={setDesde} />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={salvando}
            className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white transition hover:bg-esmeralda-dark disabled:opacity-60"
          >
            {editando ? 'Salvar' : 'Adicionar'}
          </button>
          {editando && (
            <button type="button" onClick={limpar} className="rounded-md px-3 py-2 text-sm text-slate-500 hover:text-tinta">
              Cancelar
            </button>
          )}
        </div>
      </form>
    </SecaoRecolhivel>
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
