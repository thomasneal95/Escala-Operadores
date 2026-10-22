import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useFechamentoMensal, type LinhaFechamento } from '../../features/schedules/useFechamentoMensal';
import {
  useCadastrosComissao,
  type ConfiguracaoComissao,
  type PagamentoFixo,
} from '../../features/schedules/useCadastrosComissao';
import { SecaoRecolhivel } from '../../components/SecaoRecolhivel';
import { useConfirm, useToast } from '../../components/FeedbackProvider';
import { useHistoricoComissoes } from '../../features/schedules/useHistoricoComissoes';
import { HistoricoComissoes } from './HistoricoComissoes';
import { PaineisComissao } from './PaineisComissao';
import { InfoprodutosComissao } from './InfoprodutosComissao';
import { ResumoJoao } from './ResumoJoao';

function mesAtualFormatoInput() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

const nomesMeses = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function nomeDoMes(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  return `${nomesMeses[m - 1]}/${ano}`;
}

function mesAnterior(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  return m === 1 ? `${ano - 1}-12-01` : `${ano}-${String(m - 1).padStart(2, '0')}-01`;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

function formatarData(data: string | null) {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const rotuloTipo: Partial<Record<LinhaFechamento['tipo'], string>> = {
  individual: 'Individual',
  externo: 'Externo',
  salario_fixo: 'Salário fixo',
  auxilio_fixo: 'Auxílio fixo',
};

const classeCampo =
  'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda';

export function ComissionamentoPage() {
  const { session } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const [aba, setAba] = useState<'fechamento' | 'painel' | 'infoprodutos' | 'resumo-joao' | 'historico'>(
    'fechamento'
  );
  const historico = useHistoricoComissoes();
  const [mesInput, setMesInput] = useState(mesAtualFormatoInput()); // "YYYY-MM"
  const { dados, carregando, importando, erro, calcular, importar, editarAdiantamento } =
    useFechamentoMensal();
  const cadastros = useCadastrosComissao();
  const entradaArquivo = useRef<HTMLInputElement>(null);

  const mes = `${mesInput}-01`;
  const adminId = session?.user?.id ?? null;

  useEffect(() => {
    if (adminId) calcular(mes);
  }, [mes, adminId, calcular]);

  async function recalcular() {
    if (adminId) await calcular(mes);
  }

  const arquivado = historico.meses.find((m) => m.mes === mes) ?? null;
  // Avisa só a partir do 1º mês que já está no histórico (antes disso não há
  // o que arquivar).
  const primeiroArquivado = historico.meses[historico.meses.length - 1]?.mes ?? null;
  const anteriorArquivado =
    !primeiroArquivado ||
    mesAnterior(mes) < primeiroArquivado ||
    historico.meses.some((m) => m.mes === mesAnterior(mes));

  async function handleArquivar() {
    if (!dados) return;
    const confirmou = await confirmar(
      arquivado
        ? `${nomeDoMes(mes)} já está no histórico. Substituir a foto arquivada pelo cálculo atual?`
        : `Arquivar ${nomeDoMes(mes)} no histórico? A foto guardada não muda mesmo que a base ou os cadastros mudem depois.`
    );
    if (!confirmou) return;
    const resultado = await historico.arquivar(dados);
    if (resultado.erro) toast(resultado.erro, 'erro');
    else toast(`${nomeDoMes(mes)} arquivado no histórico.`);
  }

  async function handleArquivo(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo || !adminId) return;

    const resultado = await importar(arquivo);
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }

    const meses = resultado.meses ?? [];
    toast(
      `Base importada (aba "${resultado.aba}"): ${resultado.gravadas} venda(s) de ${meses
        .map((m) => m.split('-').reverse().join('/'))
        .join(', ')}.` + (resultado.ignoradas ? ` ${resultado.ignoradas} linha(s) sem dados ignorada(s).` : '')
    );

    // Abre o último mês do arquivo (normalmente o mês que está sendo fechado).
    const ultimo = meses[meses.length - 1];
    if (ultimo && ultimo !== mesInput) setMesInput(ultimo);
    else await recalcular();
  }

  async function aposCadastro(resultado: { erro: string | null }, sucesso: string) {
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }
    toast(sucesso);
    await recalcular();
  }

  const linhas = dados?.linhas ?? [];
  const total = (campo: keyof LinhaFechamento) =>
    linhas.reduce((soma, l) => soma + (typeof l[campo] === 'number' ? (l[campo] as number) : 0), 0);
  const colaboradoresSemNome = cadastros.colaboradores.filter((c) => !c.nome_base);

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Comissionamento
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">Fechamento mensal</h1>
      <p className="mt-2 text-sm text-slate-500">
        Envie a base de vendas do Excel (aba "Base" da planilha de comissões). O fechamento soma
        Auxílio + Comissão de equipe (dias úteis) + Comissão de fim de semana + Comissão de
        infoprodutos − Adiantamento, com as regras e valores definidos em "Parâmetros das regras".
      </p>

      <div className="mt-5 inline-flex flex-wrap rounded-md border border-slate-200 bg-slate-50 p-0.5 text-sm">
        {(
          [
            ['fechamento', 'Fechamento do mês'],
            ['painel', 'Painel'],
            ['infoprodutos', 'Infoprodutos'],
            ['resumo-joao', 'Resumo João'],
            ['historico', 'Histórico'],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`rounded px-3 py-1.5 font-medium transition ${
              aba === id ? 'bg-white text-tinta shadow-sm' : 'text-slate-500 hover:text-tinta'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'historico' ? (
        <div className="mt-6">
          <HistoricoComissoes historico={historico} />
        </div>
      ) : (
      <>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Mês</label>
          <input
            type="month"
            value={mesInput}
            onChange={(e) => setMesInput(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
          />
        </div>

        <input
          ref={entradaArquivo}
          type="file"
          accept=".xlsx,.xlsm,.xls,.csv"
          onChange={handleArquivo}
          className="hidden"
        />
        <button
          onClick={() => entradaArquivo.current?.click()}
          disabled={importando}
          className="rounded-md bg-esmeralda px-4 py-2 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {importando ? 'Importando...' : '📤 Enviar base (Excel)'}
        </button>
        <button
          onClick={recalcular}
          disabled={carregando}
          className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
        >
          {carregando ? 'Calculando...' : '🔄 Recalcular'}
        </button>

        <button
          onClick={handleArquivar}
          disabled={!dados || carregando || historico.processando || dados.totalFtds === 0}
          className="rounded-md border border-profundo/30 px-4 py-2 font-medium text-profundo transition hover:bg-profundo-light disabled:opacity-60"
        >
          📦 Arquivar mês no histórico
        </button>

        {dados?.calculadoEm && (
          <p className="text-xs text-slate-400">
            Calculado em {formatarDataHora(dados.calculadoEm)}
            {dados.ultimaData && <> · base até {formatarData(dados.ultimaData)}</>}
          </p>
        )}
      </div>

      {arquivado && dados && (
        <p className="mt-4 rounded-md bg-profundo-light px-4 py-3 text-sm text-profundo">
          📦 {nomeDoMes(mes)} está arquivado no histórico (em{' '}
          {new Date(arquivado.arquivado_em).toLocaleDateString('pt-BR')}).
          {Math.abs(arquivado.salario_total - total('salario_total')) > 0.05 &&
            ` O cálculo atual difere da foto arquivada em ${formatarMoeda(
              total('salario_total') - arquivado.salario_total
            )} na folha — arquive de novo se quiser atualizar a foto.`}
        </p>
      )}
      {!historico.carregando && !anteriorArquivado && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠ {nomeDoMes(mesAnterior(mes))} ainda não foi arquivado no histórico.
        </p>
      )}

      {(erro || cadastros.erro) && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro ?? cadastros.erro}</p>
      )}

      {carregando && !dados && <p className="mt-6 text-sm text-slate-400">Calculando...</p>}

      {aba === 'infoprodutos' ? (
        <div className="mt-6">
          <InfoprodutosComissao
            mes={mes}
            operadores={[
              ...cadastros.colaboradores.map((c) => c.nome_base).filter((n): n is string => !!n),
              ...cadastros.externos.filter((e) => e.valor_por_ftd !== null).map((e) => e.nome_base),
            ].sort((a, b) => a.localeCompare(b, 'pt-BR'))}
            percentual={cadastros.config?.percentual_infoproduto ?? 0.1}
            onAlterou={recalcular}
          />
        </div>
      ) : aba === 'resumo-joao' ? (
        dados && (
          <div className="mt-6">
            <ResumoJoao dados={dados} />
          </div>
        )
      ) : aba === 'painel' ? (
        dados && (
          <div className="mt-6">
            {dados.totalFtds === 0 ? (
              <p className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600">
                Não há vendas importadas para este mês. Use "Enviar base (Excel)".
              </p>
            ) : (
              <PaineisComissao dados={dados} />
            )}
          </div>
        )
      ) : (
      <>
      {dados && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Cartao titulo="FTDs no mês" valor={String(dados.totalFtds)} />
            <Cartao titulo="Pessoas" valor={String(linhas.length)} />
            <Cartao titulo="Folha (salários)" valor={formatarMoeda(total('salario_total'))} />
            <Cartao titulo="Total a pagar" valor={formatarMoeda(total('total_a_pagar'))} destaque />
          </div>

          {dados.totalFtds === 0 && (
            <p className="mt-4 rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600">
              Não há vendas importadas para este mês. Use "Enviar base (Excel)".
            </p>
          )}

          {(dados.avisos.operadoresSemCadastro.length > 0 ||
            colaboradoresSemNome.length > 0 ||
            dados.avisos.infoprodutosSemOperador.length > 0) && (
            <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
              {dados.avisos.infoprodutosSemOperador.length > 0 && (
                <p className="text-amber-800">
                  Vendas de infoprodutos com operador não reconhecido (sem comissão até corrigir na aba
                  Infoprodutos):{' '}
                  {dados.avisos.infoprodutosSemOperador
                    .map((v) => `${v.operador} (${formatarMoeda(v.valor)})`)
                    .join(', ')}
                  .
                </p>
              )}
              {dados.avisos.operadoresSemCadastro.length > 0 && (
                <div>
                  <p className="font-medium text-amber-800">
                    Operadores da base sem cadastro — as vendas deles não entram no cálculo:
                  </p>
                  <div className="mt-2 space-y-2">
                    {dados.avisos.operadoresSemCadastro.map((o) => (
                      <OperadorSemCadastro
                        key={o.operador}
                        operador={o.operador}
                        ftds={o.ftds}
                        colaboradores={cadastros.colaboradores}
                        onLigar={async (id) =>
                          aposCadastro(await cadastros.definirNomeBase(id, o.operador), `"${o.operador}" ligado.`)
                        }
                        onExterno={async () =>
                          aposCadastro(
                            await cadastros.salvarExterno({ nome_base: o.operador, valor_por_ftd: null }),
                            `"${o.operador}" marcado como externo.`
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
              {colaboradoresSemNome.length > 0 && (
                <p className="text-amber-800">
                  Colaboradores sem "nome na base" (não recebem comissão até serem ligados):{' '}
                  {colaboradoresSemNome.map((c) => c.nome).join(', ')}. Ajuste em "Nomes na base",
                  abaixo.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  {[
                    'Nome',
                    'Equipe',
                    'Início',
                    'Auxílio',
                    'Com. própria*',
                    'Com. equipe',
                    'Com. FDS',
                    'Com. infoprodutos',
                    'Adiantamento',
                    'Salário',
                    'FTDs',
                    'Total a pagar',
                  ].map((t) => (
                    <th key={t} className="whitespace-nowrap px-3 py-3 font-medium">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-6 text-center text-slate-400">
                      Nenhum valor calculado para este mês.
                    </td>
                  </tr>
                ) : (
                  linhas.map((l) => (
                    <tr key={l.chave}>
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-tinta">
                        {l.nome}
                        {rotuloTipo[l.tipo] && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            {rotuloTipo[l.tipo]}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{l.equipe ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatarData(l.data_inicio)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(l.auxilio)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-400">{formatarMoeda(l.comissao_propria)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(l.comissao_equipe)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(l.comissao_fds)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(l.comissao_infoprodutos)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {l.colaborador_id ? (
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={l.adiantamento}
                            key={`${l.chave}-${l.adiantamento}`}
                            onBlur={(e) => {
                              const valor = Number(e.target.value) || 0;
                              if (adminId && valor !== l.adiantamento) {
                                editarAdiantamento(mes, l.colaborador_id as string, valor);
                              }
                            }}
                            className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          formatarMoeda(l.adiantamento)
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-tinta">
                        {formatarMoeda(l.salario_total)}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{l.ftds}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-esmeralda-dark">
                        {formatarMoeda(l.total_a_pagar)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {linhas.length > 0 && (
                <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-tinta">
                  <tr>
                    <td className="px-3 py-2" colSpan={3}>
                      Total
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(total('auxilio'))}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">{formatarMoeda(total('comissao_propria'))}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(total('comissao_equipe'))}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(total('comissao_fds'))}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(total('comissao_infoprodutos'))}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(total('adiantamento'))}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatarMoeda(total('salario_total'))}</td>
                    <td className="px-3 py-2">{total('ftds')}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-esmeralda-dark">{formatarMoeda(total('total_a_pagar'))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            * Com. própria: FTDs da pessoa em dias úteis × valor — só informativa, não entra no
            salário (exceto Individual e Externo, que recebem por FTD). Adiantamentos são salvos ao
            sair do campo.
          </p>
        </>
      )}

      <div className="mt-8 space-y-4">
        {cadastros.config && (
          <SecaoRecolhivel titulo="Parâmetros das regras" padraoAberta={false}>
            <FormularioParametros
              config={cadastros.config}
              onSalvar={async (novo) => aposCadastro(await cadastros.salvarConfig(novo), 'Parâmetros salvos.')}
            />
          </SecaoRecolhivel>
        )}

        <SecaoRecolhivel
          titulo="Nomes na base"
          padraoAberta={false}
          descricao="Nome de cada colaborador exatamente como aparece na coluna Operador da base."
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cadastros.colaboradores.map((c) => (
              <label key={c.id} className="block text-sm text-slate-700">
                {c.nome}
                <input
                  defaultValue={c.nome_base ?? ''}
                  key={`${c.id}-${c.nome_base}`}
                  placeholder="Nome na base"
                  onBlur={async (e) => {
                    const valor = e.target.value.trim();
                    if (valor === (c.nome_base ?? '')) return;
                    aposCadastro(await cadastros.definirNomeBase(c.id, valor || null), 'Nome na base salvo.');
                  }}
                  className={classeCampo}
                />
              </label>
            ))}
          </div>
        </SecaoRecolhivel>

        <SecaoRecolhivel
          titulo="Operadores externos"
          padraoAberta={false}
          descricao="Logins da base que não são da operação. Com valor por FTD, entram no fechamento recebendo esse valor (ex.: João, US$ 2)."
        >
          <OperadoresExternos
            externos={cadastros.externos}
            onSalvar={async (e) => aposCadastro(await cadastros.salvarExterno(e), 'Operador externo salvo.')}
            onRemover={async (n) => aposCadastro(await cadastros.removerExterno(n), 'Operador externo removido.')}
          />
        </SecaoRecolhivel>

        <SecaoRecolhivel
          titulo="Pagamentos fixos"
          padraoAberta={false}
          descricao="Quem recebe sem comissão: salário fixo (proporcional à data de início) ou auxílio fixo."
        >
          <PagamentosFixos
            fixos={cadastros.fixos}
            onSalvar={async (f) => aposCadastro(await cadastros.salvarFixo(f), 'Pagamento fixo salvo.')}
            onRemover={async (id) => aposCadastro(await cadastros.removerFixo(id), 'Pagamento fixo removido.')}
          />
        </SecaoRecolhivel>
      </div>
      </>
      )}
      </>
      )}
    </div>
  );
}

function Cartao({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        destaque ? 'border-esmeralda/30 bg-esmeralda-light' : 'border-slate-200 bg-white'
      }`}
    >
      <p
        className={`text-xs font-medium uppercase tracking-wide ${
          destaque ? 'text-esmeralda-dark' : 'text-slate-400'
        }`}
      >
        {titulo}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold text-tinta">{valor}</p>
    </div>
  );
}

