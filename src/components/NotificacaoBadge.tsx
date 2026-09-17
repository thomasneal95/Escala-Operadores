interface NotificacaoBadgeProps {
  contagem: number;
}

// Bolinha vermelha com contagem, usada nos itens de menu (aba Trocas,
// aba Multas, etc.) pra sinalizar que tem algo esperando atenção.
export function NotificacaoBadge({ contagem }: NotificacaoBadgeProps) {
  if (contagem <= 0) return null;

  return (
    <span className="ml-auto flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
      {contagem > 9 ? '9+' : contagem}
    </span>
  );
}
