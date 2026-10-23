import { useState } from 'react';
import { useMeuFechamento, type MeuFechamento } from '../../features/ganhos/useMeuFechamento';
import { useMeusRecibos, type Recibo } from '../../features/ganhos/useMeusRecibos';
import { useAuth } from '../../features/auth/AuthContext';
import { dataBr, mesAtual, moeda, nomeDoMes, tituloDoMes } from '../../lib/formatoPortal';
import { SeletorMes } from '../../components/SeletorMes';

// Aba "Meus ganhos": prévia do mês (mesmo cálculo do fechamento), como a
// comissão é calculada e os recibos dos meses fechados.
export function MeusGanhosPage() {
  const [mes, setMes] = useState(mesAtual());
  const { dados, carregando, erro } = useMeuFechamento(`${mes}-01`);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">Meus ganhos</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">Quanto vou receber</h1>
      </div>

      <SeletorMes valor={mes} onMudar={setMes} />

      {erro && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {carregando && !dados && <p className="text-sm text-slate-400">Calculando...</p>}
      {dados && <Previa dados={dados} />}
      {dados && <ComoFunciona dados={dados} />}
      <Recibos />
    </div>
  );
}

function Previa({ dados }: { dados: MeuFechamento }) {
  const l = dados.minhaLinha;
  const fechado = !!dados.arquivadoEm;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p
        className={`rounded-md px-3 py-2 text-xs ${
          fechado ? 'bg-esmeralda-light text-esmeralda-dark' : 'bg-amber-50 text-amber-800'
        }`}
      >
        {fechado
          ? `Mês fechado pelo administrador em ${new Date(dados.arquivadoEm as string).toLocaleDateString('pt-BR')}.`
          : `Prévia, sujeita a conferência. ${
              dados.ultimaData ? `Vendas consideradas até ${dataBr(dados.ultimaData)}.` : 'Ainda não há vendas deste mês no sistema.'
            } Os valores podem mudar até o fechamento.`}
      </p>

      {!dados.nomeNaBaseConfigurado && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Seu nome ainda não foi ligado à base de vendas, então suas vendas não aparecem. Avise o administrador.
        </p>
      )}

      {!l ? (
        <p className="mt-4 text-sm text-slate-500">Você não tem valores neste mês.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-slate-500">Total do mês ({nomeDoMes(dados.mes)})</p>
          <p className="font-display text-3xl font-semibold text-tinta">{moeda(l.salario_total)}</p>
          {l.total_a_pagar !== l.salario_total && (
            <p className="text-xs text-slate-500">
              No pagamento: {moeda(l.total_a_pagar)} (com acréscimo de{' '}
              {Math.round(dados.regras.taxa_total_a_pagar * 1000) / 10}%)
            </p>
          )}

          <table className="mt-4 w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <Linha rotulo="Auxílio" valor={l.auxilio} />
              <Linha rotulo="Comissão da equipe (dias úteis)" valor={l.comissao_equipe} />
              <Linha rotulo="Comissão de fim de semana" valor={l.comissao_fds} />
              <Linha rotulo="Comissão de infoprodutos" valor={l.comissao_infoprodutos} />
              {l.adiantamento > 0 && <Linha rotulo="(−) Adiantamento" valor={-l.adiantamento} />}
              {l.ja_pago > 0 && <Linha rotulo="(−) Já pago no acerto" valor={-l.ja_pago} />}
              <tr className="font-semibold text-tinta">
                <td className="py-2">Total</td>
                <td className="py-2 text-right tabular-nums">{moeda(l.salario_total)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400">{l.ftds} FTDs válidos no mês.</p>
        </>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <tr>
      <td className="py-2 text-slate-600">{rotulo}</td>
      <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums text-tinta">{moeda(valor)}</td>
    </tr>
  );
}

function ComoFunciona({ dados }: { dados: MeuFechamento }) {
  const r = dados.regras;
  const pct = Math.round(r.percentual_infoproduto * 1000) / 10;
  return (
    <details className="rounded-lg border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer font-display font-semibold text-tinta">Como minha comissão é calculada</summary>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
        <li>
          Cada <strong>FTD</strong> (venda confirmada ou aguardando) vale <strong>{moeda(r.valor_regra_nova)}</strong>, em dia útil
          e no fim de semana (desde {dataBr(r.inicio_regra_nova)}). Vendas <strong>rejeitadas</strong> não contam.
        </li>
        <li>
          <strong>Dias úteis:</strong> os FTDs de toda a equipe no dia formam um valor que é dividido igualmente entre os membros
          da equipe que já tiveram o primeiro FTD no mês. Quanto mais a equipe vende, mais todos ganham.
        </li>
        <li>
          <strong>Fim de semana:</strong> o valor dos FTDs da equipe no dia é dividido entre quem da equipe teve pelo menos um
          FTD naquele dia.
        </li>
        <li>
          <strong>Infoprodutos:</strong> cada venda gera {pct}% do valor, dividido entre todos da equipe de quem vendeu.
        </li>
        <li>
          <strong>Auxílio:</strong> valor mensal; quem entrou ou saiu no meio do mês recebe proporcional aos dias.
        </li>
        <li>
          Vendas antes das {String(r.hora_virada_dia).padStart(2, '0')}h contam para o dia anterior (turno da noite). Do total
          saem os adiantamentos.
        </li>
      </ul>
    </details>
  );
}

function Recibos() {
  const { recibos, carregando } = useMeusRecibos();
  const { perfil } = useAuth();
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-display font-semibold text-tinta">Meus recibos</h2>
      <p className="text-xs text-slate-400">Meses já fechados pelo administrador.</p>
      {carregando ? (
        <p className="mt-3 text-sm text-slate-400">Carregando...</p>
      ) : recibos.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nenhum mês fechado ainda.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {recibos.map((r) => (
            <li key={r.mes} className="py-2">
              <button
                onClick={() => setAberto(aberto === r.mes ? null : r.mes)}
                className="flex w-full items-center justify-between text-left text-sm"
              >
                <span className="font-medium text-tinta">{tituloDoMes(r.mes)}</span>
                <span className="tabular-nums text-tinta">
                  {moeda(r.salario_total)} <span className="text-slate-400">{aberto === r.mes ? '▴' : '▾'}</span>
                </span>
              </button>
              {aberto === r.mes && (
                <div className="mt-2 rounded-md bg-slate-50 p-3 text-sm">
                  <table className="w-full">
                    <tbody>
                      <Linha rotulo="Auxílio" valor={r.auxilio} />
                      <Linha rotulo="Comissão da equipe" valor={r.comissao_equipe} />
                      <Linha rotulo="Comissão de fim de semana" valor={r.comissao_fds} />
                      <Linha rotulo="Comissão de infoprodutos" valor={r.comissao_infoprodutos} />
                      {r.adiantamento > 0 && <Linha rotulo="(−) Adiantamento" valor={-r.adiantamento} />}
                    </tbody>
                  </table>
                  <button
                    onClick={() => imprimirRecibo(r, perfil?.nome_completo ?? '')}
                    className="mt-2 text-sm font-medium text-ceruleo hover:underline"
                  >
                    Imprimir / salvar em PDF
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Abre o recibo numa janela própria e chama a impressão (no celular e no
// computador dá para escolher "Salvar como PDF").
function imprimirRecibo(r: Recibo, nome: string) {
  const linhas: [string, number][] = [
    ['Auxílio', r.auxilio],
    ['Comissão da equipe (dias úteis)', r.comissao_equipe],
    ['Comissão de fim de semana', r.comissao_fds],
    ['Comissão de infoprodutos', r.comissao_infoprodutos],
    ...(r.adiantamento > 0 ? ([['(−) Adiantamento', -r.adiantamento]] as [string, number][]) : []),
  ];
  const janela = window.open('', '_blank', 'width=600,height=700');
  if (!janela) return;
  const doc = janela.document;
  doc.title = `Recibo ${nomeDoMes(r.mes)}`;
  const estilo = doc.createElement('style');
  estilo.textContent =
    'body{font-family:Arial,sans-serif;color:#101F38;padding:32px;max-width:520px;margin:auto}' +
    'h1{font-size:20px;margin:0}p{margin:4px 0;color:#475569}table{width:100%;border-collapse:collapse;margin-top:16px}' +
    'td{padding:8px 0;border-bottom:1px solid #e2e8f0}td:last-child{text-align:right}tfoot td{font-weight:bold;border:none}';
  doc.head.appendChild(estilo);
  const titulo = doc.createElement('h1');
  titulo.textContent = 'Recibo de comissões';
  const sub1 = doc.createElement('p');
  sub1.textContent = `${nome}${r.equipe ? ` · Equipe ${r.equipe}` : ''}`;
  const sub2 = doc.createElement('p');
  sub2.textContent = `Mês: ${nomeDoMes(r.mes)}${r.ftds !== null ? ` · ${r.ftds} FTDs` : ''}`;
  const tabela = doc.createElement('table');
  const corpo = doc.createElement('tbody');
  for (const [rotulo, valor] of linhas) {
    const tr = doc.createElement('tr');
    const a = doc.createElement('td');
    a.textContent = rotulo;
    const b = doc.createElement('td');
    b.textContent = moeda(valor);
    tr.append(a, b);
    corpo.appendChild(tr);
  }
  const rodape = doc.createElement('tfoot');
  const tr = doc.createElement('tr');
  const a = doc.createElement('td');
  a.textContent = 'Total';
  const b = doc.createElement('td');
  b.textContent = moeda(r.salario_total);
  tr.append(a, b);
  rodape.appendChild(tr);
  tabela.append(corpo, rodape);
  doc.body.append(titulo, sub1, sub2, tabela);
  janela.focus();
  janela.print();
}