function OperadorSemCadastro({
  operador,
  ftds,
  colaboradores,
  onLigar,
  onExterno,
}: {
  operador: string;
  ftds: number;
  colaboradores: { id: string; nome: string; nome_base: string | null }[];
  onLigar: (colaboradorId: string) => void;
  onExterno: () => void;
}) {
  const [escolhido, setEscolhido] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-white px-3 py-2">
      <span className="font-medium text-tinta">{operador}</span>
      <span className="text-slate-500">· {ftds} FTD(s)</span>
      <select
        value={escolhido}
        onChange={(e) => setEscolhido(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      >
        <option value="">Ligar a colaborador...</option>
        {colaboradores.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
            {c.nome_base ? ` (hoje: ${c.nome_base})` : ''}
          </option>
        ))}
      </select>
      <button
        onClick={() => escolhido && onLigar(escolhido)}
        disabled={!escolhido}
        className="rounded-md bg-esmeralda px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
      >
        Ligar
      </button>
      <button onClick={onExterno} className="text-sm font-medium text-slate-500 hover:text-tinta">
        É externo
      </button>
    </div>
  );
}

function FormularioParametros({
  config,
  onSalvar,
}: {
  config: ConfiguracaoComissao;
  onSalvar: (novo: ConfiguracaoComissao) => void;
}) {
  const [rascunho, setRascunho] = useState(config);
  const numero = (campo: keyof ConfiguracaoComissao, rotulo: string, passo = '0.01') => (
    <label className="block text-sm text-slate-700">
      {rotulo}
      <input
        type="number"
        step={passo}
        value={rascunho[campo] as number}
        onChange={(e) => setRascunho({ ...rascunho, [campo]: Number(e.target.value) })}
        className={classeCampo}
      />
    </label>
  );

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm text-slate-700">
          Início da regra nova
          <input
            type="date"
            value={rascunho.inicio_regra_nova}
            onChange={(e) => setRascunho({ ...rascunho, inicio_regra_nova: e.target.value })}
            className={classeCampo}
          />
        </label>
        {numero('valor_regra_nova', 'Valor por FTD na regra nova (US$)')}
        {numero('valor_antigo_dia_util', 'Valor antigo — dia útil (US$)')}
        {numero('valor_antigo_fds', 'Valor antigo — fim de semana (US$)')}
        {numero('valor_ftd_individual', 'Valor por FTD — colaborador individual (US$)')}
        <label className="block text-sm text-slate-700">
          Acréscimo no total a pagar (%)
          <input
            type="number"
            step="0.1"
            value={Math.round(rascunho.taxa_total_a_pagar * 1000) / 10}
            onChange={(e) => setRascunho({ ...rascunho, taxa_total_a_pagar: Number(e.target.value) / 100 })}
            className={classeCampo}
          />
        </label>
        {numero('hora_virada_dia', 'Virada do dia (vendas antes desta hora contam no dia anterior)', '1')}
        <label className="block text-sm text-slate-700">
          Comissão sobre infoprodutos (%)
          <input
            type="number"
            step="0.1"
            value={Math.round(rascunho.percentual_infoproduto * 1000) / 10}
            onChange={(e) => setRascunho({ ...rascunho, percentual_infoproduto: Number(e.target.value) / 100 })}
            className={classeCampo}
          />
        </label>
      </div>
      <button
        onClick={() => onSalvar(rascunho)}
        className="mt-4 rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark"
      >
        Salvar parâmetros
      </button>
    </div>
  );
}

