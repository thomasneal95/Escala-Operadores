import { useState } from 'react';
import {
  useSolicitacoesMultaAdmin,
  TODOS_DO_TURNO,
  type SolicitacaoMultaAdmin,
} from '../../features/multas/useSolicitacoesMultaAdmin';
import { useToast, useConfirm } from '../../components/FeedbackProvider';
import { SecaoRecolhivel } from '../../components/SecaoRecolhivel';
import { RegrasMultasEditor } from '../../components/RegrasMultasEditor';

const rotuloStatus: Record<string, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
};

const corStatus: Record<string, string> = {
  pendente: 'bg-amber-50 text-amber-700',
  aprovada: 'bg-esmeralda-light text-esmeralda-dark',
  recusada: 'bg-slate-200 text-slate-700',
};

function formatarDataHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR').slice(0, 5);
}

interface LinhaDecisaoProps {
  solicitacao: SolicitacaoMultaAdmin;
  colaboradores: { id: string; nome_completo: string }[];
  processando: boolean;
  onDecidir: (
    status: 'aprovada' | 'recusada',
    justificativa: string,
    colaboradorFinalId: string | null
  ) => Promise<void>;
  onVerImagem: (caminho: string) => void;
  onCancelar?: () => void;
}

function LinhaDecisao({
  solicitacao,
  colaboradores,
  processando,
  onDecidir,
  onVerImagem,
  onCancelar,
}: LinhaDecisaoProps) {
  const [colaboradorFinalId, setColaboradorFinalId] = useState(
    solicitacao.colaboradorFinalId ?? solicitacao.colaboradorApontadoId ?? ''
  );
  const [justificativa, setJustificativa] = useState(solicitacao.justificativaAdmin ?? '');
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  async function handleClick(status: 'aprovada' | 'recusada') {
    setErroLocal(null);

    if (!justificativa.trim()) {
      setErroLocal('Informe a justificativa da decisão.');
      return;
    }
    if (status === 'aprovada' && !colaboradorFinalId) {
      setErroLocal('Selecione quem vai levar a multa.');
      return;
    }

    await onDecidir(status, justificativa, colaboradorFinalId || null);
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
      <div>
        <label className="block text-xs font-medium text-slate-600">Quem vai levar a multa</label>
        <select
          value={colaboradorFinalId}
          onChange={(e) => setColaboradorFinalId(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
        >
          <option value="">Selecione...</option>
          {colaboradores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome_completo}
            </option>
          ))}
          <option value={TODOS_DO_TURNO}>Todos (todo mundo desse turno)</option>
        </select>
        {colaboradorFinalId === TODOS_DO_TURNO && (
          <p className="mt-1 text-xs text-amber-700">
            Ao aprovar, cria uma multa aprovada para cada operador ativo que tem{' '}
            {solicitacao.turnoNome} como turno da semana.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">Justificativa</label>
        <textarea
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
        />
      </div>

      {solicitacao.imagens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {solicitacao.imagens.map((caminho, i) => (
            <button
              key={caminho}
              type="button"
              onClick={() => onVerImagem(caminho)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Ver imagem {i + 1}
            </button>
          ))}
        </div>
      )}

      {erroLocal && <p className="text-xs text-red-600">{erroLocal}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleClick('aprovada')}
          disabled={processando}
          className="rounded-md bg-esmeralda px-3 py-1.5 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-60"
        >
          {processando ? 'Enviando...' : 'Aprovar multa'}
        </button>
        <button
          type="button"
          onClick={() => handleClick('recusada')}
          disabled={processando}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          {processando ? 'Enviando...' : 'Recusar'}
        </button>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            disabled={processando}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-60"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

export function MultasAdminPage() {
  const {
    solicitacoes,
    colaboradores,
    turnos,
    carregando,
    processando,
    erro,
    decidir,
    excluir,
    excluirVarias,
    obterUrlImagem,
  } = useSolicitacoesMultaAdmin();
  const toast = useToast();
  const confirmar = useConfirm();

  const [filtroTurnoId, setFiltroTurnoId] = useState('');
  const [filtroColaboradorId, setFiltroColaboradorId] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  function alternarSelecao(id: string) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  }

  async function handleVerImagem(caminho: string) {
    const url = await obterUrlImagem(caminho);
    if (!url) {
      toast('Não foi possível abrir a imagem.', 'erro');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleDecidir(
    id: string,
    status: 'aprovada' | 'recusada',
    justificativa: string,
    colaboradorFinalId: string | null
  ) {
    const confirmou = await confirmar({
      titulo: status === 'aprovada' ? 'Aprovar multa?' : 'Recusar apontamento?',
      mensagem:
        status === 'aprovada'
          ? 'Isso registra a multa como aplicada, com a pessoa e a justificativa informadas.'
          : 'Isso registra o apontamento como recusado, com a justificativa informada.',
      textoConfirmar: status === 'aprovada' ? 'Aprovar' : 'Recusar',
      perigoso: status === 'recusada',
    });
    if (!confirmou) return;

    const resultado = await decidir(id, { status, justificativa, colaboradorFinalId });
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }
    setEditandoId(null);
    toast('Decisão registrada.');
  }

  async function handleExcluir(id: string) {
    const confirmou = await confirmar({
      titulo: 'Excluir esta solicitação?',
      mensagem:
        'Isso apaga o apontamento permanentemente, incluindo as imagens de comprovação. Esta ação não pode ser desfeita.',
      textoConfirmar: 'Excluir',
      perigoso: true,
    });
    if (!confirmou) return;

    const resultado = await excluir(id);
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }
    toast('Solicitação excluída.');
  }

  async function handleExcluirSelecionadas() {
    const ids = [...selecionadas];
    if (ids.length === 0) return;

    const confirmou = await confirmar({
      titulo: `Excluir ${ids.length} solicitaç${ids.length > 1 ? 'ões' : 'ão'}?`,
      mensagem:
        'Isso apaga permanentemente todas as solicitações selecionadas, incluindo as imagens de comprovação. Esta ação não pode ser desfeita.',
      textoConfirmar: 'Excluir selecionadas',
      perigoso: true,
    });
    if (!confirmou) return;

    const resultado = await excluirVarias(ids);
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }
    setSelecionadas(new Set());
    toast(`${ids.length} solicitaç${ids.length > 1 ? 'ões excluídas' : 'ão excluída'}.`);
  }

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  const pessoaFiltro = (s: SolicitacaoMultaAdmin) => s.colaboradorFinalId ?? s.colaboradorApontadoId;

  const filtradas = solicitacoes.filter((s) => {
    if (filtroTurnoId && s.turnoId !== filtroTurnoId) return false;
    if (filtroColaboradorId && pessoaFiltro(s) !== filtroColaboradorId) return false;
    return true;
  });

  const pendentes = filtradas.filter((s) => s.status === 'pendente');
  const decididas = filtradas.filter((s) => s.status !== 'pendente');

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      <SecaoRecolhivel
        titulo="Editar regras exibidas para os colaboradores"
        padraoAberta={false}
        descricao="Categorias, ícones e o texto de alerta do dashboard de multas."
      >
        <RegrasMultasEditor />
      </SecaoRecolhivel>

      <div className="mt-6 flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-600">Turno</label>
          <select
            value={filtroTurnoId}
            onChange={(e) => setFiltroTurnoId(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
          >
            <option value="">Todos</option>
            {turnos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600">Operador</label>
          <select
            value={filtroColaboradorId}
            onChange={(e) => setFiltroColaboradorId(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
          >
            <option value="">Todos</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome_completo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtradas.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setSelecionadas(
                  selecionadas.size === filtradas.length
                    ? new Set()
                    : new Set(filtradas.map((s) => s.id))
                )
              }
              className="text-sm font-medium text-ceruleo hover:text-ceruleo/80"
            >
              {selecionadas.size === filtradas.length ? 'Limpar seleção' : 'Selecionar todas visíveis'}
            </button>
            {selecionadas.size > 0 && (
              <span className="text-sm text-slate-500">{selecionadas.size} selecionada(s)</span>
            )}
          </div>
          {selecionadas.size > 0 && (
            <button
              type="button"
              onClick={handleExcluirSelecionadas}
              disabled={processando === 'varias'}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {processando === 'varias' ? 'Excluindo...' : 'Excluir selecionadas'}
            </button>
          )}
        </div>
      )}

      <p className="mt-6 font-mono text-xs font-medium uppercase tracking-widest text-slate-400">
        Pendentes · {pendentes.length}
      </p>

      {pendentes.length === 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Nenhuma solicitação pendente.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {pendentes.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selecionadas.has(s.id)}
                    onChange={() => alternarSelecao(s.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-esmeralda focus:ring-esmeralda"
                    aria-label="Selecionar solicitação"
                  />
                  <p className="font-medium text-tinta">
                    {s.colaboradorApontadoNome ?? 'Não sabe informar'}
                    <span className="ml-2 font-normal text-slate-400">· {s.turnoNome}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${corStatus[s.status]}`}>
                    {rotuloStatus[s.status]}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleExcluir(s.id)}
                    disabled={processando === s.id}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Excluir
                  </button>
                </div>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-400">
                {formatarDataHora(s.criado_em)} · reportado por {s.reportanteNome}
                {s.anonimo && ' (anônimo para os colaboradores)'}
              </p>

              <LinhaDecisao
                solicitacao={s}
                colaboradores={colaboradores}
                processando={processando === s.id}
                onDecidir={(status, justificativa, colaboradorFinalId) =>
                  handleDecidir(s.id, status, justificativa, colaboradorFinalId)
                }
                onVerImagem={handleVerImagem}
              />
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 font-mono text-xs font-medium uppercase tracking-widest text-slate-400">
        Decididas · {decididas.length}
      </p>

      {decididas.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Nenhuma solicitação decidida ainda.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {decididas.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selecionadas.has(s.id)}
                    onChange={() => alternarSelecao(s.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-esmeralda focus:ring-esmeralda"
                    aria-label="Selecionar solicitação"
                  />
                  <p className="font-medium text-tinta">
                    {s.colaboradorFinalNome ?? s.colaboradorApontadoNome ?? '(não definido)'}
                    <span className="ml-2 font-normal text-slate-400">· {s.turnoNome}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${corStatus[s.status]}`}>
                    {rotuloStatus[s.status]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditandoId(editandoId === s.id ? null : s.id)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    {editandoId === s.id ? 'Editando...' : 'Editar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluir(s.id)}
                    disabled={processando === s.id}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Excluir
                  </button>
                </div>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-400">
                {formatarDataHora(s.criado_em)} · reportado por {s.reportanteNome}
                {s.anonimo && ' (anônimo para os colaboradores)'}
              </p>

              {editandoId === s.id ? (
                <LinhaDecisao
                  solicitacao={s}
                  colaboradores={colaboradores}
                  processando={processando === s.id}
                  onDecidir={(status, justificativa, colaboradorFinalId) =>
                    handleDecidir(s.id, status, justificativa, colaboradorFinalId)
                  }
                  onVerImagem={handleVerImagem}
                  onCancelar={() => setEditandoId(null)}
                />
              ) : (
                <>
                  {s.justificativaAdmin && (
                    <p className="mt-2 text-sm text-slate-600">{s.justificativaAdmin}</p>
                  )}
                  {s.imagens.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.imagens.map((caminho, i) => (
                        <button
                          key={caminho}
                          type="button"
                          onClick={() => handleVerImagem(caminho)}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Ver imagem {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
