import { useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useFechamentoMensal } from '../../features/schedules/useFechamentoMensal';
import { useToast } from '../../components/FeedbackProvider';

function mesAtualFormatoInput() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

export function ComissionamentoPage() {
  const { session } = useAuth();
  const [mesInput, setMesInput] = useState(mesAtualFormatoInput()); // "YYYY-MM"
  const { dados, carregando, salvando, erro, calcular, salvarAdiantamento, salvarFechamento } =
    useFechamentoMensal();
  const toast = useToast();

  // Cópia local editável (adiantamento por colaborador), inicializada
  // quando os dados chegam.
  const [adiantamentosLocais, setAdiantamentosLocais] = useState<Record<string, string>>({});

  const mes = `${mesInput}-01`;

  async function handleCalcular() {
    await calcular(mes);
  }

  // Sincroniza o estado local sempre que um novo cálculo chega.
  if (dados && Object.keys(adiantamentosLocais).length === 0 && dados.resultado.length > 0) {
    const inicial: Record<string, string> = {};
    for (const r of dados.resultado) {
      inicial[r.colaborador_id] = String(r.adiantamento);
    }
    setAdiantamentosLocais(inicial);
  }

  function salarioTotalLocal(colaboradorId: string, auxilio: number, comissaoDiaSemana: number, comissaoFimDeSemana: number) {
    const adiantamento = Number(adiantamentosLocais[colaboradorId] ?? 0) || 0;
    return Math.round((auxilio + comissaoDiaSemana + comissaoFimDeSemana - adiantamento) * 100) / 100;
  }

  async function handleSalvarFechamento() {
    if (!dados || !session?.user) return;

    const itens = dados.resultado.map((r) => {
      const adiantamento = Number(adiantamentosLocais[r.colaborador_id] ?? 0) || 0;
      return {
        colaboradorId: r.colaborador_id,
        nome: r.nome,
        auxilio: r.auxilio,
        comissaoDiaSemana: r.comissaoDiaSemana,
        comissaoFimDeSemana: r.comissaoFimDeSemana,
        adiantamento,
        salarioTotal: salarioTotalLocal(r.colaborador_id, r.auxilio, r.comissaoDiaSemana, r.comissaoFimDeSemana),
      };
    });

    // Salva os adiantamentos editados.
    for (const item of itens) {
      await salvarAdiantamento(item.colaboradorId, dados.mes, item.adiantamento);
    }

    const resultado = await salvarFechamento(dados.mes, session.user.id, itens);

    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }

    toast('Fechamento salvo com sucesso!');
  }

  const totalGeral =
    dados?.resultado.reduce(
      (soma, r) => soma + salarioTotalLocal(r.colaborador_id, r.auxilio, r.comissaoDiaSemana, r.comissaoFimDeSemana),
      0
    ) ?? 0;

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Comissionamento
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        Fechamento mensal
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Auxílio (proporcional à admissão) + Comissão de dia de semana (US$2/lead, dividido
        entre quem já converteu no mês) + Comissão de fim de semana (US$3/lead, dividido
        entre quem confirmou presença) − Adiantamento.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Mês</label>
          <input
            type="month"
            value={mesInput}
            onChange={(e) => {
              setMesInput(e.target.value);
              setAdiantamentosLocais({});
            }}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
          />
        </div>

        <button
          onClick={handleCalcular}
          disabled={carregando}
          className="rounded-md bg-esmeralda px-4 py-2 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {carregando ? 'Calculando...' : 'Calcular fechamento'}
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
                Leads convertidos no mês
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-tinta">
                {dados.totalLeadsConvertidos}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Colaboradores
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-tinta">
                {dados.resultado.length}
              </p>
            </div>
            <div className="rounded-lg border border-esmeralda/30 bg-esmeralda-light p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-esmeralda-dark">
                Folha total
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-tinta">
                {formatarMoeda(totalGeral)}
              </p>
            </div>
          </div>

          {(dados.avisos.leadsSemColaboradorConhecido.length > 0 ||
            dados.avisos.diasDeFimDeSemanaSemPresencaConfirmada.length > 0) && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">⚠️ Avisos</p>
              {dados.avisos.leadsSemColaboradorConhecido.length > 0 && (
                <p className="mt-1 text-sm text-amber-700">
                  {dados.avisos.leadsSemColaboradorConhecido.length} lead(s) convertido(s)
                  não puderam ser associados a nenhum colaborador cadastrado.
                </p>
              )}
              {dados.avisos.diasDeFimDeSemanaSemPresencaConfirmada.length > 0 && (
                <p className="mt-1 text-sm text-amber-700">
                  {dados.avisos.diasDeFimDeSemanaSemPresencaConfirmada.length} dia(s) de fim
                  de semana com leads convertidos, mas sem presença confirmada — esses
                  valores não foram distribuídos.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Colaborador</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Auxílio</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Com. dia semana</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Com. fim de semana</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Adiantamento</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Salário total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dados.resultado.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      Nenhum valor calculado para este mês.
                    </td>
                  </tr>
                ) : (
                  dados.resultado.map((r) => (
                    <tr key={r.colaborador_id}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-tinta">
                        {r.nome}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-tinta">
                        {formatarMoeda(r.auxilio)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-tinta">
                        {formatarMoeda(r.comissaoDiaSemana)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-tinta">
                        {formatarMoeda(r.comissaoFimDeSemana)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={adiantamentosLocais[r.colaborador_id] ?? '0'}
                          onChange={(e) =>
                            setAdiantamentosLocais((atual) => ({
                              ...atual,
                              [r.colaborador_id]: e.target.value,
                            }))
                          }
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-tinta">
                        {formatarMoeda(
                          salarioTotalLocal(r.colaborador_id, r.auxilio, r.comissaoDiaSemana, r.comissaoFimDeSemana)
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {dados.resultado.length > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSalvarFechamento}
                disabled={salvando}
                className="rounded-md bg-tinta px-4 py-2 font-medium text-white transition hover:bg-tinta/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando ? 'Salvando...' : 'Salvar fechamento deste mês'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}