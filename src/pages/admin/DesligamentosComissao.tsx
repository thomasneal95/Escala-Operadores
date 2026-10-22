import { useState } from 'react';
import type { DadosFechamento, LinhaFechamento } from '../../features/schedules/useFechamentoMensal';
import { useAcertosDesligamento } from '../../features/schedules/useAcertosDesligamento';
import { useEquipes } from '../../features/teams/useEquipes';
import { useConfirm, useToast } from '../../components/FeedbackProvider';

// Aba "Desligamentos" do Comissionamento: acerto de quem saiu no mês —
// auxílio proporcional até o último dia, comissões até ele, menos o
// adiantamento. O pagamento fica registrado e é descontado no fechamento.

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

function dataBr(data: string | null) {
  if (!data) return '—';
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}

function somarDias(data: string, dias: number) {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

function diferencaDias(de: string, ate: string) {
  const [a1, m1, d1] = de.split('-').map(Number);
  const [a2, m2, d2] = ate.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

// Dias usados no auxílio proporcional (mesma regra do cálculo).
function diasDoAuxilio(mes: string, admissao: string | null, saida: string) {
  let ini = mes;
  while ([0, 6].includes(new Date(`${ini}T12:00:00Z`).getUTCDay())) ini = somarDias(ini, 1);
  const [a, m] = mes.split('-').map(Number);
  const fim = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const inicio = admissao && admissao > ini ? admissao : ini;
  return { trabalhados: Math.max(0, diferencaDias(inicio, saida) + 1), total: diferencaDias(ini, fim) + 1 };
}

export function DesligamentosComissao({
  dados,
  taxa,
  onAlterou,
}: {
  dados: DadosFechamento;
  taxa: number;
  onAlterou: () => void;
}) {
  const { acertos, processando, registrar, desfazer, definirEquipe } = useAcertosDesligamento(dados.mes);
  const { equipes } = useEquipes();
  const toast = useToast();
  const confirmar = useConfirm();

  const desligados = dados.linhas.filter(
    (l) => l.colaborador_id && l.desligado_em && l.desligado_em.slice(0, 7) === dados.mes.slice(0, 7)
  );

  if (desligados.length === 0) {
    return (
      <p className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600">
        Ninguém foi desligado neste mês. Para desligar, use "Desativar" na tela de Colaboradores e informe o último dia
        trabalhado.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {desligados.map((l) => (
        <Acerto
          key={l.chave}
          linha={l}
          dados={dados}
          taxa={taxa}
          acerto={acertos.find((a) => a.colaborador_id === l.colaborador_id) ?? null}
          equipes={equipes.map((e) => ({ id: e.id, nome: e.nome }))}
          processando={processando}
          onRegistrar={async () => {
            const ok = await confirmar(
              `Registrar o pagamento do acerto de ${l.nome}? O valor fica guardado e é descontado no fechamento do mês.`
            );
            if (!ok) return;
            const r = await registrar(l, taxa, dados.ultimaData);
            if (r.erro) toast(r.erro, 'erro');
            else {
              toast('Acerto registrado.');
              onAlterou();
            }
          }}
          onDesfazer={async (id) => {
            const ok = await confirmar(`Desfazer o registro do acerto de ${l.nome}? O valor volta a aparecer no fechamento.`);
            if (!ok) return;
            const r = await desfazer(id);
            if (r.erro) toast(r.erro, 'erro');
            else onAlterou();
          }}
          onDefinirEquipe={async (equipeId) => {
            const r = await definirEquipe(l.colaborador_id as string, l.desligado_em as string, equipeId);
            if (r.erro) toast(r.erro, 'erro');
            else {
              toast('Equipe registrada.');
              onAlterou();
            }
          }}
        />
      ))}
    </div>
  );
}

function Acerto({
  linha,
  dados,
  taxa,
  acerto,
  equipes,
  processando,
  onRegistrar,
  onDesfazer,
  onDefinirEquipe,
}: {
  linha: LinhaFechamento;
  dados: DadosFechamento;
  taxa: number;
  acerto: { id: string; valor_pago: number; total_a_pagar: number; pago_em: string; base_ate: string | null } | null;
  equipes: { id: string; nome: string }[];
  processando: boolean;
  onRegistrar: () => void;
  onDesfazer: (id: string) => void;
  onDefinirEquipe: (equipeId: string) => void;
}) {
  const [equipeEscolhida, setEquipeEscolhida] = useState('');
  const saida = linha.desligado_em as string;
  const ganho = Math.round((linha.salario_total + linha.ja_pago) * 100) / 100;
  const diferenca = acerto ? Math.round((ganho - acerto.valor_pago) * 100) / 100 : 0;
  const baseIncompleta = !dados.ultimaData || dados.ultimaData < saida;
  const { trabalhados, total } = diasDoAuxilio(dados.mes, linha.data_inicio, saida);
  const detalhe = dados.paineis.detalheDesligados.find((d) => d.colaborador_id === linha.colaborador_id)?.dias ?? [];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-tinta">{linha.nome}</h2>
          <p className="text-sm text-slate-500">
            Equipe {linha.equipe ?? '—'} · último dia trabalhado {dataBr(saida)}
          </p>
        </div>
        {acerto ? (
          <span className="rounded-full bg-esmeralda-light px-3 py-1 text-sm font-medium text-esmeralda-dark">
            Pago em {new Date(acerto.pago_em).toLocaleDateString('pt-BR')}: {moeda(acerto.valor_pago)}
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">Acerto pendente</span>
        )}
      </div>

      {baseIncompleta && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          A base de vendas deste mês vai só até {dataBr(dados.ultimaData)}. Envie a base até {dataBr(saida)} (aba
          Fechamento do mês) para o acerto considerar todas as vendas.
        </p>
      )}

      {!linha.equipe && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>Sem equipe registrada até a saída — a comissão de equipe não pode ser calculada. Em qual equipe estava?</span>
          <select
            value={equipeEscolhida}
            onChange={(e) => setEquipeEscolhida(e.target.value)}
            className="rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-tinta"
          >
            <option value="">Escolha</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
          <button
            onClick={() => equipeEscolhida && onDefinirEquipe(equipeEscolhida)}
            disabled={!equipeEscolhida || processando}
            className="rounded-md bg-amber-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
          >
            Salvar equipe
          </button>
        </div>
      )}

      <table className="mt-4 w-full max-w-lg text-sm">
        <tbody className="divide-y divide-slate-100">
          <Linha
            rotulo={`Auxílio proporcional (${trabalhados} de ${total} dias)`}
            valor={linha.auxilio}
          />
          <Linha rotulo="Comissão de equipe (dias úteis até a saída)" valor={linha.comissao_equipe} />
          <Linha rotulo="Comissão de fim de semana" valor={linha.comissao_fds} />
          <Linha rotulo="Comissão de infoprodutos" valor={linha.comissao_infoprodutos} />
          <Linha rotulo="(−) Adiantamento" valor={-linha.adiantamento} />
          <tr className="font-semibold text-tinta">
            <td className="py-2">Valor do acerto</td>
            <td className="py-2 text-right">{moeda(ganho)}</td>
          </tr>
          <tr className="text-esmeralda-dark">
            <td className="py-2">Total a pagar (+{Math.round(taxa * 1000) / 10}%)</td>
            <td className="py-2 text-right font-semibold">{moeda(ganho * (1 + taxa))}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-xs text-slate-400">{linha.ftds} FTDs no mês até a saída.</p>

      {acerto && Math.abs(diferenca) >= 0.01 && (
        <p className="mt-3 rounded-md bg-profundo-light px-3 py-2 text-sm text-profundo">
          O cálculo mudou desde o pagamento (base ou cadastros atualizados): diferença de {moeda(diferenca)}. Ela aparece no
          fechamento do mês; ou registre o acerto de novo para atualizar o valor pago.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={onRegistrar}
          disabled={processando || baseIncompleta}
          title={baseIncompleta ? 'Envie a base até o dia da saída antes de registrar.' : undefined}
          className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-50"
        >
          {acerto ? 'Registrar de novo com o valor atual' : 'Registrar pagamento do acerto'}
        </button>
        {acerto && (
          <button
            onClick={() => onDesfazer(acerto.id)}
            disabled={processando}
            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Desfazer registro
          </button>
        )}
      </div>

      {detalhe.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-ceruleo">Ver detalhe por dia</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  {['Dia', 'FTDs', 'Com. equipe', 'Com. FDS', 'Com. infoprodutos'].map((t) => (
                    <th key={t} className="px-2 py-1 font-medium">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {detalhe.map((d) => (
                  <tr key={d.dia}>
                    <td className="px-2 py-1">{dataBr(d.dia)}</td>
                    <td className="px-2 py-1">{d.ftds}</td>
                    <td className="px-2 py-1">{moeda(d.comissao_equipe)}</td>
                    <td className="px-2 py-1">{moeda(d.comissao_fds)}</td>
                    <td className="px-2 py-1">{moeda(d.comissao_infoprodutos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <tr>
      <td className="py-2 text-slate-600">{rotulo}</td>
      <td className="py-2 text-right text-tinta">{moeda(valor)}</td>
    </tr>
  );
}
