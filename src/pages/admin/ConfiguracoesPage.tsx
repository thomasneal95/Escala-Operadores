import { useEffect, useState, type FormEvent } from 'react';
import { useConfiguracaoRecorrencia } from '../../features/schedules/useConfiguracaoRecorrencia';
import { HoraSelect } from '../../features/shifts/HoraSelect';

const diasDaSemana = [
  { valor: 0, nome: 'Domingo' },
  { valor: 1, nome: 'Segunda-feira' },
  { valor: 2, nome: 'Terça-feira' },
  { valor: 3, nome: 'Quarta-feira' },
  { valor: 4, nome: 'Quinta-feira' },
  { valor: 5, nome: 'Sexta-feira' },
  { valor: 6, nome: 'Sábado' },
];

export function ConfiguracoesPage() {
  const { config, carregando, erro, salvando, salvar } = useConfiguracaoRecorrencia();

  const [diaAbertura, setDiaAbertura] = useState(1);
  const [horaAbertura, setHoraAbertura] = useState('08:00');
  const [diaFechamento, setDiaFechamento] = useState(4);
  const [horaFechamento, setHoraFechamento] = useState('18:00');
  const [ativo, setAtivo] = useState(true);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (config) {
      setDiaAbertura(config.dia_abertura);
      setHoraAbertura(config.hora_abertura.slice(0, 5));
      setDiaFechamento(config.dia_fechamento);
      setHoraFechamento(config.hora_fechamento.slice(0, 5));
      setAtivo(config.ativo);
    }
  }, [config]);

  async function handleSalvar(event: FormEvent) {
    event.preventDefault();
    setErroForm(null);
    setSucesso(false);

    if (diaAbertura === diaFechamento) {
      setErroForm('O dia de abertura precisa ser diferente do dia de fechamento.');
      return;
    }

    const resultado = await salvar({
      dia_abertura: diaAbertura,
      hora_abertura: horaAbertura,
      dia_fechamento: diaFechamento,
      hora_fechamento: horaFechamento,
      ativo,
    });

    if (resultado.erro) {
      setErroForm(resultado.erro);
      return;
    }

    setSucesso(true);
  }

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-display font-semibold text-tinta">
          Abertura e fechamento automáticos
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Configure em qual dia e horário o período de disponibilidade abre
          automaticamente para os colaboradores, e em qual dia e horário o
          recebimento é encerrado — sem precisar de nenhuma ação manual.
        </p>

        <form onSubmit={handleSalvar} className="mt-6 space-y-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-esmeralda focus:ring-esmeralda"
            />
            <span className="text-sm font-medium text-slate-700">
              Recorrência automática ativa
            </span>
          </label>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 p-4">
              <p className="flex items-center gap-1.5 font-medium text-tinta">
                <span className="h-2 w-2 rounded-full bg-esmeralda" />
                Abertura
              </p>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700">
                  Dia da semana
                </label>
                <select
                  value={diaAbertura}
                  onChange={(e) => setDiaAbertura(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
                >
                  {diasDaSemana.map((d) => (
                    <option key={d.valor} value={d.valor}>
                      {d.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700">Horário</label>
                <div className="mt-1">
                  <HoraSelect value={horaAbertura} onChange={setHoraAbertura} />
                </div>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 p-4">
              <p className="flex items-center gap-1.5 font-medium text-tinta">
                <span className="h-2 w-2 rounded-full bg-profundo" />
                Fechamento
              </p>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700">
                  Dia da semana
                </label>
                <select
                  value={diaFechamento}
                  onChange={(e) => setDiaFechamento(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
                >
                  {diasDaSemana.map((d) => (
                    <option key={d.valor} value={d.valor}>
                      {d.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700">Horário</label>
                <div className="mt-1">
                  <HoraSelect value={horaFechamento} onChange={setHoraFechamento} />
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            A transição é verificada a cada hora pelo sistema. Pode levar até 1
            hora após o horário configurado para o período abrir ou fechar de
            fato.
          </p>

          {erroForm && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erroForm}</p>
          )}
          {sucesso && (
            <p className="rounded-md bg-esmeralda-light px-3 py-2 text-sm text-esmeralda-dark">
              Configuração salva com sucesso.
            </p>
          )}

          <button
            type="submit"
            disabled={salvando}
            className="rounded-md bg-esmeralda px-5 py-2.5 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </form>
      </div>
    </div>
  );
}