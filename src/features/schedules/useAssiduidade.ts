import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface AssiduidadeColaborador {
  id: string;
  nome_completo: string;
  presencas: number;
  faltas: number;
  totalConfirmado: number;
  percentual: number | null;
}

export function useAssiduidade() {
  const [dados, setDados] = useState<AssiduidadeColaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro(null);

      const { data: colaboradoresData, error: erroColaboradores } = await supabase
        .from('colaboradores')
        .select('id, perfis(nome_completo)')
        .eq('ativo', true);

      if (erroColaboradores) {
        setErro('Não foi possível carregar os colaboradores.');
        setCarregando(false);
        return;
      }

      const { data: escalasData, error: erroEscalas } = await supabase
        .from('escalas')
        .select('colaborador_id, compareceu')
        .not('compareceu', 'is', null);

      if (erroEscalas) {
        setErro('Não foi possível carregar os dados de presença.');
        setCarregando(false);
        return;
      }

      const resultado: AssiduidadeColaborador[] = (colaboradoresData ?? []).map((c) => {
        const perfil = c.perfis as unknown as { nome_completo: string } | null;
        const registros = (escalasData ?? []).filter((e) => e.colaborador_id === c.id);
        const presencas = registros.filter((r) => r.compareceu === true).length;
        const faltas = registros.filter((r) => r.compareceu === false).length;
        const total = presencas + faltas;

        return {
          id: c.id,
          nome_completo: perfil?.nome_completo ?? '(sem nome)',
          presencas,
          faltas,
          totalConfirmado: total,
          percentual: total > 0 ? presencas / total : null,
        };
      });

      const comDados = resultado.filter((r) => r.totalConfirmado > 0);
      comDados.sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0));

      setDados(comDados);
      setCarregando(false);
    }

    carregar();
  }, []);

  return { dados, carregando, erro };
}