// Guarda, por usuário e por "escopo" (ex.: "multas"), quando foi a última
// vez que a pessoa efetivamente abriu aquela tela — usado só pra decidir
// se um item já visto deve continuar contando como notificação nova.
// Fica no localStorage (por navegador/dispositivo), mesmo padrão já usado
// em TourOperador para "já viu o tour".

function chave(escopo: string, userId: string) {
  return `escala_operadores_visto_${escopo}_${userId}`;
}

export function obterUltimaVisualizacao(escopo: string, userId: string): string | null {
  try {
    return localStorage.getItem(chave(escopo, userId));
  } catch {
    return null;
  }
}

export function marcarComoVisualizado(escopo: string, userId: string) {
  try {
    localStorage.setItem(chave(escopo, userId), new Date().toISOString());
  } catch {
    // localStorage indisponível (aba anônima restrita, etc.) — sem problema,
    // só significa que a notificação pode continuar aparecendo.
  }
}
