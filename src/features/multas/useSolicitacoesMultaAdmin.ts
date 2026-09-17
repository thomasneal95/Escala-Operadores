import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

export interface SolicitacaoMultaAdmin {
  id: string;
  criado_em: string;
  reportanteNome: string;
  anonimo: boolean;
  turnoNome: string;
  colaboradorApontadoId: string | null;
  colaboradorApontadoNome: string | null;
  naoSabeInformar: boolean;
  imagens: string[];
  status: 'pendente' | 'aprovada' | 'recusada';
  colaboradorFinalId: string | null;
  colaboradorFinalNome: string | null;
  justificativaAdmin: string | null;
}

export interface ColaboradorOpcao {
  id: string;
  nome_completo: string;
}

export function useSolicitacoesMultaAdmin() {
  const { session } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoMultaAdmin[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorOpcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const [solicitacoesResultado, colaboradoresResultado] = await Promise.all([
      supabase
        .from('solicitacoes_multa')
        .select(
          `id, criado_em, anonimo, imagens, status, justificativa_admin, nao_sabe_informar,
           colaborador_apontado_id, colaborador_final_id,
           reportante:colaboradores!solicitacoes_multa_reportante_id_fkey(perfis(nome_completo)),
           apontado:colaboradores!solicitacoes_multa_colaborador_apontado_id_fkey(perfis(nome_completo)),
           final:colaboradores!solicitacoes_multa_colaborador_final_id_fkey(perfis(nome_completo)),
           turnos(nome)`
        )
        .order('criado_em', { ascending: false }),
      supabase
        .from('colaboradores')
        .select('id, perfis(nome_completo)')
        .eq('ativo', true),
    ]);

    if (solicitacoesResultado.error || colaboradoresResultado.error) {
      setErro('Não foi possível carregar as solicitações de multa.');
      setCarregando(false);
      return;
    }

    const lista: SolicitacaoMultaAdmin[] = (solicitacoesResultado.data ?? []).map((s) => {
      const reportante = s.reportante as unknown as { perfis: { nome_completo: string } | null } | null;
      const apontado = s.apontado as unknown as { perfis: { nome_completo: string } | null } | null;
      const final = s.final as unknown as { perfis: { nome_completo: string } | null } | null;
      const turno = s.turnos as unknown as { nome: string } | null;

      return {
        id: s.id,
        criado_em: s.criado_em,
        reportanteNome: reportante?.perfis?.nome_completo ?? '(desconhecido)',
        anonimo: s.anonimo,
        turnoNome: turno?.nome ?? '(desconhecido)',
        colaboradorApontadoId: s.colaborador_apontado_id,
        colaboradorApontadoNome: apontado?.perfis?.nome_completo ?? null,
        naoSabeInformar: s.nao_sabe_informar,
        imagens: s.imagens ?? [],
        status: s.status,
        colaboradorFinalId: s.colaborador_final_id,
        colaboradorFinalNome: final?.perfis?.nome_completo ?? null,
        justificativaAdmin: s.justificativa_admin,
      };
    });

    setSolicitacoes(lista);

    const listaColaboradores: ColaboradorOpcao[] = (colaboradoresResultado.data ?? [])
      .map((c) => {
        const perfil = c.perfis as unknown as { nome_completo: string } | null;
        return { id: c.id, nome_completo: perfil?.nome_completo ?? '(sem nome)' };
      })
      .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));

    setColaboradores(listaColaboradores);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function decidir(
    id: string,
    decisao: { status: 'aprovada' | 'recusada'; justificativa: string; colaboradorFinalId: string | null }
  ) {
    if (!session?.user) return { erro: 'Sessão inválida.' };

    if (!decisao.justificativa.trim()) {
      return { erro: 'Informe a justificativa da decisão.' };
    }

    if (decisao.status === 'aprovada' && !decisao.colaboradorFinalId) {
      return { erro: 'Selecione quem vai levar a multa antes de aprovar.' };
    }

    setProcessando(id);
    setErro(null);

    const { error } = await supabase
      .from('solicitacoes_multa')
      .update({
        status: decisao.status,
        justificativa_admin: decisao.justificativa,
        colaborador_final_id: decisao.colaboradorFinalId,
        decidido_por: session.user.id,
        decidido_em: new Date().toISOString(),
      })
      .eq('id', id);

    setProcessando(null);

    if (error) {
      const mensagem = 'Não foi possível registrar a decisão.';
      setErro(mensagem);
      return { erro: mensagem };
    }

    await carregar();
    return { erro: null };
  }

  async function obterUrlImagem(caminho: string) {
    const { data, error } = await supabase.storage
      .from('comprovantes-multa')
      .createSignedUrl(caminho, 300);

    if (error || !data) return null;
    return data.signedUrl;
  }

  return {
    solicitacoes,
    colaboradores,
    carregando,
    processando,
    erro,
    decidir,
    obterUrlImagem,
    recarregar: carregar,
  };
}
