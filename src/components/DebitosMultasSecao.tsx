import type { SolicitacaoMultaAdmin } from '../features/multas/useSolicitacoesMultaAdmin';
import { valorAtualMulta, formatarReais, semanasEmAtraso } from '../lib/multasFinanceiro';

interface DebitosMultasSecaoProps {
  solicitacoes: SolicitacaoMultaAdmin[];
  processando: string | null;
  onMarcarComoPago: (id: string, pago: boolean) => void;
}

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function DebitosMultasSecao({
  solicitacoes,
  processando,
  onMarcarComoPago,
}: DebitosMultasSecaoProps) {
  const aprovadas = solicitacoes.filter(
    (s) => s.status === 'aprovada' && s.colaboradorFinalId && s.valorBase && s.dataVencimento
  );

  const porColaborador = new Map<string, { nome: string; multas: SolicitacaoMultaAdmin[] }>();
  for (const s of aprovadas) {
    const chave = s.colaboradorFinalId!;
    const grupo = porColaborador.get(chave) ?? { nome: s.colaboradorFinalNome ?? '(desconhecido)', multas: [] };
    grupo.multas.push(s);
    porColaborador.set(chave, grupo);
  }

  const linhas = [...porColaborador.entries()]
    .map(([colaboradorId, grupo]) => {
      const totalDevido = grupo.multas
        .filter((m) => !m.paga)
        .reduce((soma, m) => soma + valorAtualMulta(m.valorBase!, m.dataVencimento!, m.paga), 0);
      return { colaboradorId, ...grupo, totalDevido };
    })
    .sort((a, b) => b.totalDevido - a.totalDevido);

  if (linhas.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Nenhuma multa aprovada ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {linhas.map((linha) => (
        <div key={linha.colaboradorId} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-tinta">{linha.nome}</p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                linha.totalDevido > 0
                  ? 'bg-red-50 text-red-700'
                  : 'bg-esmeralda-light text-esmeralda-dark'
              }`}
            >
              {linha.totalDevido > 0 ? `Deve ${formatarReais(linha.totalDevido)}` : 'Em dia'}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {linha.multas.map((m) => {
              const valorAtual = valorAtualMulta(m.valorBase!, m.dataVencimento!, m.paga);
              const semanas = m.paga ? 0 : semanasEmAtraso(m.dataVencimento!);
              const emAtraso = !m.paga && semanas > 0;

              return (
                <div
                  key={m.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${
                    m.paga ? 'bg-slate-50' : emAtraso ? 'bg-red-50' : 'bg-slate-50'
                  }`}
                >
                  <div>
                    <span className="font-medium text-tinta">{formatarReais(valorAtual)}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      base {formatarReais(m.valorBase!)} · vencimento {formatarData(m.dataVencimento!)}
                      {emAtraso && ` · ${semanas} semana${semanas > 1 ? 's' : ''} de juros`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onMarcarComoPago(m.id, !m.paga)}
                    disabled={processando === m.id}
                    className={`rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                      m.paga
                        ? 'border-slate-300 text-slate-600 hover:bg-slate-100'
                        : 'border-esmeralda text-esmeralda-dark hover:bg-esmeralda-light'
                    }`}
                  >
                    {m.paga ? 'Desmarcar pagamento' : 'Marcar como pago'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
