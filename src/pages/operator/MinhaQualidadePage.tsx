import { useEffect, useRef, useState } from 'react';
import { useMinhaQualidade, inicioDoMes, mesAnteriorDe } from '../../features/qualidade/useMinhaQualidade';
import type { RelatorioQualidade } from '../../features/qualidade/useRelatoriosQualidade';
import {
  diasEntre,
  hojeIso,
  normalizarNome,
  rankingCategorias,
  reincidencias,
} from '../../features/qualidade/analiseQualidade';
import { COR, COR_GRAVIDADE, fmt } from '../admin/qualidade/graficos';

// Aba "Qualidade" do operador: a própria nota, a evolução, pontos fortes, o
// que melhorar, falhas repetidas, um desafio e os relatórios — só dela.

const META_DESAFIO = 3;
const JANELA_TOPICOS = 90;
const rotuloGravidade = { baixa: 'baixa', media: 'média', alta: 'alta' } as const;

function mediaDe(lista: RelatorioQualidade[]) {
  const notas = lista.flatMap((r) => (r.nota === null ? [] : [r.nota]));
  return notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null;
}

function nomeDoMes(iso: string) {
  const [a, m] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function MinhaQualidadePage() {
  const { relatorios, equipeMes, carregando, erro } = useMinhaQualidade();
  const [verTodos, setVerTodos] = useState(false);

  const hoje = hojeIso();
  const inicioMes = inicioDoMes(hoje);
  const inicioMesAnterior = mesAnteriorDe(hoje);

  // Mais recente primeiro.
  const ordenados = [...relatorios].sort((a, b) => b.data_avaliacao.localeCompare(a.data_avaliacao));
  const doMes = ordenados.filter((r) => r.data_avaliacao >= inicioMes);
  const doMesAnterior = ordenados.filter((r) => r.data_avaliacao >= inicioMesAnterior && r.data_avaliacao < inicioMes);
  const recentes = ordenados.filter((r) => diasEntre(r.data_avaliacao, hoje) < JANELA_TOPICOS);
  const ultimos30 = ordenados.filter((r) => diasEntre(r.data_avaliacao, hoje) < 30);

  const notaMes = mediaDe(doMes);
  const notaAnterior = mediaDe(doMesAnterior);
  const ultimo = ordenados[0] ?? null;
  const notaPrincipal = notaMes ?? ultimo?.nota ?? null;

  const forcas = rankingCategorias(recentes, 'positivo').slice(0, 4);
  const melhorias = rankingCategorias(recentes, 'melhoria').slice(0, 5);
  const repetidas = reincidencias(ultimos30, 30);

  // Sequência de avaliações sem falha de gravidade alta (a atual e a melhor).
  const semGrave = [...ordenados].reverse().map((r) => !r.topicos.some((t) => t.tipo === 'melhoria' && t.gravidade === 'alta'));
  let melhorSeq = 0;
  let corrente = 0;
  for (const ok of semGrave) {
    corrente = ok ? corrente + 1 : 0;
    melhorSeq = Math.max(melhorSeq, corrente);
  }
  const seqAtual = corrente;

  // Desafio: a falha mais frequente dos últimos 90 dias; progresso = avaliações
  // seguidas, desde a última vez que ela apareceu, sem ela.
  const alvo = melhorias[0]?.categoria ?? null;
  let progresso = 0;
  if (alvo) {
    for (const r of ordenados) {
      if (r.topicos.some((t) => t.tipo === 'melhoria' && normalizarNome(t.categoria) === normalizarNome(alvo))) break;
      progresso++;
    }
  }

  if (carregando) return <p className="text-sm text-slate-400">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">Qualidade</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">Minha qualidade</h1>
        </div>
        {ordenados.length > 0 && (
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">{nomeDoMes(hoje)}</span>
        )}
      </div>

      {erro && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {!erro && ordenados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-display text-lg font-semibold text-tinta">Sua primeira avaliação vai aparecer aqui</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Quando a supervisão avaliar seus atendimentos, você vê aqui sua nota, seus pontos fortes e o que dá para melhorar.
          </p>
        </div>
      ) : (
        ordenados.length > 0 && (
          <>
            {/* Nota */}
            <div className="flex items-center gap-5 rounded-xl border border-slate-200 bg-white p-5">
              <Anel nota={notaPrincipal} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  {notaMes !== null ? `Nota de ${nomeDoMes(hoje).toLowerCase()}` : 'Última avaliação'}
                </p>
                {notaMes !== null && notaAnterior !== null ? (
                  <Variacao atual={notaMes} anterior={notaAnterior} mes={nomeDoMes(inicioMesAnterior).toLowerCase()} />
                ) : notaMes === null && ultimo ? (
                  <p className="mt-1 text-sm text-slate-500">Ainda sem avaliação neste mês · última em {fmt.data(ultimo.data_avaliacao)}</p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    {doMes.length} avaliação{doMes.length === 1 ? '' : 'ões'} neste mês
                  </p>
                )}
                {equipeMes?.media != null && notaMes !== null && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="text-xs text-slate-500">Média da sua equipe neste mês: {fmt.nota(equipeMes.media)}</p>
                    <p className="text-sm font-medium text-tinta">
                      {notaMes - equipeMes.media > 0.05
                        ? 'Você está acima da média'
                        : notaMes - equipeMes.media < -0.05
                          ? 'Você está abaixo da média'
                          : 'Você está na média da equipe'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Evolução */}
            <Cartao titulo="Sua evolução" detalhe={`últimas ${Math.min(8, ordenados.length)} avaliações`}>
              <Evolucao relatorios={ordenados.slice(0, 8).reverse()} referencia={equipeMes?.media ?? null} />
            </Cartao>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Pontos fortes */}
              <Cartao titulo="Seus pontos fortes" detalhe="últimos 90 dias" icone="★" corIcone={COR.positivo}>
                {forcas.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum ponto positivo registrado no período.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {forcas.map((f) => (
                      <LinhaBarra key={f.categoria} rotulo={f.categoria} valor={f.total} maximo={forcas[0].total} cor={COR.positivo} />
                    ))}
                  </ul>
                )}
              </Cartao>

              {/* Sequência */}
              <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-xl font-semibold ${
                    seqAtual > 0 ? 'bg-esmeralda-light text-esmeralda-dark' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {seqAtual}
                </div>
                <div>
                  <p className="font-medium text-tinta">
                    {seqAtual === 0
                      ? 'A última avaliação teve falha grave'
                      : `${seqAtual === 1 ? 'Avaliação' : 'Avaliações'} seguida${seqAtual === 1 ? '' : 's'} sem falha grave`}
                  </p>
                  <p className="text-xs text-slate-500">
                    {seqAtual === 0 ? 'A próxima já começa uma nova sequência.' : `Seu melhor resultado: ${melhorSeq}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Onde melhorar */}
            <h2 className="pt-2 font-display text-lg font-semibold text-tinta">Onde melhorar</h2>

            {repetidas.map((r) => (
              <div key={r.categoria} className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-red-800">
                  <span aria-hidden>⚠</span> Falha repetida
                </p>
                <p className="mt-1 text-sm text-red-800">
                  "{r.categoria}" apareceu em {r.ocorrencias.length} avaliações nos últimos 30 dias (
                  {r.ocorrencias.map(fmt.dataCurta).join(', ')}).
                </p>
              </div>
            ))}

            <Cartao titulo="Pontos de melhoria" detalhe="últimos 90 dias">
              {melhorias.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum ponto de melhoria nos últimos 90 dias. Continue assim.</p>
              ) : (
                <ul className="space-y-3">
                  {melhorias.map((m) => {
                    const maisGrave = m.gravidade.alta ? 'alta' : m.gravidade.media ? 'media' : m.gravidade.baixa ? 'baixa' : null;
                    return (
                      <li key={m.categoria}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-tinta">{m.categoria}</span>
                          <span className="shrink-0 rounded-full bg-[#FDEEE4] px-2 py-0.5 text-xs text-[#8A3712]">
                            {maisGrave ? `${rotuloGravidade[maisGrave]} · ` : ''}
                            {m.total}×
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${(m.total / melhorias[0].total) * 100}%`,
                              background: maisGrave ? COR_GRAVIDADE[maisGrave] : COR.melhoria,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Cartao>

            {alvo && (
              <Cartao titulo="Desafio" icone="◎" corIcone={COR.linha}>
                <p className="text-sm text-slate-600">
                  Ficar {META_DESAFIO} avaliações seguidas sem <strong className="font-medium text-tinta">"{alvo}"</strong>
                </p>
                <div className="mt-3 flex gap-1.5">
                  {Array.from({ length: META_DESAFIO }, (_, i) => (
                    <div key={i} className={`h-2 flex-1 rounded-full ${i < progresso ? 'bg-esmeralda' : 'bg-slate-200'}`} />
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {progresso >= META_DESAFIO
                    ? 'Desafio cumprido. Mandou bem!'
                    : `${progresso} de ${META_DESAFIO} avaliações`}
                </p>
              </Cartao>
            )}

            {/* Último relatório e lista */}
            {ultimo && (
              <Cartao titulo={verTodos ? 'Todos os relatórios' : 'Último relatório'}>
                <ul className="divide-y divide-slate-100">
                  {(verTodos ? ordenados : [ultimo]).map((r) => (
                    <ItemRelatorio key={r.id} relatorio={r} />
                  ))}
                </ul>
                {ordenados.length > 1 && (
                  <button onClick={() => setVerTodos(!verTodos)} className="mt-3 text-sm font-medium text-ceruleo hover:underline">
                    {verTodos ? 'Mostrar só o último' : `Ver todos os relatórios (${ordenados.length}) →`}
                  </button>
                )}
              </Cartao>
            )}
          </>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Cartao({
  titulo,
  detalhe,
  icone,
  corIcone,
  children,
}: {
  titulo: string;
  detalhe?: string;
  icone?: string;
  corIcone?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-medium text-tinta">
          {icone && (
            <span className="mr-1.5" style={{ color: corIcone }} aria-hidden>
              {icone}
            </span>
          )}
          {titulo}
        </h3>
        {detalhe && <span className="text-xs text-slate-400">{detalhe}</span>}
      </div>
      {children}
    </section>
  );
}

function Anel({ nota }: { nota: number | null }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const fracao = nota === null ? 0 : Math.max(0, Math.min(1, nota / 10));
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0" role="img" aria-label={`Nota ${fmt.nota(nota)} de 10`}>
      <circle cx="48" cy="48" r={r} fill="none" stroke="#E6F1EC" strokeWidth="9" />
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke={COR.positivo}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${fracao * c} ${c}`}
        transform="rotate(-90 48 48)"
        className="transition-[stroke-dasharray] duration-700"
      />
      <text x="48" y="47" textAnchor="middle" dominantBaseline="middle" className="font-display" fontSize="24" fontWeight={600} fill="#101F38">
        {fmt.nota(nota)}
      </text>
      <text x="48" y="66" textAnchor="middle" fontSize="11" fill={COR.textoMudo}>
        de 10
      </text>
    </svg>
  );
}

function Variacao({ atual, anterior, mes }: { atual: number; anterior: number; mes: string }) {
  const diff = atual - anterior;
  if (Math.abs(diff) < 0.05) return <p className="mt-1 text-sm text-slate-500">= igual a {mes}</p>;
  return (
    <p className={`mt-1 text-sm font-medium ${diff > 0 ? 'text-[#0F7A3D]' : 'text-[#B42318]'}`}>
      {diff > 0 ? '▲' : '▼'} {fmt.dec(Math.abs(diff))} <span className="font-normal text-slate-500">vs {mes}</span>
    </p>
  );
}

function LinhaBarra({ rotulo, valor, maximo, cor }: { rotulo: string; valor: number; maximo: number; cor: string }) {
  return (
    <li>
      <div className="flex justify-between gap-2 text-sm">
        <span className="truncate text-tinta">{rotulo}</span>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-tinta">{valor}×</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
        <div className="h-1.5 rounded-full" style={{ width: `${(valor / Math.max(1, maximo)) * 100}%`, background: cor }} />
      </div>
    </li>
  );
}

// Uma bolinha por avaliação (mais antiga à esquerda), com a média da equipe
// do mês como linha de referência.
function Evolucao({ relatorios, referencia }: { relatorios: RelatorioQualidade[]; referencia: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  const pontos = relatorios.flatMap((r) => (r.nota === null ? [] : [{ data: r.data_avaliacao, nota: r.nota }]));
  if (pontos.length === 0) return <p className="text-sm text-slate-400">Sem notas ainda.</p>;
  return <div ref={ref}>{largura > 0 && <EvolucaoSvg pontos={pontos} referencia={referencia} largura={largura} />}</div>;
}

function EvolucaoSvg({
  pontos,
  referencia,
  largura,
}: {
  pontos: { data: string; nota: number }[];
  referencia: number | null;
  largura: number;
}) {
  const altura = 150;
  const m = { l: 16, r: 16, t: 24, b: 24 };
  const w = largura - m.l - m.r;
  const h = altura - m.t - m.b;
  const valores = [...pontos.map((p) => p.nota), ...(referencia !== null ? [referencia] : [])];
  const min = Math.max(0, Math.floor(Math.min(...valores)) - 1);
  const max = Math.min(10, Math.ceil(Math.max(...valores)) + 1);
  const x = (i: number) => m.l + (pontos.length === 1 ? w / 2 : (i / (pontos.length - 1)) * w);
  const y = (v: number) => m.t + (1 - (v - min) / (max - min || 1)) * h;
  const caminho = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.nota)}`).join(' ');
  const ultimo = pontos.length - 1;
  return (
    <svg width={largura} height={altura} role="img" aria-label="Notas das suas últimas avaliações">
      <line x1={m.l} x2={m.l + w} y1={m.t + h} y2={m.t + h} stroke={COR.eixo} />
      {referencia !== null && (
        <g>
          <line x1={m.l} x2={m.l + w} y1={y(referencia)} y2={y(referencia)} stroke={COR.textoMudo} strokeOpacity={0.5} />
          <text x={m.l} y={y(referencia) - 6} fontSize={12} fill={COR.textoMudo} stroke="#fff" strokeWidth={3} paintOrder="stroke">
            equipe {fmt.nota(referencia)}
          </text>
        </g>
      )}
      {pontos.length > 1 && <path d={caminho} fill="none" stroke={COR.linha} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {pontos.map((p, i) => (
        <g key={`${p.data}-${i}`}>
          <circle cx={x(i)} cy={y(p.nota)} r={i === ultimo ? 6 : 4.5} fill={COR.linha} stroke="#fff" strokeWidth={2}>
            <title>{`${fmt.data(p.data)}: ${fmt.nota(p.nota)}`}</title>
          </circle>
          {(i === ultimo || pontos.length <= Math.floor(largura / 48)) && (
            <text x={x(i)} y={y(p.nota) - 11} textAnchor="middle" fontSize={12} fontWeight={i === ultimo ? 700 : 500} fill="#101F38">
              {fmt.nota(p.nota)}
            </text>
          )}
          {(i === 0 || i === ultimo || pontos.length <= Math.floor(largura / 48)) && (
            <text x={x(i)} y={altura - 6} textAnchor="middle" fontSize={11} fill={COR.textoMudo}>
              {fmt.dataCurta(p.data)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function ItemRelatorio({ relatorio: r }: { relatorio: RelatorioQualidade }) {
  const positivos = r.topicos.filter((t) => t.tipo === 'positivo');
  const melhorias = r.topicos.filter((t) => t.tipo === 'melhoria');
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-slate-500">
          {fmt.data(r.data_avaliacao)}
          {r.avaliador && ` · ${r.avaliador}`}
          {r.periodo && ` · ${r.periodo}`}
        </p>
        <span className="font-display text-xl font-semibold tabular-nums text-tinta">{fmt.nota(r.nota)}</span>
      </div>
      {r.resumo && <p className="mt-1.5 text-sm leading-relaxed text-tinta">{r.resumo}</p>}
      {(positivos.length > 0 || melhorias.length > 0) && (
        <ul className="mt-3 space-y-2">
          {positivos.map((t, i) => (
            <TopicoLinha key={`p${i}`} tipo="positivo" categoria={t.categoria} descricao={t.descricao} exemplo={t.exemplo} />
          ))}
          {melhorias.map((t, i) => (
            <TopicoLinha
              key={`m${i}`}
              tipo="melhoria"
              categoria={t.categoria}
              descricao={t.descricao}
              exemplo={t.exemplo}
              gravidade={t.gravidade}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function TopicoLinha({
  tipo,
  categoria,
  descricao,
  exemplo,
  gravidade,
}: {
  tipo: 'positivo' | 'melhoria';
  categoria: string;
  descricao: string;
  exemplo: string | null;
  gravidade?: 'baixa' | 'media' | 'alta' | null;
}) {
  const positivo = tipo === 'positivo';
  return (
    <li className="flex gap-2.5">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          positivo ? 'bg-esmeralda-light text-esmeralda-dark' : 'bg-[#FDEEE4] text-[#8A3712]'
        }`}
        aria-label={positivo ? 'Ponto positivo' : 'Ponto de melhoria'}
      >
        {positivo ? '+' : '−'}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-tinta">
          {categoria}
          {gravidade && <span className="ml-1.5 text-xs font-normal text-[#8A3712]">gravidade {rotuloGravidade[gravidade]}</span>}
        </p>
        <p className="text-sm text-slate-600">{descricao}</p>
        {exemplo && <p className="mt-0.5 text-xs italic text-slate-400">{exemplo}</p>}
      </div>
    </li>
  );
}
