import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import type { Turno } from '../../types/database';

// Valor especial selecionável em "quem vai levar a multa": ao aprovar com
// esse valor, cria uma multa para cada colaborador ativo cujo turno_semana_id
// bate com o turno desta solicitação (mesmo campo usado na escala automática).
export const TODOS_DO_TURNO = '__todos_do_turno__';

// Segunda-feira seguinte à data informada (mesma semana se hoje já for
// segunda conta como "essa semana", então a cobrança cai na próxima).
function proximaSegundaISO(data: Date): string {
  const utc = Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
  const diaDaSemana = new Date(utc).getUTCDay(); // 0=domingo..6=sabado
  const diasDesdeSegunda = (diaDaSemana + 6) % 7; // segunda=0
  const segundaDestaSemana = utc - diasDesdeSegunda * 24 * 60 * 60 * 1000;
  const proxima = segundaDestaSemana + 7 * 24 * 60 * 60 * 1000;
  return new Date(proxima).toISOString().slice(0, 10);
}

export interface SolicitacaoMultaAdmin {
  id: string;
  criado_em: string;
  reportanteId: string;
  reportanteNome: string;
  anonimo: boolean;
  turnoId: string;
  turnoNome: string;
  colaboradorApontadoId: string | null;
  colaboradorApontadoNome: string | null;
  naoSabeInformar: boolean;
  imagens: string[];
  status: 'pendente' | 'aprovada' | 'recusada';
  colaboradorFinalId: string | null;
  colaboradorFinalNome: string | null;
  justificativaAdmin: string | null;
  valorBase: number | null;
  dataVencimento: string | null;
  paga: boolean;
  pagoEm: string | null;
}

export interface ColaboradorOpcao {
  id: string;
  nome_completo: string;
}

