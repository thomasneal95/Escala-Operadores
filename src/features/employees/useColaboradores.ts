import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface ColaboradorLista {
  id: string;
  perfil_id: string;
  nome_completo: string;
  equipe_id: string | null;
  equipe_nome: string | null;
  telefone: string | null;
  matricula: string | null;
  ativo: boolean;
}

interface DadosCadastro {
  nome_completo: string;
  telefone: string | null;
  matricula: string | null;
}

export function useColaboradores() {
  const [colaboradores, setColaboradores] = useState<ColaboradorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase
      .from('colaboradores')
      .select(
        'id, perfil_id, equipe_id, telefone, matricula, ativo, perfis(nome_completo), equipes(nome)'
      );

    if (error) {
      setErro('Não foi possível carregar os colaboradores.');
      setCarregando(false);
      return;
    }

    const formatados: ColaboradorLista[] = (data ?? []).map((c) => {
      const perfil = c.perfis as unknown as { nome_completo: string } | null;
      const equipe = c.equipes as unknown as { nome: string } | null;
      return {
        id: c.id,
        perfil_id: c.perfil_id,
        nome_completo: perfil?.nome_completo ?? '(sem nome)',
        equipe_id: c.equipe_id,
        equipe_nome: equipe?.nome ?? null,
        telefone: c.telefone,
        matricula: c.matricula,
        ativo: c.ativo,
      };
    });

    formatados.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    setColaboradores(formatados);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function atualizarEquipe(id: string, equipeId: string | null) {
    setProcessando(true);
    const { error } = await supabase
      .from('colaboradores')
      .update({ equipe_id: equipeId })
      .eq('id', id);
    setProcessando(false);

    if (error) return { erro: 'Não foi possível atualizar a equipe.' };
    await carregar();
    return { erro: null };
  }

  async function alternarAtivo(id: string, ativo: boolean) {
    setProcessando(true);
    const { error } = await supabase.from('colaboradores').update({ ativo }).eq('id', id);
    setProcessando(false);

    if (error) return { erro: 'Não foi possível atualizar o status.' };
    await carregar();
    return { erro: null };
  }

  // Atualiza nome (em perfis) e telefone/matrícula (em colaboradores) juntos.
  async function atualizarCadastro(
    colaboradorId: string,
    perfilId: string,
    dados: DadosCadastro
  ) {
    setProcessando(true);

    const { error: erroPerfil } = await supabase
      .from('perfis')
      .update({ nome_completo: dados.nome_completo })
      .eq('id', perfilId);

    if (erroPerfil) {
      setProcessando(false);
      return { erro: 'Não foi possível atualizar o nome.' };
    }

    const { error: erroColaborador } = await supabase
      .from('colaboradores')
      .update({ telefone: dados.telefone, matricula: dados.matricula })
      .eq('id', colaboradorId);

    setProcessando(false);

    if (erroColaborador) {
      let mensagem = 'Não foi possível atualizar o cadastro.';
      if (erroColaborador.code === '23505') {
        mensagem = 'Já existe um colaborador com essa matrícula.';
      }
      return { erro: mensagem };
    }

    await carregar();
    return { erro: null };
  }

  return {
    colaboradores,
    carregando,
    erro,
    processando,
    recarregar: carregar,
    atualizarEquipe,
    alternarAtivo,
    atualizarCadastro,
  };
}