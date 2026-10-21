import { useState, type FormEvent } from 'react';

interface GerarEscalaMesFormProps {
  onGerar: (ano: number, mes: number) => Promise<void>;
  gerando: boolean;
}

function proximoMes() {
  const agora = new Date();
  const data = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

export function GerarEscalaMesForm({
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
        Cria todos os fins de semana do mês e monta a escala pelas duplas de cada equipe
        (configuradas em Equipes): a cada fim de semana uma dupla trabalha no sábado, outra no
        domingo (home office) e a terceira folga, no rodízio Sábado → Domingo → Folga. Na dupla,
        uma pessoa faz Manhã + Tarde e a outra Tarde + Noite. A escala fica em organização até
        você confirmar.
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