function OperadoresExternos({
  externos,
  onSalvar,
  onRemover,
}: {
  externos: { nome_base: string; valor_por_ftd: number | null }[];
  onSalvar: (e: { nome_base: string; valor_por_ftd: number | null }) => void;
  onRemover: (nomeBase: string) => void;
}) {
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  return (
    <div className="space-y-2">
      {externos.length === 0 && <p className="text-sm text-slate-400">Nenhum operador externo.</p>}
      {externos.map((e) => (
        <div key={e.nome_base} className="flex flex-wrap items-center gap-3 text-sm">
          <span className="w-40 font-medium text-tinta">{e.nome_base}</span>
          <span className="text-slate-500">
            {e.valor_por_ftd === null ? 'Fora do fechamento' : `${e.valor_por_ftd.toFixed(2)} US$/FTD`}
          </span>
          <button onClick={() => onRemover(e.nome_base)} className="text-red-600 hover:text-red-700">
            Remover
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-2 pt-2">
        <label className="text-sm text-slate-700">
          Nome na base
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={classeCampo} />
        </label>
        <label className="text-sm text-slate-700">
          US$ por FTD (vazio = fora)
          <input
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className={classeCampo}
          />
        </label>
        <button
          onClick={() => {
            if (!nome.trim()) return;
            onSalvar({ nome_base: nome, valor_por_ftd: valor === '' ? null : Number(valor) });
            setNome('');
            setValor('');
          }}
          className="rounded-md bg-esmeralda px-3 py-2 text-sm font-medium text-white"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}

function PagamentosFixos({
  fixos,
  onSalvar,
  onRemover,
}: {
  fixos: PagamentoFixo[];
  onSalvar: (f: Omit<PagamentoFixo, 'id'> & { id?: string }) => void;
  onRemover: (id: string) => void;
}) {
  const vazio = { nome: '', tipo: 'salario_fixo' as const, valor: 0, data_inicio: null, adiantamento: 0 };
  const [novo, setNovo] = useState<Omit<PagamentoFixo, 'id'>>(vazio);
  return (
    <div className="space-y-2">
      {fixos.length === 0 && <p className="text-sm text-slate-400">Nenhum pagamento fixo.</p>}
      {fixos.map((f) => (
        <div key={f.id} className="flex flex-wrap items-center gap-3 text-sm">
          <span className="w-40 font-medium text-tinta">{f.nome}</span>
          <span className="text-slate-500">
            {f.tipo === 'salario_fixo' ? 'Salário fixo' : 'Auxílio fixo'} · US$ {f.valor.toFixed(2)}
            {f.data_inicio && ` · desde ${formatarData(f.data_inicio)}`}
          </span>
          <label className="flex items-center gap-1 text-slate-500">
            Adiantamento
            <input
              type="number"
              step="0.01"
              defaultValue={f.adiantamento}
              key={`${f.id}-${f.adiantamento}`}
              onBlur={(e) => {
                const valor = Number(e.target.value) || 0;
                if (valor !== f.adiantamento) onSalvar({ ...f, adiantamento: valor });
              }}
              className="w-20 rounded-md border border-slate-300 px-2 py-1"
            />
          </label>
          <button onClick={() => onRemover(f.id)} className="text-red-600 hover:text-red-700">
            Remover
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-2 pt-2">
        <label className="text-sm text-slate-700">
          Nome
          <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className={classeCampo} />
        </label>
        <label className="text-sm text-slate-700">
          Tipo
          <select
            value={novo.tipo}
            onChange={(e) => setNovo({ ...novo, tipo: e.target.value as PagamentoFixo['tipo'] })}
            className={classeCampo}
          >
            <option value="salario_fixo">Salário fixo</option>
            <option value="auxilio_fixo">Auxílio fixo</option>
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Valor (US$)
          <input
            type="number"
            step="0.01"
            value={novo.valor}
            onChange={(e) => setNovo({ ...novo, valor: Number(e.target.value) })}
            className={classeCampo}
          />
        </label>
        <label className="text-sm text-slate-700">
          Início (opcional)
          <input
            type="date"
            value={novo.data_inicio ?? ''}
            onChange={(e) => setNovo({ ...novo, data_inicio: e.target.value || null })}
            className={classeCampo}
          />
        </label>
        <button
          onClick={() => {
            if (!novo.nome.trim()) return;
            onSalvar(novo);
            setNovo(vazio);
          }}
          className="rounded-md bg-esmeralda px-3 py-2 text-sm font-medium text-white"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
