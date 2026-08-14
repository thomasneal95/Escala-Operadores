import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import type { PeriodoOperacao } from '../../types/database';

interface ColaboradorParaGeracao {
  id: string;
  equipe_id: string | null;
  turno_semana_id: string | null;
}

interface TurnoParaGeracao {
  id: string;
  ativo_sabado: boolean;
  ativo_domingo: boolean;
}

interface EscalaExistente {
  colaborador_id: string;
  data: string;
  turno_id: string;
}

interface DisponibilidadeExistente {
  colaborador_id: string;
  data: string;
  turno_id: string;
  disponivel: boolean;
}

interface VagaEquipeTurno {
  equipe_id: string;
  turno_id: string;
  vagas: number;
}

interface ParametrosGeracao {
  periodo: PeriodoOperacao;
  colaboradores: ColaboradorParaGeracao[];
  turnos: TurnoParaGeracao[];
  escalasExistentes: EscalaExistente[];
  disponibilidades: DisponibilidadeExistente[];
  vagas: VagaEquipeTurno[];
}

export function useGerarEscalaAutomatica() {
  const [gerando, setGerando] = useState(false);

  async function gerar({
    periodo,
    colaboradores,
    turnos,
    escalasExistentes,
    disponibilidades,
    vagas,
  }: ParametrosGeracao) {
    setGerando(true);

    const dias = [periodo.data_inicio, periodo.data_fim];
    const equipeIds = Array.from(
      new Set(colaboradores.map((c) => c.equipe_id).filter((id): id is string => !!id))
    );

    const novasLinhas: { colaborador_id: string; periodo_id: string; data: string; turno_id: string }[] = [];

    // Cópia mutável de "quem já está escalado" — vai crescendo conforme
    // preenchemos vagas, para não escalar a mesma pessoa duas vezes no
    // mesmo turno nem contar vagas erradas entre iterações.
    const escaladosAtuais = new Set(
      escalasExistentes.map((e) => `${e.data}|${e.turno_id}|${e.colaborador_id}`)
    );

    function disponivel(colaboradorId: string, data: string, turnoId: string) {
      return disponibilidades.some(
        (d) =>
          d.colaborador_id === colaboradorId &&
          d.data === data &&
          d.turno_id === turnoId &&
          d.disponivel
      );
    }

    function jaEscalado(colaboradorId: string, data: string, turnoId: string) {
      return escaladosAtuais.has(`${data}|${turnoId}|${colaboradorId}`);
    }

    function quantidadeEscalada(equipeId: string, data: string, turnoId: string) {
      let contagem = 0;
      for (const c of colaboradores) {
        if (c.equipe_id === equipeId && jaEscalado(c.id, data, turnoId)) {
          contagem++;
        }
      }
      return contagem;
    }

    for (const data of dias) {
      const ehSabado = data === periodo.data_inicio;
      const turnosDoDia = turnos.filter((t) => (ehSabado ? t.ativo_sabado : t.ativo_domingo));

      for (const equipeId of equipeIds) {
        for (const turno of turnosDoDia) {
          const vagasConfiguradas =
            vagas.find((v) => v.equipe_id === equipeId && v.turno_id === turno.id)?.vagas ?? 0;

          if (vagasConfiguradas <= 0) continue;

          const jaPreenchidas = quantidadeEscalada(equipeId, data, turno.id);
          let vagasLivres = vagasConfiguradas - jaPreenchidas;
          if (vagasLivres <= 0) continue;

          const candidatosDaEquipe = colaboradores.filter(
            (c) =>
              c.equipe_id === equipeId &&
              disponivel(c.id, data, turno.id) &&
              !jaEscalado(c.id, data, turno.id)
          );

          const prioritarios = candidatosDaEquipe.filter((c) => c.turno_semana_id === turno.id);
          const demais = candidatosDaEquipe.filter((c) => c.turno_semana_id !== turno.id);

          const ordemDeEscolha = [...prioritarios, ...demais];

          for (const candidato of ordemDeEscolha) {
            if (vagasLivres <= 0) break;

            novasLinhas.push({
              colaborador_id: candidato.id,
              periodo_id: periodo.id,
              data,
              turno_id: turno.id,
            });
            escaladosAtuais.add(`${data}|${turno.id}|${candidato.id}`);
            vagasLivres--;
          }
        }
      }
    }

    if (novasLinhas.length === 0) {
      setGerando(false);
      return { erro: null, quantidadeAdicionada: 0 };
    }

    const { error } = await supabase.from('escalas').insert(novasLinhas);

    setGerando(false);

    if (error) {
      return {
        erro: 'Não foi possível gerar a escala automaticamente. Tente novamente.',
        quantidadeAdicionada: 0,
      };
    }

    return { erro: null, quantidadeAdicionada: novasLinhas.length };
  }

  return { gerar, gerando };
}