import { Fragment, useEffect, useRef, useState, type ChangeEvent } from 'react';
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
import { DesligamentosComissao } from './DesligamentosComissao';
import { NovaOperacao, OperacaoComissao } from './OutrasOperacoesComissao';
import { QuadroGeral } from './QuadroGeral';
import { useOutrasOperacoes } from '../../features/operacoes/useOutrasOperacoes';
import { OPERACAO_PRINCIPAL } from '../../features/operacoes/calculoOperacoes';

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

// Navegação em dois níveis: no topo, o mês e as seções (Quadro geral, uma
// por operação — TNT e as outras —, "+ Operação" e Histórico); dentro da
// TNT, as abas dela (fechamento, painel, infoprodutos...).
type Secao = 'geral' | 'tnt' | 'nova-operacao' | 'historico' | `op:${string}`;
type AbaTnt = 'fechamento' | 'painel' | 'infoprodutos' | 'resumo-joao' | 'desligamentos';

export function ComissionamentoPage({ infoprodutosPendentes = 0 }: { infoprodutosPendentes?: number }) {
  const { session } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const [secao, setSecao] = useState<Secao>('geral');
  const [aba, setAba] = useState<AbaTnt>('fechamento');
  const historico = useHistoricoComissoes();
  const [mesInput, setMesInput] = useState(mesAtualFormatoInput()); // "YYYY-MM"
  const { dados, carregando, importando, erro, calcular, importar, editarAdiantamento } =
    useFechamentoMensal();
  const cadastros = useCadastrosComissao();
  const entradaArquivo = useRef<HTMLInputElement>(null);

  const mes = `${mesInput}-01`;
  const adminId = session?.user?.id ?? null;
  const outras = useOutrasOperacoes(mes, cadastros.config?.hora_virada_dia ?? 6);
  const operacoesAtivas = outras.operacoes.filter((o) => o.ativo);
  const operacaoAberta = operacoesAtivas.find((o) => `op:${o.id}` === secao) ?? null;

  // Operação desativada (ou que não existe mais): volta para o Quadro geral.
  useEffect(() => {
    if (secao.startsWith('op:') && !outras.carregando && !operacaoAberta) setSecao('geral');
  }, [secao, outras.carregando, operacaoAberta]);

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
  const colaboradoresSemNome = cadastros.colaboradores.filter((c) => c.ativo && !c.nome_base);
  const ativos = cadastros.colaboradores.filter((c) => c.ativo);
  const desligados = cadastros.colaboradores
    .filter((c) => !c.ativo)
    .sort((a, b) => (b.desativado_em ?? '').localeCompare(a.desativado_em ?? ''));

  const seletorMes = (
    <div>
      <label className="block text-sm font-medium text-slate-700">Mês</label>
      <input
        type="month"
        value={mesInput}
        onChange={(e) => setMesInput(e.target.value)}
        className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
      />
    </div>
  );

  const abaSecao = (id: Secao, rotulo: string, extra?: { badge?: number; discreto?: boolean }) => (
    <button
      key={id}
      onClick={(e) => {
        setSecao(id);
        // No celular a barra rola de lado: mantém a seção escolhida à vista.
        e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }}
      className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
        secao === id
          ? 'border-esmeralda text-tinta'
          : `border-transparent hover:border-slate-300 hover:text-tinta ${extra?.discreto ? 'text-slate-400' : 'text-slate-500'}`
      }`}
    >
      {rotulo}
      {!!extra?.badge && (
        <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">{extra.badge}</span>
      )}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">Comissionamento</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">Fechamento mensal</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Escolha o mês, envie a base de cada operação e confira no Quadro geral quanto pagar a cada pessoa.
          </p>
        </div>
        {secao !== 'historico' && seletorMes}
      </div>

      <nav className="mt-6 flex items-stretch overflow-x-auto border-b border-slate-200 [scrollbar-width:none]" aria-label="Seções do comissionamento">
        {abaSecao('geral', 'Quadro geral')}
        <span className="mx-2 my-2.5 w-px shrink-0 bg-slate-200" aria-hidden />
        {abaSecao('tnt', OPERACAO_PRINCIPAL, { badge: infoprodutosPendentes })}
        {operacoesAtivas.map((o) => abaSecao(`op:${o.id}`, o.nome))}
        {abaSecao('nova-operacao', '+ Operação', { discreto: true })}
        <span className="flex-1" />
        {abaSecao('historico', 'Histórico')}
      </nav>

      {secao === 'historico' ? (
        <div className="mt-6">
          <HistoricoComissoes historico={historico} />
        </div>
      ) : secao === 'nova-operacao' ? (
        <div className="mt-6">
          <NovaOperacao ops={outras} onCriada={(id) => setSecao(`op:${id}`)} />
        </div>
      ) : operacaoAberta ? (
        <div className="mt-6">
          <OperacaoComissao
            key={operacaoAberta.id}
            ops={outras}
            operacaoId={operacaoAberta.id}
            nome={operacaoAberta.nome}
            onMesDoArquivo={setMesInput}
          />
        </div>
      ) : secao === 'geral' ? (
        <div className="mt-6">
          {(erro || outras.erro) && (
            <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro ?? outras.erro}</p>
          )}
          {carregando && !dados && <p className="text-sm text-slate-400">Calculando...</p>}
          {dados && <QuadroGeral linhas={linhas} ops={outras} taxa={cadastros.config?.taxa_total_a_pagar ?? 0.02} />}
        </div>
      ) : (
      <>
      <p className="mt-5 max-w-3xl text-sm text-slate-500">
        Envie a base de vendas da {OPERACAO_PRINCIPAL} (aba "Base" da planilha de comissões). O fechamento soma
        Auxílio + Comissão de equipe (dias úteis) + Comissão de fim de semana + Comissão de infoprodutos −
        Adiantamento, com as regras e valores definidos em "Parâmetros das regras".
      </p>

      <div className="mt-4 inline-flex max-w-full flex-wrap rounded-md border border-slate-200 bg-slate-50 p-0.5 text-sm">
        {(
          [
            ['fechamento', 'Fechamento'],
            ['painel', 'Painel'],
            ['infoprodutos', 'Infoprodutos'],
            ['resumo-joao', 'Resumo João'],
            ['desligamentos', 'Desligamentos'],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition ${
              aba === id ? 'bg-white text-tinta shadow-sm' : 'text-slate-500 hover:text-tinta'
            }`}
          >
            {rotulo}
            {id === 'infoprodutos' && infoprodutosPendentes > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
                {infoprodutosPendentes}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
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
          {importando ? 'Importando...' : `📤 Enviar base ${OPERACAO_PRINCIPAL} (Excel)`}
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
      ) : aba === 'desligamentos' ? (
        dados && (
          <div className="mt-6">
            <DesligamentosComissao
              dados={dados}
              taxa={cadastros.config?.taxa_total_a_pagar ?? 0.02}
              onAlterou={recalcular}
            />
          </div>
        )
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
                Não há vendas importadas para este mês. Use "Enviar base {OPERACAO_PRINCIPAL} (Excel)".
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
              Não há vendas importadas para este mês. Use "Enviar base {OPERACAO_PRINCIPAL} (Excel)".
            </p>
          )}

          {(dados.avisos.operadoresSemCadastro.length > 0 ||
            colaboradoresSemNome.length > 0 ||
            dados.avisos.vendasDeDesligados.length > 0 ||
            dados.avisos.infoprodutosSemOperador.length > 0) && (
            <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
              {dados.avisos.vendasDeDesligados.length > 0 && (
                <div className="text-amber-800">
                  <p className="font-medium">
                    Vendas de quem já tinha saído antes deste mês (ou está sem data de saída) — não
                    entram no cálculo:
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {dados.avisos.vendasDeDesligados.map((d) => (
                      <li key={d.operador}>
                        {d.nome} ({d.operador}) · {d.ftds} FTD(s) ·{' '}
                        {d.desativado_em ? `saída registrada em ${formatarData(d.desativado_em)}` : 'sem data de saída'}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1">
                    Se a pessoa trabalhou neste mês, corrija o último dia em Colaboradores → "Data de saída" e
                    recalcule.
                  </p>
                </div>
              )}
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

          {linhas.length > 0 && <ResumoPorEquipe linhas={linhas} />}

          <TabelaPorPessoa
            linhas={linhas}
            mesInput={mesInput}
            onAdiantamento={(colaboradorId, valor) => {
              if (adminId) editarAdiantamento(mes, colaboradorId, valor);
            }}
          />
        </>
      )}

      <div className="mt-8 space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Configurações da {OPERACAO_PRINCIPAL}
        </h2>
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
          {[
            { titulo: null, lista: ativos },
            { titulo: 'Desligados', lista: desligados },
          ].map(({ titulo, lista }) =>
            lista.length === 0 ? null : (
          <div key={titulo ?? 'ativos'} className={titulo ? 'mt-5' : ''}>
          {titulo && <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {lista.map((c) => (
              <label key={c.id} className="block text-sm text-slate-700">
                {c.nome}
                {!c.ativo && (
                  <span className="ml-1 text-xs text-slate-400">
                    ({c.desativado_em ? `saiu em ${formatarData(c.desativado_em)}` : 'sem data de saída'})
                  </span>
                )}
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
          </div>
            )
          )}
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

// Tabela por pessoa: só o essencial nas colunas; o resto abre ao clicar na
// linha (detalhe das comissões, início, acerto já pago, saída).
function TabelaPorPessoa({
  linhas,
  mesInput,
  onAdiantamento,
}: {
  linhas: LinhaFechamento[];
  mesInput: string;
  onAdiantamento: (colaboradorId: string, valor: number) => void;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  // Externo (e individual) recebe por FTD: a parte dos dias úteis fica em
  // comissao_propria e entra no pagamento.
  const comissoes = (l: LinhaFechamento) =>
    l.comissao_equipe +
    l.comissao_fds +
    l.comissao_infoprodutos +
    (l.tipo === 'externo' || l.tipo === 'individual' ? l.comissao_propria : 0);
  const soma = (f: (l: LinhaFechamento) => number) => linhas.reduce((s, l) => s + f(l), 0);
  const direita = 'whitespace-nowrap px-3 py-2 text-right tabular-nums';

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
          <tr>
            <th className="px-3 py-3 font-medium">Nome</th>
            {['FTDs', 'Comissões', 'Auxílio', 'Adiantamento', 'Salário', 'Total a pagar'].map((t) => (
              <th key={t} className="whitespace-nowrap px-3 py-3 text-right font-medium">
                {t}
              </th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {linhas.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                Nenhum valor calculado para este mês.
              </td>
            </tr>
          ) : (
            linhas.map((l) => {
              const estaAberta = aberta === l.chave;
              const saiuNoMes = !!l.desligado_em && l.desligado_em.slice(0, 7) === mesInput;
              return (
                <Fragment key={l.chave}>
                  <tr
                    onClick={() => setAberta(estaAberta ? null : l.chave)}
                    className={`cursor-pointer hover:bg-slate-50 ${estaAberta ? 'bg-slate-50' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-tinta">
                        {l.nome}
                        {saiuNoMes && (
                          <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            Saiu em {formatarData(l.desligado_em)}
                          </span>
                        )}
                        {rotuloTipo[l.tipo] && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            {rotuloTipo[l.tipo]}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">{l.equipe ? `Equipe ${l.equipe}` : 'Sem equipe'}</p>
                    </td>
                    <td className={`${direita} text-slate-600`}>{l.ftds || '—'}</td>
                    <td className={direita}>{comissoes(l) ? formatarMoeda(comissoes(l)) : '—'}</td>
                    <td className={direita}>{l.auxilio ? formatarMoeda(l.auxilio) : '—'}</td>
                    <td className={direita} onClick={(e) => e.stopPropagation()}>
                      {l.colaborador_id ? (
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={l.adiantamento}
                          key={`${l.chave}-${l.adiantamento}`}
                          onBlur={(e) => {
                            const valor = Number(e.target.value) || 0;
                            if (valor !== l.adiantamento) onAdiantamento(l.colaborador_id as string, valor);
                          }}
                          aria-label={`Adiantamento de ${l.nome}`}
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm"
                        />
                      ) : l.adiantamento ? (
                        formatarMoeda(l.adiantamento)
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`${direita} font-semibold text-tinta`}>{formatarMoeda(l.salario_total)}</td>
                    <td className={`${direita} font-semibold text-esmeralda-dark`}>{formatarMoeda(l.total_a_pagar)}</td>
                    <td className="px-2 text-center text-slate-400" aria-hidden>
                      {estaAberta ? '▴' : '▾'}
                    </td>
                  </tr>
                  {estaAberta && (
                    <tr className="bg-slate-50">
                      <td colSpan={8} className="px-3 pb-4 pt-1">
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-7">
                          <Detalhe rotulo="Início" valor={formatarData(l.data_inicio)} />
                          <Detalhe rotulo="Com. equipe (dias úteis)" valor={formatarMoeda(l.comissao_equipe)} />
                          <Detalhe
                            rotulo={l.tipo === 'externo' ? 'FTDs no fim de semana (pagos)' : 'Com. fim de semana'}
                            valor={formatarMoeda(l.comissao_fds)}
                          />
                          <Detalhe rotulo="Com. infoprodutos" valor={formatarMoeda(l.comissao_infoprodutos)} />
                          {l.tipo === 'externo' || l.tipo === 'individual' ? (
                            <Detalhe rotulo="FTDs em dias úteis (pagos)" valor={formatarMoeda(l.comissao_propria)} />
                          ) : (
                            <Detalhe
                              rotulo="Com. própria (informativa)"
                              valor={formatarMoeda(l.comissao_propria)}
                              dica="FTDs da pessoa em dias úteis × valor. Não entra no salário."
                            />
                          )}
                          {l.ja_pago > 0 && <Detalhe rotulo="Já pago (acerto)" valor={formatarMoeda(l.ja_pago)} />}
                          {l.desligado_em && <Detalhe rotulo="Último dia" valor={formatarData(l.desligado_em)} />}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
        {linhas.length > 0 && (
          <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-tinta">
            <tr>
              <td className="px-3 py-2">Total</td>
              <td className={direita}>{soma((l) => l.ftds)}</td>
              <td className={direita}>{formatarMoeda(soma(comissoes))}</td>
              <td className={direita}>{formatarMoeda(soma((l) => l.auxilio))}</td>
              <td className={direita}>{formatarMoeda(soma((l) => l.adiantamento))}</td>
              <td className={direita}>{formatarMoeda(soma((l) => l.salario_total))}</td>
              <td className={`${direita} text-esmeralda-dark`}>{formatarMoeda(soma((l) => l.total_a_pagar))}</td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
      <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
        Clique numa linha para ver o detalhe. Comissões = equipe + fim de semana + infoprodutos (externos: todos os FTDs).
        Adiantamentos são salvos ao sair do campo.
      </p>
    </div>
  );
}

function Detalhe({ rotulo, valor, dica }: { rotulo: string; valor: string; dica?: string }) {
  return (
    <div title={dica}>
      <dt className="text-xs text-slate-400">{rotulo}</dt>
      <dd className="font-medium text-tinta">{valor}</dd>
    </div>
  );
}

// Somatório por equipe: FTDs e quanto a equipe recebe no mês. Externos,
// pagamentos fixos e quem está sem equipe ficam em "Outros".
function ResumoPorEquipe({ linhas }: { linhas: LinhaFechamento[] }) {
  const grupos = new Map<string, LinhaFechamento[]>();
  for (const l of linhas) {
    const grupo = l.equipe ? `Equipe ${l.equipe}` : 'Outros (externos, fixos e sem equipe)';
    grupos.set(grupo, [...(grupos.get(grupo) ?? []), l]);
  }
  const ordem = [...grupos.keys()].sort((a, b) => {
    if (a.startsWith('Outros')) return 1;
    if (b.startsWith('Outros')) return -1;
    return a.localeCompare(b, 'pt-BR');
  });
  const soma = (lista: LinhaFechamento[], campo: keyof LinhaFechamento) =>
    lista.reduce((s, l) => s + (l[campo] as number), 0);
  const colunas: [string, (lista: LinhaFechamento[]) => string][] = [
    ['Pessoas', (lista) => String(lista.length)],
    ['FTDs', (lista) => String(soma(lista, 'ftds'))],
    ['Com. equipe', (lista) => formatarMoeda(soma(lista, 'comissao_equipe'))],
    ['Com. FDS', (lista) => formatarMoeda(soma(lista, 'comissao_fds'))],
    ['Com. infoprodutos', (lista) => formatarMoeda(soma(lista, 'comissao_infoprodutos'))],
    ['Auxílio', (lista) => formatarMoeda(soma(lista, 'auxilio'))],
    ['Salário', (lista) => formatarMoeda(soma(lista, 'salario_total'))],
    ['Total a pagar', (lista) => formatarMoeda(soma(lista, 'total_a_pagar'))],
  ];

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <p className="border-b border-slate-200 px-3 py-2 text-sm font-medium text-tinta">Resumo por equipe</p>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Equipe</th>
            {colunas.map(([titulo]) => (
              <th key={titulo} className="whitespace-nowrap px-3 py-2 font-medium">
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ordem.map((grupo) => {
            const lista = grupos.get(grupo) ?? [];
            return (
              <tr key={grupo}>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-tinta">{grupo}</td>
                {colunas.map(([titulo, valor]) => (
                  <td
                    key={titulo}
                    className={`whitespace-nowrap px-3 py-2 ${
                      titulo === 'Total a pagar' ? 'font-semibold text-esmeralda-dark' : titulo === 'Salário' ? 'font-semibold text-tinta' : ''
                    }`}
                  >
                    {valor(lista)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-tinta">
          <tr>
            <td className="px-3 py-2">Total</td>
            {colunas.map(([titulo, valor]) => (
              <td key={titulo} className={`whitespace-nowrap px-3 py-2 ${titulo === 'Total a pagar' ? 'text-esmeralda-dark' : ''}`}>
                {valor(linhas)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
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
  colaboradores: { id: string; nome: string; nome_base: string | null; ativo: boolean; desativado_em: string | null }[];
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
        {[
          { rotulo: 'Ativos', lista: colaboradores.filter((c) => c.ativo) },
          { rotulo: 'Desligados', lista: colaboradores.filter((c) => !c.ativo) },
        ].map(({ rotulo, lista }) =>
          lista.length === 0 ? null : (
            <optgroup key={rotulo} label={rotulo}>
              {lista.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {!c.ativo && (c.desativado_em ? ` — saiu em ${formatarData(c.desativado_em)}` : ' — sem data de saída')}
                  {c.nome_base ? ` (hoje: ${c.nome_base})` : ''}
                </option>
              ))}
            </optgroup>
          )
        )}
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
