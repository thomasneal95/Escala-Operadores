import { useState } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { useDisponibilidade } from '../../features/availability/useDisponibilidade';
import { usePrazoDisponibilidade } from '../../features/availability/usePrazoDisponibilidade';
import { useToast, useConfirm } from '../../components/FeedbackProvider';
import { corTurno } from '../../lib/turnoColors';

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function nomeDoDia(data: string, dataInicio: string) {
  return data === dataInicio ? 'Sábado' : 'Domingo';
}

export function DisponibilidadePage() {
    const {
    periodo,
    turnos,
    carregando,
    erro,
    alternar,
    estaDisponivel,
    contagemDe,
    temAlteracoesPendentes,
    podeEnviar,
    enviando,
    enviadoComSucesso,
    enviarDisponibilidade,
    repetirAnterior,
  } = useDisponibilidade();

  const { texto: textoPrazo, ativo: prazoAtivo } = usePrazoDisponibilidade();
  const toast = useToast();
  const confirmar = useConfirm();

  // Controla qual bolinha de contagem está com o detalhe aberto no momento.
  const [detalheAberto, setDetalheAberto] = useState<string | null>(null);

    if (carregando) {
    return (
      <div>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-7 w-64" />
        <Skeleton className="mt-3 h-4 w-full max-w-md" />

        <div className="mt-8 space-y-6">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-5">
              <Skeleton className="h-5 w-32" />
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="h-20 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!periodo) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">
          Não há nenhum período de disponibilidade aberto no momento.
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Volte aqui quando um novo final de semana for aberto para preenchimento.
        </p>
      </div>
    );
  }

  function turnosDoDia(data: string) {
    const ehSabado = data === periodo!.data_inicio;
    return turnos.filter((t) => (ehSabado ? t.ativo_sabado : t.ativo_domingo));
  }

    async function handleEnviar() {
    if (!temAlteracoesPendentes && podeEnviar) {
      const confirmou = await confirmar({
        titulo: 'Enviar tudo como indisponível?',
        mensagem:
          'Você não marcou nenhum turno. Se continuar, será registrado que você está indisponível para todos os turnos deste fim de semana.',
        textoConfirmar: 'Sim, enviar assim',
      });
      if (!confirmou) return;
    }

    await enviarDisponibilidade();
  }

      async function handleRepetirAnterior() {
    const resultado = await repetirAnterior();
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
    }
  }

  function chaveDetalhe(data: string, turnoId: string) {
    return `${data}|${turnoId}`;
  }

  return (
    <div>
      {erro && (
        <p className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Disponibilidade
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        {formatarData(periodo.data_inicio)} – {formatarData(periodo.data_fim)}
      </h1>
            <p className="mt-2 text-slate-500">
        Selecione os turnos em que você está disponível para trabalhar e clique em
        "Enviar disponibilidade" para confirmar. Você pode alterar suas respostas
        enquanto o período estiver aberto.
      </p>

            {prazoAtivo && textoPrazo && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          {textoPrazo}
        </p>
      )}

      <div className="mt-3">
        <button
          onClick={handleRepetirAnterior}
          className="text-sm font-medium text-ceruleo hover:text-ceruleo/80"
        >
          Usar a mesma disponibilidade de antes
        </button>
      </div>

      <div className="mt-8 space-y-6">
        {[periodo.data_inicio, periodo.data_fim].map((data) => {
          const turnosDisponiveisNesseDia = turnosDoDia(data);

          return (
            <div key={data} className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-display font-semibold text-tinta">
                {nomeDoDia(data, periodo.data_inicio)}
                <span className="ml-2 font-mono text-sm font-normal text-slate-400">
                  {formatarData(data)}
                </span>
              </h2>

              {turnosDisponiveisNesseDia.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">Não há operação neste dia.</p>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {turnosDisponiveisNesseDia.map((turno) => {
                    const ativo = estaDisponivel(data, turno.id);
                    const cor = corTurno(turno.nome);
                    const contagem = contagemDe(data, turno.id);
                    const chaveEsseCard = chaveDetalhe(data, turno.id);
                    const detalheEstaAberto = detalheAberto === chaveEsseCard;

                    return (
                      <div key={turno.id} className="relative">
                        <button
                          onClick={() => alternar(data, turno.id)}
                          disabled={enviando}
                          className={`w-full rounded-md border px-4 py-3 text-left transition disabled:cursor-wait disabled:opacity-70 ${
                            ativo
                              ? `${cor.border} ${cor.bgLight}`
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <p className="font-medium text-tinta">{turno.nome}</p>
                          <p className="font-mono text-sm text-slate-500">
                            {turno.hora_inicio.slice(0, 5)} – {turno.hora_fim.slice(0, 5)}
                          </p>
                          <p
                            className={`mt-2 text-xs font-medium ${
                              ativo ? cor.text : 'text-slate-400'
                            }`}
                          >
                            {ativo ? 'Disponível' : 'Indisponível'}
                          </p>
                        </button>

                        {contagem.total > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetalheAberto(detalheEstaAberto ? null : chaveEsseCard);
                            }}
                            className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-[11px] font-semibold text-white shadow-sm hover:bg-slate-800"
                            title="Ver quantas pessoas já marcaram este turno"
                          >
                            {contagem.total}
                          </button>
                        )}

                        {detalheEstaAberto && contagem.total > 0 && (
                          <div className="absolute right-0 top-6 z-10 w-52 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg">
                                                        <p>
                              <span className="font-medium text-tinta">{contagem.total}</span>{' '}
                              da sua equipe{' '}
                              {contagem.total > 1 ? 'já marcaram' : 'já marcou'} disponível
                              para este turno.
                            </p>
                            {contagem.preferencial > 0 && (
                              <p className="mt-1">
                                <span className="font-medium text-tinta">
                                  {contagem.preferencial}
                                </span>{' '}
                                {contagem.preferencial > 1 ? 'trabalham' : 'trabalha'} nesse
                                turno durante a semana.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

            <div className="mt-8 flex flex-col items-start gap-3 border-t border-slate-200 pt-6">
        {temAlteracoesPendentes && (
          <p className="flex items-center gap-2 text-sm font-medium text-amber-600">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Você tem alterações não enviadas.
          </p>
        )}

        {!temAlteracoesPendentes && enviadoComSucesso && (
          <p className="flex items-center gap-2 text-sm font-medium text-esmeralda-dark">
            <span className="h-2 w-2 rounded-full bg-esmeralda" />
            Disponibilidade enviada com sucesso.
          </p>
        )}

                <button
          onClick={handleEnviar}
          disabled={!podeEnviar || enviando}
          className="rounded-md bg-esmeralda px-5 py-2.5 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : 'Enviar disponibilidade'}
        </button>
      </div>
    </div>
  );
}