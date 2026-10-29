import { useEffect, useState } from 'react';

// Evento do Chrome/Edge/Android que permite abrir o pedido de instalação.
interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __eventoInstalacao?: EventoInstalacao | null;
  }
}

// O navegador pode disparar o evento antes de o React montar a tela; por isso
// ele é guardado já no carregamento (main.tsx chama esta função).
export function capturarEventoInstalacao() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__eventoInstalacao = e as EventoInstalacao;
    window.dispatchEvent(new Event('instalacao-disponivel'));
  });
  window.addEventListener('appinstalled', () => {
    window.__eventoInstalacao = null;
    window.dispatchEvent(new Event('instalacao-disponivel'));
  });
}

function jaInstalado() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function ehIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Como o app pode ser instalado neste aparelho:
// - 'prompt': o navegador abre o pedido de instalação (Android, Chrome, Edge);
// - 'ios': no iPhone/iPad é preciso usar Compartilhar → Adicionar à Tela de Início;
// - null: já está instalado ou o navegador não permite.
export function useInstalarApp() {
  const [evento, setEvento] = useState(() => window.__eventoInstalacao ?? null);
  const [instalado, setInstalado] = useState(jaInstalado);

  useEffect(() => {
    const atualizar = () => {
      setEvento(window.__eventoInstalacao ?? null);
      setInstalado(jaInstalado());
    };
    window.addEventListener('instalacao-disponivel', atualizar);
    return () => window.removeEventListener('instalacao-disponivel', atualizar);
  }, []);

  const modo: 'prompt' | 'ios' | null = instalado ? null : evento ? 'prompt' : ehIos() ? 'ios' : null;

  async function instalar() {
    if (!evento) return false;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    window.__eventoInstalacao = null;
    setEvento(null);
    if (outcome === 'accepted') setInstalado(true);
    return outcome === 'accepted';
  }

  return { modo, instalar };
}
