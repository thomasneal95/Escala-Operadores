import { useDisponibilidade } from '../../features/availability/useDisponibilidade';
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
    temAlteracoesPendentes,
    enviando,
    enviadoComSucesso,
    enviarDisponibilidade,
  } = useDisponibilidade();

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
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

  async function handleEnviar() {
    await enviarDisponibilidade();
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

      <div className="mt-8 space-y-6">
        {[periodo.data_inicio, periodo.data_fim].map((data) => (
          <div key={data} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-display font-semibold text-tinta">
              {nomeDoDia(data, periodo.data_inicio)}
              <span className="ml-2 font-mono text-sm font-normal text-slate-400">
                {formatarData(data)}
              </span>
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {turnos.map((turno) => {
                const ativo = estaDisponivel(data, turno.id);
                const cor = corTurno(turno.nome);

                return (
                  <button
                    key={turno.id}
                    onClick={() => alternar(data, turno.id)}
                    disabled={enviando}
                    className={`rounded-md border px-4 py-3 text-left transition disabled:cursor-wait disabled:opacity-70 ${
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
                );
              })}
            </div>
          </div>
        ))}
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
          disabled={!temAlteracoesPendentes || enviando}
          className="rounded-md bg-esmeralda px-5 py-2.5 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : 'Enviar disponibilidade'}
        </button>
      </div>
    </div>
  );
}