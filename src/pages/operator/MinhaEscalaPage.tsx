import { useState } from 'react';
import { useMinhaEscala } from '../../features/schedules/useMinhaEscala';
import { useVisualizacaoEscala } from '../../features/schedules/useVisualizacaoEscala';
import { corTurno } from '../../lib/turnoColors';
import { EscalaEquipeModal } from '../../components/EscalaEquipeModal';
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
  const { processando, marcarComoVisto, foiVisualizada } = useVisualizacaoEscala(
    escalas.map((e) => e.id)
  );
  const [modalEquipeAberto, setModalEquipeAberto] = useState(false);

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  async function handleMarcarComoVisto(escalaId: string) {
    await marcarComoVisto(escalaId);
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

      <div className="mt-4">
        <button
          onClick={() => setModalEquipeAberto(true)}
          className="inline-flex items-center gap-2 rounded-md border border-ceruleo bg-ceruleo px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-ceruleo/90"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 10-.001-4.001A2 2 0 006 8zM1.5 14.25c0-1.657 1.79-3 4-3 .68 0 1.32.13 1.878.359C6.548 12.29 6 13.36 6 14.5v.5H1.5v-.75zM18.5 15h-11v-.5c0-1.795 2.015-3.25 4.5-3.25s4.5 1.455 4.5 3.25V15zM14 8a2 2 0 10-.001-4.001A2 2 0 0014 8z" />
          </svg>
          Ver escala da equipe
        </button>
      </div>

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
                  {escalasDoDia.map((escala) => {
                    const cor = corTurno(escala.turno_nome_snapshot);
                    const visto = foiVisualizada(escala.id);

                    return (
                      <div
                        key={escala.id}
                        className={`rounded-md ${cor.bgLight} px-4 py-3`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${cor.text}`}>
                            {escala.turno_nome_snapshot}
                          </span>
                          <span className={`font-mono text-sm ${cor.text}`}>
                            {escala.turno_hora_inicio_snapshot.slice(0, 5)} –{' '}
                            {escala.turno_hora_fim_snapshot.slice(0, 5)}
                          </span>
                        </div>

                        <div className="mt-2">
                          {visto ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-esmeralda-dark">
                              ✓ Confirmado que você viu
                            </span>
                          ) : (
                            <button
                              onClick={() => handleMarcarComoVisto(escala.id)}
                              disabled={processando === escala.id}
                              className="rounded-md bg-white/70 px-2.5 py-1 text-xs font-medium text-tinta hover:bg-white disabled:opacity-60"
                            >
                              {processando === escala.id ? 'Confirmando...' : 'Marcar que vi'}
                            </button>
                          )}
                        </div>
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

      <EscalaEquipeModal
        periodoId={periodo.id}
        dataInicio={periodo.data_inicio}
        dataFim={periodo.data_fim}
        aberto={modalEquipeAberto}
        onFechar={() => setModalEquipeAberto(false)}
      />
    </div>
  );
}