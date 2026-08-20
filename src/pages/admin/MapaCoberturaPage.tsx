import { useState } from 'react';
import { useMapaCobertura } from '../../features/schedules/useMapaCobertura';
import { useEquipes } from '../../features/teams/useEquipes';

function formatarData(data: string) {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

function corDaCelula(disponiveis: number, vagas: number) {
  if (vagas === 0) return 'bg-slate-100 text-slate-400';
  const proporcao = disponiveis / vagas;
  if (proporcao >= 1) return 'bg-esmeralda text-white';
  if (proporcao >= 0.7) return 'bg-esmeralda-light text-esmeralda-dark';
  if (proporcao >= 0.4) return 'bg-amber-200 text-amber-900';
  return 'bg-red-300 text-red-900';
}

export function MapaCoberturaPage() {
  const [equipeId, setEquipeId] = useState<string>('');
  const { equipes } = useEquipes();
  const { turnos, periodos, carregando, erro, celula } = useMapaCobertura(equipeId || null);

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Mapa de cobertura
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        Disponibilidade por turno ao longo do tempo
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Mostra quantas pessoas marcaram disponibilidade em cada turno, comparado às vagas
        configuradas para a equipe. Ajuda a identificar turnos que costumam ficar
        desfalcados antes mesmo de montar a escala.
      </p>

      <div className="mt-5 max-w-xs">
        <label className="block text-sm font-medium text-slate-700">Equipe</label>
        <select
          value={equipeId}
          onChange={(e) => setEquipeId(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
        >
          <option value="">Todas as equipes</option>
          {equipes
            .filter((e) => e.ativo)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
        </select>
      </div>

      {carregando ? (
        <p className="mt-6 text-sm text-slate-400">Carregando...</p>
      ) : periodos.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Ainda não há períodos suficientes no histórico.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
          <table className="w-full border-separate border-spacing-1 text-center text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs font-medium text-slate-400">
                  Turno
                </th>
                {periodos.map((p) => (
                  <th
                    key={p.id}
                    className="px-2 py-1 text-xs font-medium text-slate-400"
                  >
                    {formatarData(p.data_inicio)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {turnos.map((turno) => (
                <tr key={turno.id}>
                  <td className="px-2 py-1 text-left text-sm font-medium text-tinta">
                    {turno.nome}
                  </td>
                  {periodos.map((p) => {
                    const c = celula(p.id, turno.id);
                    const vagas = c?.vagas ?? 0;
                    const disponiveis = c?.disponiveis ?? 0;

                    return (
                      <td key={p.id} className="p-0">
                        <div
                          className={`flex h-12 w-16 flex-col items-center justify-center rounded-md text-xs font-semibold ${corDaCelula(disponiveis, vagas)}`}
                          title={`${disponiveis} disponíveis de ${vagas} vagas`}
                        >
                          <span>{disponiveis}</span>
                          {vagas > 0 && <span className="text-[10px] font-normal">/{vagas}</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-esmeralda" /> Cheio ou acima
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-esmeralda-light" /> Bom (70%+)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-200" /> Atenção (40–69%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-red-300" /> Crítico (abaixo de 40%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}