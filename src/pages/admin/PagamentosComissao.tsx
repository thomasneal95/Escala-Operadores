import { useState } from 'react';
import { useConfirm, useToast } from '../../components/FeedbackProvider';
import type { LinhaFechamento } from '../../features/schedules/useFechamentoMensal';
import type { useOutrasOperacoes } from '../../features/operacoes/useOutrasOperacoes';
import { montarQuadroGeral } from '../../features/operacoes/quadroGeral';
import { usePagamentos, type Carteira, type PagamentoRealizado } from '../../features/operacoes/usePagamentos';

type OutrasOperacoes = ReturnType<typeof useOutrasOperacoes>;

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function encurtar(texto: string, inicio = 8, fim = 6) {
  return texto.length <= inicio + fim + 3 ? texto : `${texto.slice(0, inicio)}…${texto.slice(-fim)}`;
}

const REDES = ['TRC20 (Tron)', 'BEP20 (BNB Chain)', 'ERC20 (Ethereum)', 'Polygon', 'Solana', 'Arbitrum'];

const classeCampo =
  'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda';
const botaoSecundario =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-tinta transition hover:bg-slate-50 disabled:opacity-60';
const botaoPrimario =
  'rounded-md bg-esmeralda px-3 py-1.5 text-sm font-medium text-white transition hover:bg-esmeralda-dark disabled:opacity-60';

interface ItemPagamento {
  chave: string;
  nome: string;
  // Valor atual no Quadro geral (0 se a pessoa não aparece mais nele).
  valor: number;
  carteira: Carteira | undefined;
  pago: PagamentoRealizado | undefined;
}

type Filtro = 'pendentes' | 'pagos' | 'todos';
type Painel = { chave: string; modo: 'pagar' | 'carteira' } | null;

