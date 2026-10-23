import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

// Recibos: as linhas do próprio operador nos meses arquivados pelo admin.
// O banco só devolve as linhas da própria pessoa.

export interface Recibo {
  mes: string;
  equipe: string | null;
  auxilio: number;
  comissao_equipe: number;
  comissao_fds: number;
  comissao_infoprodutos: number;
  adiantamento: number;
  salario_total: number;
  ftds: number | null;
  total_a_pagar: number | null;
}

export function useMeusRecibos() {
  const { session } = useAuth();
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!session?.user) return;
    let cancelado = false;
    (async () => {
      const { data: eu } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('perfil_id', session.user.id)
        .maybeSingle();
      if (!eu) {
        if (!cancelado) setCarregando(false);
        return;
      }
      const { data } = await supabase
        .from('historico_comissoes')
        .select(
          'mes, equipe, auxilio, comissao_equipe, comissao_fds, comissao_infoprodutos, adiantamento, salario_total, ftds, total_a_pagar'
        )
        .eq('colaborador_id', eu.id)
        .order('mes', { ascending: false });
      if (cancelado) return;
      setRecibos(
        (data ?? []).map((r) => ({
          ...r,
          auxilio: Number(r.auxilio),
          comissao_equipe: Number(r.comissao_equipe),
          comissao_fds: Number(r.comissao_fds),
          comissao_infoprodutos: Number(r.comissao_infoprodutos),
          adiantamento: Number(r.adiantamento),
          salario_total: Number(r.salario_total),
          total_a_pagar: r.total_a_pagar === null ? null : Number(r.total_a_pagar),
        }))
      );
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [session]);

  return { recibos, carregando };
}
