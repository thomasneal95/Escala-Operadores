import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

interface ColegaEquipe {
  id: string;
  nome_completo: string;
  telefone: string | null;
  souEu: boolean;
}

export function useColegasEquipe() {
  const { session } = useAuth();
  const [equipeNome, setEquipeNome] = useState<string | null>(null);
  const [colegas, setColegas] = useState<ColegaEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      if (!session?.user) return;

      setCarregando(true);
      setErro(null);

      // 1. Descobre a própria equipe.
      const { data: meuColaborador, error: erroMeu } = await supabase
        .from('colaboradores')
        .select('equipe_id, equipes(nome)')
        .eq('perfil_id', session.user.id)
        .single();

      if (erroMeu) {
        setErro('Não foi possível carregar seus dados.');
        setCarregando(false);
        return;
      }

      const equipeId = meuColaborador.equipe_id;
      const equipe = meuColaborador.equipes as unknown as { nome: string } | null;
      setEquipeNome(equipe?.nome ?? null);

      if (!equipeId) {
        setColegas([]);
        setCarregando(false);
        return;
      }

      // 2. Busca todos os colaboradores da mesma equipe (inclui a própria pessoa).
      const { data: colaboradoresData, error: erroColaboradores } = await supabase
        .from('colaboradores')
        .select('id, perfil_id, telefone, ativo, perfis(nome_completo)')
        .eq('equipe_id', equipeId)
        .eq('ativo', true);

      if (erroColaboradores) {
        setErro('Não foi possível carregar os colegas de equipe.');
        setCarregando(false);
        return;
      }

      const lista: ColegaEquipe[] = (colaboradoresData ?? []).map((c) => {
        const perfil = c.perfis as unknown as { nome_completo: string } | null;
        return {
          id: c.id,
          nome_completo: perfil?.nome_completo ?? '(sem nome)',
          telefone: c.telefone,
          souEu: c.perfil_id === session.user.id,
        };
      });

      lista.sort((a, b) => {
        if (a.souEu) return -1;
        if (b.souEu) return 1;
        return a.nome_completo.localeCompare(b.nome_completo);
      });

      setColegas(lista);
      setCarregando(false);
    }

    carregar();
  }, [session]);

  return { equipeNome, colegas, carregando, erro };
}