// Seção "Pagamentos": guia para pagar cada pessoa do Quadro geral (mesmos
// valores, já com a taxa), com a carteira guardada de cada uma e a
// confirmação do que já foi pago no mês.
export function PagamentosComissao({
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
  const confirmar = useConfirm();
  const pg = usePagamentos(mes);
  const [filtro, setFiltro] = useState<Filtro>('pendentes');
  const [busca, setBusca] = useState('');
  const [painel, setPainel] = useState<Painel>(null);
  const [salvando, setSalvando] = useState(false);

  const { lista, total } = montarQuadroGeral(linhas, ops, taxa);

  const itens: ItemPagamento[] = lista.map((l) => ({
    chave: l.chave,
    nome: l.nome,
    valor: total(l),
    carteira: pg.carteiras.get(l.chave),
    pago: pg.pagamentos.get(l.chave),
  }));
  // Pagos que não aparecem mais no Quadro geral (ex.: cadastro mudou).
  for (const p of pg.pagamentos.values()) {
    if (!itens.some((i) => i.chave === p.chave)) {
      itens.push({ chave: p.chave, nome: p.nome, valor: 0, carteira: pg.carteiras.get(p.chave), pago: p });
    }
  }

  // Quem tem valor zero ou negativo (ex.: adiantamento maior que o salário)
  // não tem o que receber.
  const aPagar = itens.filter((i) => i.pago || i.valor > 0);
  const semValor = itens.filter((i) => !i.pago && i.valor <= 0);
  const pendentes = aPagar.filter((i) => !i.pago);
  const pagos = aPagar.filter((i) => i.pago);
  const divergentes = pagos.filter((i) => Math.abs(i.valor - i.pago!.valor) >= 0.01);
  const pendentesSemCarteira = pendentes.filter((i) => !i.carteira);

  const somaPendente = pendentes.reduce((s, i) => s + i.valor, 0);
  const somaPaga = pagos.reduce((s, i) => s + i.pago!.valor, 0);
  const progresso = aPagar.length ? (pagos.length / aPagar.length) * 100 : 0;

  const termo = busca.trim().toLowerCase();
  const visiveis = (filtro === 'pendentes' ? pendentes : filtro === 'pagos' ? pagos : aPagar)
    .filter((i) => !termo || i.nome.toLowerCase().includes(termo))
    .sort((a, b) => Number(!!a.pago) - Number(!!b.pago) || a.nome.localeCompare(b.nome, 'pt-BR'));

  async function copiar(texto: string, rotulo: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast(`${rotulo} copiado.`);
    } catch {
      toast('Não foi possível copiar.', 'erro');
    }
  }

  async function confirmarPagamento(item: ItemPagamento, transacao: string) {
    setSalvando(true);
    const resultado = await pg.marcarPago({ chave: item.chave, nome: item.nome, valor: item.valor, transacao });
    setSalvando(false);
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }
    setPainel(null);
    toast(`${item.nome} marcado como pago.`);
  }

  async function desfazer(item: ItemPagamento) {
    if (!item.pago) return;
    const ok = await confirmar(`Desfazer o pagamento de ${item.nome} (${formatarMoeda(item.pago.valor)})? Volta para pendente.`);
    if (!ok) return;
    const resultado = await pg.desfazerPagamento(item.pago.id);
    if (resultado.erro) toast(resultado.erro, 'erro');
  }

  async function salvarCarteira(carteira: Carteira) {
    setSalvando(true);
    const resultado = await pg.salvarCarteira(carteira);
    setSalvando(false);
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }
    setPainel(null);
    toast(`Carteira de ${carteira.nome} salva.`);
  }

  async function removerCarteira(item: ItemPagamento) {
    const ok = await confirmar(`Remover a carteira de ${item.nome}?`);
    if (!ok) return;
    const resultado = await pg.removerCarteira(item.chave);
    if (resultado.erro) toast(resultado.erro, 'erro');
    else setPainel(null);
  }

  if (pg.carregando) return <p className="text-sm text-slate-400">Carregando pagamentos...</p>;

  const abaFiltro = (id: Filtro, rotulo: string, qtd: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setFiltro(id)}
      className={`rounded px-3 py-1.5 font-medium transition ${
        filtro === id ? 'bg-white text-tinta shadow-sm' : 'text-slate-500 hover:text-tinta'
      }`}
    >
      {rotulo} <span className="tabular-nums text-slate-400">{qtd}</span>
    </button>
  );

  return (
    <div>
      <p className="max-w-3xl text-sm text-slate-500">
        Siga a lista para pagar cada pessoa: os valores são os do Quadro geral (já com a taxa). Copie a carteira e o
        valor, faça a transferência e marque como pago. As carteiras ficam guardadas para os próximos meses.
      </p>
      {pg.erro && <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{pg.erro}</p>}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Cartao titulo="Falta pagar" valor={formatarMoeda(somaPendente)} destaque={pendentes.length > 0} />
        <Cartao titulo="Já pago" valor={formatarMoeda(somaPaga)} />
        <Cartao titulo="Pessoas pendentes" valor={String(pendentes.length)} />
        <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Progresso</p>
          <p className="mt-1 font-display text-xl font-semibold text-tinta sm:text-2xl">
            {pagos.length} <span className="text-base font-normal text-slate-400">de {aPagar.length}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-esmeralda transition-all" style={{ width: `${progresso}%` }} />
          </div>
        </div>
      </div>

      {(pendentesSemCarteira.length > 0 || divergentes.length > 0) && (
        <div className="mt-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {pendentesSemCarteira.length > 0 && (
            <p>
              ⚠ Sem carteira cadastrada: {pendentesSemCarteira.map((i) => i.nome).join(', ')}.
            </p>
          )}
          {divergentes.length > 0 && (
            <p>
              ⚠ O valor mudou depois do pagamento: {divergentes.map((i) => i.nome).join(', ')}. Confira a diferença na
              linha de cada um.
            </p>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-sm">
          {abaFiltro('pendentes', 'Pendentes', pendentes.length)}
          {abaFiltro('pagos', 'Pagos', pagos.length)}
          {abaFiltro('todos', 'Todos', aPagar.length)}
        </div>
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pessoa..."
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda sm:w-64"
        />
      </div>

      <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {visiveis.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-slate-400">
            {filtro === 'pendentes' && aPagar.length > 0 && !termo
              ? 'Todos os pagamentos do mês foram feitos. 🎉'
              : 'Ninguém aqui.'}
          </li>
        ) : (
          visiveis.map((item) => (
            <LinhaPagamento
              key={item.chave}
              item={item}
              painel={painel?.chave === item.chave ? painel.modo : null}
              salvando={salvando}
              onPainel={(modo) => setPainel(modo ? { chave: item.chave, modo } : null)}
              onCopiar={copiar}
              onConfirmar={(transacao) => confirmarPagamento(item, transacao)}
              onDesfazer={() => desfazer(item)}
              onSalvarCarteira={salvarCarteira}
              onRemoverCarteira={() => removerCarteira(item)}
            />
          ))
        )}
      </ul>

      {semValor.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Sem valor a receber neste mês (fora da lista): {semValor.map((i) => `${i.nome} (${formatarMoeda(i.valor)})`).join(', ')}.
        </p>
      )}
    </div>
  );
}

