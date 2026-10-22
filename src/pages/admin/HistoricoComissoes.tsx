import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  useHistoricoComissoes,
  type LinhaHistorico,
} from '../../features/schedules/useHistoricoComissoes';
import { useConfirm, useToast } from '../../components/FeedbackProvider';

const nomesMeses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function nomeDoMes(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  return `${nomesMeses[m - 1]}/${ano}`;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

function formatarData(data: string | null) {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Aba "Histórico" do Comissionamento: meses arquivados (fotos do
// fechamento), como a aba Historico da planilha.
export function HistoricoComissoes({ historico }: { historico: ReturnType<typeof useHistoricoComissoes> }) {
  const { meses, carregando, erro, processando, linhasDoMes, importarDaPlanilha, excluir } = historico;
  const toast = useToast();
  const confirmar = useConfirm();
  const entradaArquivo = useRef<HTMLInputElement>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaHistorico[]>([]);

  const mesAberto = selecionado && meses.some((m) => m.mes === selecionado) ? selecionado : meses[0]?.mes ?? null;

  useEffect(() => {
    if (!mesAberto) {
      setLinhas([]);
      return;
    }
    let cancelado = false;
    linhasDoMes(mesAberto).then((l) => {
      if (!cancelado) setLinhas(l);
    });
    return () => {
      cancelado = true;
    };
    // linhasDoMes é recriada a cada render; recarrega quando o mês ou a lista mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesAberto, meses]);

  async function handleArquivo(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo) return;
    const confirmou = await confirmar(
      'Importar os meses da aba "Historico" deste arquivo? Meses que já estão no histórico do site serão substituídos pelos da planilha.'
    );
    if (!confirmou) return;
    const resultado = await importarDaPlanilha(arquivo);
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }
    toast(`Histórico importado: ${(resultado.meses ?? []).map(nomeDoMes).join(', ')}.`);
  }

  async function handleExcluir(mes: string) {
    const confirmou = await confirmar(`Excluir ${nomeDoMes(mes)} do histórico? Esta ação não pode ser desfeita.`);
    if (!confirmou) return;
    const resultado = await excluir(mes);
    if (resultado.erro) toast(resultado.erro, 'erro');
  }

  const total = (campo: keyof LinhaHistorico) =>
    linhas.reduce((s, l) => s + (typeof l[campo] === 'number' ? (l[campo] as number) : 0), 0);
  const temTotalAPagar = linhas.length > 0 && linhas.every((l) => l.total_a_pagar !== null);
  const temFtds = linhas.length > 0 && linhas.every((l) => l.ftds !== null);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={entradaArquivo}
          type="file"
          accept=".xlsx,.xlsm,.xls"
          onChange={handleArquivo}
          className="hidden"
        />
        <button
          onClick={() => entradaArquivo.current?.click()}
          disabled={processando}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          {processando ? 'Importando...' : '📥 Importar histórico da planilha'}
        </button>
        <p className="text-xs text-slate-400">
          Traz os meses da aba "Historico" do Excel. Para arquivar um mês calculado no site, use
          "Arquivar mês" na aba Fechamento do mês.
        </p>
      </div>

      {erro && <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {carregando && <p className="mt-4 text-sm text-slate-400">Carregando...</p>}
      {!carregando && meses.length === 0 && (
        <p className="mt-4 rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Nenhum mês arquivado ainda.
        </p>
      )}

      {meses.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meses.map((m) => (
            <button
              key={m.mes}
              onClick={() => setSelecionado(m.mes)}
              className={`rounded-lg border p-4 text-left transition ${
                m.mes === mesAberto
                  ? 'border-esmeralda bg-esmeralda-light'
                  : 'border-slate-200 bg-white hover:border-esmeralda/50'
              }`}
            >
              <p className="font-display font-semibold text-tinta">{nomeDoMes(m.mes)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {m.pessoas} pessoa(s) · Folha {formatarMoeda(m.salario_total)}
              </p>
              {m.total_a_pagar !== null && (
                <p className="text-sm font-medium text-esmeralda-dark">
                  Total a pagar {formatarMoeda(m.total_a_pagar)}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-400">
                {m.origem === 'planilha' ? 'Importado da planilha' : 'Arquivado no site'} em{' '}
                {new Date(m.arquivado_em).toLocaleDateString('pt-BR')}
              </p>
            </button>
          ))}
        </div>
      )}

      {mesAberto && linhas.length > 0 && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-tinta">{nomeDoMes(mesAberto)}</h2>
            <button
              onClick={() => handleExcluir(mesAberto)}
              disabled={processando}
              className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
            >
              Excluir do histórico
            </button>
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  {['Nome', 'Equipe', 'Início', 'Auxílio', 'Com. própria', 'Com. equipe', 'Com. FDS', 'Adiantamento', 'Salário']
                    .concat(temFtds ? ['FTDs'] : [])
                    .concat(temTotalAPagar ? ['Total a pagar'] : [])
                    .map((t) => (
                      <th key={t} className="whitespace-nowrap px-3 py-3 font-medium">
                        {t}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-tinta">{l.nome}</td>
                    <td className="px-3 py-2 text-slate-600">{l.equipe ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatarData(l.data_inicio)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(l.auxilio)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">{formatarMoeda(l.comissao_propria)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(l.comissao_equipe)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(l.comissao_fds)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(l.adiantamento)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-tinta">{formatarMoeda(l.salario_total)}</td>
                    {temFtds && <td className="px-3 py-2 text-slate-600">{l.ftds}</td>}
                    {temTotalAPagar && (
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-esmeralda-dark">
                        {formatarMoeda(l.total_a_pagar ?? 0)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-tinta">
                <tr>
                  <td className="px-3 py-2" colSpan={3}>
                    Total
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(total('auxilio'))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-400">{formatarMoeda(total('comissao_propria'))}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(total('comissao_equipe'))}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(total('comissao_fds'))}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(total('adiantamento'))}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(total('salario_total'))}</td>
                  {temFtds && <td className="px-3 py-2">{total('ftds')}</td>}
                  {temTotalAPagar && (
                    <td className="whitespace-nowrap px-3 py-2 text-esmeralda-dark">{formatarMoeda(total('total_a_pagar'))}</td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
