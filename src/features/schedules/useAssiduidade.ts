import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface AssiduidadeColaborador {
  id: string;
  nome_completo: string;
  diasTrabalhados: number;
  diasPossiveis: number;
  percentual: number | null;
}

export function useAssiduidade() {
  const [dados, setDados] = useState<AssiduidadeColaborador[]>([]);
  const [diasPossiveis, setDiasPossiveis] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro(null);

      // Todos os períodos já confirmados/encerrados = todo o histórico de
      // finais de semana que realmente aconteceram (cada um com 2 dias).
      const { data: periodosData, error: erroPeriodos } = await supabase
        .from('periodos_operacao')
        .select('id, data_inicio, data_fim')
        .in('status', ['confirmado', 'encerrado']);

      if (erroPeriodos) {
        setErro('Não foi possível carregar os períodos.');
        setCarregando(false);
        return;
      }

      const totalDiasPossiveis = (periodosData ?? []).length * 2;
      setDiasPossiveis(totalDiasPossiveis);

            const { data: colaboradoresData, error: erroColaboradores } = await supabase
        .from('colaboradores')
        .select('id, data_admissao, perfis(nome_completo)')
        .eq('ativo', true);

      if (erroColaboradores) {
        setErro('Não foi possível carregar os colaboradores.');
        setCarregando(false);
        return;
      }

      const idsPeriodos = (periodosData ?? []).map((p) => p.id);

      const { data: escalasData, error: erroEscalas } = await supabase
        .from('escalas')
        .select('colaborador_id, data')
        .in('periodo_id', idsPeriodos.length > 0 ? idsPeriodos : ['00000000-0000-0000-0000-000000000000']);

      if (erroEscalas) {
        setErro('Não foi possível carregar as escalas.');
        setCarregando(false);
        return;
      }

            const resultado: AssiduidadeColaborador[] = (colaboradoresData ?? []).map((c) => {
        const perfil = c.perfis as unknown as { nome_completo: string } | null;

        // Conta dias distintos (não turnos) em que a pessoa trabalhou.
        const diasUnicos = new Set(
          (escalasData ?? []).filter((e) => e.colaborador_id === c.id).map((e) => e.data)
        );

        // Só considera, no total de dias possíveis, os que aconteceram
        // depois (ou no mesmo dia) da admissão. Sem data de admissão
        // cadastrada, considera todo o histórico (comportamento anterior).
        const diasPossiveisParaEssaPessoa = c.data_admissao
          ? (periodosData ?? []).reduce((soma, p) => {
              let contagem = 0;
              if (p.data_inicio >= c.data_admissao!) contagem += 1;
              if (p.data_fim >= c.data_admissao!) contagem += 1;
              return soma + contagem;
            }, 0)
          : totalDiasPossiveis;

        return {
          id: c.id,
          nome_completo: perfil?.nome_completo ?? '(sem nome)',
          diasTrabalhados: diasUnicos.size,
          diasPossiveis: diasPossiveisParaEssaPessoa,
          percentual:
            diasPossiveisParaEssaPessoa > 0 ? diasUnicos.size / diasPossiveisParaEssaPessoa : null,
        };
      });

      resultado.sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0));

      setDados(resultado);
      setCarregando(false);
    }

    carregar();
  }, []);

  return { dados, diasPossiveis, carregando, erro };
}