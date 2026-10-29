import { useState } from 'react';
import { usePushNotificacoes } from '../features/notificacoes/usePushNotificacoes';
import { useToast } from './FeedbackProvider';

const CHAVE_DISPENSADO = 'jornada360-notificacoes-dispensado-ate';
const DIAS_DISPENSADO = 30;

function dispensadoAgora() {
  try {
    return Number(localStorage.getItem(CHAVE_DISPENSADO) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

// Card da tela inicial que convida a ativar as notificações neste aparelho.
// Só aparece quando o aparelho permite (no iPhone, com o app instalado) e
// as notificações ainda não estão ativas; "Agora não" esconde por 30 dias.
export function AtivarNotificacoesCard({ textoExtra }: { textoExtra: string }) {
  const { estado, processando, ativar } = usePushNotificacoes();
  const [dispensado, setDispensado] = useState(dispensadoAgora);
  const toast = useToast();

  if (estado !== 'inativo' || dispensado) return null;

  function dispensar() {
    try {
      localStorage.setItem(CHAVE_DISPENSADO, String(Date.now() + DIAS_DISPENSADO * 86_400_000));
    } catch {
      // sem armazenamento: some só nesta visita
    }
    setDispensado(true);
  }

  async function clicarAtivar() {
    const { erro } = await ativar();
    toast(erro ?? 'Notificações ativadas neste aparelho.', erro ? 'erro' : 'sucesso');
  }

  return (
    <div className="mb-6 rounded-lg border border-esmeralda/30 bg-esmeralda-light p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-esmeralda text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-tinta">Ative as notificações</p>
          <p className="mt-0.5 text-sm text-slate-600">{textoExtra}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              onClick={clicarAtivar}
              disabled={processando}
              className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-50"
            >
              Ativar notificações
            </button>
            <button
              onClick={dispensar}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white/60"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Linha do menu lateral para ligar/desligar as notificações deste aparelho.
export function ControleNotificacoes() {
  const { estado, processando, ativar, desativar } = usePushNotificacoes();
  const toast = useToast();

  if (estado === 'carregando' || estado === 'indisponivel') return null;

  async function alternar() {
    if (estado === 'ativo') {
      await desativar();
      toast('Notificações desativadas neste aparelho.');
      return;
    }
    const { erro } = await ativar();
    toast(erro ?? 'Notificações ativadas neste aparelho.', erro ? 'erro' : 'sucesso');
  }

  return (
    <div className="rounded-md px-3 py-2">
      <p className="text-xs text-slate-400">Notificações neste aparelho</p>
      {estado === 'bloqueado' ? (
        <p className="mt-0.5 text-xs text-slate-300">Bloqueadas. Libere nos ajustes do celular para este app.</p>
      ) : (
        <button
          onClick={alternar}
          disabled={processando}
          className="mt-0.5 text-sm font-medium text-esmeralda hover:underline disabled:opacity-50"
        >
          {estado === 'ativo' ? 'Ativadas · desativar' : 'Desativadas · ativar'}
        </button>
      )}
    </div>
  );
}
