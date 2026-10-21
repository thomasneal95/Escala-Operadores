interface ComEquipe {
  nome_completo: string;
  equipe_nome?: string | null;
}

// Agrupa por equipe (em ordem de nome, "Sem equipe" por último) e, dentro de
// cada equipe, por nome — para conferir a escala equipe por equipe.
export function agruparPorEquipe<T extends ComEquipe>(colaboradores: T[]) {
  const grupos = new Map<string, T[]>();
  for (const c of colaboradores) {
    const equipe = c.equipe_nome ?? 'Sem equipe';
    grupos.set(equipe, [...(grupos.get(equipe) ?? []), c]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => {
      if (a === 'Sem equipe') return 1;
      if (b === 'Sem equipe') return -1;
      return a.localeCompare(b);
    })
    .map(([equipe, membros]) => ({
      equipe,
      membros: [...membros].sort((a, b) => a.nome_completo.localeCompare(b.nome_completo)),
    }));
}