function LinhaPagamento({
  item,
  painel,
  salvando,
  onPainel,
  onCopiar,
  onConfirmar,
  onDesfazer,
  onSalvarCarteira,
  onRemoverCarteira,
}: {
  item: ItemPagamento;
  painel: 'pagar' | 'carteira' | null;
  salvando: boolean;
  onPainel: (modo: 'pagar' | 'carteira' | null) => void;
  onCopiar: (texto: string, rotulo: string) => void;
  onConfirmar: (transacao: string) => void;
  onDesfazer: () => void;
  onSalvarCarteira: (c: Carteira) => void;
  onRemoverCarteira: () => void;
}) {
  const { carteira, pago } = item;
  const diferenca = pago ? Math.round((item.valor - pago.valor) * 100) / 100 : 0;

  return (
    <li className={pago ? 'bg-esmeralda-light/30' : ''}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            pago ? 'bg-esmeralda text-white' : 'border-2 border-slate-300 text-transparent'
          }`}
          aria-label={pago ? 'Pago' : 'Pendente'}
        >
          ✓
        </span>

        <div className="min-w-0 flex-1 basis-56">
          <p className="font-medium text-tinta">{item.nome}</p>
          {pago ? (
            <p className="mt-0.5 text-xs text-slate-500">
              Pago em {formatarDataHora(pago.pago_em)}
              {pago.endereco && (
                <>
                  {' '}
                  · {pago.rede} <span className="font-mono">{encurtar(pago.endereco)}</span>
                </>
              )}
              {pago.transacao && (
                <>
                  {' '}
                  · transação{' '}
                  <button
                    type="button"
                    onClick={() => onCopiar(pago.transacao!, 'ID da transação')}
                    className="font-mono underline decoration-dotted hover:text-tinta"
                    title={pago.transacao}
                  >
                    {encurtar(pago.transacao)}
                  </button>
                </>
              )}
            </p>
          ) : carteira ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-ceruleo/10 px-1.5 py-0.5 font-medium text-ceruleo">{carteira.rede}</span>
              <button
                type="button"
                onClick={() => onCopiar(carteira.endereco, 'Endereço')}
                className="group flex min-w-0 items-center gap-1.5 rounded px-1 font-mono text-slate-600 hover:bg-slate-100 hover:text-tinta"
                title="Copiar endereço"
              >
                <span className="truncate">{encurtar(carteira.endereco, 10, 8)}</span>
                <span className="font-sans text-slate-400 group-hover:text-esmeralda-dark">Copiar</span>
              </button>
              <button type="button" onClick={() => onPainel('carteira')} className="text-slate-400 hover:text-tinta">
                Editar
              </button>
              {carteira.observacao && <span className="text-slate-400">· {carteira.observacao}</span>}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onPainel('carteira')}
              className="mt-1 text-xs font-medium text-amber-700 hover:underline"
            >
              + Cadastrar carteira
            </button>
          )}
        </div>

        <div className="text-right">
          <button
            type="button"
            onClick={() => onCopiar((pago?.valor ?? item.valor).toFixed(2), 'Valor')}
            className="font-display text-lg font-semibold tabular-nums text-tinta hover:text-esmeralda-dark"
            title="Copiar valor"
          >
            {formatarMoeda(pago?.valor ?? item.valor)}
          </button>
          {pago && diferenca !== 0 && (
            <p className="text-xs font-medium text-amber-700">
              Atual: {formatarMoeda(item.valor)} ({diferenca > 0 ? '+' : ''}
              {formatarMoeda(diferenca)})
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {pago ? (
            <button type="button" onClick={onDesfazer} className={botaoSecundario}>
              Desfazer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onPainel(painel === 'pagar' ? null : 'pagar')}
              className={botaoPrimario}
            >
              Marcar como pago
            </button>
          )}
        </div>
      </div>

      {painel === 'pagar' && !pago && (
        <PainelConfirmar item={item} salvando={salvando} onConfirmar={onConfirmar} onCancelar={() => onPainel(null)} />
      )}
      {painel === 'carteira' && (
        <PainelCarteira
          item={item}
          salvando={salvando}
          onSalvar={onSalvarCarteira}
          onRemover={onRemoverCarteira}
          onCancelar={() => onPainel(null)}
        />
      )}
    </li>
  );
}

function PainelConfirmar({
  item,
  salvando,
  onConfirmar,
  onCancelar,
}: {
  item: ItemPagamento;
  salvando: boolean;
  onConfirmar: (transacao: string) => void;
  onCancelar: () => void;
}) {
  const [transacao, setTransacao] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onConfirmar(transacao);
      }}
      className="mx-4 mb-4 space-y-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3"
    >
      <p className="text-sm text-tinta">
        Confirmar o pagamento de <strong>{formatarMoeda(item.valor)}</strong> para <strong>{item.nome}</strong>
        {item.carteira ? (
          <>
            {' '}
            na carteira <span className="font-mono text-xs">{encurtar(item.carteira.endereco, 10, 8)}</span> (
            {item.carteira.rede})?
          </>
        ) : (
          '?'
        )}
      </p>
      {!item.carteira && (
        <p className="text-xs text-amber-700">Essa pessoa ainda não tem carteira cadastrada.</p>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-600">ID / hash da transação (opcional)</label>
        <input
          value={transacao}
          onChange={(e) => setTransacao(e.target.value)}
          placeholder="Cole aqui para guardar o comprovante"
          className={`${classeCampo} font-mono`}
          autoFocus
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={salvando} className={botaoPrimario}>
          {salvando ? 'Salvando...' : 'Confirmar pagamento'}
        </button>
        <button type="button" onClick={onCancelar} className={botaoSecundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function PainelCarteira({
  item,
  salvando,
  onSalvar,
  onRemover,
  onCancelar,
}: {
  item: ItemPagamento;
  salvando: boolean;
  onSalvar: (c: Carteira) => void;
  onRemover: () => void;
  onCancelar: () => void;
}) {
  const [rede, setRede] = useState(item.carteira?.rede ?? REDES[0]);
  const [endereco, setEndereco] = useState(item.carteira?.endereco ?? '');
  const [observacao, setObservacao] = useState(item.carteira?.observacao ?? '');
  const enderecoLimpo = endereco.replace(/\s+/g, '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!rede.trim() || !enderecoLimpo) return;
        onSalvar({ chave: item.chave, nome: item.nome, rede, endereco: enderecoLimpo, observacao });
      }}
      className="mx-4 mb-4 grid gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 sm:grid-cols-[12rem_1fr]"
    >
      <p className="text-sm font-medium text-tinta sm:col-span-2">Carteira de {item.nome}</p>
      <div>
        <label className="block text-xs font-medium text-slate-600">Rede</label>
        <input
          value={rede}
          onChange={(e) => setRede(e.target.value)}
          list="redes-carteira"
          required
          className={classeCampo}
        />
        <datalist id="redes-carteira">
          {REDES.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Endereço da carteira</label>
        <input
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          required
          spellCheck={false}
          autoFocus
          className={`${classeCampo} font-mono`}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-600">Observação (opcional)</label>
        <input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: Binance, carteira pessoal"
          className={classeCampo}
        />
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" disabled={salvando || !enderecoLimpo} className={botaoPrimario}>
          {salvando ? 'Salvando...' : 'Salvar carteira'}
        </button>
        <button type="button" onClick={onCancelar} className={botaoSecundario}>
          Cancelar
        </button>
        {item.carteira && (
          <button type="button" onClick={onRemover} className="ml-auto text-sm text-red-600 hover:underline">
            Remover carteira
          </button>
        )}
      </div>
    </form>
  );
}

function Cartao({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-3 sm:p-4 ${
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
      <p className="mt-1 font-display text-xl font-semibold tabular-nums text-tinta sm:text-2xl">{valor}</p>
    </div>
  );
}
