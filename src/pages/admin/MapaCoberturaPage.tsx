import { useMemo, useState } from 'react';
import { useMapaCobertura } from '../../features/schedules/useMapaCobertura';
import { useEquipes } from '../../features/teams/useEquipes';
import { corTurno } from '../../lib/turnoColors';

function formatarData(data: string) {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

// Escala de cor mais granular, do crítico ao excelente.
function corDaCelula(proporcao: number | null) {
  if (proporcao === null) return { bg: 'bg-slate-100', texto: 'text-slate-400' };
  if (proporcao >= 1) return { bg: 'bg-esmeralda', texto: 'text-white' };
  if (proporcao >= 0.85) return { bg: 'bg-esmeralda-light', texto: 'text-esmeralda-dark' };
  if (proporcao >= 0.65) return { bg: 'bg-lime-200', texto: 'text-lime-900' };
  if (proporcao >= 0.45) return { bg: 'bg-amber-200', texto: 'text-amber-900' };
  if (proporcao >= 0.25) return { bg: 'bg-orange-300', texto: 'text-orange-950' };
  return { bg: 'bg-red-400', texto: 'text-white' };
}

export function MapaCoberturaPage() {
  const [equipeId, setEquipeId] = useState<string>('');
  const { equipes } = useEquipes();
  const { turnos, periodos, carregando, erro, celula } = useMapaCobertura(equipeId || null);

  const mediasPorTurno = useMemo(() => {
    const mapa = new Map<string, number | null>();
    for (const turno of turnos) {
      const proporcoes: number[] = [];
      for (const p of periodos) {
        const c = celula(p.id, turno.id);
        if (c && c.vagas > 0) proporcoes.push(c.disponiveis / c.vagas);
      }
      mapa.set(
        turno.id,
        proporcoes.length > 0 ? proporcoes.reduce((a, b) => a + b, 0) / proporcoes.length : null
      );
    }
    return mapa;
  }, [turnos, periodos, celula]);

  const turnoMaisFraco = useMemo(() => {
    let pior: { nome: string; media: number } | null = null;
    for (const turno of turnos) {
      const media = mediasPorTurno.get(turno.id);
      if (media === null || media === undefined) continue;
      if (!pior || media < pior.media) pior = { nome: turno.nome, media };
    }
    return pior;
  }, [turnos, mediasPorTurno]);

  const turnoMaisForte = useMemo(() => {
    let melhor: { nome: string; media: number } | null = null;
    for (const turno of turnos) {
      const media = mediasPorTurno.get(turno.id);
      if (media === null || media === undefined) continue;
      if (!melhor || media > melhor.media) melhor = { nome: turno.nome, media };
    }
    return melhor;
  }, [turnos, mediasPorTurno]);

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
        <>
          {/* Destaques rápidos */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {turnoMaisFraco && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-red-600">
                  🔴 Turno mais crítico
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-tinta">
                  {turnoMaisFraco.nome}
                </p>
                <p className="mt-1 text-sm text-red-700">
                  Média de {Math.round(turnoMaisFraco.media * 100)}% de cobertura
                </p>
              </div>
            )}
            {turnoMaisForte && (
              <div className="rounded-lg border border-esmeralda/30 bg-esmeralda-light p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-esmeralda-dark">
                  🟢 Turno mais forte
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-tinta">
                  {turnoMaisForte.nome}
                </p>
                <p className="mt-1 text-sm text-esmeralda-dark">
                  Média de {Math.round(turnoMaisForte.media * 100)}% de cobertura
                </p>
              </div>
            )}
          </div>

          {/* Mapa de calor */}
          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white p-5">
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `140px repeat(${periodos.length}, 90px) 100px`,
              }}
            >
              {/* Cabeçalho */}
              <div />
              {periodos.map((p) => (
                <div key={p.id} className="text-center">
                  <p className="text-xs font-medium text-slate-400">
                    {formatarData(p.data_inicio)}–{formatarData(p.data_fim)}
                  </p>
                </div>
              ))}
              <div className="text-center">
                <p className="text-xs font-semibold text-tinta">Média</p>
              </div>

              {/* Linhas por turno */}
              {turnos.map((turno) => {
                const cor = corTurno(turno.nome);
                const media = mediasPorTurno.get(turno.id);

                return (
                  <div key={turno.id} className="contents">
                    <div className="flex items-center gap-2 py-1">
                      <span className={`h-2.5 w-2.5 rounded-full ${cor.dot}`} />
                      <span className="text-sm font-medium text-tinta">{turno.nome}</span>
                    </div>

                    {periodos.map((p) => {
                      const c = celula(p.id, turno.id);
                      const vagas = c?.vagas ?? 0;
                      const disponiveis = c?.disponiveis ?? 0;
                      const proporcao = vagas > 0 ? disponiveis / vagas : null;
                      const { bg, texto } = corDaCelula(proporcao);

                      return (
                        <div
                          key={p.id}
                          className={`flex h-16 w-full flex-col items-center justify-center rounded-md ${bg} ${texto}`}
                          title={`${disponiveis} disponíveis de ${vagas} vagas configuradas`}
                        >
                          <span className="text-base font-bold leading-none">
                            {proporcao === null ? '—' : `${Math.round(proporcao * 100)}%`}
                          </span>
                          <span className="mt-1 text-[10px] font-medium leading-none opacity-80">
                            {disponiveis}/{vagas}
                          </span>
                        </div>
                      );
                    })}

                    <div className="flex h-16 flex-col items-center justify-center rounded-md border border-slate-200 bg-slate-50">
                      <span className="text-base font-bold leading-none text-tinta">
                        {media === null || media === undefined ? '—' : `${Math.round(media * 100)}%`}
                      </span>
                      <span className="mt-1 text-[10px] font-medium leading-none text-slate-400">
                        média
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legenda */}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-red-400" /> Crítico (&lt;25%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-orange-300" /> Baixo (25–44%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-amber-200" /> Atenção (45–64%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-lime-200" /> Bom (65–84%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-esmeralda-light" /> Ótimo (85–99%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-esmeralda" /> Cheio (100%+)
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}