export function useSolicitacoesMultaAdmin() {
  const { session } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoMultaAdmin[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorOpcao[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [valorMulta, setValorMulta] = useState(20);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const [solicitacoesResultado, colaboradoresResultado, turnosResultado, configResultado] =
      await Promise.all([
        supabase
          .from('solicitacoes_multa')
          .select(
            `id, criado_em, anonimo, imagens, status, justificativa_admin, nao_sabe_informar,
           colaborador_apontado_id, colaborador_final_id, turno_id, reportante_id,
           valor_base, data_vencimento, paga, pago_em,
           reportante:colaboradores!solicitacoes_multa_reportante_id_fkey(perfis(nome_completo)),
           apontado:colaboradores!solicitacoes_multa_colaborador_apontado_id_fkey(perfis(nome_completo)),
           final:colaboradores!solicitacoes_multa_colaborador_final_id_fkey(perfis(nome_completo)),
           turnos(nome)`
          )
          .order('criado_em', { ascending: false }),
        supabase
          .from('colaboradores')
          .select('id, perfis(nome_completo)')
          .eq('ativo', true)
          .eq('comissionamento_individual', false),
        supabase
          .from('turnos')
          .select('id, nome, hora_inicio, hora_fim, ordem_exibicao, ativo_sabado, ativo_domingo')
          .eq('ativo', true)
          .order('ordem_exibicao'),
        supabase.from('configuracao_multas').select('valor_multa').eq('id', true).single(),
      ]);

    if (solicitacoesResultado.error || colaboradoresResultado.error || turnosResultado.error) {
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
        reportanteId: s.reportante_id,
        reportanteNome: reportante?.perfis?.nome_completo ?? '(desconhecido)',
        anonimo: s.anonimo,
        turnoId: s.turno_id,
        turnoNome: turno?.nome ?? '(desconhecido)',
        colaboradorApontadoId: s.colaborador_apontado_id,
        colaboradorApontadoNome: apontado?.perfis?.nome_completo ?? null,
        naoSabeInformar: s.nao_sabe_informar,
        imagens: s.imagens ?? [],
        status: s.status,
        colaboradorFinalId: s.colaborador_final_id,
        colaboradorFinalNome: final?.perfis?.nome_completo ?? null,
        justificativaAdmin: s.justificativa_admin,
        valorBase: s.valor_base,
        dataVencimento: s.data_vencimento,
        paga: s.paga,
        pagoEm: s.pago_em,
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
    setTurnos(turnosResultado.data ?? []);
    if (!configResultado.error && configResultado.data) {
      setValorMulta(Number(configResultado.data.valor_multa));
    }
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

    // "Todos do turno": só faz sentido ao aprovar (recusar não define
    // responsável nenhum, então trata como se nada tivesse sido escolhido).
    if (decisao.status === 'aprovada' && decisao.colaboradorFinalId === TODOS_DO_TURNO) {
      return decidirTodosDoTurno(id, decisao.justificativa);
    }

    setProcessando(id);
    setErro(null);

    const solicitacaoAtual = solicitacoes.find((s) => s.id === id);
    // Só grava valor/vencimento na PRIMEIRA vez que vira aprovada — editar
    // depois (trocar responsável/justificativa) não reinicia o prazo/juros.
    // Recusar sempre limpa o débito, mesmo que já tivesse sido aprovada antes.
    const jaEstavaAprovada = solicitacaoAtual?.status === 'aprovada';

    const camposFinanceiros =
      decisao.status === 'recusada'
        ? { valor_base: null, data_vencimento: null, paga: false, pago_em: null }
        : jaEstavaAprovada
          ? {}
          : {
              valor_base: valorMulta,
              data_vencimento: proximaSegundaISO(new Date()),
              paga: false,
              pago_em: null,
            };

    const { error } = await supabase
      .from('solicitacoes_multa')
      .update({
        status: decisao.status,
        justificativa_admin: decisao.justificativa,
        colaborador_final_id:
          decisao.colaboradorFinalId === TODOS_DO_TURNO ? null : decisao.colaboradorFinalId,
        decidido_por: session.user.id,
        decidido_em: new Date().toISOString(),
        ...camposFinanceiros,
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

  async function decidirTodosDoTurno(id: string, justificativa: string) {
    if (!session?.user) return { erro: 'Sessão inválida.' };

    const solicitacao = solicitacoes.find((s) => s.id === id);
    if (!solicitacao) return { erro: 'Solicitação não encontrada.' };

    setProcessando(id);
    setErro(null);

    const { data: colaboradoresDoTurno, error: erroColaboradores } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('ativo', true)
      .eq('turno_semana_id', solicitacao.turnoId);

    if (erroColaboradores) {
      setProcessando(null);
      const mensagem = 'Não foi possível buscar os operadores desse turno.';
      setErro(mensagem);
      return { erro: mensagem };
    }

    if (!colaboradoresDoTurno || colaboradoresDoTurno.length === 0) {
      setProcessando(null);
      const mensagem = 'Nenhum operador ativo tem esse turno como turno da semana.';
      setErro(mensagem);
      return { erro: mensagem };
    }

    const agora = new Date().toISOString();
    const vencimento = proximaSegundaISO(new Date());
    const [primeiro, ...restantes] = colaboradoresDoTurno;

    const { error: erroUpdate } = await supabase
      .from('solicitacoes_multa')
      .update({
        status: 'aprovada',
        justificativa_admin: justificativa,
        colaborador_final_id: primeiro.id,
        decidido_por: session.user.id,
        decidido_em: agora,
        valor_base: valorMulta,
        data_vencimento: vencimento,
        paga: false,
        pago_em: null,
      })
      .eq('id', id);

    if (erroUpdate) {
      setProcessando(null);
      const mensagem = 'Não foi possível registrar a decisão.';
      setErro(mensagem);
      return { erro: mensagem };
    }

    if (restantes.length > 0) {
      const novasLinhas = restantes.map((c) => ({
        reportante_id: solicitacao.reportanteId,
        anonimo: solicitacao.anonimo,
        turno_id: solicitacao.turnoId,
        colaborador_apontado_id: solicitacao.colaboradorApontadoId,
        nao_sabe_informar: solicitacao.naoSabeInformar,
        imagens: solicitacao.imagens,
        status: 'aprovada' as const,
        colaborador_final_id: c.id,
        justificativa_admin: justificativa,
        decidido_por: session.user.id,
        decidido_em: agora,
        valor_base: valorMulta,
        data_vencimento: vencimento,
        paga: false,
        pago_em: null,
      }));

      const { error: erroInsercao } = await supabase.from('solicitacoes_multa').insert(novasLinhas);

      if (erroInsercao) {
        setProcessando(null);
        const mensagem =
          'A primeira multa foi registrada, mas não foi possível criar as demais do turno.';
        setErro(mensagem);
        return { erro: mensagem };
      }
    }

    setProcessando(null);
    await carregar();
    return { erro: null };
  }

  async function marcarComoPago(id: string, pago: boolean) {
    setProcessando(id);
    setErro(null);

    const { error } = await supabase
      .from('solicitacoes_multa')
      .update({ paga: pago, pago_em: pago ? new Date().toISOString() : null })
      .eq('id', id);

    setProcessando(null);

    if (error) {
      const mensagem = 'Não foi possível atualizar o pagamento.';
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

  async function excluir(id: string) {
    setProcessando(id);
    setErro(null);

    const solicitacao = solicitacoes.find((s) => s.id === id);

    const { error } = await supabase.from('solicitacoes_multa').delete().eq('id', id);

    setProcessando(null);

    if (error) {
      const mensagem = 'Não foi possível excluir esta solicitação.';
      setErro(mensagem);
      return { erro: mensagem };
    }

    if (solicitacao && solicitacao.imagens.length > 0) {
      await supabase.storage.from('comprovantes-multa').remove(solicitacao.imagens);
    }

    await carregar();
    return { erro: null };
  }

  async function excluirVarias(ids: string[]) {
    if (ids.length === 0) return { erro: null };

    setProcessando('varias');
    setErro(null);

    const idsUnicos = new Set(ids);
    const imagensParaRemover = solicitacoes
      .filter((s) => idsUnicos.has(s.id))
      .flatMap((s) => s.imagens);

    const { error } = await supabase.from('solicitacoes_multa').delete().in('id', ids);

    setProcessando(null);

    if (error) {
      const mensagem = 'Não foi possível excluir as solicitações selecionadas.';
      setErro(mensagem);
      return { erro: mensagem };
    }

    if (imagensParaRemover.length > 0) {
      await supabase.storage.from('comprovantes-multa').remove(imagensParaRemover);
    }

    await carregar();
    return { erro: null };
  }

  return {
    solicitacoes,
    colaboradores,
    turnos,
    valorMulta,
    carregando,
    processando,
    erro,
    decidir,
    marcarComoPago,
    excluir,
    excluirVarias,
    obterUrlImagem,
    recarregar: carregar,
  };
}
