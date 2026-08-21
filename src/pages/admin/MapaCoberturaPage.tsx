import { useState } from 'react';
import { useAnalises } from '../../features/schedules/useAnalises';
import { useEquipes } from '../../features/teams/useEquipes';
import { corTurno } from '../../lib/turnoColors';

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataCurta(data: string) {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

// Escala de cor ÚNICA, usada nos três gráficos e na legenda única.
function corPorProporcao(proporcao: number) {
  if (proporcao >= 1) return { bg: 'bg-emerald-200', texto: 'text-emerald-800', hex: '#6ee7b7' };
  if (proporcao >= 0.85) return { bg: 'bg-lime-200', texto: 'text-lime-800', hex: '#bef264' };
  if (proporcao >= 0.6) return { bg: 'bg-amber-200', texto: 'text-amber-800', hex: '#fcd34d' };
  if (proporcao >= 0.35) return { bg: 'bg-orange-200', texto: 'text-orange-800', hex: '#fdba74' };
  return { bg: 'bg-rose-200', texto: 'text-rose-800', hex: '#fda4af' };
}

const textoTendencia: Record<string, string> = {
  melhorando: '📈 Melhorando',
  piorando: '📉 Piorando',
  estavel: '➡️ Estável',
};

type SubAba = 'turno' | 'dia' | 'tendencia';

export function MapaCoberturaPage() {
  const [equipeId, setEquipeId] = useState<string>('');
  const { equipes } = useEquipes();
  const { turnos, periodos, celula, dias, evolucao, resumo, carregando, erro } =
    useAnalises(equipeId || null);
  const [subAba, setSubAba] = useState<SubAba>('turno');

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Análises
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        Cobertura de turnos ao longo do tempo
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
          {/* Resumo automático */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Cobertura média geral
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-tinta">
                {resumo.mediaGeral !== null ? `${Math.round(resumo.mediaGeral * 100)}%` : '—'}
              </p>
            </div>

            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-rose-600">
                🔴 Turno mais crítico
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-tinta">
                {resumo.turnoMaisFraco?.nome ?? '—'}
              </p>
              {resumo.turnoMaisFraco && (
                <p className="text-xs text-rose-700">
                  {Math.round(resumo.turnoMaisFraco.media * 100)}% de média
                </p>
              )}
            </div>

            <div className="rounded-lg border border-esmeralda/30 bg-esmeralda-light p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-esmeralda-dark">
                🟢 Turno mais forte
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-tinta">
                {resumo.turnoMaisForte?.nome ?? '—'}
              </p>
              {resumo.turnoMaisForte && (
                <p className="text-xs text-esmeralda-dark">
                  {Math.round(resumo.turnoMaisForte.media * 100)}% de média
                </p>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Tendência recente
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-tinta">
                {resumo.tendencia ? textoTendencia[resumo.tendencia] : 'Poucos dados ainda'}
              </p>
            </div>
          </div>

          {/* Sub-abas */}
          <div className="mt-6 flex gap-1 border-b border-slate-200">
            {(
              [
                { id: 'turno', rotulo: 'Por turno' },
                { id: 'dia', rotulo: 'Por dia' },
                { id: 'tendencia', rotulo: 'Tendência' },
              ] as { id: SubAba; rotulo: string }[]
            ).map((aba) => (
              <button
                key={aba.id}
                onClick={() => setSubAba(aba.id)}
                className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                  subAba === aba.id
                    ? 'border-esmeralda text-esmeralda-dark'
                    : 'border-transparent text-slate-500 hover:text-tinta'
                }`}
              >
                {aba.rotulo}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
            {/* ---- Por turno (mapa de calor) ---- */}
            {subAba === 'turno' && (
              <>
                <p className="text-sm text-slate-500">
                  Disponibilidade marcada em relação às vagas configuradas, por turno e por
                  fim de semana.
                </p>
                <div className="mt-4 overflow-x-auto">
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `140px repeat(${periodos.length}, 90px)` }}
                  >
                    <div />
                    {periodos.map((p) => (
                      <div key={p.id} className="text-center">
                        <p className="whitespace-nowrap text-xs font-medium text-slate-400">
                          {formatarDataCurta(p.data_inicio)}–{formatarDataCurta(p.data_fim)}
                        </p>
                      </div>
                    ))}

                    {turnos.map((turno) => {
                      const cor = corTurno(turno.nome);
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
                            const proporcao = vagas > 0 ? disponiveis / vagas : 0;
                            const corCelula = corPorProporcao(proporcao);
                            return (
                              <div
                                key={p.id}
                                className={`flex h-14 w-full flex-col items-center justify-center rounded-md ${corCelula.bg} ${corCelula.texto}`}
                                title={`${disponiveis} disponíveis de ${vagas} vagas`}
                              >
                                <span className="text-sm font-bold leading-none">
                                  {vagas > 0 ? `${Math.round(proporcao * 100)}%` : '—'}
                                </span>
                                <span className="mt-1 text-[10px] font-medium leading-none opacity-80">
                                  {disponiveis}/{vagas}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ---- Por dia (barras) ---- */}
            {subAba === 'dia' && (
              <>
                <p className="text-sm text-slate-500">
                  Vagas efetivamente preenchidas em cada sábado e domingo, em relação ao
                  total de vagas configuradas.
                </p>
                <div className="mt-6 flex items-end gap-3 overflow-x-auto pb-2">
                  {dias.map((dia) => {
                    const proporcao = dia.vagasTotais > 0 ? dia.preenchidas / dia.vagasTotais : 0;
                    const alturaPercentual = Math.min(proporcao, 1) * 100;
                    const cor = corPorProporcao(proporcao);
                    return (
                      <div
                        key={`${dia.periodoId}-${dia.data}`}
                        className="flex w-20 shrink-0 flex-col items-center"
                      >
                        <span className={`text-sm font-bold ${cor.texto}`}>
                          {Math.round(proporcao * 100)}%
                        </span>
                        <div className="mt-1 flex h-32 w-full items-end rounded-md bg-slate-50">
                          <div
                            className={`w-full rounded-md transition-all ${cor.bg}`}
                            style={{ height: `${Math.max(alturaPercentual, 4)}%` }}
                            title={`${dia.preenchidas} de ${dia.vagasTotais} vagas preenchidas`}
                          />
                        </div>
                        <span className="mt-2 whitespace-nowrap text-xs font-medium text-tinta">
                          {dia.ehSabado ? 'Sáb' : 'Dom'} {formatarDataCurta(dia.data)}
                        </span>
                        <span className="mt-1 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          {dia.preenchidas}/{dia.vagasTotais} vagas
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ---- Tendência (linha) ---- */}
            {subAba === 'tendencia' && (
              <>
                <p className="text-sm text-slate-500">
                  Percentual geral de vagas preenchidas em cada fim de semana, para perceber
                  se a cobertura está melhorando ou piorando com o tempo.
                </p>
                {evolucao.length < 2 ? (
                  <p className="mt-4 text-sm text-slate-400">Ainda não há dados suficientes.</p>
                ) : (
                  (() => {
                    const largura = Math.max(evolucao.length * 70, 280);
                    const altura = 160;
                    const margemBaixo = 24;
                    const pontos = evolucao.map((e, i) => {
                      const x =
                        evolucao.length === 1
                          ? largura / 2
                          : (i / (evolucao.length - 1)) * (largura - 40) + 20;
                      const y = altura - margemBaixo - e.percentual * (altura - margemBaixo - 10);
                      return { ...e, x, y };
                    });
                    const linhaPath = pontos
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                      .join(' ');

                    return (
                      <div className="mt-4 overflow-x-auto">
                        <svg
                          viewBox={`0 0 ${largura} ${altura}`}
                          width={largura}
                          height={altura}
                          className="min-w-full"
                        >
                          {[0.25, 0.5, 0.75, 1].map((marca) => {
                            const y = altura - margemBaixo - marca * (altura - margemBaixo - 10);
                            return (
                              <line
                                key={marca}
                                x1={0}
                                x2={largura}
                                y1={y}
                                y2={y}
                                stroke="#e2e8f0"
                                strokeWidth={1}
                              />
                            );
                          })}
                          <path d={linhaPath} fill="none" stroke="#94a3b8" strokeWidth={2} />
                          {pontos.map((p) => (
                            <g key={p.periodoId}>
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={5}
                                fill={corPorProporcao(p.percentual).hex}
                                stroke="#475569"
                                strokeWidth={1}
                              >
                                <title>{`${formatarData(p.dataInicio)}: ${Math.round(p.percentual * 100)}%`}</title>
                              </circle>
                              <text
                                x={p.x}
                                y={altura - 6}
                                textAnchor="middle"
                                fontSize="9"
                                fill="#64748b"
                              >
                                {formatarDataCurta(p.dataInicio)}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    );
                  })()
                )}
              </>
            )}
          </div>

          {/* Legenda única */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-rose-200" /> Crítico (&lt;35%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-orange-200" /> Baixo (35–59%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-200" /> Atenção (60–84%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-lime-200" /> Bom (85–99%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-emerald-200" /> Cheio ou acima
            </span>
          </div>
        </>
      )}
    </div>
  );
}