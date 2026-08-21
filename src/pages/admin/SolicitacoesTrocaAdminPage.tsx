import { useSolicitacoesTrocaAdmin } from '../../features/schedules/useSolicitacoesTrocaAdmin';
import { useConfirm } from '../../components/FeedbackProvider';

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

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
  const { solicitacoes, carregando, erro, processando, aprovar, rejeitar } =
    useSolicitacoesTrocaAdmin();
  const confirmar = useConfirm();

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  const aguardandoAprovacao = solicitacoes.filter((s) => s.status === 'aceito_pelo_colega');
  const outras = solicitacoes.filter((s) => s.status !== 'aceito_pelo_colega');

  async function handleAprovar(s: (typeof solicitacoes)[number]) {
    if (!s.escalaSolicitante || !s.escalaColega) return;

        const confirmou = await confirmar(
      `Aprovar a troca entre ${s.solicitanteNome} e ${s.colegaNome}? ` +
        'Os dois turnos vão trocar de dono imediatamente na escala.'
    );
    if (!confirmou) return;

    await aprovar(s.id, s.escalaSolicitante.id, s.escalaColega.id);
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
                    {s.escalaColega && (
                      <p className="mt-1 text-sm text-tinta">
                        {formatarData(s.escalaColega.data)} · {s.escalaColega.turno_nome_snapshot}{' '}
                        ({s.escalaColega.turno_hora_inicio_snapshot.slice(0, 5)}–
                        {s.escalaColega.turno_hora_fim_snapshot.slice(0, 5)})
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {s.colegaNome} vai trabalhar
                    </p>
                    {s.escalaSolicitante && (
                      <p className="mt-1 text-sm text-tinta">
                        {formatarData(s.escalaSolicitante.data)} ·{' '}
                        {s.escalaSolicitante.turno_nome_snapshot} (
                        {s.escalaSolicitante.turno_hora_inicio_snapshot.slice(0, 5)}–
                        {s.escalaSolicitante.turno_hora_fim_snapshot.slice(0, 5)})
                      </p>
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
                  <th className="px-4 py-3 font-medium">Turno oferecido</th>
                  <th className="px-4 py-3 font-medium">Colega</th>
                  <th className="px-4 py-3 font-medium">Turno oferecido</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outras.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-tinta">{s.solicitanteNome}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.escalaSolicitante ? (
                        <>
                          {formatarData(s.escalaSolicitante.data)} ·{' '}
                          {s.escalaSolicitante.turno_nome_snapshot}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-tinta">{s.colegaNome}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.escalaColega ? (
                        <>
                          {formatarData(s.escalaColega.data)} · {s.escalaColega.turno_nome_snapshot}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${corStatus[s.status]}`}
                      >
                        {rotuloStatus[s.status]}
                      </span>
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