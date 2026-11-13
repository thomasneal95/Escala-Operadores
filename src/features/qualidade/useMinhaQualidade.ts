import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import type { RelatorioQualidade, Topico } from './useRelatoriosQualidade';
import { hojeIso, somarDias } from './analiseQualidade';

// Aba "Qualidade" do portal do operador: os relatórios da própria pessoa (a
// política de acesso só devolve os dela) e a média da equipe dela no mês
// atual e no anterior (só o número agregado).

export interface MediaEquipe {
  media: number | null;
  relatorios: number;
}

export function inicioDoMes(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

export function mesAnteriorDe(iso: string) {
  return inicioDoMes(somarDias(inicioDoMes(iso), -1));
}

export function useMinhaQualidade() {
  const [relatorios, setRelatorios] = useState<RelatorioQualidade[]>([]);
  const [equipeMes, setEquipeMes] = useState<MediaEquipe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    const hoje = hojeIso();
    const inicioMes = inicioDoMes(hoje);

    async function carregar() {
      const [relatoriosRes, equipeRes] = await Promise.all([
        supabase
          .from('relatorios_qualidade')
          .select(
            'id, colaborador_id, operador_nome, data_avaliacao, periodo, avaliador, nota, resumo, enviado_em, relatorio_qualidade_topicos(ordem, tipo, categoria, descricao, gravidade, exemplo)'
          )
          .order('data_avaliacao', { ascending: false })
          .order('enviado_em', { ascending: false }),
        supabase.rpc('media_qualidade_minha_equipe', { p_inicio: inicioMes, p_fim: hoje }),
      ]);
      if (!ativo) return;

      if (relatoriosRes.error) {
        setErro('Não foi possível carregar os seus relatórios de qualidade.');
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
            arquivo_path: null,
            arquivo_nome: null,
            nota: resto.nota === null ? null : Number(resto.nota),
            topicos: [...(topicos ?? [])].sort((a, b) => a.ordem - b.ordem),
          } as RelatorioQualidade;
        })
      );

      const linha = (equipeRes.data as { media: number | string | null; relatorios: number }[] | null)?.[0];
      setEquipeMes(linha ? { media: linha.media === null ? null : Number(linha.media), relatorios: linha.relatorios } : null);
      setCarregando(false);
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, []);

  return { relatorios, equipeMes, carregando, erro };
}
