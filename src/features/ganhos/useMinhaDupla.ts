import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

// A dupla do fim de semana do operador (função minha_dupla), para mostrar o
// rodízio Sábado → Domingo → Folga dos próximos fins de semana.

export interface MinhaDupla {
  numero: number;
  posicao: 'manha_tarde' | 'tarde_noite';
  parceiro: string | null;
  equipe: string;
}

export function useMinhaDupla() {
  const [dupla, setDupla] = useState<MinhaDupla | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase.rpc('minha_dupla').then(({ data }) => {
      const linha = (data as MinhaDupla[] | null)?.[0] ?? null;
      setDupla(linha);
      setCarregando(false);
    });
  }, []);

  return { dupla, carregando };
}
