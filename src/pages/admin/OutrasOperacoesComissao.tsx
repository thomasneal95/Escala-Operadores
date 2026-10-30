import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useConfirm, useToast } from '../../components/FeedbackProvider';
import { SecaoRecolhivel } from '../../components/SecaoRecolhivel';
import type { useOutrasOperacoes } from '../../features/operacoes/useOutrasOperacoes';
import type { ModoDivisao, PessoaOperacao } from '../../features/operacoes/calculoOperacoes';

type OutrasOperacoes = ReturnType<typeof useOutrasOperacoes>;

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

function formatarData(data: string | null) {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

const campo =
  'rounded-md border border-slate-300 px-3 py-2 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda';

// Aba "Outras operações" do comissionamento: cada operação tem a sua base
// (Excel) e o seu fechamento; a divisão é escolhida a cada mês.
export function OutrasOperacoesComissao({
  ops,
  onMesDoArquivo,
}: {
  ops: OutrasOperacoes;
  onMesDoArquivo: (mes: string) => void;
}) {
  const toast = useToast();
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState('');

  const ativas = ops.operacoes.filter((o) => o.ativo);
  const selecionada = ativas.find((o) => o.id === selecionadaId) ?? ativas[0] ?? null;

  async function criar() {
    if (!novoNome.trim()) return;
    const { erro } = await ops.criarOperacao(novoNome);
    if (erro) toast(erro, 'erro');
    else {
      toast(`Operação "${novoNome.trim()}" criada.`);
      setNovoNome('');
    }
  }

  return (
    <div>
      {ops.erro && <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{ops.erro}</p>}

      {ativas.length === 0 && !ops.carregando ? (
        <p className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Nenhuma operação cadastrada. Crie a primeira abaixo, com o nome da operação (ex.: o nome do
          produto ou do cliente).
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {ativas.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelecionadaId(o.id)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                selecionada?.id === o.id
                  ? 'border-esmeralda bg-esmeralda text-white'
                  : 'border-slate-300 text-slate-600 hover:border-esmeralda hover:text-esmeralda'
              }`}
            >
              {o.nome}
            </button>
          ))}
        </div>
      )}

      {selecionada && (
        <FechamentoOperacao
          key={selecionada.id}
          ops={ops}
          operacaoId={selecionada.id}
          nome={selecionada.nome}
          onMesDoArquivo={onMesDoArquivo}
        />
      )}

      <div className="mt-8">
        <SecaoRecolhivel titulo="Gerenciar operações" padraoAberta={ativas.length === 0}>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Nova operação</label>
              <input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && criar()}
                placeholder="Nome da operação"
                className={`mt-1 ${campo}`}
              />
            </div>
            <button
              onClick={criar}
              disabled={!novoNome.trim()}
              className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-50"
            >
              Criar
            </button>
          </div>

          {ops.operacoes.length > 0 && (
            <ul className="mt-5 divide-y divide-slate-100 rounded-md border border-slate-200">
              {ops.operacoes.map((o) => (
                <LinhaGerenciar key={o.id} ops={ops} id={o.id} nome={o.nome} ativo={o.ativo} />
              ))}
            </ul>
          )}
        </SecaoRecolhivel>
      </div>
    </div>
  );
}

function LinhaGerenciar({ ops, id, nome, ativo }: { ops: OutrasOperacoes; id: string; nome: string; ativo: boolean }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [texto, setTexto] = useState(nome);

  async function renomear() {
    if (!texto.trim() || texto.trim() === nome) return setTexto(nome);
    const { erro } = await ops.renomearOperacao(id, texto);
    if (erro) {
      toast(erro, 'erro');
      setTexto(nome);
    } else toast('Operação renomeada.');
  }

  async function alternar() {
    if (
      ativo &&
      !(await confirmar(
        `Desativar "${nome}"? Ela some das abas e do quadro geral, mas a base e as divisões ficam guardadas.`
      ))
    )
      return;
    const { erro } = await ops.alternarAtiva(id, !ativo);
    if (erro) toast(erro, 'erro');
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2">
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={renomear}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={`${campo} min-w-0 flex-1 py-1.5`}
      />
      <span className={`text-xs ${ativo ? 'text-esmeralda' : 'text-slate-400'}`}>{ativo ? 'Ativa' : 'Desativada'}</span>
      <button onClick={alternar} className="text-sm font-medium text-slate-600 hover:underline">
        {ativo ? 'Desativar' : 'Reativar'}
      </button>
    </li>
  );
}

function FechamentoOperacao({
  ops,
  operacaoId,
  nome,
  onMesDoArquivo,
}: {
  ops: OutrasOperacoes;
  operacaoId: string;
  nome: string;
  onMesDoArquivo: (mes: string) => void;
}) {
  const toast = useToast();
  const entradaArquivo = useRef<HTMLInputElement>(null);
  const resultado = ops.resultados.get(operacaoId);
  const [valorTexto, setValorTexto] = useState('');

  const valorSalvo = resultado?.valorPorFtd ?? 0;
  useEffect(() => {
    setValorTexto(valorSalvo ? String(valorSalvo).replace('.', ',') : '');
  }, [valorSalvo]);

  async function handleArquivo(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo) return;
    const r = await ops.importar(operacaoId, arquivo);
    if (r.erro) {
      toast(r.erro, 'erro');
      return;
    }
    const meses = r.meses ?? [];
    toast(
      `Base de ${nome} importada (aba "${r.aba}"): ${r.gravadas} venda(s) de ${meses
        .map((m) => m.split('-').reverse().join('/'))
        .join(', ')}.` + (r.ignoradas ? ` ${r.ignoradas} linha(s) sem dados ignorada(s).` : '')
    );
    const ultimo = meses[meses.length - 1];
    if (ultimo) onMesDoArquivo(ultimo);
  }

  async function salvarValor() {
    const valor = Number(valorTexto.replace(',', '.') || 0);
    if (!Number.isFinite(valor) || valor < 0) {
      toast('Valor por venda inválido.', 'erro');
      return;
    }
    if (valor === valorSalvo) return;
    const { erro } = await ops.definirValor(operacaoId, valor);
    if (erro) toast(erro, 'erro');
    else toast('Valor por venda salvo para este mês.');
  }

  const pessoas = resultado?.pessoas ?? [];
  const nomesEquipes = [...new Set(pessoas.map((p) => p.equipe).filter((e): e is string => !!e))];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end gap-3">
        <input
          ref={entradaArquivo}
          type="file"
          accept=".xlsx,.xlsm,.xls,.csv"
          onChange={handleArquivo}
          className="hidden"
        />
        <button
          onClick={() => entradaArquivo.current?.click()}
          disabled={ops.importando}
          className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {ops.importando ? 'Importando...' : `📤 Enviar base de ${nome} (Excel)`}
        </button>
        <div>
          <label className="block text-sm font-medium text-slate-700">Valor por venda no mês (US$)</label>
          <input
            inputMode="decimal"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            onBlur={salvarValor}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="0,00"
            className={`mt-1 w-32 ${campo}`}
          />
        </div>
        {resultado?.ultimaData && (
          <p className="text-xs text-slate-400">Base até {formatarData(resultado.ultimaData)}</p>
        )}
      </div>

      <p className="mt-3 text-sm text-slate-500">
        A planilha segue o mesmo formato da base da TNT (Operador, Etapa ou Status, Data e Hora). Enviar de
        novo substitui só os meses que vierem no arquivo, só nesta operação. Vendas "Rejeitado" não contam.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cartao titulo="Vendas no mês" valor={String(resultado?.totalFtds ?? 0)} />
        <Cartao titulo="Pessoas" valor={String(pessoas.length)} />
        <Cartao titulo="Valor por venda" valor={formatarMoeda(valorSalvo)} />
        <Cartao titulo="Total da operação" valor={formatarMoeda(resultado?.total ?? 0)} destaque />
      </div>

      {pessoas.length === 0 ? (
        <p className="mt-5 rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Não há vendas de {nome} neste mês. Use "Enviar base de {nome} (Excel)".
        </p>
      ) : (
        <>
          {valorSalvo === 0 && (
            <p className="mt-5 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
              ⚠ Defina o valor por venda deste mês para calcular quanto cada um recebe.
            </p>
          )}
          <p className="mt-5 text-sm text-slate-500">
            Divisão do mês: <strong>Individual</strong> recebe as próprias vendas × valor;{' '}
            <strong>Equipe</strong> soma as vendas de quem está na mesma equipe e divide igualmente;{' '}
            <strong>Sem pagamento</strong> não recebe.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-3 py-3 font-medium">Nome na base</th>
                  <th className="px-3 py-3 font-medium">Colaborador</th>
                  <th className="px-3 py-3 font-medium text-right">Dias</th>
                  <th className="px-3 py-3 font-medium text-right">Vendas</th>
                  <th className="px-3 py-3 font-medium text-right">Rejeitadas</th>
                  <th className="px-3 py-3 font-medium">Divisão</th>
                  <th className="px-3 py-3 font-medium text-right">Recebe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pessoas.map((p) => (
                  <LinhaPessoa
                    key={p.nome_base}
                    ops={ops}
                    operacaoId={operacaoId}
                    pessoa={p}
                    nomesEquipes={nomesEquipes}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {(resultado?.equipes.length ?? 0) > 0 && (
            <div className="mt-6">
              <h3 className="font-display text-base font-semibold text-tinta">Equipes do mês</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {resultado!.equipes.map((e) => (
                  <div key={e.nome} className="rounded-lg border border-slate-200 p-4">
                    <p className="font-medium text-tinta">{e.nome}</p>
                    <p className="mt-1 text-sm text-slate-500">{e.membros.join(', ')}</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {e.ftds} venda(s) × {formatarMoeda(valorSalvo)} = {formatarMoeda(e.valor)} ÷ {e.membros.length} ={' '}
                      <strong>{formatarMoeda(e.valor / e.membros.length)}</strong> por pessoa
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LinhaPessoa({
  ops,
  operacaoId,
  pessoa,
  nomesEquipes,
}: {
  ops: OutrasOperacoes;
  operacaoId: string;
  pessoa: PessoaOperacao;
  nomesEquipes: string[];
}) {
  const toast = useToast();
  const [equipe, setEquipe] = useState(pessoa.equipe ?? '');
  useEffect(() => setEquipe(pessoa.equipe ?? ''), [pessoa.equipe]);

  async function salvarDivisao(modo: ModoDivisao, nomeEquipe: string | null) {
    const { erro } = await ops.definirDivisao(operacaoId, pessoa.nome_base, modo, nomeEquipe);
    if (erro) toast(erro, 'erro');
  }

  async function trocarModo(modo: ModoDivisao) {
    if (modo === 'equipe') {
      // Entra na primeira equipe já criada no mês (ou cria a "Equipe 1");
      // o nome pode ser trocado ao lado.
      await salvarDivisao('equipe', pessoa.equipe ?? nomesEquipes[0] ?? 'Equipe 1');
    } else {
      await salvarDivisao(modo, null);
    }
  }

  async function salvarEquipe() {
    if (!equipe.trim()) return setEquipe(pessoa.equipe ?? '');
    if (equipe.trim() !== pessoa.equipe) await salvarDivisao('equipe', equipe);
  }

  async function vincular(colaboradorId: string) {
    const { erro } = await ops.vincular(operacaoId, pessoa.nome_base, colaboradorId || null);
    if (erro) toast(erro, 'erro');
  }

  const listaId = `equipes-${operacaoId}`;

  return (
    <tr className={pessoa.modo === 'sem_pagamento' ? 'text-slate-400' : ''}>
      <td className="whitespace-nowrap px-3 py-2 font-medium text-tinta">{pessoa.nome_base}</td>
      <td className="px-3 py-2">
        <select
          value={pessoa.colaborador_id ?? ''}
          onChange={(e) => vincular(e.target.value)}
          className={`${campo} py-1.5 ${pessoa.colaborador_id ? '' : 'border-amber-300 text-amber-800'}`}
        >
          <option value="">Sem cadastro (fica separado)</option>
          {ops.colaboradores
            .filter((c) => c.ativo || c.id === pessoa.colaborador_id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.ativo ? '' : ' (desligado)'}
              </option>
            ))}
        </select>
      </td>
      <td className="px-3 py-2 text-right">{pessoa.dias}</td>
      <td className="px-3 py-2 text-right font-medium">{pessoa.ftds}</td>
      <td className="px-3 py-2 text-right">{pessoa.rejeitados || '—'}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <select value={pessoa.modo} onChange={(e) => trocarModo(e.target.value as ModoDivisao)} className={`${campo} py-1.5`}>
            <option value="individual">Individual</option>
            <option value="equipe">Equipe</option>
            <option value="sem_pagamento">Sem pagamento</option>
          </select>
          {pessoa.modo === 'equipe' && (
            <>
              <input
                list={listaId}
                value={equipe}
                onChange={(e) => setEquipe(e.target.value)}
                onBlur={salvarEquipe}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className={`${campo} w-32 py-1.5`}
                aria-label="Nome da equipe"
              />
              <datalist id={listaId}>
                {nomesEquipes.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right font-medium">{formatarMoeda(pessoa.valor)}</td>
    </tr>
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
