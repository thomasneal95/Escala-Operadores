import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  useVendasInfoprodutos,
  type NovaVendaInfoproduto,
  type VendaInfoproduto,
} from '../../features/schedules/useVendasInfoprodutos';
import { useConfirm, useToast } from '../../components/FeedbackProvider';

const PRODUTOS_PADRAO = ['Sala de Sinais', 'Transmissões VIP', 'Combo (Sala de Sinais + Transmissões VIP)'];

const classeCampo =
  'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda';

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

function dataBr(data: string) {
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}

// Aba "Infoprodutos" do Comissionamento: lançamento das vendas (como a aba
// Vendas Infoprodutos da planilha) e resumo por produto e operador.
export function InfoprodutosComissao({
  mes,
  operadores,
  percentual,
  onAlterou,
}: {
  mes: string;
  operadores: string[];
  percentual: number;
  onAlterou: () => void;
}) {
  const info = useVendasInfoprodutos(mes);
  const toast = useToast();
  const confirmar = useConfirm();
  const entradaArquivo = useRef<HTMLInputElement>(null);
  const [editando, setEditando] = useState<VendaInfoproduto | null>(null);

  const produtos = [...new Set([...PRODUTOS_PADRAO, ...info.produtosConhecidos])];

  async function depois(resultado: { erro: string | null }, sucesso: string) {
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return false;
    }
    toast(sucesso);
    onAlterou();
    return true;
  }

  async function handleImportar(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo) return;
    const confirmou = await confirmar(
      'Importar as vendas da aba "Vendas Infoprodutos" deste arquivo? Use só uma vez por mês: ' +
        'importar de novo duplica as vendas.' +
        (info.vendas.length > 0 ? `\n\nAtenção: este mês já tem ${info.vendas.length} venda(s) lançada(s).` : '')
    );
    if (!confirmou) return;
    const resultado = await info.importarDaPlanilha(arquivo);
    await depois(resultado, `${resultado.quantidade} venda(s) importada(s). Confira se está tudo certo.`);
  }

  async function handleExcluir(v: VendaInfoproduto) {
    const confirmou = await confirmar(`Excluir a venda de ${v.operador} (${v.produto}, ${moeda(v.valor)}) de ${dataBr(v.data)}?`);
    if (confirmou) await depois(await info.remover(v.id), 'Venda excluída.');
  }

  async function handleConferir(ids: string[], status: 'confirmada' | 'recusada') {
    if (status === 'recusada') {
      const confirmou = await confirmar('Recusar esta venda? Ela não entra na comissão (o operador vê que foi recusada).');
      if (!confirmou) return;
    }
    await depois(
      await info.conferir(ids, status),
      status === 'confirmada' ? `${ids.length} venda(s) confirmada(s).` : 'Venda recusada.'
    );
  }

  // Só as confirmadas contam no fechamento (e nos totais abaixo).
  const pendentes = info.vendas.filter((v) => v.status === 'pendente');
  const confirmadas = info.vendas.filter((v) => v.status === 'confirmada');
  const total = confirmadas.reduce((s, v) => s + v.valor, 0);
  const agrupar = (chave: (v: VendaInfoproduto) => string) => {
    const mapa = new Map<string, { nome: string; qtd: number; valor: number }>();
    for (const v of confirmadas) {
      const k = chave(v);
      const atual = mapa.get(k) ?? { nome: k, qtd: 0, valor: 0 };
      atual.qtd++;
      atual.valor += v.valor;
      mapa.set(k, atual);
    }
    return [...mapa.values()].sort((a, b) => b.valor - a.valor);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-display font-semibold text-tinta">{editando ? 'Editar venda' : 'Lançar venda'}</h2>
        <FormularioVenda
          key={editando?.id ?? 'nova'}
          inicial={editando}
          mes={mes}
          produtos={produtos}
          operadores={operadores}
          processando={info.processando}
          onCancelar={editando ? () => setEditando(null) : undefined}
          onSalvar={async (v) => {
            const ok = await depois(
              editando ? await info.atualizar(editando.id, v) : await info.adicionar(v),
              editando ? 'Venda atualizada.' : 'Venda lançada.'
            );
            if (ok) setEditando(null);
            return ok;
          }}
        />
      </div>

      {info.erro && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{info.erro}</p>}

      {info.pendentesEmOutrosMeses.length > 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Também há vendas aguardando conferência em:{' '}
          {info.pendentesEmOutrosMeses.map((m) => `${m.slice(5)}/${m.slice(0, 4)}`).join(', ')}. Troque o mês acima para
          conferir.
        </p>
      )}

      {pendentes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-semibold text-tinta">
                {pendentes.length} venda(s) registrada(s) pelos operadores aguardando conferência
              </h2>
              <p className="text-xs text-slate-600">Só entram na comissão depois de confirmadas.</p>
            </div>
            <button
              onClick={() => handleConferir(pendentes.map((v) => v.id), 'confirmada')}
              disabled={info.processando}
              className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-60"
            >
              Confirmar todas
            </button>
          </div>
          <ul className="mt-3 divide-y divide-amber-200 text-sm">
            {pendentes.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-tinta">
                  {dataBr(v.data)} · <span className="font-medium">{v.operador}</span> · {v.produto} ·{' '}
                  {moeda(v.valor)}
                  {v.email_lead && <span className="text-slate-500"> · {v.email_lead}</span>}
                </span>
                <span className="flex gap-3">
                  <button
                    onClick={() => handleConferir([v.id], 'confirmada')}
                    disabled={info.processando}
                    className="text-sm font-medium text-esmeralda-dark hover:underline"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => handleConferir([v.id], 'recusada')}
                    disabled={info.processando}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Recusar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Cartao titulo="Vendas confirmadas" valor={String(confirmadas.length)} />
        <Cartao titulo="Total vendido" valor={moeda(total)} />
        <Cartao titulo={`Comissão (${Math.round(percentual * 1000) / 10}%)`} valor={moeda(total * percentual)} />
      </div>

      {confirmadas.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Resumo titulo="Por produto" linhas={agrupar((v) => v.produto)} />
          <Resumo titulo="Por operador" linhas={agrupar((v) => v.operador)} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              {['Data', 'Produto', 'E-mail do lead', 'Operador', 'Valor', 'Comissão', ''].map((t) => (
                <th key={t} className="whitespace-nowrap px-3 py-2 font-medium">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {info.carregando ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-slate-400">
                  Carregando...
                </td>
              </tr>
            ) : info.vendas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  Nenhuma venda lançada neste mês.
                </td>
              </tr>
            ) : (
              info.vendas.map((v) => (
                <tr key={v.id} className={v.status === 'confirmada' ? '' : 'text-slate-400'}>
                  <td className="whitespace-nowrap px-3 py-2">
                    {dataBr(v.data)}
                    {v.status !== 'confirmada' && (
                      <span
                        className={`ml-1 rounded-full px-2 py-0.5 text-[11px] ${
                          v.status === 'pendente' ? 'bg-amber-100 text-amber-800' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {v.status === 'pendente' ? 'pendente' : 'recusada'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{v.produto}</td>
                  <td className="px-3 py-2 text-slate-500">{v.email_lead ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {v.operador}
                    {!operadores.some((o) => o.trim().toLowerCase() === v.operador.trim().toLowerCase()) && (
                      <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                        não reconhecido
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{moeda(v.valor)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {v.status === 'confirmada' ? moeda(v.valor * percentual) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button onClick={() => setEditando(v)} className="mr-3 text-sm font-medium text-ceruleo hover:underline">
                      Editar
                    </button>
                    <button onClick={() => handleExcluir(v)} className="text-sm font-medium text-red-600 hover:text-red-700">
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <input ref={entradaArquivo} type="file" accept=".xlsx,.xlsm,.xls" onChange={handleImportar} className="hidden" />
        <button
          onClick={() => entradaArquivo.current?.click()}
          disabled={info.processando}
          className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          📥 Importar da planilha (uma vez)
        </button>
        <span>
          Traz as vendas da aba "Vendas Infoprodutos" do Excel. A comissão de cada venda é dividida entre todos da
          equipe do operador; operador externo (ex.: João) fica com ela inteira.
        </span>
      </div>
    </div>
  );
}

function FormularioVenda({
  inicial,
  mes,
  produtos,
  operadores,
  processando,
  onSalvar,
  onCancelar,
}: {
  inicial: VendaInfoproduto | null;
  mes: string;
  produtos: string[];
  operadores: string[];
  processando: boolean;
  onSalvar: (v: NovaVendaInfoproduto) => Promise<boolean>;
  onCancelar?: () => void;
}) {
  const vazio: NovaVendaInfoproduto = { data: mes, produto: '', email_lead: '', operador: '', valor: 0 };
  const [venda, setVenda] = useState<NovaVendaInfoproduto>(inicial ?? vazio);
  const [valorTexto, setValorTexto] = useState(inicial ? String(inicial.valor) : '');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const valor = Number(valorTexto.replace(',', '.'));
    if (!venda.produto.trim() || !venda.operador.trim() || !Number.isFinite(valor) || valor <= 0) return;
    const ok = await onSalvar({ ...venda, valor });
    if (ok && !inicial) {
      setVenda({ ...vazio, data: venda.data });
      setValorTexto('');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <label className="text-sm text-slate-700">
        Data
        <input
          type="date"
          required
          value={venda.data}
          onChange={(e) => setVenda({ ...venda, data: e.target.value })}
          className={classeCampo}
        />
      </label>
      <label className="text-sm text-slate-700 lg:col-span-2">
        Produto
        <input
          list="produtos-infoprodutos"
          required
          value={venda.produto}
          onChange={(e) => setVenda({ ...venda, produto: e.target.value })}
          className={classeCampo}
        />
        <datalist id="produtos-infoprodutos">
          {produtos.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>
      <label className="text-sm text-slate-700">
        Operador
        <select
          required
          value={venda.operador}
          onChange={(e) => setVenda({ ...venda, operador: e.target.value })}
          className={classeCampo}
        >
          <option value="">Selecione</option>
          {operadores.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          {venda.operador && !operadores.includes(venda.operador) && <option value={venda.operador}>{venda.operador}</option>}
        </select>
      </label>
      <label className="text-sm text-slate-700">
        Valor (US$)
        <input
          inputMode="decimal"
          required
          value={valorTexto}
          onChange={(e) => setValorTexto(e.target.value)}
          className={classeCampo}
        />
      </label>
      <label className="text-sm text-slate-700">
        E-mail do lead
        <input
          type="email"
          value={venda.email_lead ?? ''}
          onChange={(e) => setVenda({ ...venda, email_lead: e.target.value })}
          className={classeCampo}
        />
      </label>
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-6">
        <button
          type="submit"
          disabled={processando}
          className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-60"
        >
          {inicial ? 'Salvar alterações' : 'Lançar venda'}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="text-sm font-medium text-slate-500 hover:text-tinta">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function Cartao({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-tinta">{valor}</p>
    </div>
  );
}

function Resumo({ titulo, linhas }: { titulo: string; linhas: { nome: string; qtd: number; valor: number }[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-tinta">{titulo}</p>
      <table className="mt-2 w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {linhas.map((l) => (
            <tr key={l.nome}>
              <td className="py-1.5 pr-2 text-slate-700">{l.nome}</td>
              <td className="py-1.5 pr-2 text-right text-slate-500">{l.qtd} venda(s)</td>
              <td className="py-1.5 text-right font-medium text-tinta">{moeda(l.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
