import { useAuth } from '../../features/auth/AuthContext';
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
  const { perfil, sair } = useAuth();
  const { escalas, carregando, erro } = useMinhaEscala(colaboradorId, periodo.id);

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nuvem text-slate-500">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nuvem">
      <header className="bg-tinta">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-slate-400">Olá,</p>
            <p className="font-display font-medium text-white">{perfil?.nome_completo}</p>
          </div>
          <button
            onClick={sair}
            className="rounded-md border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
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
            const escalaDoDia = escalas.find((e) => e.data === data);
            const cor = escalaDoDia ? corTurno(escalaDoDia.turno_nome_snapshot) : null;

            return (
              <div key={data} className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="font-display font-semibold text-tinta">
                  {nomeDoDia(data, periodo.data_inicio)}
                  <span className="ml-2 font-mono text-sm font-normal text-slate-400">
                    {formatarData(data)}
                  </span>
                </h2>

                {escalaDoDia && cor ? (
                  <div className={`mt-3 flex items-center justify-between rounded-md ${cor.bgLight} px-4 py-3`}>
                    <span className={`font-medium ${cor.text}`}>
                      {escalaDoDia.turno_nome_snapshot}
                    </span>
                    <span className={`font-mono text-sm ${cor.text}`}>
                      {escalaDoDia.turno_hora_inicio_snapshot.slice(0, 5)} –{' '}
                      {escalaDoDia.turno_hora_fim_snapshot.slice(0, 5)}
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">Não trabalha</p>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}