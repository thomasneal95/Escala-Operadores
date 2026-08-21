import { useState } from 'react';
import { useSolicitacoesTroca } from '../../features/schedules/useSolicitacoesTroca';
import { useColegasEquipe } from '../../features/teams/useColegasEquipe';
import { useAreaColaborador } from '../../features/schedules/useAreaColaborador';
import { useMinhaEscalaDoPeriodo } from '../../features/schedules/useMinhaEscalaDoPeriodo';
import { corTurno } from '../../lib/turnoColors';

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

const rotuloStatus: Record<string, string> = {
  pendente: 'Aguardando colega',
  aceito_pelo_colega: 'Aguardando aprovação do admin',
  aprovado: 'Aprovado',
  rejeitado_pelo_colega: 'Recusado pelo colega',
  rejeitado_pelo_admin: 'Recusado pelo admin',
  cancelado: 'Cancelado',
};

const corStatus: Record<string, string> = {
  pendente: 'bg-ceruleo-light text-ceruleo',
  aceito_pelo_colega: 'bg-profundo-light text-profundo',
  aprovado: 'bg-esmeralda-light text-esmeralda-dark',
  rejeitado_pelo_colega: 'bg-slate-100 text-slate-500',
  rejeitado_pelo_admin: 'bg-slate-100 text-slate-500',
  cancelado: 'bg-slate-100 text-slate-500',
};

