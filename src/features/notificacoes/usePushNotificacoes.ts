import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  CHAVE_PUBLICA_VAPID,
  desligarPushDesteAparelho,
  inscricaoAtual,
  paraBytes,
  salvarNoServidor,
  suportaPush,
  type EstadoPush,
} from './push';

export type { EstadoPush };

// Card e menu usam o hook ao mesmo tempo: quando um muda o estado, avisa o outro.
const EVENTO = 'push-estado';
function anunciar(estado: EstadoPush) {
  window.dispatchEvent(new CustomEvent<EstadoPush>(EVENTO, { detail: estado }));
}

// Notificações no celular (Web Push). No iPhone só existe com o app
// instalado na tela de início; fora dele o estado fica 'indisponivel'.
export function usePushNotificacoes() {
  const { session } = useAuth();
  const [estado, setEstado] = useState<EstadoPush>('carregando');
  const [processando, setProcessando] = useState(false);

  const verificar = useCallback(async () => {
    if (!suportaPush()) {
      setEstado('indisponivel');
      return;
    }
    const { reg, inscricao } = await inscricaoAtual();
    if (!reg) {
      setEstado('indisponivel');
      return;
    }
    if (Notification.permission === 'denied') {
      setEstado('bloqueado');
      return;
    }
    if (inscricao && Notification.permission === 'granted') {
      // Garante que o aparelho está ligado a quem está logado agora.
      await salvarNoServidor(inscricao);
      setEstado('ativo');
      return;
    }
    setEstado('inativo');
  }, []);

  useEffect(() => {
    if (session?.user) verificar();
  }, [session, verificar]);

  useEffect(() => {
    const ouvir = (e: Event) => setEstado((e as CustomEvent<EstadoPush>).detail);
    window.addEventListener(EVENTO, ouvir);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, []);

  async function ativar() {
    setProcessando(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') {
        anunciar(permissao === 'denied' ? 'bloqueado' : 'inativo');
        return { erro: 'Permissão de notificações não concedida.' };
      }
      const { reg, inscricao: existente } = await inscricaoAtual();
      if (!reg) return { erro: 'Este navegador não permite notificações.' };
      const inscricao =
        existente ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: paraBytes(CHAVE_PUBLICA_VAPID),
        }));
      const erro = await salvarNoServidor(inscricao);
      if (erro) return { erro: 'Não foi possível ativar as notificações. Tente de novo.' };
      anunciar('ativo');
      return { erro: null };
    } catch {
      return { erro: 'Não foi possível ativar as notificações neste aparelho.' };
    } finally {
      setProcessando(false);
    }
  }

  async function desativar() {
    setProcessando(true);
    await desligarPushDesteAparelho();
    setProcessando(false);
    anunciar('inativo');
  }

  return { estado, processando, ativar, desativar };
}
