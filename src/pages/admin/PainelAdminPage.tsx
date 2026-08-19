import { usePainelAdmin } from '../../features/schedules/usePainelAdmin';
import { Skeleton } from '../../components/Skeleton';

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

const rotuloStatus: Record<string, string> = {
  aberto: 'Aberto',
  em_organizacao: 'Em organização',
  confirmado: 'Confirmado',
  encerrado: 'Encerrado',
};

const corStatus: Record<string, string> = {
  aberto: 'bg-esmeralda-light text-esmeralda-dark',
  em_organizacao: 'bg-ceruleo-light text-ceruleo',
  confirmado: 'bg-profundo-light text-profundo',
  encerrado: 'bg-slate-200 text-slate-700',
};

interface PainelAdminPageProps {
  aoNavegar: (aba: 'escala' | 'colaboradores' | 'historico' | 'equipes') => void;
}

export function PainelAdminPage({ aoNavegar }: PainelAdminPageProps) {
  const { dados, carregando, erro } = usePainelAdmin();

    if (carregando) {
    return (
      <div>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-7 w-40" />

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="mt-4 h-4 w-72" />
          <Skeleton className="mt-2 h-2 w-full max-w-sm" />
          <Skeleton className="mt-4 h-9 w-40" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        {erro ?? 'Não foi possível carregar o painel.'}
      </p>
    );
  }

  const { periodoAtual } = dados;

  return (
    <div>
      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Painel
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">Visão geral</h1>

      {/* Card do período atual */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        {!periodoAtual ? (
          <div className="text-center">
            <p className="text-slate-600">Nenhum período de operação foi criado ainda.</p>
            <button
              onClick={() => aoNavegar('escala')}
              className="mt-4 rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark"
            >
              Criar período
            </button>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-xl font-semibold text-tinta">
                {formatarData(periodoAtual.data_inicio)} – {formatarData(periodoAtual.data_fim)}
              </h2>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${corStatus[periodoAtual.status]}`}
              >
                {rotuloStatus[periodoAtual.status]}
              </span>
            </div>

            {periodoAtual.status === 'aberto' && (
              <div className="mt-4">
                <p className="text-slate-600">
                  <span className="font-display text-2xl font-semibold text-tinta">
                    {dados.colaboradoresQueEnviaram}
                  </span>{' '}
                  de {dados.totalColaboradoresAtivos} colaboradores já enviaram disponibilidade
                </p>
                <div className="mt-2 h-2 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-esmeralda transition-all"
                    style={{
                      width: `${
                        dados.totalColaboradoresAtivos > 0
                          ? Math.min(
                              100,
                              (dados.colaboradoresQueEnviaram / dados.totalColaboradoresAtivos) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <button
                  onClick={() => aoNavegar('escala')}
                  className="mt-4 rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark"
                >
                  Ver disponibilidade
                </button>
              </div>
            )}

            {periodoAtual.status === 'em_organizacao' && (
              <div className="mt-4">
                {dados.vagasTotais > 0 ? (
                  <>
                    <p className="text-slate-600">
                      <span className="font-display text-2xl font-semibold text-tinta">
                        {dados.escalasPreenchidas}
                      </span>{' '}
                      de {dados.vagasTotais} vagas preenchidas
                    </p>
                    <div className="mt-2 h-2 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-profundo transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (dados.escalasPreenchidas / dados.vagasTotais) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-slate-600">
                    {dados.escalasPreenchidas} colaborador(es) escalado(s) até agora. Configure
                    as vagas por equipe para acompanhar o progresso aqui.
                  </p>
                )}
                <button
                  onClick={() => aoNavegar('escala')}
                  className="mt-4 rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark"
                >
                  Montar escala
                </button>
              </div>
            )}

            {periodoAtual.status === 'confirmado' && (
              <div className="mt-4">
                <p className="text-slate-600">
                  Escala confirmada com{' '}
                  <span className="font-medium text-tinta">{dados.escalasPreenchidas}</span>{' '}
                  colaborador(es) escalado(s). Os colaboradores já podem visualizar seus turnos.
                </p>
                <button
                  onClick={() => aoNavegar('escala')}
                  className="mt-4 rounded-md bg-ceruleo-light px-4 py-2 text-sm font-medium text-ceruleo hover:bg-ceruleo/20"
                >
                  Ver escala
                </button>
              </div>
            )}

            {periodoAtual.status === 'encerrado' && (
              <div className="mt-4">
                <p className="text-slate-600">Este período já foi encerrado.</p>
                <button
                  onClick={() => aoNavegar('historico')}
                  className="mt-4 rounded-md bg-ceruleo-light px-4 py-2 text-sm font-medium text-ceruleo hover:bg-ceruleo/20"
                >
                  Ver histórico
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Presença pendente */}
      {dados.periodoPresencaPendente && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="font-medium text-amber-800">
            {dados.periodoPresencaPendente.pendentes} confirmação(ões) de presença pendente(s)
          </p>
          <p className="mt-1 text-sm text-amber-700">
            Final de semana de {formatarData(dados.periodoPresencaPendente.data_inicio)} até{' '}
            {formatarData(dados.periodoPresencaPendente.data_fim)}.
          </p>
          <button
            onClick={() => aoNavegar('historico')}
            className="mt-3 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            Confirmar presença
          </button>
        </div>
      )}

      {/* Números gerais */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          onClick={() => aoNavegar('colaboradores')}
          className="rounded-lg border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300"
        >
          <p className="font-display text-3xl font-semibold text-tinta">
            {dados.totalColaboradoresAtivos}
          </p>
          <p className="mt-1 text-sm text-slate-500">Colaboradores ativos</p>
        </button>
        <button
          onClick={() => aoNavegar('equipes')}
          className="rounded-lg border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300"
        >
          <p className="font-display text-3xl font-semibold text-tinta">
            {dados.totalEquipesAtivas}
          </p>
          <p className="mt-1 text-sm text-slate-500">Equipes ativas</p>
        </button>
      </div>
    </div>
  );
}