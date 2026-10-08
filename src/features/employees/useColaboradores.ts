import { useCallback, useEffect, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';

interface ColaboradorLista {
  id: string;
  perfil_id: string;
  nome_completo: string;
  equipe_id: string | null;
  equipe_nome: string | null;
  turno_semana_id: string | null;
  telefone: string | null;
  matricula: string | null;
  data_admissao: string | null;
  auxilio_mensal: number;
  ativo: boolean;
  desativado_em: string | null;
}

export interface PreviaDesativacao {
  escalas_futuras: number;
  disponibilidades_futuras: number;
  trocas_pendentes: number;
}

// A edge function responde { erro } com status 4xx/5xx; extrai a mensagem.
async function mensagemDeErroDaFuncao(error: unknown, padrao: string) {
  if (error instanceof FunctionsHttpError) {
    const corpo = await error.context.json().catch(() => null);
    if (corpo?.erro) return corpo.erro as string;
  }
  return padrao;
}

interface DadosCadastro {
  nome_completo: string;
  telefone: string | null;
  matricula: string | null;
  turno_semana_id: string | null;
  data_admissao: string | null;
  auxilio_mensal: number;
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
        'id, perfil_id, equipe_id, turno_semana_id, telefone, matricula, data_admissao, auxilio_mensal, ativo, desativado_em, comissionamento_individual, perfis(nome_completo, papel), equipes(nome)'
      );

    if (error) {
      setErro('Não foi possível carregar os colaboradores.');
      setCarregando(false);
      return;
    }

    // Administradores e colaboradores de comissionamento individual (sem
    // equipe, só usados na aba Comissionamento) não aparecem aqui.
    const semAdmin = (data ?? []).filter((c) => {
      const perfil = c.perfis as unknown as { papel: string } | null;
      return perfil?.papel !== 'administrador' && !c.comissionamento_individual;
    });

            const formatados: ColaboradorLista[] = semAdmin.map((c) => {
      const perfil = c.perfis as unknown as { nome_completo: string } | null;
      const equipe = c.equipes as unknown as { nome: string } | null;
      return {
        id: c.id,
        perfil_id: c.perfil_id,
        nome_completo: perfil?.nome_completo ?? '(sem nome)',
        equipe_id: c.equipe_id,
        equipe_nome: equipe?.nome ?? null,
        turno_semana_id: c.turno_semana_id,
        telefone: c.telefone,
        matricula: c.matricula,
        data_admissao: c.data_admissao,
        auxilio_mensal: c.auxilio_mensal,
        ativo: c.ativo,
        desativado_em: c.desativado_em,
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

    const hoje = new Date().toISOString().slice(0, 10);

    // Fecha o registro de vigência de equipe atual (se houver um em aberto).
    await supabase
      .from('historico_equipe')
      .update({ valido_ate: hoje })
      .eq('colaborador_id', id)
      .is('valido_ate', null);

    // Abre um novo registro de vigência, se uma equipe foi escolhida.
    if (equipeId) {
      await supabase.from('historico_equipe').insert({
        colaborador_id: id,
        equipe_id: equipeId,
        valido_de: hoje,
        valido_ate: null,
      });
    }

    const { error } = await supabase
      .from('colaboradores')
      .update({ equipe_id: equipeId })
      .eq('id', id);
    setProcessando(false);

    if (error) return { erro: 'Não foi possível atualizar a equipe.' };
    await carregar();
    return { erro: null };
  }

  // O que será removido ao desativar (escalas/disponibilidades de períodos
  // ainda não terminados e trocas pendentes) — para a confirmação.
  async function previaDesativacao(id: string) {
    const { data, error } = await supabase.rpc('previa_desativacao_colaborador', {
      p_colaborador_id: id,
    });
    if (error) return null;
    return ((data as PreviaDesativacao[] | null)?.[0] ?? null);
  }

  // Desativa (tira de tudo que é atual/futuro, bloqueia o login, preserva o
  // histórico) ou reativa — ver edge function desativar-colaborador.
  async function alterarAtivo(id: string, acao: 'desativar' | 'reativar') {
    setProcessando(true);
    const { error } = await supabase.functions.invoke('desativar-colaborador', {
      body: { colaborador_id: id, acao },
    });
    setProcessando(false);

    if (error) {
      const padrao =
        acao === 'desativar'
          ? 'Não foi possível desativar o colaborador.'
          : 'Não foi possível reativar o colaborador.';
      return { erro: await mensagemDeErroDaFuncao(error, padrao) };
    }

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
      .update({
        telefone: dados.telefone,
        matricula: dados.matricula,
        turno_semana_id: dados.turno_semana_id,
        data_admissao: dados.data_admissao,
        auxilio_mensal: dados.auxilio_mensal,
      })
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
    previaDesativacao,
    alterarAtivo,
    atualizarCadastro,
  };
}