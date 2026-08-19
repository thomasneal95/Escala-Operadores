interface SkeletonProps {
  className?: string;
}

// Peça básica: um retângulo cinza pulsando. Combine várias para montar
// o "esqueleto" de qualquer tela (ex.: uma linha de texto, um card, etc.)
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

// Esqueleto de um card genérico (título + duas linhas), usado em telas
// tipo Painel, Histórico, etc.
export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="mt-3 h-4 w-2/3" />
      <Skeleton className="mt-2 h-4 w-1/2" />
    </div>
  );
}

// Esqueleto de uma linha de tabela (ex.: lista de colaboradores).
export function SkeletonLinhaTabela({ colunas = 4 }: { colunas?: number }) {
  return (
    <tr>
      {Array.from({ length: colunas }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-[140px]" />
        </td>
      ))}
    </tr>
  );
}