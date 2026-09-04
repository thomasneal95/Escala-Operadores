import { corTurno } from '../lib/turnoColors';
import { useDisponibilidadeEquipe } from '../features/availability/useDisponibilidadeEquipe';

interface DisponibilidadeEquipeModalProps {
  periodoId: string;
  dataInicio: string;
  dataFim: string;
  aberto: boolean;
  onFechar: () => void;
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function DisponibilidadeEquipeModal({
  periodoId,
  dataInicio,
  dataFim,
  aberto,
  onFechar,
}: DisponibilidadeEquipeModalProps) {
  const { equipeNome, turnos, colegas, carregando, erro } = useDisponibilidadeEquipe(
    periodoId,
    aberto
  );

  if (!aberto) return null;

  const dias = [
    { data: dataInicio, nome: 'Sábado' },
    { data: dataFim, nome: 'Domingo' },
  ];

  const pendentes = colegas.filter((c) => !c.jaDeclarou);
  const declarados = colegas.filter((c) => c.jaDeclarou);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
              Disponibilidade da equipe
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold text-tinta">
              {equipeNome ?? 'Sem equipe'}
            </h3>
          </div>
          <button
            onClick={onFechar}
            className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {erro && (
            <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
          )}

          {carregando ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : !equipeNome ? (
            <p className="text-slate-600">Você ainda não foi associado a nenhuma equipe.</p>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Turnos marcados com{' '}
                <span className="font-semibold text-tinta">★</span> são o turno que a pessoa já
                trabalha durante a semana.
              </p>

              {pendentes.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                    Ainda não declararam ({pendentes.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pendentes.map((c) => (
                      <span
                        key={c.id}
                        className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700"
                      >
                        {c.nomeCompleto}
                        {c.souEu && ' (Você)'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-6">
                {dias.map(({ data, nome }) => {
                  const turnosDoDia = turnos.filter((t) =>
                    data === dataInicio ? t.ativo_sabado : t.ativo_domingo
                  );

                  if (turnosDoDia.length === 0) return null;

                  return (
                    <div key={data}>
                      <h4 className="font-display font-semibold text-tinta">
                        {nome}
                        <span className="ml-2 font-mono text-sm font-normal text-slate-400">
                          {formatarData(data)}
                        </span>
                      </h4>

                      {declarados.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-400">
                          Ninguém da equipe declarou disponibilidade ainda.
                        </p>
                      ) : (
                        <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
                          <table className="w-full min-w-[420px] text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="px-3 py-2 text-left font-medium text-slate-500">
                                  Colaborador
                                </th>
                                {turnosDoDia.map((turno) => (
                                  <th
                                    key={turno.id}
                                    className="px-3 py-2 text-center font-medium text-slate-500"
                                  >
                                    {turno.nome}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {declarados.map((colega) => (
                                <tr key={colega.id}>
                                  <td className="whitespace-nowrap px-3 py-2 font-medium text-tinta">
                                    {colega.nomeCompleto}
                                    {colega.souEu && (
                                      <span className="ml-2 rounded-full bg-esmeralda-light px-2 py-0.5 text-xs font-medium text-esmeralda-dark">
                                        Você
                                      </span>
                                    )}
                                  </td>
                                  {turnosDoDia.map((turno) => {
                                    const disponivel =
                                      colega.respostas[`${data}|${turno.id}`] ?? false;
                                    const preferencia = colega.turnoSemanaId === turno.id;
                                    const cor = corTurno(turno.nome);

                                    return (
                                      <td key={turno.id} className="px-3 py-2 text-center">
                                        {disponivel ? (
                                          <span
                                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${cor.bgLight} ${cor.text}`}
                                            title={
                                              preferencia
                                                ? 'Disponível — este é o turno que a pessoa trabalha durante a semana'
                                                : 'Disponível'
                                            }
                                          >
                                            {preferencia && '★'} Disponível
                                          </span>
                                        ) : (
                                          <span className="text-slate-300">—</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
