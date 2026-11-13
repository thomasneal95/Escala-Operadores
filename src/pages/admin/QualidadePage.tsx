import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  useRelatoriosQualidade,
  type OperadorQualidade,
  type RelatorioQualidade,
  type Topico,
} from '../../features/qualidade/useRelatoriosQualidade';
import { lerRelatorioQualidade, type Gravidade, type TipoTopico } from '../../lib/lerRelatorioQualidade';
import { useConfirm, useToast } from '../../components/FeedbackProvider';

const MODELO_URL = '/modelos/modelo-relatorio-qualidade.xlsx';

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function rotuloMes(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  const texto = new Date(Date.UTC(ano, m - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Liga o nome do arquivo ao cadastro: nome igual, ou um nome contido no outro
// quando só existe uma possibilidade (ex.: "Ana Paula" ↔ "Ana Paula Souza").
function acharOperador(nome: string, operadores: OperadorQualidade[]) {
  const alvo = normalizar(nome);
  if (!alvo) return null;
  const igual = operadores.find((o) => normalizar(o.nome) === alvo);
  if (igual) return igual.id;
  const parecidos = operadores.filter((o) => {
    const n = normalizar(o.nome);
    return n.startsWith(`${alvo} `) || alvo.startsWith(`${n} `);
  });
  return parecidos.length === 1 ? parecidos[0].id : null;
}

const rotuloGravidade: Record<Gravidade, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };
const corGravidade: Record<Gravidade, string> = {
  baixa: 'bg-slate-100 text-slate-600',
  media: 'bg-amber-100 text-amber-800',
  alta: 'bg-red-100 text-red-700',
};

function corNota(nota: number | null) {
  if (nota === null) return 'bg-slate-100 text-slate-500';
  if (nota >= 8) return 'bg-esmeralda-light text-esmeralda-dark';
  if (nota >= 6) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-700';
}

function topicoValido(t: Topico) {
  return t.categoria.trim() !== '' && t.descricao.trim() !== '';
}

// ---------------------------------------------------------------------------

interface Rascunho {
  arquivo: File;
  colaboradorId: string;
  operadorNome: string;
  dataAvaliacao: string;
  periodo: string;
  avaliador: string;
  nota: string;
  resumo: string;
  topicos: TopicoRascunho[];
  avisos: string[];
}

type TopicoRascunho = Topico & { uid: string };

export function QualidadePage() {
  const { relatorios, operadores, carregando, erro, salvar, baixarArquivo, excluir } = useRelatoriosQualidade();
  const toast = useToast();
  const confirmar = useConfirm();
  const entradaArquivo = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [filtroOperador, setFiltroOperador] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);

  const [arrastando, setArrastando] = useState(false);

  // Arquivo solto fora da área de envio: o navegador abriria o arquivo e
  // sairia do site.
  useEffect(() => {
    const impedir = (e: globalThis.DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', impedir);
    window.addEventListener('drop', impedir);
    return () => {
      window.removeEventListener('dragover', impedir);
      window.removeEventListener('drop', impedir);
    };
  }, []);
  const ocupado = lendo || salvando || carregando;

  function handleArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (arquivo) processarArquivo(arquivo);
  }

  function handleSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    if (ocupado) return;
    const arquivos = [...e.dataTransfer.files];
    if (arquivos.length === 0) return;
    if (arquivos.length > 1) toast('Solte um relatório por vez. Vou abrir só o primeiro.', 'info');
    const arquivo = arquivos[0];
    if (!/\.(xlsx|xlsm|xls)$/i.test(arquivo.name)) {
      toast('O relatório precisa ser um arquivo Excel (.xlsx), no modelo da aba Qualidade.', 'erro');
      return;
    }
    processarArquivo(arquivo);
  }

  async function processarArquivo(arquivo: File) {
    if (rascunho) {
      const trocar = await confirmar(
        `Já há um relatório em conferência (${rascunho.arquivo.name}) que ainda não foi salvo. Descartar e abrir ${arquivo.name}?`
      );
      if (!trocar) return;
    }
    setLendo(true);
    try {
      const lido = await lerRelatorioQualidade(arquivo);
      setRascunho({
        arquivo,
        colaboradorId: acharOperador(lido.operador, operadores) ?? '',
        operadorNome: lido.operador,
        dataAvaliacao: lido.dataAvaliacao ?? '',
        periodo: lido.periodo ?? '',
        avaliador: lido.avaliador ?? '',
        nota: lido.nota === null ? '' : String(lido.nota),
        resumo: lido.resumo ?? '',
        topicos: lido.topicos.map((t) => ({ ...t, uid: crypto.randomUUID() })),
        avisos: lido.avisos,
      });
    } catch (falha) {
      toast(falha instanceof Error ? falha.message : 'Não foi possível ler o arquivo.', 'erro');
    } finally {
      setLendo(false);
    }
  }

  async function handleSalvar() {
    if (!rascunho) return;
    const operadorCadastro = operadores.find((o) => o.id === rascunho.colaboradorId);
    const operadorNome = rascunho.operadorNome.trim() || operadorCadastro?.nome || '';
    const nota = rascunho.nota.trim() === '' ? null : Number(rascunho.nota.replace(',', '.'));

    if (!operadorNome) return toast('Informe o operador avaliado.', 'erro');
    if (!rascunho.dataAvaliacao) return toast('Informe a data da avaliação.', 'erro');
    if (nota !== null && !(Number.isFinite(nota) && nota >= 0 && nota <= 10)) {
      return toast('A nota precisa estar entre 0 e 10.', 'erro');
    }
    if (rascunho.topicos.some((t) => !topicoValido(t))) {
      return toast('Há tópicos sem categoria ou descrição. Complete ou remova antes de salvar.', 'erro');
    }

    setSalvando(true);
    const resultado = await salvar(
      {
        colaborador_id: rascunho.colaboradorId || null,
        operador_nome: operadorNome,
        data_avaliacao: rascunho.dataAvaliacao,
        periodo: rascunho.periodo,
        avaliador: rascunho.avaliador,
        nota,
        resumo: rascunho.resumo,
        topicos: rascunho.topicos,
      },
      rascunho.arquivo
    );
    setSalvando(false);
    if (resultado.erro) return toast(resultado.erro, 'erro');
    toast('Relatório salvo.', 'sucesso');
    setRascunho(null);
  }

  async function handleExcluir(r: RelatorioQualidade) {
    const ok = await confirmar(
      `Excluir o relatório de ${r.operador_nome} de ${formatarData(r.data_avaliacao)}?\n\n` +
        'O arquivo original e os tópicos também serão apagados. Esta ação não pode ser desfeita.'
    );
    if (!ok) return;
    const resultado = await excluir(r);
    if (resultado.erro) toast(resultado.erro, 'erro');
    else toast('Relatório excluído.', 'sucesso');
  }

  async function handleBaixar(r: RelatorioQualidade) {
    const resultado = await baixarArquivo(r);
    if (resultado.erro) toast(resultado.erro, 'erro');
  }

  const meses = useMemo(
    () => [...new Set(relatorios.map((r) => r.data_avaliacao.slice(0, 7)))].sort().reverse(),
    [relatorios]
  );

  const operadoresComRelatorio = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const r of relatorios) {
      const chave = r.colaborador_id ?? `n:${normalizar(r.operador_nome)}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, operadores.find((o) => o.id === r.colaborador_id)?.nome ?? r.operador_nome);
      }
    }
    return [...mapa].sort((a, b) => a[1].localeCompare(b[1]));
  }, [relatorios, operadores]);

  const filtrados = relatorios.filter(
    (r) =>
      (!filtroMes || r.data_avaliacao.startsWith(filtroMes)) &&
      (!filtroOperador || (r.colaborador_id ?? `n:${normalizar(r.operador_nome)}`) === filtroOperador)
  );

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">Qualidade</p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">Relatórios de qualidade do atendimento</h1>
      <p className="mt-2 text-sm text-slate-500">
        Envie o relatório preenchido no modelo em Excel. O site separa os pontos positivos e os pontos de
        melhoria em tópicos para você conferir antes de salvar, e guarda o arquivo original.
      </p>

      <div
        role="button"
        tabIndex={0}
        onClick={() => !ocupado && entradaArquivo.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !ocupado) {
            e.preventDefault();
            entradaArquivo.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = ocupado ? 'none' : 'copy';
          if (!arrastando) setArrastando(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false);
        }}
        onDrop={handleSoltar}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition ${
          arrastando
            ? 'border-esmeralda bg-esmeralda-light'
            : 'border-slate-300 bg-white hover:border-esmeralda/60 hover:bg-slate-50'
        } ${ocupado ? 'cursor-wait opacity-60' : ''}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-8 w-8 text-esmeralda">
          <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium text-tinta">
          {lendo ? 'Lendo arquivo...' : arrastando ? 'Solte o arquivo aqui' : 'Arraste o relatório aqui'}
        </p>
        {!lendo && !arrastando && (
          <p className="text-xs text-slate-500">
            ou <span className="font-medium text-esmeralda-dark underline">clique para escolher</span> · Excel
            (.xlsx) no modelo
          </p>
        )}
        <input
          ref={entradaArquivo}
          type="file"
          accept=".xlsx,.xlsm,.xls"
          onChange={handleArquivo}
          className="hidden"
        />
      </div>
      <a
        href={MODELO_URL}
        download="modelo-relatorio-qualidade.xlsx"
        className="mt-3 inline-block text-sm font-medium text-ceruleo hover:underline"
      >
        Baixar modelo em branco
      </a>

      {erro && <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {rascunho && (
        <ConferenciaRelatorio
          rascunho={rascunho}
          operadores={operadores}
          salvando={salvando}
          onAlterar={setRascunho}
          onSalvar={handleSalvar}
          onCancelar={() => setRascunho(null)}
        />
      )}

      <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-tinta">
          Relatórios salvos{' '}
          <span className="text-sm font-normal text-slate-400">
            ({filtrados.length}
            {filtrados.length !== relatorios.length ? ` de ${relatorios.length}` : ''})
          </span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={filtroOperador}
            onChange={(e) => setFiltroOperador(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">Todos os operadores</option>
            {operadoresComRelatorio.map(([chave, nome]) => (
              <option key={chave} value={chave}>
                {nome}
              </option>
            ))}
          </select>
          <select
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">Todos os meses</option>
            {meses.map((m) => (
              <option key={m} value={m}>
                {rotuloMes(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {carregando ? (
        <p className="mt-4 text-sm text-slate-400">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          {relatorios.length === 0 ? 'Nenhum relatório enviado ainda.' : 'Nenhum relatório com esses filtros.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtrados.map((r) => (
            <ItemRelatorio
              key={r.id}
              relatorio={r}
              nomeCadastro={operadores.find((o) => o.id === r.colaborador_id)?.nome ?? null}
              aberto={aberto === r.id}
              onAlternar={() => setAberto(aberto === r.id ? null : r.id)}
              onBaixar={() => handleBaixar(r)}
              onExcluir={() => handleExcluir(r)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conferência antes de salvar

function ConferenciaRelatorio({
  rascunho,
  operadores,
  salvando,
  onAlterar,
  onSalvar,
  onCancelar,
}: {
  rascunho: Rascunho;
  operadores: OperadorQualidade[];
  salvando: boolean;
  onAlterar: (r: Rascunho) => void;
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  const campo = <K extends keyof Rascunho>(chave: K, valor: Rascunho[K]) => onAlterar({ ...rascunho, [chave]: valor });
  const alterarTopico = (i: number, t: Topico) =>
    campo('topicos', rascunho.topicos.map((atual, j) => (j === i ? { ...t, uid: atual.uid } : atual)));
  const removerTopico = (i: number) => campo('topicos', rascunho.topicos.filter((_, j) => j !== i));
  const adicionarTopico = (tipo: TipoTopico) =>
    campo('topicos', [
      ...rascunho.topicos,
      { tipo, categoria: '', descricao: '', gravidade: null, exemplo: null, uid: crypto.randomUUID() },
    ]);

  const indices = rascunho.topicos.map((t, i) => ({ t, i }));
  const positivos = indices.filter(({ t }) => t.tipo === 'positivo');
  const melhorias = indices.filter(({ t }) => t.tipo === 'melhoria');
  const operadorEncontrado = rascunho.colaboradorId !== '';

  const entrada = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda';

  return (
    <div className="mt-6 rounded-lg border border-esmeralda/40 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-tinta">Conferir antes de salvar</h2>
          <p className="text-xs text-slate-500">Arquivo: {rascunho.arquivo.name}</p>
        </div>
        <p className="text-sm text-slate-500">
          {positivos.length} positivo(s) · {melhorias.length} de melhoria
        </p>
      </div>

      {rascunho.avisos.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 rounded-md bg-amber-50 px-8 py-3 text-sm text-amber-800">
          {rascunho.avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm font-medium text-slate-700">
          Operador (cadastro)
          <select
            value={rascunho.colaboradorId}
            onChange={(e) => campo('colaboradorId', e.target.value)}
            className={`${entrada} bg-white`}
          >
            <option value="">— Não vincular —</option>
            {operadores.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
                {o.ativo ? '' : ' (inativo)'}
              </option>
            ))}
          </select>
          <span className={`mt-1 block text-xs ${operadorEncontrado ? 'text-slate-400' : 'text-amber-700'}`}>
            No arquivo: "{rascunho.operadorNome || 'em branco'}"
            {operadorEncontrado ? '' : ' — não encontrei no cadastro; escolha acima se for alguém da lista.'}
          </span>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Data da avaliação
          <input
            type="date"
            value={rascunho.dataAvaliacao}
            onChange={(e) => campo('dataAvaliacao', e.target.value)}
            className={entrada}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Nota geral (0 a 10)
          <input
            type="text"
            inputMode="decimal"
            value={rascunho.nota}
            onChange={(e) => campo('nota', e.target.value)}
            className={entrada}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Período avaliado
          <input type="text" value={rascunho.periodo} onChange={(e) => campo('periodo', e.target.value)} className={entrada} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Avaliador
          <input type="text" value={rascunho.avaliador} onChange={(e) => campo('avaliador', e.target.value)} className={entrada} />
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-3">
          Resumo
          <textarea value={rascunho.resumo} onChange={(e) => campo('resumo', e.target.value)} rows={2} className={entrada} />
        </label>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ColunaTopicos
          titulo="Pontos positivos"
          tom="positivo"
          itens={positivos}
          onAlterar={alterarTopico}
          onRemover={removerTopico}
          onAdicionar={() => adicionarTopico('positivo')}
        />
        <ColunaTopicos
          titulo="Pontos de melhoria"
          tom="melhoria"
          itens={melhorias}
          onAlterar={alterarTopico}
          onRemover={removerTopico}
          onAdicionar={() => adicionarTopico('melhoria')}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={onSalvar}
          disabled={salvando}
          className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-60"
        >
          {salvando ? 'Salvando...' : 'Salvar relatório'}
        </button>
        <button
          onClick={onCancelar}
          disabled={salvando}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ColunaTopicos({
  titulo,
  tom,
  itens,
  onAlterar,
  onRemover,
  onAdicionar,
}: {
  titulo: string;
  tom: TipoTopico;
  itens: { t: TopicoRascunho; i: number }[];
  onAlterar: (i: number, t: Topico) => void;
  onRemover: (i: number) => void;
  onAdicionar: () => void;
}) {
  return (
    <div>
      <p className={`text-sm font-semibold ${tom === 'positivo' ? 'text-esmeralda-dark' : 'text-amber-700'}`}>
        {titulo} ({itens.length})
      </p>
      <div className="mt-2 space-y-2">
        {itens.map(({ t, i }) => (
          <CartaoTopicoEditavel key={t.uid} topico={t} onAlterar={(novo) => onAlterar(i, novo)} onRemover={() => onRemover(i)} />
        ))}
        {itens.length === 0 && <p className="text-sm text-slate-400">Nenhum.</p>}
      </div>
      <button onClick={onAdicionar} className="mt-2 text-sm font-medium text-ceruleo hover:underline">
        + Adicionar tópico
      </button>
    </div>
  );
}

function CartaoTopicoEditavel({
  topico,
  onAlterar,
  onRemover,
}: {
  topico: Topico;
  onAlterar: (t: Topico) => void;
  onRemover: () => void;
}) {
  const [editando, setEditando] = useState(!topicoValido(topico));
  const entrada = 'mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm';

  if (!editando) {
    return (
      <div className="rounded-md border border-slate-200 p-3">
        <CorpoTopico topico={topico} />
        <div className="mt-2 flex gap-3 text-xs">
          <button onClick={() => setEditando(true)} className="font-medium text-ceruleo hover:underline">
            Editar
          </button>
          <button onClick={onRemover} className="font-medium text-red-600 hover:underline">
            Remover
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-ceruleo/40 bg-slate-50 p-3 text-xs text-slate-600">
      <div className="grid grid-cols-2 gap-2">
        <label>
          Tipo
          <select
            value={topico.tipo}
            onChange={(e) => {
              const tipo = e.target.value as TipoTopico;
              onAlterar({ ...topico, tipo, gravidade: tipo === 'melhoria' ? topico.gravidade : null });
            }}
            className={`${entrada} bg-white`}
          >
            <option value="positivo">Ponto positivo</option>
            <option value="melhoria">Ponto de melhoria</option>
          </select>
        </label>
        {topico.tipo === 'melhoria' ? (
          <label>
            Gravidade
            <select
              value={topico.gravidade ?? ''}
              onChange={(e) => onAlterar({ ...topico, gravidade: (e.target.value || null) as Gravidade | null })}
              className={`${entrada} bg-white`}
            >
              <option value="">—</option>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </label>
        ) : (
          <span />
        )}
      </div>
      <label className="block">
        Categoria
        <input value={topico.categoria} onChange={(e) => onAlterar({ ...topico, categoria: e.target.value })} className={entrada} />
      </label>
      <label className="block">
        Descrição
        <textarea
          value={topico.descricao}
          onChange={(e) => onAlterar({ ...topico, descricao: e.target.value })}
          rows={2}
          className={entrada}
        />
      </label>
      <label className="block">
        Exemplo (opcional)
        <input
          value={topico.exemplo ?? ''}
          onChange={(e) => onAlterar({ ...topico, exemplo: e.target.value || null })}
          className={entrada}
        />
      </label>
      <div className="flex gap-3">
        <button
          onClick={() => setEditando(false)}
          disabled={!topicoValido(topico)}
          className="font-medium text-esmeralda-dark hover:underline disabled:opacity-50"
        >
          Pronto
        </button>
        <button onClick={onRemover} className="font-medium text-red-600 hover:underline">
          Remover
        </button>
      </div>
    </div>
  );
}

function CorpoTopico({ topico }: { topico: Topico }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            topico.tipo === 'positivo' ? 'bg-esmeralda-light text-esmeralda-dark' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {topico.categoria}
        </span>
        {topico.gravidade && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${corGravidade[topico.gravidade]}`}>
            {rotuloGravidade[topico.gravidade]}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm text-tinta">{topico.descricao}</p>
      {topico.exemplo && <p className="mt-1 text-xs italic text-slate-500">{topico.exemplo}</p>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Lista de relatórios salvos

function ItemRelatorio({
  relatorio: r,
  nomeCadastro,
  aberto,
  onAlternar,
  onBaixar,
  onExcluir,
}: {
  relatorio: RelatorioQualidade;
  nomeCadastro: string | null;
  aberto: boolean;
  onAlternar: () => void;
  onBaixar: () => void;
  onExcluir: () => void;
}) {
  const positivos = r.topicos.filter((t) => t.tipo === 'positivo');
  const melhorias = r.topicos.filter((t) => t.tipo === 'melhoria');

  return (
    <li className="rounded-lg border border-slate-200 bg-white">
      <button onClick={onAlternar} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left">
        <span className={`rounded-md px-2 py-1 text-sm font-semibold tabular-nums ${corNota(r.nota)}`}>
          {r.nota === null ? '—' : r.nota.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-tinta">{nomeCadastro ?? r.operador_nome}</span>
          <span className="block text-xs text-slate-500">
            {formatarData(r.data_avaliacao)}
            {r.periodo ? ` · ${r.periodo}` : ''}
            {r.avaliador ? ` · por ${r.avaliador}` : ''}
          </span>
          <span className="mt-0.5 block text-xs">
            <span className="text-esmeralda-dark">{positivos.length} positivo(s)</span>
            <span className="text-slate-400"> · </span>
            <span className="text-amber-700">{melhorias.length} de melhoria</span>
          </span>
        </span>
        <span className={`text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {aberto && (
        <div className="border-t border-slate-100 px-4 py-4">
          {!r.colaborador_id && (
            <p className="mb-3 text-xs text-amber-700">Não vinculado a um cadastro de colaborador.</p>
          )}
          {r.resumo && <p className="text-sm text-slate-600">{r.resumo}</p>}
          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[
              { titulo: 'Pontos positivos', lista: positivos, cor: 'text-esmeralda-dark' },
              { titulo: 'Pontos de melhoria', lista: melhorias, cor: 'text-amber-700' },
            ].map(({ titulo, lista, cor }) => (
              <div key={titulo}>
                <p className={`text-sm font-semibold ${cor}`}>
                  {titulo} ({lista.length})
                </p>
                <div className="mt-2 space-y-2">
                  {lista.map((t, i) => (
                    <div key={i} className="rounded-md border border-slate-200 p-3">
                      <CorpoTopico topico={t} />
                    </div>
                  ))}
                  {lista.length === 0 && <p className="text-sm text-slate-400">Nenhum.</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {r.arquivo_path && (
              <button onClick={onBaixar} className="font-medium text-ceruleo hover:underline">
                Baixar arquivo original
              </button>
            )}
            <button onClick={onExcluir} className="font-medium text-red-600 hover:underline">
              Excluir relatório
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
