import type { DadosFechamento } from '../../features/schedules/useFechamentoMensal';

// Aba "Resumo João" da planilha: painel das vendas (FTDs) do João no mês,
// pago por FTD como operador externo.

const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const ordemSemana = [1, 2, 3, 4, 5, 6, 0];

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

function dataBr(data: string) {
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}

function diaDaSemana(dia: string) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function ResumoJoao({ dados }: { dados: DadosFechamento }) {
  const externos = dados.paineis.resumoExternos;
  const joao = externos.find((e) => e.nome.trim().toLowerCase() === 'joão') ?? externos[0];

  if (!joao) {
    return (
      <p className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600">
        Cadastre o João em "Operadores externos" (aba Fechamento do mês) com o valor por FTD para ver o resumo.
      </p>
    );
  }

  const valor = joao.valor_por_ftd;
  const registros = joao.registros;
  const total = registros.reduce((s, r) => s + r.qtd, 0);
  const confirmados = registros.filter((r) => r.etapa.toLowerCase() === 'confirmado').reduce((s, r) => s + r.qtd, 0);

  const porDia = new Map<string, number>();
  for (const r of registros) porDia.set(r.dia, (porDia.get(r.dia) ?? 0) + r.qtd);
  const dias = [...porDia.keys()].sort();
  const melhor = [...porDia.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  const porEtapa = new Map<string, number>();
  for (const r of registros) porEtapa.set(r.etapa, (porEtapa.get(r.etapa) ?? 0) + r.qtd);

  const porSemana = new Map<number, number>();
  for (const [dia, qtd] of porDia) porSemana.set(diaDaSemana(dia), (porSemana.get(diaDaSemana(dia)) ?? 0) + qtd);

  const linhaFechamento = dados.linhas.find((l) => l.tipo === 'externo' && l.nome === joao.nome);
  const comissaoInfo = linhaFechamento?.comissao_infoprodutos ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-tinta">Resumo de comissões — {joao.nome}</h2>
        <p className="text-sm text-slate-500">
          {dias.length > 0 ? `Período: ${dataBr(dias[0])} até ${dataBr(dias[dias.length - 1])}` : 'Sem registros no mês'} ·
          US$ {valor.toFixed(2).replace('.', ',')} por FTD, em qualquer dia
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao titulo="Comissão total (FTDs)" valor={moeda(total * valor)} destaque />
        <Cartao titulo="Total de registros" valor={String(total)} />
        <Cartao titulo="Confirmados" valor={String(confirmados)} />
        <Cartao titulo="Comissão confirmada" valor={moeda(confirmados * valor)} />
        <Cartao titulo="Comissão média / registro" valor={moeda(total ? valor : 0)} />
        <Cartao titulo="Dias com registro" valor={String(dias.length)} />
        <Cartao titulo="Melhor data" valor={melhor ? `${dataBr(melhor[0])} (${melhor[1]})` : '—'} />
        <Cartao titulo="Comissão no melhor dia" valor={moeda(melhor ? melhor[1] * valor : 0)} />
      </div>

      {comissaoInfo > 0 && (
        <p className="rounded-md bg-esmeralda-light px-4 py-3 text-sm text-esmeralda-dark">
          + {moeda(comissaoInfo)} de comissão de infoprodutos no mês (total no fechamento:{' '}
          {moeda(linhaFechamento?.salario_total ?? 0)}).
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tabela
          titulo="Comissão por etapa"
          cabecalho="Etapa"
          linhas={[...porEtapa.entries()].sort((a, b) => b[1] - a[1]).map(([etapa, qtd]) => [etapa, qtd, qtd * valor])}
          total={[total, total * valor]}
        />
        <Tabela
          titulo="Comissão por dia da semana"
          cabecalho="Dia da semana"
          linhas={ordemSemana.map((d) => [diasSemana[d], porSemana.get(d) ?? 0, (porSemana.get(d) ?? 0) * valor])}
          total={[total, total * valor]}
        />
        <Tabela
          titulo="Comissão por data"
          cabecalho="Data"
          linhas={dias.map((d) => [dataBr(d), porDia.get(d) ?? 0, (porDia.get(d) ?? 0) * valor])}
          total={[total, total * valor]}
        />
      </div>
    </div>
  );
}

function Cartao({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${destaque ? 'border-esmeralda/30 bg-esmeralda-light' : 'border-slate-200 bg-white'}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="mt-1 font-display text-xl font-semibold text-tinta">{valor}</p>
    </div>
  );
}

function Tabela({
  titulo,
  cabecalho,
  linhas,
  total,
}: {
  titulo: string;
  cabecalho: string;
  linhas: [string, number, number][];
  total: [number, number];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-tinta">{titulo}</p>
      <table className="mt-2 w-full text-sm">
        <thead className="text-xs text-slate-400">
          <tr>
            <th className="py-1 text-left font-medium">{cabecalho}</th>
            <th className="py-1 text-right font-medium">Registros</th>
            <th className="py-1 text-right font-medium">Comissão</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {linhas.map(([nome, qtd, valor]) => (
            <tr key={nome}>
              <td className="py-1.5 text-slate-700">{nome}</td>
              <td className="py-1.5 text-right text-slate-600">{qtd}</td>
              <td className="py-1.5 text-right text-tinta">{moeda(valor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-slate-200 font-semibold text-tinta">
          <tr>
            <td className="py-1.5">Total</td>
            <td className="py-1.5 text-right">{total[0]}</td>
            <td className="py-1.5 text-right">{moeda(total[1])}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
