import { useSolicitacoesTrocaAdmin } from '../../features/schedules/useSolicitacoesTrocaAdmin';
import { useConfirm, useToast } from '../../components/FeedbackProvider';
import { rotuloBloco } from '../../lib/blocosDeTrabalho';

const rotuloStatus: Record<string, string> = {
  pendente: 'Aguardando colega',
  aceito_pelo_colega: 'Aguardando sua aprovação',
  aprovado: 'Aprovado',
  rejeitado_pelo_colega: 'Recusado pelo colega',
  rejeitado_pelo_admin: 'Recusado por você',
  cancelado: 'Cancelado pelo solicitante',
};

const corStatus: Record<string, string> = {
  pendente: 'bg-slate-100 text-slate-500',
  aceito_pelo_colega: 'bg-ceruleo-light text-ceruleo',
  aprovado: 'bg-esmeralda-light text-esmeralda-dark',
  rejeitado_pelo_colega: 'bg-slate-100 text-slate-500',
  rejeitado_pelo_admin: 'bg-slate-100 text-slate-500',
  cancelado: 'bg-slate-100 text-slate-500',
};

export function SolicitacoesTrocaAdminPage() {
  const { solicitacoes, carregando, erro, processando, aprovar, aplicar, rejeitar } =
    useSolicitacoesTrocaAdmin();
  const confirmar = useConfirm();
  const toast = useToast();

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  const aguardandoAprovacao = solicitacoes.filter((s) => s.status === 'aceito_pelo_colega');
  const naoAplicadas = solicitacoes.filter((s) => s.naoAplicada);

  async function handleAplicar(s: (typeof solicitacoes)[number]) {
    const resultado = await aplicar(s.id);
    if (resultado.erro) {
      toast(`${s.solicitanteNome} × ${s.colegaNome}: ${resultado.erro}`, 'erro');
      return false;
    }
    return true;
  }

  async function handleAplicarTodas() {
    const confirmou = await confirmar(
      `Aplicar na escala as ${naoAplicadas.length} trocas aprovadas que ainda não aparecem para ` +
        'os operadores? Só os turnos que ainda estão com a pessoa errada serão movidos.'
    );
    if (!confirmou) return;

    let aplicadas = 0;
    for (const s of naoAplicadas) {
      if (await handleAplicar(s)) aplicadas++;
    }
    toast(`${aplicadas} de ${naoAplicadas.length} troca(s) aplicada(s) na escala.`);
  }

  async function handleAplicarUma(s: (typeof solicitacoes)[number]) {
    const confirmou = await confirmar(
      `Aplicar na escala a troca entre ${s.solicitanteNome} e ${s.colegaNome}? ` +
        'Só os turnos que ainda estão com a pessoa errada serão movidos.'
    );
    if (!confirmou) return;
    if (await handleAplicar(s)) toast('Troca aplicada na escala.');
  }
  const outras = solicitacoes.filter((s) => s.status !== 'aceito_pelo_colega');

  async function handleAprovar(s: (typeof solicitacoes)[number]) {
    if (s.tipo === 'assumir' ? !s.blocoColega : !s.blocoSolicitante || (s.tipo === 'troca' && !s.blocoColega)) return;

        const confirmou = await confirmar(
      s.tipo === 'cobertura'
        ? `Aprovar que ${s.colegaNome} cubra o dia de ${s.solicitanteNome}? ` +
            'O dia passa para o colega imediatamente na escala.'
        : s.tipo === 'assumir'
          ? `Aprovar que ${s.solicitanteNome} (de folga) trabalhe no dia de ${s.colegaNome}? ` +
              'O dia passa para quem pediu imediatamente na escala.'
          : `Aprovar a troca entre ${s.solicitanteNome} e ${s.colegaNome}? ` +
            'Os dois dias de trabalho vão trocar de dono imediatamente na escala.'
    );
    if (!confirmou) return;

    const resultado = await aprovar(s.id);
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }
    toast(`Troca aprovada: ${resultado.turnosTrocados} turno(s) mudaram de dono na escala.`);
  }

  async function handleRejeitar(id: string) {
        const confirmou = await confirmar('Rejeitar esta solicitação de troca?');
    if (!confirmou) return;
    await rejeitar(id);
  }

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Trocas
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        Solicitações de troca de turno
      </h1>

      {/* Aprovadas que não chegaram à escala */}
      {naoAplicadas.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-amber-800">
              {naoAplicadas.length} troca(s) aprovada(s) ainda não aparecem na escala dos operadores.
            </p>
            {naoAplicadas.length > 1 && (
              <button
                onClick={handleAplicarTodas}
                disabled={processando !== null}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                Aplicar todas na escala
              </button>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {naoAplicadas.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm"
              >
                <div className="text-tinta">
                  <span className="font-medium">{s.solicitanteNome}</span>
                  {s.tipo === 'assumir'
                    ? ' (de folga)'
                    : s.blocoSolicitante && <> · {rotuloBloco(s.blocoSolicitante)}</>}
                  <span className="mx-1 text-slate-400">⇄</span>
                  <span className="font-medium">{s.colegaNome}</span>
                  {s.tipo === 'cobertura'
                    ? ' (só cobre)'
                    : s.blocoColega && <> · {rotuloBloco(s.blocoColega)}</>}
                </div>
                <button
                  onClick={() => handleAplicarUma(s)}
                  disabled={processando === s.id}
                  className="rounded-md border border-amber-400 px-3 py-1 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                >
                  {processando === s.id ? 'Aplicando...' : 'Aplicar na escala'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aguardando aprovação */}
      <div className="mt-6">
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-slate-400">
          Aguardando sua aprovação
        </p>
        {aguardandoAprovacao.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nenhuma troca aguardando aprovação.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {aguardandoAprovacao.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-ceruleo/30 bg-ceruleo-light/40 p-4"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {s.solicitanteNome} vai trabalhar
                    </p>
                    {s.tipo === 'cobertura' ? (
                      <p className="mt-1 text-sm text-slate-500">Nada — fica de folga (só cobertura)</p>
                    ) : (
                      s.blocoColega && (
                        <p className="mt-1 text-sm text-tinta">{rotuloBloco(s.blocoColega)}</p>
                      )
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {s.colegaNome} vai trabalhar
                    </p>
                    {s.tipo === 'assumir' ? (
                      <p className="mt-1 text-sm text-slate-500">Nada — fica de folga</p>
                    ) : (
                      s.blocoSolicitante && (
                        <p className="mt-1 text-sm text-tinta">{rotuloBloco(s.blocoSolicitante)}</p>
                      )
                    )}
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => handleAprovar(s)}
                    disabled={processando === s.id}
                    className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-60"
                  >
                    {processando === s.id ? 'Processando...' : 'Aprovar troca'}
                  </button>
                  <button
                    onClick={() => handleRejeitar(s.id)}
                    disabled={processando === s.id}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico de solicitações */}
      <div className="mt-8">
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-slate-400">
          Todas as solicitações
        </p>
        {outras.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nenhuma outra solicitação até agora.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Solicitante</th>
                  <th className="px-4 py-3 font-medium">Dia oferecido</th>
                  <th className="px-4 py-3 font-medium">Colega</th>
                  <th className="px-4 py-3 font-medium">Dia oferecido</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outras.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-tinta">{s.solicitanteNome}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.tipo === 'assumir'
                        ? 'De folga'
                        : s.blocoSolicitante
                          ? rotuloBloco(s.blocoSolicitante)
                          : '—'}
                    </td>
                    <td className="px-4 py-3 text-tinta">{s.colegaNome}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.tipo === 'cobertura'
                        ? 'Só cobre'
                        : s.blocoColega
                          ? rotuloBloco(s.blocoColega)
                          : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${corStatus[s.status]}`}
                      >
                        {rotuloStatus[s.status]}
                      </span>
                      {s.naoAplicada && (
                        <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Não aplicada na escala
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}