export function SolicitacoesTrocaPage() {
  const { periodo } = useAreaColaborador();
  const {
    solicitacoes,
    carregando,
    erro,
    processando,
    criarSolicitacao,
    aceitarSolicitacao,
    recusarSolicitacao,
    cancelarSolicitacao,
  } = useSolicitacoesTroca();
  const { colegas } = useColegasEquipe();
  const { escalas: minhasEscalas } = useMinhaEscalaDoPeriodo(periodo?.id ?? null);

  const [minhaEscalaId, setMinhaEscalaId] = useState('');
  const [colegaId, setColegaId] = useState('');
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [aceitandoId, setAceitandoId] = useState<string | null>(null);
  const [escalaParaOferecer, setEscalaParaOferecer] = useState('');

  const podeSolicitar =
    periodo && (periodo.status === 'confirmado' || periodo.status === 'encerrado');

  const colegasParaSolicitar = colegas.filter((c) => !c.souEu);

  async function handleCriarSolicitacao() {
    setErroForm(null);
    setSucesso(null);

    if (!periodo || !minhaEscalaId || !colegaId) {
      setErroForm('Selecione o seu turno e o colega para solicitar a troca.');
      return;
    }

    const resultado = await criarSolicitacao(periodo.id, minhaEscalaId, colegaId);
    if (resultado.erro) {
      setErroForm(resultado.erro);
      return;
    }

    setSucesso('Solicitação enviada! Aguarde o colega aceitar.');
    setMinhaEscalaId('');
    setColegaId('');
  }

  async function handleAceitar(solicitacaoId: string) {
    if (!escalaParaOferecer) return;
    const resultado = await aceitarSolicitacao(solicitacaoId, escalaParaOferecer);
    if (!resultado.erro) {
      setAceitandoId(null);
      setEscalaParaOferecer('');
    }
  }

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  const recebidas = solicitacoes.filter((s) => !s.souSolicitante);
  const enviadas = solicitacoes.filter((s) => s.souSolicitante);

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

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-display font-semibold text-tinta">Solicitar troca</h2>

        {!podeSolicitar ? (
          <p className="mt-2 text-sm text-slate-500">
            Você só pode solicitar troca depois que a escala do fim de semana atual estiver
            confirmada.
          </p>
        ) : minhasEscalas.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Você não está escalado neste período, então não há turno para trocar.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Seu turno</label>
              <select
                value={minhaEscalaId}
                onChange={(e) => setMinhaEscalaId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
              >
                <option value="">Selecione</option>
                {minhasEscalas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {formatarData(e.data)} · {e.turno_nome_snapshot} (
                    {e.turno_hora_inicio_snapshot.slice(0, 5)}–
                    {e.turno_hora_fim_snapshot.slice(0, 5)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Trocar com quem?
              </label>
              <select
                value={colegaId}
                onChange={(e) => setColegaId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
              >
                <option value="">Selecione</option>
                {colegasParaSolicitar.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_completo}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                onClick={handleCriarSolicitacao}
                disabled={processando === 'nova'}
                className="rounded-md bg-esmeralda px-4 py-2 font-medium text-white transition hover:bg-esmeralda-dark disabled:opacity-60"
              >
                {processando === 'nova' ? 'Enviando...' : 'Solicitar troca'}
              </button>
            </div>
          </div>
        )}

        {erroForm && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erroForm}</p>
        )}
        {sucesso && (
          <p className="mt-3 rounded-md bg-esmeralda-light px-3 py-2 text-sm text-esmeralda-dark">
            {sucesso}
          </p>
        )}
      </div>

      <div className="mt-6">
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-slate-400">
          Recebidas
        </p>
        {recebidas.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nenhuma solicitação recebida.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {recebidas.map((s) => {
              const cor = s.escalaOutraPessoa ? corTurno(s.escalaOutraPessoa.turno_nome_snapshot) : null;

              return (
                              <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-600">
                      <span className="font-medium text-tinta">{s.outraPessoaNome}</span> quer
                      trocar um turno com você.
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${corStatus[s.status]}`}
                    >
                      {rotuloStatus[s.status]}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                    <div>
                      <p className="font-medium uppercase tracking-wide text-slate-400">
                        Turno de {s.outraPessoaNome}
                      </p>
                      {s.escalaOutraPessoa ? (
                        <p className={`mt-0.5 font-medium ${cor?.text ?? 'text-slate-700'}`}>
                          {formatarData(s.escalaOutraPessoa.data)} ·{' '}
                          {s.escalaOutraPessoa.turno_nome_snapshot}
                        </p>
                      ) : (
                        <p className="mt-0.5">—</p>
                      )}
                    </div>
                    <div>
                      <p className="font-medium uppercase tracking-wide text-slate-400">
                        Seu turno (a oferecer)
                      </p>
                      {s.minhaEscala ? (
                        <p className="mt-0.5 text-slate-700">
                          {formatarData(s.minhaEscala.data)} · {s.minhaEscala.turno_nome_snapshot}
                        </p>
                      ) : (
                        <p className="mt-0.5 italic">Você escolhe ao aceitar</p>
                      )}
                    </div>
                  </div>

                  {s.status === 'pendente' && (
                    <div className="mt-3">
                      {aceitandoId === s.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={escalaParaOferecer}
                            onChange={(e) => setEscalaParaOferecer(e.target.value)}
                            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                          >
                            <option value="">Qual turno seu você oferece?</option>
                            {minhasEscalas.map((e) => (
                              <option key={e.id} value={e.id}>
                                {formatarData(e.data)} · {e.turno_nome_snapshot}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAceitar(s.id)}
                            disabled={!escalaParaOferecer || processando === s.id}
                            className="rounded-md bg-esmeralda px-3 py-1.5 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-60"
                          >
                            Confirmar aceite
                          </button>
                          <button
                            onClick={() => setAceitandoId(null)}
                            className="text-sm font-medium text-slate-500 hover:text-slate-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={() => setAceitandoId(s.id)}
                            className="rounded-md bg-esmeralda px-3 py-1.5 text-sm font-medium text-white hover:bg-esmeralda-dark"
                          >
                            Aceitar
                          </button>
                          <button
                            onClick={() => recusarSolicitacao(s.id)}
                            disabled={processando === s.id}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Recusar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6">
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-slate-400">
          Enviadas
        </p>
        {enviadas.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nenhuma solicitação enviada.</p>
        ) : (
          <div className="mt-3 space-y-3">
                        {enviadas.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-600">
                    Você solicitou trocar com{' '}
                    <span className="font-medium text-tinta">{s.outraPessoaNome}</span>
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${corStatus[s.status]}`}
                  >
                    {rotuloStatus[s.status]}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                  <div>
                    <p className="font-medium uppercase tracking-wide text-slate-400">
                      Seu turno oferecido
                    </p>
                    {s.minhaEscala ? (
                      <p className="mt-0.5 text-slate-700">
                        {formatarData(s.minhaEscala.data)} · {s.minhaEscala.turno_nome_snapshot}
                      </p>
                    ) : (
                      <p className="mt-0.5">—</p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium uppercase tracking-wide text-slate-400">
                      Turno de {s.outraPessoaNome}
                    </p>
                    {s.escalaOutraPessoa ? (
                      <p className="mt-0.5 text-slate-700">
                        {formatarData(s.escalaOutraPessoa.data)} ·{' '}
                        {s.escalaOutraPessoa.turno_nome_snapshot}
                      </p>
                    ) : (
                      <p className="mt-0.5 italic">Ainda não escolhido</p>
                    )}
                  </div>
                </div>

                {s.status === 'pendente' && (
                  <button
                    onClick={() => cancelarSolicitacao(s.id)}
                    disabled={processando === s.id}
                    className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Cancelar solicitação
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}