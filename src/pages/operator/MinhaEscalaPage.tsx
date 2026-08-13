import { useMinhaEscala } from '../../features/schedules/useMinhaEscala';
import { corTurno } from '../../lib/turnoColors';
import type { PeriodoOperacao } from '../../types/database';

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function nomeDoDia(data: string, dataInicio: string) {
  return data === dataInicio ? 'Sábado' : 'Domingo';
}

interface MinhaEscalaPageProps {
  colaboradorId: string;
  periodo: PeriodoOperacao;
}

export function MinhaEscalaPage({ colaboradorId, periodo }: MinhaEscalaPageProps) {
  const { escalas, carregando, erro } = useMinhaEscala(colaboradorId, periodo.id);

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  return (
    <div>
      {erro && (
        <p className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Minha escala
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        {formatarData(periodo.data_inicio)} – {formatarData(periodo.data_fim)}
      </h1>

      <div className="mt-8 space-y-4">
        {[periodo.data_inicio, periodo.data_fim].map((data) => {
          const escalasDoDia = escalas
            .filter((e) => e.data === data)
            .sort((a, b) => a.turno_hora_inicio_snapshot.localeCompare(b.turno_hora_inicio_snapshot));

          return (
            <div key={data} className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-display font-semibold text-tinta">
                {nomeDoDia(data, periodo.data_inicio)}
                <span className="ml-2 font-mono text-sm font-normal text-slate-400">
                  {formatarData(data)}
                </span>
              </h2>

              {escalasDoDia.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {escalasDoDia.map((escala, i) => {
                    const cor = corTurno(escala.turno_nome_snapshot);
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between rounded-md ${cor.bgLight} px-4 py-3`}
                      >
                        <span className={`font-medium ${cor.text}`}>
                          {escala.turno_nome_snapshot}
                        </span>
                        <span className={`font-mono text-sm ${cor.text}`}>
                          {escala.turno_hora_inicio_snapshot.slice(0, 5)} –{' '}
                          {escala.turno_hora_fim_snapshot.slice(0, 5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">Não trabalha</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}