import { useState } from 'react';
import { useMeuFechamento } from '../../features/ganhos/useMeuFechamento';
import { mesAtual, moeda } from '../../lib/formatoPortal';
import { SeletorMes } from '../../components/SeletorMes';
import { ResumoExterno } from '../admin/ResumoJoao';

// Aba "Meu comissionamento" do operador externo pago por FTD (ex.: João):
// o mesmo resumo que o admin vê na aba "Resumo João", só com os dados dele.
export function MeuComissionamentoExternoPage() {
  const [mes, setMes] = useState(mesAtual());
  const { dados, carregando, erro } = useMeuFechamento(`${mes}-01`);
  const linha = dados?.minhaLinha ?? null;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">Meu comissionamento</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">Quanto vou receber</h1>
      </div>

      <SeletorMes valor={mes} onMudar={setMes} max={mesAtual()} />

      {erro && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {carregando && !dados && <p className="text-sm text-slate-400">Calculando...</p>}
      {dados &&
        (dados.externo ? (
          <>
            {linha && (
              <div className="rounded-lg border border-esmeralda/30 bg-esmeralda-light p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-esmeralda-dark">Total a pagar no mês</p>
                <p className="mt-1 font-display text-3xl font-semibold text-tinta">{moeda(linha.total_a_pagar)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  FTDs + infoprodutos, já com a taxa de {(dados.regras.taxa_total_a_pagar * 100).toLocaleString('pt-BR')}%.
                  {dados.ultimaData && ` Base atualizada até ${dados.ultimaData.split('-').reverse().join('/')}.`}
                </p>
              </div>
            )}
            <ResumoExterno externo={dados.externo} linha={linha} />
          </>
        ) : (
          <p className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600">
            Seu acesso ainda não foi ligado ao seu nome na base de vendas. Avise o administrador.
          </p>
        ))}
    </div>
  );
}
