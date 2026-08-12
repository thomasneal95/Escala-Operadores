import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

interface PerfilAcesso {
  id: string;
  nome_completo: string;
  papel: 'administrador' | 'colaborador';
  ativo: boolean;
  temCadastroColaborador: boolean;
}

export function useGestaoAcesso() {
  const { session } = useAuth();
  const [perfis, setPerfis] = useState<PerfilAcesso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data: perfisData, error: erroPerfis } = await supabase
      .from('perfis')
      .select('id, nome_completo, papel, ativo')
      .order('nome_completo');

    if (erroPerfis) {
      setErro('Não foi possível carregar os perfis.');
      setCarregando(false);
      return;
    }

    const { data: colaboradoresData, error: erroColaboradores } = await supabase
      .from('colaboradores')
      .select('perfil_id');

    if (erroColaboradores) {
      setErro('Não foi possível carregar os cadastros de colaborador.');
      setCarregando(false);
      return;
    }

    const idsComColaborador = new Set((colaboradoresData ?? []).map((c) => c.perfil_id));

    const lista: PerfilAcesso[] = (perfisData ?? []).map((p) => ({
      id: p.id,
      nome_completo: p.nome_completo,
      papel: p.papel,
      ativo: p.ativo,
      temCadastroColaborador: idsComColaborador.has(p.id),
    }));

    setPerfis(lista);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alterarPapel(perfilId: string, novoPapel: 'administrador' | 'colaborador') {
    if (perfilId === session?.user.id && novoPapel === 'colaborador') {
      return {
        erro: 'Você não pode remover seu próprio acesso de administrador. Peça a outro administrador para fazer essa alteração.',
      };
    }

    setProcessando(perfilId);
    const { error } = await supabase
      .from('perfis')
      .update({ papel: novoPapel })
      .eq('id', perfilId);
    setProcessando(null);

    if (error) {
      return { erro: 'Não foi possível alterar o acesso deste perfil.' };
    }

    await carregar();
    return { erro: null };
  }

  return { perfis, carregando, erro, processando, alterarPapel, recarregar: carregar };
}