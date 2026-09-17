interface NotificacaoBadgeProps {
  contagem: number;
}

// Bolinha vermelha com contagem, usada nos itens de menu (aba Trocas,
// aba Multas, etc.) pra sinalizar que tem algo esperando atenção.
export function NotificacaoBadge({ contagem }: NotificacaoBadgeProps) {
  if (contagem <= 0) return null;

  return (
    <span
      className="ml-auto flex h-[1.35rem] min-w-[1.35rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold leading-none text-white shadow-[0_0_0_2px_rgba(255,255,255,0.15)]"
      aria-label={`${contagem} notificação${contagem > 1 ? 'ões' : ''} pendente${contagem > 1 ? 's' : ''}`}
    >
      {contagem > 9 ? '9+' : contagem}
    </span>
  );
}
