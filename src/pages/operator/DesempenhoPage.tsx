import { useState } from 'react';
import { useMeuFechamento, type MeuFechamento } from '../../features/ganhos/useMeuFechamento';
import { dataBr, mesAtual, moeda, nomeDoMes } from '../../lib/formatoPortal';
import { SeletorMes } from '../../components/SeletorMes';

const COR = '#2F9BD6';
const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function diasDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => `${a}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
}

function diaDaSemana(dia: string) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

// Aba "Desempenho": meus FTDs do mês (calendário e comparação), vendas
// rejeitadas e os números da minha equipe (sem valores individuais).
export function DesempenhoPage() {
  const [mes, setMes] = useState(mesAtual());
  const { dados, carregando, erro } = useMeuFechamento(`${mes}-01`);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">Desempenho</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">Meus FTDs</h1>
      </div>
      <SeletorMes valor={mes} onMudar={setMes} />
      {erro && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {carregando && !dados && <p className="text-sm text-slate-400">Carregando...</p>}
      {dados && (
        <>
          <MeusFtds dados={dados} />
          <Rejeitadas dados={dados} />
          <MinhaEquipe dados={dados} />
        </>
      )}
    </div>
  );
}

function Indicador({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="mt-1 font-display text-xl font-semibold text-tinta">{valor}</p>
      {detalhe && <p className="text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

function MeusFtds({ dados }: { dados: MeuFechamento }) {
  const porDia = new Map(dados.meusDias.map((d) => [d.dia, d.ftds]));
  const total = dados.meusDias.reduce((s, d) => s + d.ftds, 0);
  const diasComVenda = dados.meusDias.filter((d) => d.ftds > 0).length;
  const melhor = [...dados.meusDias].sort((a, b) => b.ftds - a.ftds)[0];
  const anterior = dados.ftdsMesAnterior;
  const variacao = anterior ? Math.round(((total - anterior) / anterior) * 100) : null;
  const maximo = Math.max(1, ...dados.meusDias.map((d) => d.ftds));
  const dias = diasDoMes(dados.mes);
  const vazios = (diaDaSemana(dias[0]) + 6) % 7;

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Indicador
          titulo="FTDs no mês"
          valor={String(total)}
          detalhe={
            anterior === null
              ? undefined
              : `${anterior} no mês anterior${variacao !== null ? ` (${variacao >= 0 ? '+' : ''}${variacao}%)` : ''}`
          }
        />
        <Indicador titulo="Dias com venda" valor={String(diasComVenda)} />
        <Indicador
          titulo="Melhor dia"
          valor={melhor && melhor.ftds > 0 ? `${melhor.ftds} FTDs` : '—'}
          detalhe={melhor && melhor.ftds > 0 ? `${diasSemana[diaDaSemana(melhor.dia)]} ${dataBr(melhor.dia).slice(0, 5)}` : undefined}
        />
        <Indicador titulo="Base até" valor={dados.ultimaData ? dataBr(dados.ultimaData).slice(0, 5) : '—'} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-tinta">📅 Meus FTDs por dia — {nomeDoMes(dados.mes)}</p>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">
          {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => (
            <span key={d} className="pb-1 font-medium text-slate-400">
              {d}
            </span>
          ))}
          {Array.from({ length: vazios }).map((_, i) => (
            <span key={`v${i}`} />
          ))}
          {dias.map((dia) => {
            const ftds = porDia.get(dia) ?? 0;
            return (
              <div
                key={dia}
                title={`${dataBr(dia)}: ${ftds} FTDs`}
                className="rounded-md border border-slate-200 px-1 py-1.5"
                style={{ background: ftds ? `rgba(47, 155, 214, ${0.1 + (ftds / maximo) * 0.45})` : '#ffffff' }}
              >
                <p className="text-[10px] text-slate-500">{Number(dia.slice(8))}</p>
                <p className="font-semibold text-tinta">{ftds || '–'}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Rejeitadas({ dados }: { dados: MeuFechamento }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-tinta">Minhas vendas rejeitadas</p>
      <p className="text-xs text-slate-400">Vendas reprovadas na conferência — não contam como FTD.</p>
      {dados.rejeitadas.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Nenhuma venda rejeitada neste mês. 👏</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {dados.rejeitadas.map((r, i) => (
            <li key={i} className="flex justify-between py-1.5 text-slate-600">
              <span>
                {dataBr(r.dia)} às {r.hora}
              </span>
              <span className="text-slate-400">cliente {r.cliente ?? '—'}</span>
            </li>
          ))}
        </ul>
      )}
      {dados.rejeitadas.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">Se achar que alguma foi rejeitada por engano, fale com o administrador.</p>
      )}
    </section>
  );
}

// Equipe: só números agregados (FTDs da equipe e o valor dividido no dia).
function MinhaEquipe({ dados }: { dados: MeuFechamento }) {
  const [hover, setHover] = useState<string | null>(null);
  if (!dados.equipe) return null;
  const { nome, ativos, porDia } = dados.equipe;
  const totalFtds = porDia.reduce((s, d) => s + d.ftds, 0);
  const meusFtds = dados.meusDias.reduce((s, d) => s + d.ftds, 0);
  const dias = diasDoMes(dados.mes).filter((d) => !dados.ultimaData || d <= dados.ultimaData);
  const valor = (dia: string) => porDia.find((d) => d.dia === dia);
  const maximo = Math.max(1, ...porDia.map((d) => d.ftds));
  const altura = 120;
  const destaque = hover ? valor(hover) : null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-tinta">Minha equipe ({nome})</h2>
      <div className="grid grid-cols-3 gap-3">
        <Indicador titulo="FTDs da equipe" valor={String(totalFtds)} />
        <Indicador titulo="Ativos" valor={String(ativos)} />
        <Indicador
          titulo="Minha parte"
          valor={totalFtds ? `${Math.round((meusFtds / totalFtds) * 100)}%` : '—'}
          detalhe="dos FTDs da equipe"
        />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-tinta">FTDs da equipe por dia</p>
        <p className="mt-1 min-h-5 text-xs text-slate-600" aria-live="polite">
          {hover ? (
            <>
              <span className="font-medium text-tinta">
                {diasSemana[diaDaSemana(hover)]} {dataBr(hover).slice(0, 5)}:
              </span>{' '}
              {destaque?.ftds ?? 0} FTDs · valor do dia {moeda(destaque?.valor ?? 0)}
            </>
          ) : (
            <span className="text-slate-400">Toque em um dia para ver os valores.</span>
          )}
        </p>
        <div className="mt-2 flex items-end gap-px" style={{ height: altura }}>
          {dias.map((dia) => {
            const d = valor(dia);
            const ativo = hover === dia;
            return (
              <button
                key={dia}
                type="button"
                onPointerEnter={() => setHover(dia)}
                onFocus={() => setHover(dia)}
                onClick={() => setHover(dia)}
                aria-label={`${dataBr(dia)}: ${d?.ftds ?? 0} FTDs`}
                className="flex h-full min-w-0 flex-1 items-end"
              >
                <span
                  className="block w-full rounded-t-sm"
                  style={{
                    height: `${((d?.ftds ?? 0) / maximo) * 100}%`,
                    background: COR,
                    opacity: hover && !ativo ? 0.55 : 1,
                  }}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-[10px] text-slate-400">
          <span>{dias[0] ? dataBr(dias[0]).slice(0, 5) : ''}</span>
          <span>{dias.length ? dataBr(dias[dias.length - 1]).slice(0, 5) : ''}</span>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Nos dias úteis, o valor do dia é dividido entre os ativos da equipe; no fim de semana, entre quem vendeu no dia.
        </p>
      </div>
    </section>
  );
}
