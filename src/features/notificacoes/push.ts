import { supabase } from '../../lib/supabase/client';

// Chave pública de envio (VAPID). Pública por natureza; a privada fica só
// nos segredos da edge function enviar-push.
export const CHAVE_PUBLICA_VAPID =
  'BI2u4waeGOMdIz7i18JLj28ebXIXAdfeCcqDFOQgDQEH_cGnMrQBqBc-fZqF6o4ScSUbJ14iRK0GrmYG4Ja7aJc';

export type EstadoPush = 'carregando' | 'indisponivel' | 'bloqueado' | 'inativo' | 'ativo';

export function suportaPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function paraBytes(base64url: string) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export async function inscricaoAtual() {
  const reg = await navigator.serviceWorker.getRegistration();
  return { reg, inscricao: (await reg?.pushManager.getSubscription()) ?? null };
}

export async function salvarNoServidor(inscricao: PushSubscription) {
  const json = inscricao.toJSON();
  const { error } = await supabase.rpc('registrar_push', {
    p_endpoint: inscricao.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_dispositivo: navigator.userAgent.slice(0, 200),
  });
  return error;
}

// Ao sair do sistema: este aparelho para de receber as notificações de quem
// estava logado (chamado antes do signOut, ainda com a sessão válida).
export async function desligarPushDesteAparelho() {
  try {
    if (!suportaPush()) return;
    const { inscricao } = await inscricaoAtual();
    if (!inscricao) return;
    await supabase.rpc('remover_push', { p_endpoint: inscricao.endpoint });
    await inscricao.unsubscribe();
  } catch {
    // sem conexão: o aparelho é reaproveitado no próximo login
  }
}
