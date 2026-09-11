import { corTurno } from '../lib/turnoColors';
import { useEscalaEquipe } from '../features/schedules/useEscalaEquipe';
import { useModalAcessivel } from '../hooks/useModalAcessivel';

interface EscalaEquipeModalProps {
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

export function EscalaEquipeModal({
  periodoId,
  dataInicio,
  dataFim,
  aberto,
  onFechar,
}: EscalaEquipeModalProps) {
  const { equipeNome, turnos, escalados, carregando, erro } = useEscalaEquipe(periodoId, aberto);
  const ref = useModalAcessivel(aberto, onFechar);

  if (!aberto) return null;

  const dias = [
    { data: dataInicio, nome: 'Sábado' },
    { data: dataFim, nome: 'Domingo' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-escala-equipe"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
              Escala da equipe
            </p>
            <h3 id="titulo-escala-equipe" className="mt-1 font-display text-lg font-semibold text-tinta">
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
            <div className="space-y-6">
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

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {turnosDoDia.map((turno) => {
                        const membros = escalados.filter(
                          (e) => e.data === data && e.turnoId === turno.id
                        );
                        const cor = corTurno(turno.nome);

                        return (
                          <div
                            key={turno.id}
                            className="rounded-md border border-slate-200 bg-white p-3"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${cor.dot}`} />
                              <p className="text-sm font-medium text-tinta">{turno.nome}</p>
                            </div>
                            <p className="font-mono text-xs text-slate-400">
                              {turno.hora_inicio.slice(0, 5)}–{turno.hora_fim.slice(0, 5)}
                            </p>

                            <div className="mt-2 space-y-1">
                              {membros.length === 0 ? (
                                <p className="text-xs text-slate-300">Ninguém</p>
                              ) : (
                                membros.map((m) => (
                                  <p
                                    key={m.colaboradorId}
                                    className={`rounded px-2 py-1 text-xs font-medium ${cor.bgLight} ${cor.text}`}
                                  >
                                    {m.nome}
                                    {m.souEu && ' (Você)'}
                                  </p>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
