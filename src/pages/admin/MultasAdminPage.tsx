import { useState } from 'react';
import {
  useSolicitacoesMultaAdmin,
  type SolicitacaoMultaAdmin,
} from '../../features/multas/useSolicitacoesMultaAdmin';
import { useToast, useConfirm } from '../../components/FeedbackProvider';

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
}

function LinhaDecisao({
  solicitacao,
  colaboradores,
  processando,
  onDecidir,
  onVerImagem,
}: LinhaDecisaoProps) {
  const [colaboradorFinalId, setColaboradorFinalId] = useState(
    solicitacao.colaboradorApontadoId ?? ''
  );
  const [justificativa, setJustificativa] = useState('');
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
        </select>
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
    obterUrlImagem,
  } = useSolicitacoesMultaAdmin();
  const toast = useToast();
  const confirmar = useConfirm();

  const [filtroTurnoId, setFiltroTurnoId] = useState('');
  const [filtroColaboradorId, setFiltroColaboradorId] = useState('');

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

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
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
                <p className="font-medium text-tinta">
                  {s.colaboradorApontadoNome ?? 'Não sabe informar'}
                  <span className="ml-2 font-normal text-slate-400">· {s.turnoNome}</span>
                </p>
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
                <p className="font-medium text-tinta">
                  {s.colaboradorFinalNome ?? s.colaboradorApontadoNome ?? '(não definido)'}
                  <span className="ml-2 font-normal text-slate-400">· {s.turnoNome}</span>
                </p>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
