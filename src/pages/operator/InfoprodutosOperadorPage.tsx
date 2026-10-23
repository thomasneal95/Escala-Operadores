import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  useMinhasVendasInfoprodutos,
  type MinhaVendaInfoproduto,
  type NovaVenda,
} from '../../features/ganhos/useMinhasVendasInfoprodutos';
import { useConfirm, useToast } from '../../components/FeedbackProvider';
import { dataBr, mesAtual, moeda, tituloDoMes } from '../../lib/formatoPortal';
import { SeletorMes } from '../../components/SeletorMes';
import { PRODUTOS_INFOPRODUTOS } from '../../lib/produtosInfoprodutos';

function hoje() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

const vazio = (): NovaVenda => ({ data: hoje(), produto: '', email_lead: '', valor: 0 });

const etiqueta: Record<MinhaVendaInfoproduto['status'], { texto: string; classe: string }> = {
  pendente: { texto: 'Aguardando conferência', classe: 'bg-amber-50 text-amber-800' },
  confirmada: { texto: 'Confirmada', classe: 'bg-esmeralda-light text-esmeralda-dark' },
  recusada: { texto: 'Recusada', classe: 'bg-red-50 text-red-700' },
};

const campo =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda';

// Aba "Infoprodutos": o operador registra as próprias vendas, que ficam
// aguardando a conferência do administrador. Só as confirmadas entram na
// comissão do mês.
export function InfoprodutosOperadorPage() {
  const [mes, setMes] = useState(mesAtual());
  const { vendas, carregando, processando, registrar, editar, excluir } =
    useMinhasVendasInfoprodutos(`${mes}-01`);
  const [form, setForm] = useState<NovaVenda>(vazio);
  const [editando, setEditando] = useState<string | null>(null);
  const toast = useToast();
  const confirmar = useConfirm();

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form.produto.trim() || !(form.valor > 0) || !form.data) {
      toast('Preencha a data, o produto e o valor.', 'erro');
      return;
    }
    const { erro } = editando ? await editar(editando, form) : await registrar(form);
    if (erro) {
      toast(erro, 'erro');
      return;
    }
    toast(editando ? 'Venda atualizada.' : 'Venda registrada! Ela entra na comissão depois da conferência.');
    setForm(vazio());
    setEditando(null);
    if (form.data.slice(0, 7) !== mes) setMes(form.data.slice(0, 7));
  }

  function comecarEdicao(v: MinhaVendaInfoproduto) {
    setEditando(v.id);
    setForm({ data: v.data, produto: v.produto, email_lead: v.email_lead ?? '', valor: v.valor });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remover(v: MinhaVendaInfoproduto) {
    const ok = await confirmar({
      titulo: 'Excluir venda',
      mensagem: `Excluir a venda de ${v.produto} (${moeda(v.valor)}) de ${dataBr(v.data)}?`,
      textoConfirmar: 'Excluir',
      perigoso: true,
    });
    if (!ok) return;
    const { erro } = await excluir(v.id);
    toast(erro ?? 'Venda excluída.', erro ? 'erro' : 'sucesso');
    if (editando === v.id) {
      setEditando(null);
      setForm(vazio());
    }
  }

  const totalConfirmado = vendas.filter((v) => v.status === 'confirmada').reduce((s, v) => s + v.valor, 0);
  const pendentes = vendas.filter((v) => v.status === 'pendente').length;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">Infoprodutos</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">Minhas vendas de infoprodutos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registre aqui cada venda. Ela fica aguardando a conferência do administrador e, depois de confirmada, entra na
          comissão do mês.
        </p>
      </div>

      <form onSubmit={salvar} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
        <p className="font-display font-semibold text-tinta">{editando ? 'Editar venda' : 'Registrar venda'}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-700">
            Data da venda
            <input
              type="date"
              required
              max={hoje()}
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              className={campo}
            />
          </label>
          <label className="block text-sm text-slate-700">
            Valor (US$)
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={form.valor || ''}
              onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })}
              className={campo}
            />
          </label>
        </div>
        <label className="block text-sm text-slate-700">
          Produto
          <select
            required
            value={form.produto}
            onChange={(e) => setForm({ ...form, produto: e.target.value })}
            className={campo}
          >
            <option value="">Selecione</option>
            {PRODUTOS_INFOPRODUTOS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            {form.produto && !PRODUTOS_INFOPRODUTOS.includes(form.produto) && (
              <option value={form.produto}>{form.produto}</option>
            )}
          </select>
        </label>
        <label className="block text-sm text-slate-700">
          E-mail do lead <span className="text-slate-400">(opcional)</span>
          <input
            type="email"
            value={form.email_lead}
            onChange={(e) => setForm({ ...form, email_lead: e.target.value })}
            className={campo}
          />
        </label>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={processando}
            className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-50"
          >
            {editando ? 'Salvar alteração' : 'Registrar venda'}
          </button>
          {editando && (
            <button
              type="button"
              onClick={() => {
                setEditando(null);
                setForm(vazio());
              }}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <SeletorMes valor={mes} onMudar={setMes} />

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display font-semibold text-tinta">{tituloDoMes(mes)}</h2>
          <p className="text-sm text-slate-500">
            Confirmado: <span className="font-medium text-tinta">{moeda(totalConfirmado)}</span>
            {pendentes > 0 && ` · ${pendentes} aguardando`}
          </p>
        </div>
        {carregando ? (
          <p className="mt-3 text-sm text-slate-400">Carregando...</p>
        ) : vendas.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nenhuma venda neste mês.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {vendas.map((v) => (
              <li key={v.id} className="py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-tinta">{v.produto}</p>
                    <p className="truncate text-xs text-slate-500">
                      {dataBr(v.data)}
                      {v.email_lead ? ` · ${v.email_lead}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular-nums text-tinta">{moeda(v.valor)}</p>
                    <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] ${etiqueta[v.status].classe}`}>
                      {etiqueta[v.status].texto}
                    </span>
                  </div>
                </div>
                {v.status === 'pendente' && (
                  <div className="mt-1 flex gap-4 text-xs">
                    <button onClick={() => comecarEdicao(v)} className="font-medium text-ceruleo hover:underline">
                      Editar
                    </button>
                    <button onClick={() => remover(v)} className="font-medium text-red-600 hover:underline">
                      Excluir
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
