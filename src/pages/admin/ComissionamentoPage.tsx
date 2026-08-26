import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useComissionamento } from '../../features/schedules/useComissionamento';

interface PeriodoResumo {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: string;
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

export function ComissionamentoPage() {
  const [periodos, setPeriodos] = useState<PeriodoResumo[]>([]);
  const [periodoId, setPeriodoId] = useState<string>('');
  const [carregandoPeriodos, setCarregandoPeriodos] = useState(true);
  const { dados, carregando, erro, calcular } = useComissionamento();

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('periodos_operacao')
        .select('id, data_inicio, data_fim, status')
        .in('status', ['confirmado', 'encerrado'])
        .order('data_inicio', { ascending: false })
        .limit(20);

      setPeriodos(data ?? []);
      if (data && data.length > 0) setPeriodoId(data[0].id);
      setCarregandoPeriodos(false);
    }

    carregar();
  }, []);

  const periodoSelecionado = periodos.find((p) => p.id === periodoId);

  async function handleCalcular() {
    if (!periodoSelecionado) return;
    await calcular(periodoSelecionado.data_inicio, periodoSelecionado.data_fim);
  }

  const totalGeral = dados?.resultado.reduce((soma, r) => soma + r.comissao, 0) ?? 0;

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Comissionamento
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        Cálculo de comissão por leads convertidos
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Dia de semana: US$ 2 por lead, dividido entre toda a equipe. Fim de semana: US$ 3
        por lead, dividido só entre quem confirmou presença naquele dia.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="max-w-xs flex-1">
          <label className="block text-sm font-medium text-slate-700">
            Final de semana
          </label>
          {carregandoPeriodos ? (
            <p className="mt-1 text-sm text-slate-400">Carregando...</p>
          ) : (
            <select
              value={periodoId}
              onChange={(e) => setPeriodoId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
            >
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatarData(p.data_inicio)} – {formatarData(p.data_fim)}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={handleCalcular}
          disabled={!periodoSelecionado || carregando}
          className="rounded-md bg-esmeralda px-4 py-2 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {carregando ? 'Calculando...' : 'Calcular comissionamento'}
        </button>
      </div>

      {erro && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      {dados && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Leads convertidos
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-tinta">
                {dados.totalLeadsConvertidos}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Colaboradores com comissão
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-tinta">
                {dados.resultado.length}
              </p>
            </div>
            <div className="rounded-lg border border-esmeralda/30 bg-esmeralda-light p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-esmeralda-dark">
                Total geral
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-tinta">
                {formatarMoeda(totalGeral)}
              </p>
            </div>
          </div>

          {/* Avisos */}
          {(dados.avisos.leadsSemColaboradorConhecido.length > 0 ||
            dados.avisos.diasDeFimDeSemanaSemPresencaConfirmada.length > 0) && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">⚠️ Avisos</p>
              {dados.avisos.leadsSemColaboradorConhecido.length > 0 && (
                <p className="mt-1 text-sm text-amber-700">
                  {dados.avisos.leadsSemColaboradorConhecido.length} lead(s) convertido(s)
                  não puderam ser associados a nenhum colaborador cadastrado (e-mail não
                  encontrado no sistema).
                </p>
              )}
              {dados.avisos.diasDeFimDeSemanaSemPresencaConfirmada.length > 0 && (
                <p className="mt-1 text-sm text-amber-700">
                  {dados.avisos.diasDeFimDeSemanaSemPresencaConfirmada.length} dia(s) de fim
                  de semana com leads convertidos, mas sem nenhuma presença confirmada na
                  equipe responsável — esses valores não foram distribuídos.
                </p>
              )}
            </div>
          )}

          {/* Tabela de resultado */}
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Colaborador</th>
                  <th className="px-4 py-3 font-medium">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dados.resultado.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                      Nenhuma comissão calculada para este período.
                    </td>
                  </tr>
                ) : (
                  dados.resultado.map((r) => (
                    <tr key={r.colaborador_id}>
                      <td className="px-4 py-3 font-medium text-tinta">{r.nome}</td>
                      <td className="px-4 py-3 text-tinta">{formatarMoeda(r.comissao)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}