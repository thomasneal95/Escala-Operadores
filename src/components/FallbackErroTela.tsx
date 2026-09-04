// Mostrado no lugar de uma tela inteira quando o ErrorBoundary que a envolve
// captura uma falha — nunca deve aparecer em uso normal, é só a rede de
// segurança contra uma tela em branco.
export function FallbackErroTela() {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
      <p className="font-medium text-red-700">Algo deu errado ao carregar esta tela.</p>
      <p className="mt-1 text-sm text-red-600">
        Tente recarregar a página. Se o problema continuar, avise o administrador.
      </p>
    </div>
  );
}
