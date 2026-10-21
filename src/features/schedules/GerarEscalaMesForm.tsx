import { useState, type FormEvent } from 'react';

interface GerarEscalaMesFormProps {
  maxFinsDeSemana: string;
  onMudarMaxFinsDeSemana: (valor: string) => void;
  onGerar: (ano: number, mes: number) => Promise<void>;
  gerando: boolean;
}

function proximoMes() {
  const agora = new Date();
  const data = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

export function GerarEscalaMesForm({
  maxFinsDeSemana,
  onMudarMaxFinsDeSemana,
  onGerar,
  gerando,
}: GerarEscalaMesFormProps) {
  const [mes, setMes] = useState(proximoMes);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const [ano, numeroMes] = mes.split('-').map(Number);
    if (!ano || !numeroMes) return;
    await onGerar(ano, numeroMes);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="font-semibold text-slate-900">Gerar escala do mês</h2>
      <p className="mt-1 text-sm text-slate-500">
        Cria todos os fins de semana do mês e monta a escala pelo histórico: por equipe e por
        dia, uma pessoa faz Manhã + Tarde e outra faz Tarde + Noite. Quem mais trabalhou tem
        prioridade, cada pessoa trabalha no máximo 1 dia por fim de semana e tem pelo menos 1
        fim de semana de folga no mês. O domingo (home office) passa em rodízio por todos. A
        escala fica em organização até você confirmar.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="mes_escala" className="block text-sm font-medium text-slate-700">
            Mês
          </label>
          <input
            id="mes_escala"
            type="month"
            required
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
          />
        </div>

        <div>
          <label htmlFor="max_fins_semana" className="block text-sm font-medium text-slate-700">
            Máx. de fins de semana por pessoa
          </label>
          <input
            id="max_fins_semana"
            type="number"
            min={1}
            placeholder="Só a folga mensal"
            value={maxFinsDeSemana}
            onChange={(e) => onMudarMaxFinsDeSemana(e.target.value)}
            className="mt-1 w-44 rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
          />
        </div>

        <button
          type="submit"
          disabled={gerando}
          className="rounded-md bg-esmeralda px-4 py-2 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {gerando ? 'Gerando...' : 'Gerar escala do mês'}
        </button>
      </form>
    </div>
  );
}
