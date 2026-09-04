import { useEffect, useRef } from 'react';

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Comportamento básico de acessibilidade compartilhado pelos modais do
// sistema: foca o primeiro elemento focável ao abrir, prende o Tab dentro do
// modal (focus trap), devolve o foco pra quem estava focado antes ao fechar,
// e opcionalmente fecha com Esc (passe onEscape só quando o modal puder ser
// dispensado — ex.: não usar em modais de confirmação obrigatória).
export function useModalAcessivel(aberto: boolean, onEscape?: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    const elementoAnterior = document.activeElement as HTMLElement | null;
    const container = ref.current;
    const focaveis = container?.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL);
    focaveis?.[0]?.focus();

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape' && onEscape) {
        onEscape();
        return;
      }

      if (e.key !== 'Tab' || !container) return;

      const focaveisAgora = container.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL);
      if (focaveisAgora.length === 0) return;

      const primeiro = focaveisAgora[0];
      const ultimo = focaveisAgora[focaveisAgora.length - 1];

      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener('keydown', aoTeclar);

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      elementoAnterior?.focus();
    };
  }, [aberto, onEscape]);

  return ref;
}
