import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import type { Gravidade, TipoTopico } from '../../lib/lerRelatorioQualidade';

// Relatórios de qualidade do atendimento (aba Qualidade do admin): cada
// relatório com seus tópicos e o arquivo original no bucket privado
// "relatorios-qualidade".

const BUCKET = 'relatorios-qualidade';

export interface Topico {
  tipo: TipoTopico;
  categoria: string;
  descricao: string;
  gravidade: Gravidade | null;
  exemplo: string | null;
}

export interface RelatorioQualidade {
  id: string;
  colaborador_id: string | null;
  operador_nome: string;
  data_avaliacao: string;
  periodo: string | null;
  avaliador: string | null;
  nota: number | null;
  resumo: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  enviado_em: string;
  topicos: Topico[];
}

export interface OperadorQualidade {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface NovoRelatorio {
  colaborador_id: string | null;
  operador_nome: string;
  data_avaliacao: string;
  periodo: string | null;
  avaliador: string | null;
  nota: number | null;
  resumo: string | null;
  topicos: Topico[];
}

function nomeSeguro(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(-80);
}

export function useRelatoriosQualidade() {
  const { session } = useAuth();
  const [relatorios, setRelatorios] = useState<RelatorioQualidade[]>([]);
  const [operadores, setOperadores] = useState<OperadorQualidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    const [relatoriosRes, colaboradoresRes] = await Promise.all([
      supabase
        .from('relatorios_qualidade')
        .select(
          'id, colaborador_id, operador_nome, data_avaliacao, periodo, avaliador, nota, resumo, arquivo_path, arquivo_nome, enviado_em, relatorio_qualidade_topicos(ordem, tipo, categoria, descricao, gravidade, exemplo)'
        )
        .order('data_avaliacao', { ascending: false })
        .order('enviado_em', { ascending: false }),
      supabase.from('colaboradores').select('id, ativo, perfis(nome_completo, papel)'),
    ]);

    if (relatoriosRes.error || colaboradoresRes.error) {
      setErro('Não foi possível carregar os relatórios de qualidade.');
      setCarregando(false);
      return;
    }

    setRelatorios(
      (relatoriosRes.data ?? []).map((r) => {
        const { relatorio_qualidade_topicos: topicos, ...resto } = r as typeof r & {
          relatorio_qualidade_topicos: (Topico & { ordem: number })[];
        };
        return {
          ...resto,
          nota: resto.nota === null ? null : Number(resto.nota),
          topicos: [...(topicos ?? [])].sort((a, b) => a.ordem - b.ordem),
        } as RelatorioQualidade;
      })
    );

    setOperadores(
      (colaboradoresRes.data ?? [])
        .filter((c) => (c.perfis as unknown as { papel: string } | null)?.papel !== 'administrador')
        .map((c) => ({
          id: c.id,
          nome: (c.perfis as unknown as { nome_completo: string } | null)?.nome_completo ?? '(sem nome)',
          ativo: c.ativo,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome))
    );
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Envia o arquivo, grava o relatório e os tópicos. Se algo falhar no meio,
  // desfaz o que já tinha sido gravado.
  async function salvar(dados: NovoRelatorio, arquivo: File) {
    const caminho = `${dados.data_avaliacao.slice(0, 7)}/${crypto.randomUUID()}-${nomeSeguro(arquivo.name)}`;
    const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
      contentType: arquivo.type || 'application/octet-stream',
    });
    if (erroUpload) return { erro: 'Não foi possível enviar o arquivo do relatório.' };

    const { data: relatorio, error: erroRelatorio } = await supabase
      .from('relatorios_qualidade')
      .insert({
        colaborador_id: dados.colaborador_id,
        operador_nome: dados.operador_nome.trim(),
        data_avaliacao: dados.data_avaliacao,
        periodo: dados.periodo?.trim() || null,
        avaliador: dados.avaliador?.trim() || null,
        nota: dados.nota,
        resumo: dados.resumo?.trim() || null,
        arquivo_path: caminho,
        arquivo_nome: arquivo.name,
        enviado_por: session?.user?.id ?? null,
      })
      .select('id')
      .single();

    if (erroRelatorio || !relatorio) {
      await supabase.storage.from(BUCKET).remove([caminho]);
      return { erro: 'Não foi possível salvar o relatório.' };
    }

    if (dados.topicos.length > 0) {
      const { error: erroTopicos } = await supabase.from('relatorio_qualidade_topicos').insert(
        dados.topicos.map((t, i) => ({
          relatorio_id: relatorio.id,
          ordem: i + 1,
          tipo: t.tipo,
          categoria: t.categoria.trim(),
          descricao: t.descricao.trim(),
          gravidade: t.tipo === 'melhoria' ? t.gravidade : null,
          exemplo: t.exemplo?.trim() || null,
        }))
      );
      if (erroTopicos) {
        await supabase.from('relatorios_qualidade').delete().eq('id', relatorio.id);
        await supabase.storage.from(BUCKET).remove([caminho]);
        return { erro: 'Não foi possível salvar os tópicos do relatório.' };
      }
    }

    await carregar();
    return { erro: null };
  }

  async function baixarArquivo(relatorio: RelatorioQualidade) {
    if (!relatorio.arquivo_path) return { erro: 'Este relatório não tem arquivo.' };
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(relatorio.arquivo_path, 60, { download: relatorio.arquivo_nome ?? true });
    if (error || !data) return { erro: 'Não foi possível baixar o arquivo.' };
    window.location.assign(data.signedUrl);
    return { erro: null };
  }

  async function excluir(relatorio: RelatorioQualidade) {
    const { error } = await supabase.from('relatorios_qualidade').delete().eq('id', relatorio.id);
    if (error) return { erro: 'Não foi possível excluir o relatório.' };
    if (relatorio.arquivo_path) await supabase.storage.from(BUCKET).remove([relatorio.arquivo_path]);
    await carregar();
    return { erro: null };
  }

  return { relatorios, operadores, carregando, erro, salvar, baixarArquivo, excluir };
}
