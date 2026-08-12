import { useState, type FormEvent } from 'react';

interface NovoPeriodoFormProps {
  onCriar: (dataInicio: string, dataFim: string) => Promise<{ erro: string | null }>;
  processando: boolean;
}

export function NovoPeriodoForm({ onCriar, processando }: NovoPeriodoFormProps) {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);

    const resultado = await onCriar(dataInicio, dataFim);

    if (resultado.erro) {
      setErro(resultado.erro);
      return;
    }

    setDataInicio('');
    setDataFim('');
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="font-semibold text-slate-900">Criar novo período de operação</h2>
      <p className="mt-1 text-sm text-slate-500">
        Abra um novo final de semana para os colaboradores informarem disponibilidade.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="data_inicio" className="block text-sm font-medium text-slate-700">
            Data inicial (sábado)
          </label>
          <input
            id="data_inicio"
            type="date"
            required
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
          />
        </div>

        <div>
          <label htmlFor="data_fim" className="block text-sm font-medium text-slate-700">
            Data final (domingo)
          </label>
          <input
            id="data_fim"
            type="date"
            required
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
          />
        </div>

        <button
          type="submit"
          disabled={processando}
          className="rounded-md bg-esmeralda px-4 py-2 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processando ? 'Criando...' : 'Criar período'}
        </button>
      </form>

      {erro && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}
    </div>
  );
}