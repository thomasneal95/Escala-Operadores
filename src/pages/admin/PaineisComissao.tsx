import { useMemo, useState } from 'react';
import type { DadosFechamento } from '../../features/schedules/useFechamentoMensal';

// Painéis do comissionamento — espelham as abas Dashboard, Insights e
// Projeção de FTDs da planilha. Tudo sai do mesmo cálculo do fechamento.

// Paleta categórica (validada para daltonismo nos pares vizinhos). A cor
// segue a equipe pela ordem alfabética do mês, nunca pelo ranking.
const CORES_EQUIPES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const COR_UNICA = '#2a78d6';
const SUPERFICIE = '#ffffff';

const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

function dataCurta(dia: string) {
  const [, m, d] = dia.split('-');
  return `${d}/${m}`;
}

function diaDaSemana(dia: string) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

function diasDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => `${a}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
}

// Semanas de segunda a domingo dentro do mês.
function semanasDoMes(mes: string) {
  const semanas: string[][] = [];
  for (const dia of diasDoMes(mes)) {
    if (semanas.length === 0 || diaDaSemana(dia) === 1) semanas.push([]);
    semanas[semanas.length - 1].push(dia);
  }
  return semanas;
}

export function PaineisComissao({ dados }: { dados: DadosFechamento }) {
  const { linhas, paineis } = dados;
  const equipes = useMemo(
    () => [...new Set([...paineis.porEquipe.map((e) => e.equipe), ...paineis.comissaoPorEquipeEDia.map((c) => c.equipe)])].sort(),
    [paineis]
  );
  const corDaEquipe = (equipe: string) => CORES_EQUIPES[equipes.indexOf(equipe) % CORES_EQUIPES.length];
  const semanas = useMemo(() => semanasDoMes(dados.mes), [dados.mes]);

  const [filtroEquipe, setFiltroEquipe] = useState('Todas');
  const [filtroSemana, setFiltroSemana] = useState(-1);

  const diasVisiveis = filtroSemana >= 0 ? semanas[filtroSemana] ?? [] : diasDoMes(dados.mes);
  const equipesVisiveis = filtroEquipe === 'Todas' ? equipes : equipes.filter((e) => e === filtroEquipe);

  const colaboradores = linhas.filter((l) => l.tipo === 'colaborador' || l.tipo === 'individual');
  const soma = (campo: 'salario_total' | 'comissao_equipe' | 'comissao_fds' | 'auxilio' | 'adiantamento') =>
    linhas.reduce((s, l) => s + l[campo], 0);
  const ftdsNoMes = colaboradores.reduce((s, l) => s + l.ftds, 0);

  const porEquipe = equipes.map((equipe) => {
    const daEquipe = colaboradores.filter((l) => l.equipe === equipe);
    const extra = paineis.porEquipe.find((p) => p.equipe === equipe);
    const diasUteis = daEquipe.reduce((s, l) => s + l.comissao_equipe, 0);
    const fds = daEquipe.reduce((s, l) => s + l.comissao_fds, 0);
    const rejeitados = extra?.rejeitados ?? 0;
    const ftds = extra?.ftds ?? 0;
    return {
      equipe,
      diasUteis,
      fds,
      total: diasUteis + fds,
      ativos: extra?.ativos ?? 0,
      rejeitados,
      pctRejeicao: rejeitados + ftds > 0 ? rejeitados / (rejeitados + ftds) : 0,
    };
  });

  const rankingComissao = [...colaboradores]
    .filter((l) => l.comissao_propria > 0)
    .sort((a, b) => b.comissao_propria - a.comissao_propria);
  const rankingFtds = [...colaboradores].filter((l) => l.ftds > 0).sort((a, b) => b.ftds - a.ftds);

  return (
    <div className="space-y-8">
      {/* Filtros — uma linha acima dos gráficos */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-700">
          Semana
          <select
            value={filtroSemana}
            onChange={(e) => setFiltroSemana(Number(e.target.value))}
            className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value={-1}>Todas</option>
            {semanas.map((s, i) => (
              <option key={s[0]} value={i}>
                Semana {i + 1} ({dataCurta(s[0])}–{dataCurta(s[s.length - 1])})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Equipe
          <select
            value={filtroEquipe}
            onChange={(e) => setFiltroEquipe(e.target.value)}
            className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option>Todas</option>
            {equipes.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-400">Os filtros valem para o gráfico de comissão por dia; a semana também é destacada no calendário.</p>
      </div>

      {/* Indicadores */}
      <section>
        <h2 className="font-display text-lg font-semibold text-tinta">Dashboard</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Indicador titulo="Folha total" valor={moeda(soma('salario_total'))} />
          <Indicador titulo="Com. dias úteis" valor={moeda(soma('comissao_equipe'))} />
          <Indicador titulo="Com. FDS" valor={moeda(soma('comissao_fds'))} />
          <Indicador titulo="Auxílio" valor={moeda(soma('auxilio'))} />
          <Indicador titulo="Adiantamentos" valor={moeda(soma('adiantamento'))} />
          <Indicador titulo="FTDs no mês" valor={String(ftdsNoMes)} />
          <Indicador titulo="Ativos" valor={String(paineis.ativos)} />
          <Indicador titulo="Base até" valor={dados.ultimaData ? dataCurta(dados.ultimaData) : '—'} />
          <Indicador titulo="Rejeitados no mês" valor={String(paineis.rejeitadosNoMes)} />
        </div>
      </section>

      {/* Por equipe */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white lg:col-span-2">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                {['Equipe', 'Com. dias úteis', 'Com. FDS', 'Total', 'Ativos', 'Rejeitados', '% rejeição'].map((t) => (
                  <th key={t} className="whitespace-nowrap px-3 py-2 font-medium">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {porEquipe.map((e) => (
                <tr key={e.equipe}>
                  <td className="px-3 py-2 font-medium text-tinta">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: corDaEquipe(e.equipe) }} />
                    {e.equipe}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{moeda(e.diasUteis)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{moeda(e.fds)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-tinta">{moeda(e.total)}</td>
                  <td className="px-3 py-2">{e.ativos}</td>
                  <td className="px-3 py-2">{e.rejeitados}</td>
                  <td className="px-3 py-2">{(e.pctRejeicao * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-tinta">Rejeitados por operador</p>
          {paineis.rejeitadosPorOperador.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Nenhuma venda rejeitada no mês.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {paineis.rejeitadosPorOperador.map((r) => (
                <li key={r.operador} className="flex justify-between text-slate-600">
                  <span>
                    {r.operador}
                    {r.equipe && <span className="text-slate-400"> · {r.equipe}</span>}
                  </span>
                  <span className="font-medium text-tinta">{r.qtd}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <ComissaoPorDia
        dias={diasVisiveis}
        equipes={equipesVisiveis}
        corDaEquipe={corDaEquipe}
        valores={paineis.comissaoPorEquipeEDia}
        ultimaData={dados.ultimaData}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Ranking
          titulo="Ranking — comissão própria (US$)"
          itens={rankingComissao.map((l) => ({ nome: l.nome, valor: l.comissao_propria, rotulo: moeda(l.comissao_propria) }))}
        />
        <Ranking
          titulo="FTDs por colaborador (mês)"
          itens={rankingFtds.map((l) => ({ nome: l.nome, valor: l.ftds, rotulo: String(l.ftds) }))}
        />
      </section>

      <Insights
        dados={dados}
        ftdsNoMes={ftdsNoMes}
        rankingFtds={rankingFtds}
        rankingComissao={rankingComissao}
        porEquipe={porEquipe}
        semanaFiltrada={filtroSemana >= 0 ? diasVisiveis : null}
      />

      <Projecao dados={dados} />
    </div>
  );
}

function Indicador({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="mt-1 font-display text-xl font-semibold text-tinta">{valor}</p>
    </div>
  );
}

// Barras empilhadas por dia, um segmento por equipe.
function ComissaoPorDia({
  dias,
  equipes,
  corDaEquipe,
  valores,
  ultimaData,
}: {
  dias: string[];
  equipes: string[];
  corDaEquipe: (e: string) => string;
  valores: { dia: string; equipe: string; valor: number }[];
  ultimaData: string | null;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [verTabela, setVerTabela] = useState(false);

  const valor = (dia: string, equipe: string) =>
    valores.find((v) => v.dia === dia && v.equipe === equipe)?.valor ?? 0;
  const totais = dias.map((d) => equipes.reduce((s, e) => s + valor(d, e), 0));
  const maximo = Math.max(1, ...totais);
  const altura = 180;
  const largura = 28;
  const espaco = 6;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-tinta">Comissão por dia e equipe (US$)</p>
        <button onClick={() => setVerTabela(!verTabela)} className="text-xs font-medium text-ceruleo hover:underline">
          {verTabela ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </div>
      {equipes.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
          {equipes.map((e) => (
            <span key={e} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: corDaEquipe(e) }} />
              Equipe {e}
            </span>
          ))}
        </div>
      )}

      {!verTabela && (
        <p className="mt-2 min-h-5 text-xs text-slate-600" aria-live="polite">
          {hover ? (
            <>
              <span className="font-medium text-tinta">
                {diasSemana[diaDaSemana(hover)]} {dataCurta(hover)}:
              </span>{' '}
              {equipes.map((e, i) => (
                <span key={e} className="mr-2 inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ background: corDaEquipe(e) }} />
                  {e} {moeda(valor(hover, e))}
                  {i === equipes.length - 1 && equipes.length > 1 && (
                    <span className="ml-1 text-slate-400">· total {moeda(equipes.reduce((s, x) => s + valor(hover, x), 0))}</span>
                  )}
                </span>
              ))}
            </>
          ) : (
            <span className="text-slate-400">Passe o mouse (ou toque) em um dia para ver os valores.</span>
          )}
        </p>
      )}

      {verTabela ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Dia</th>
                {equipes.map((e) => (
                  <th key={e} className="px-2 py-1 font-medium">
                    {e}
                  </th>
                ))}
                <th className="px-2 py-1 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {dias.map((d, i) => (
                <tr key={d}>
                  <td className="px-2 py-1">
                    {diasSemana[diaDaSemana(d)]} {dataCurta(d)}
                  </td>
                  {equipes.map((e) => (
                    <td key={e} className="px-2 py-1">
                      {valor(d, e).toFixed(2)}
                    </td>
                  ))}
                  <td className="px-2 py-1 font-medium">{totais[i].toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-1 overflow-x-auto">
          <svg
            width={dias.length * (largura + espaco) + 8}
            height={altura + 36}
            role="img"
            aria-label="Comissão por dia e equipe"
          >
            <line x1={0} x2={dias.length * (largura + espaco)} y1={altura} y2={altura} stroke="#e2e8f0" />
            {dias.map((d, i) => {
              const x = i * (largura + espaco) + 4;
              let y = altura;
              const fimDeSemana = [0, 6].includes(diaDaSemana(d));
              const semDados = !!ultimaData && d > ultimaData;
              return (
                <g
                  key={d}
                  onPointerEnter={() => setHover(d)}
                  onPointerLeave={() => setHover(null)}
                  tabIndex={0}
                  onFocus={() => setHover(d)}
                  onBlur={() => setHover(null)}
                >
                  <rect x={x - 3} y={0} width={largura + 6} height={altura + 30} fill="transparent" />
                  {equipes.map((e) => {
                    const v = valor(d, e);
                    if (v <= 0) return null;
                    const h = (v / maximo) * (altura - 8);
                    y -= h;
                    return (
                      <rect
                        key={e}
                        x={x}
                        y={y}
                        width={largura}
                        height={Math.max(h - 2, 1)}
                        rx={3}
                        fill={corDaEquipe(e)}
                        stroke={SUPERFICIE}
                        strokeWidth={1}
                      />
                    );
                  })}
                  <text
                    x={x + largura / 2}
                    y={altura + 14}
                    textAnchor="middle"
                    className={`text-[10px] ${semDados ? 'fill-slate-300' : fimDeSemana ? 'fill-ceruleo' : 'fill-slate-500'}`}
                  >
                    {d.slice(8)}
                  </text>
                  <text x={x + largura / 2} y={altura + 26} textAnchor="middle" className="fill-slate-400 text-[9px]">
                    {diasSemana[diaDaSemana(d)]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">
        Dias úteis: valor da equipe dividido entre os ativos. Sábado e domingo (em azul): dividido entre quem teve FTD no dia.
      </p>
    </section>
  );
}

function Ranking({ titulo, itens }: { titulo: string; itens: { nome: string; valor: number; rotulo: string }[] }) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-tinta">{titulo}</p>
      {itens.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">Sem dados no mês.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {itens.map((item, i) => (
            <li key={item.nome} className="grid grid-cols-[9rem_1fr_auto] items-center gap-2 text-xs" title={`${item.nome}: ${item.rotulo}`}>
              <span className="truncate text-slate-600">
                {i + 1}. {item.nome}
              </span>
              <span className="h-3 rounded-r" style={{ width: `${(item.valor / maximo) * 100}%`, background: COR_UNICA }} />
              <span className="font-medium text-tinta">{item.rotulo}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Insights({
  dados,
  ftdsNoMes,
  rankingFtds,
  rankingComissao,
  porEquipe,
  semanaFiltrada,
}: {
  dados: DadosFechamento;
  ftdsNoMes: number;
  rankingFtds: DadosFechamento['linhas'];
  rankingComissao: DadosFechamento['linhas'];
  porEquipe: { equipe: string; total: number }[];
  semanaFiltrada: string[] | null;
}) {
  const ftdsDoDia = new Map(dados.paineis.ftdsPorDia.map((f) => [f.dia, f.ftds]));
  const dias = diasDoMes(dados.mes);
  const maximo = Math.max(1, ...dados.paineis.ftdsPorDia.map((f) => f.ftds));

  // Grade de segunda a domingo.
  const vazios = (diaDaSemana(dias[0]) + 6) % 7;
  const celulas: (string | null)[] = [...Array(vazios).fill(null), ...dias];

  const melhorDia = [...dados.paineis.ftdsPorDia].sort((a, b) => b.ftds - a.ftds)[0];
  const diasUteisAteBase = dias.filter(
    (d) => (!dados.ultimaData || d <= dados.ultimaData) && ![0, 6].includes(diaDaSemana(d))
  ).length;
  const lider = [...porEquipe].sort((a, b) => b.total - a.total)[0];
  const comissoes = dados.linhas.reduce((s, l) => s + l.comissao_equipe + l.comissao_fds, 0);
  const medalhas = ['🥇', '🥈', '🥉'];

  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-tinta">Insights do mês</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-tinta">📅 Calendário de FTDs</p>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">
            {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => (
              <span key={d} className="pb-1 font-medium text-slate-400">
                {d}
              </span>
            ))}
            {celulas.map((dia, i) => {
              if (!dia) return <span key={`v${i}`} />;
              const ftds = ftdsDoDia.get(dia) ?? 0;
              const destacado = !semanaFiltrada || semanaFiltrada.includes(dia);
              const intensidade = ftds / maximo;
              return (
                <div
                  key={dia}
                  title={`${dataCurta(dia)}: ${ftds} FTDs`}
                  className={`rounded-md border px-1 py-1.5 ${destacado ? '' : 'opacity-30'}`}
                  style={{
                    borderColor: '#e2e8f0',
                    background: ftds ? `rgba(42, 120, 214, ${0.08 + intensidade * 0.45})` : '#ffffff',
                  }}
                >
                  <p className="text-[10px] text-slate-500">{Number(dia.slice(8))}</p>
                  <p className="font-semibold text-tinta">{ftds || '–'}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-tinta">🏆 Pódio — Top 3 FTDs</p>
            <ul className="mt-2 space-y-1 text-sm">
              {rankingFtds.slice(0, 3).map((l, i) => (
                <li key={l.chave} className="flex justify-between text-slate-700">
                  <span>
                    {medalhas[i]} {l.nome}
                  </span>
                  <span>
                    <span className="font-semibold text-tinta">{l.ftds} FTDs</span>
                    <span className="text-slate-400"> · {moeda(l.comissao_propria)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="font-medium text-tinta">💡 Resumo automático</p>
            <ul className="mt-2 space-y-1">
              {rankingComissao[0] && (
                <li>
                  💰 Maior comissão própria: {rankingComissao[0].nome} — {moeda(rankingComissao[0].comissao_propria)}
                </li>
              )}
              {melhorDia && (
                <li>
                  📈 Melhor dia do mês: {diasSemana[diaDaSemana(melhorDia.dia)]} {dataCurta(melhorDia.dia)} — {melhorDia.ftds} FTDs
                </li>
              )}
              {diasUteisAteBase > 0 && (
                <li>⚡ Média de {(ftdsNoMes / diasUteisAteBase).toFixed(1).replace('.', ',')} FTDs por dia útil</li>
              )}
              {lider && lider.total > 0 && (
                <li>
                  🚀 Equipe {lider.equipe} lidera — {moeda(lider.total)} em comissões
                </li>
              )}
              <li>
                📊 {dados.paineis.ativos} colaboradores ativos geraram {moeda(comissoes)} em comissões
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// Projeção de FTDs: run-rate pelos dias completos (o último dia da base é
// considerado parcial), como na aba Projeção da planilha.
function Projecao({ dados }: { dados: DadosFechamento }) {
  const dias = diasDoMes(dados.mes);
  const ftdsDoDia = new Map(dados.paineis.ftdsPorDia.map((f) => [f.dia, f.ftds]));

  if (!dados.ultimaData) return null;

  const ultimoCompleto = dias.filter((d) => d < dados.ultimaData!).pop() ?? null;
  const decorridos = ultimoCompleto ? dias.indexOf(ultimoCompleto) + 1 : 0;
  const restantes = dias.length - decorridos;
  const realizados = dias.slice(0, decorridos).reduce((s, d) => s + (ftdsDoDia.get(d) ?? 0), 0);
  const media = decorridos > 0 ? realizados / decorridos : 0;
  const projetados = media * restantes;
  const maximo = Math.max(1, media, ...dias.map((d) => ftdsDoDia.get(d) ?? 0));
  const altura = 140;

  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-tinta">Projeção de FTDs</h2>
      <p className="text-xs text-slate-400">
        Média dos dias completos (o último dia da base conta como parcial) projetada para os dias restantes.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Indicador titulo="Realizados (dias completos)" valor={String(realizados)} />
        <Indicador titulo="Média diária" valor={media.toFixed(1).replace('.', ',')} />
        <Indicador titulo={`Projetados (${restantes} dias)`} valor={Math.round(projetados).toString()} />
        <Indicador titulo="Projeção total do mês" valor={Math.round(realizados + projetados).toString()} />
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 flex gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COR_UNICA }} /> Realizado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed" style={{ borderColor: COR_UNICA, background: 'rgba(42,120,214,0.15)' }} />{' '}
            Projeção
          </span>
        </div>
        <svg width={dias.length * 24 + 8} height={altura + 20} role="img" aria-label="FTDs realizados e projetados por dia">
          <line x1={0} x2={dias.length * 24} y1={altura} y2={altura} stroke="#e2e8f0" />
          {dias.map((d, i) => {
            const realizado = i < decorridos || d === dados.ultimaData;
            const valor = realizado ? ftdsDoDia.get(d) ?? 0 : media;
            const h = (valor / maximo) * (altura - 6);
            const x = i * 24 + 4;
            const parcial = d === dados.ultimaData;
            return (
              <g key={d}>
                <title>{`${dataCurta(d)}: ${realizado ? `${valor} FTDs${parcial ? ' (parcial)' : ''}` : `projeção ${valor.toFixed(1)}`}`}</title>
                <rect
                  x={x}
                  y={altura - h}
                  width={18}
                  height={Math.max(h, 1)}
                  rx={3}
                  fill={realizado && !parcial ? COR_UNICA : 'rgba(42,120,214,0.15)'}
                  stroke={realizado && !parcial ? 'none' : COR_UNICA}
                  strokeDasharray={realizado && !parcial ? undefined : '3 2'}
                />
                <text x={x + 9} y={altura + 14} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  {d.slice(8)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
