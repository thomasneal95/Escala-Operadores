import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

export interface ItemMural {
  id: string;
  criado_em: string;
  turno_nome: string;
  colaborador_nome: string | null;
  status: 'pendente' | 'aprovada' | 'recusada';
  justificativa_admin: string | null;
  eu_reportei: boolean;
  decidido_em: string | null;
  sou_eu_multado: boolean;
}

export function useMuralMultas() {
  const [itens, setItens] = useState<ItemMural[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase.rpc('mural_multas');

    if (error) {
      setErro('Não foi possível carregar o mural de multas.');
      setCarregando(false);
      return;
    }

    setItens(data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { itens, carregando, erro, recarregar: carregar };
}
