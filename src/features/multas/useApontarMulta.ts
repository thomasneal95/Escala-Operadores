import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import type { Turno } from '../../types/database';

export interface ColaboradorOpcao {
  id: string;
  nome_completo: string;
}

export interface DadosNovaSolicitacao {
  turnoId: string;
  colaboradorApontadoId: string | null; // null = "não sei informar"
  anonimo: boolean;
  imagens: File[];
}

export function useApontarMulta() {
  const { session } = useAuth();
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorOpcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!session?.user) return;

    setCarregando(true);
    setErro(null);

    const { data: colaborador, error: erroColaborador } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('perfil_id', session.user.id)
      .single();

    if (erroColaborador || !colaborador) {
      setErro('Não foi possível carregar seus dados.');
      setCarregando(false);
      return;
    }

    setColaboradorId(colaborador.id);

    const [turnosResultado, colaboradoresResultado] = await Promise.all([
      supabase
        .from('turnos')
        .select('id, nome, hora_inicio, hora_fim, ordem_exibicao, ativo_sabado, ativo_domingo')
        .eq('ativo', true)
        .order('ordem_exibicao'),
      // Lista TODOS os operadores ativos (não só a própria equipe) — ver
      // migration 20260918000000_ajustes_sistema_multas.sql.
      supabase.rpc('colaboradores_ativos_nomes'),
    ]);

    if (turnosResultado.error || colaboradoresResultado.error) {
      setErro('Não foi possível carregar os dados do formulário.');
      setCarregando(false);
      return;
    }

    setTurnos(turnosResultado.data ?? []);

    const listaColaboradores: ColaboradorOpcao[] = colaboradoresResultado.data ?? [];

    setColaboradores(listaColaboradores);
    setCarregando(false);
  }, [session]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarSolicitacao(dados: DadosNovaSolicitacao): Promise<{ erro: string | null }> {
    if (!colaboradorId) {
      return { erro: 'Não foi possível identificar seus dados.' };
    }

    if (dados.imagens.length === 0) {
      return { erro: 'Anexe ao menos uma imagem de comprovação.' };
    }

    setEnviando(true);
    setErro(null);

    const caminhosImagens: string[] = [];

    for (const arquivo of dados.imagens) {
      const extensao = arquivo.name.split('.').pop() ?? 'jpg';
      const caminho = `${colaboradorId}/${crypto.randomUUID()}.${extensao}`;

      const { error: erroUpload } = await supabase.storage
        .from('comprovantes-multa')
        .upload(caminho, arquivo);

      if (erroUpload) {
        setEnviando(false);
        const mensagem = 'Não foi possível enviar a(s) imagem(ns) de comprovação.';
        setErro(mensagem);
        return { erro: mensagem };
      }

      caminhosImagens.push(caminho);
    }

    const { error: erroInsercao } = await supabase.from('solicitacoes_multa').insert({
      reportante_id: colaboradorId,
      anonimo: dados.anonimo,
      turno_id: dados.turnoId,
      colaborador_apontado_id: dados.colaboradorApontadoId,
      nao_sabe_informar: dados.colaboradorApontadoId === null,
      imagens: caminhosImagens,
    });

    setEnviando(false);

    if (erroInsercao) {
      const mensagem = 'Não foi possível registrar o apontamento.';
      setErro(mensagem);
      return { erro: mensagem };
    }

    return { erro: null };
  }

  return {
    turnos,
    colaboradores,
    carregando,
    enviando,
    erro,
    criarSolicitacao,
  };
}
