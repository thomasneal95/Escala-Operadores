import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

// Operador externo pago por FTD com login (ex.: João): o cadastro de
// colaborador dele é de "comissionamento individual" e o portal mostra só o
// comissionamento e os infoprodutos dele.
export function useSouExterno() {
  const { session } = useAuth();
  const [externo, setExterno] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from('colaboradores')
      .select('comissionamento_individual')
      .eq('perfil_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setExterno(!!data?.comissionamento_individual));
  }, [session?.user]);

  return { externo: !!externo, carregando: externo === null };
}
