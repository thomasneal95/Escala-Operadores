import { useState } from 'react';
import { papelDaDupla, rotuloPapel } from '../lib/rodizioDuplas';
import type { DuplaFimDeSemana, MembroEquipe } from '../features/teams/useDuplasFimDeSemana';

interface DuplasEquipeEditorProps {
  duplas: DuplaFimDeSemana[];
  membros: MembroEquipe[];
  salvando: boolean;
  onSalvar: (
    duplas: Omit<DuplaFimDeSemana, 'equipe_id'>[]
  ) => Promise<{ erro: string | null }>;
}

const NUMEROS = [1, 2, 3];

function proximoSabado() {
  const data = new Date();
  data.setDate(data.getDate() + ((6 - data.getDay() + 7) % 7));
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function formatarData(data: string) {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

export function DuplasEquipeEditor({ duplas, membros, salvando, onSalvar }: DuplasEquipeEditorProps) {
  const [rascunho, setRascunho] = useState(() =>
    NUMEROS.map((numero) => {
      const dupla = duplas.find((d) => d.numero === numero);
      return {
        numero,
        manha_tarde_id: dupla?.manha_tarde_id ?? null,
        tarde_noite_id: dupla?.tarde_noite_id ?? null,
      };
    })
  );
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);

  const sabado = proximoSabado();
  const escolhidos = rascunho.flatMap((d) => [d.manha_tarde_id, d.tarde_noite_id]);

  function alterar(numero: number, campo: 'manha_tarde_id' | 'tarde_noite_id', valor: string) {
    setMensagem(null);
    setRascunho((atual) =>
      atual.map((d) => (d.numero === numero ? { ...d, [campo]: valor || null } : d))
    );
  }

  async function handleSalvar() {
    const resultado = await onSalvar(rascunho);
    setMensagem(
      resultado.erro ? { texto: resultado.erro, erro: true } : { texto: 'Duplas salvas.', erro: false }
    );
  }

  function seletor(numero: number, campo: 'manha_tarde_id' | 'tarde_noite_id', valor: string | null) {
    return (
      <select
        value={valor ?? ''}
        onChange={(e) => alterar(numero, campo, e.target.value)}
        disabled={salvando}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-tinta"
      >
        <option value="">— ninguém —</option>
        {membros.map((m) => (
          <option key={m.id} value={m.id} disabled={m.id !== valor && escolhidos.includes(m.id)}>
            {m.nome}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Duplas do fim de semana
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Cada dupla segue o rodízio Sábado → Domingo (home) → Folga. A numeração define a fase:
        a coluna da direita mostra o que cada dupla faz no próximo fim de semana ({formatarData(sabado)}).
      </p>

      <div className="mt-3 space-y-3">
        {rascunho.map((d) => {
          const papel = papelDaDupla(d.numero, sabado);
          return (
            <div
              key={d.numero}
              className="grid grid-cols-1 items-end gap-3 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-[auto_1fr_1fr_auto]"
            >
              <p className="font-display font-semibold text-tinta">Dupla {d.numero}</p>
              <label className="block text-xs font-medium text-slate-600">
                Manhã + Tarde
                {seletor(d.numero, 'manha_tarde_id', d.manha_tarde_id)}
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Tarde + Noite
                {seletor(d.numero, 'tarde_noite_id', d.tarde_noite_id)}
              </label>
              <span
                className={`rounded-full px-2.5 py-1 text-center text-xs font-medium ${
                  papel === 'folga'
                    ? 'bg-slate-100 text-slate-500'
                    : papel === 'domingo'
                      ? 'bg-ceruleo-light text-ceruleo'
                      : 'bg-esmeralda-light text-esmeralda-dark'
                }`}
              >
                {rotuloPapel[papel]}
              </span>
            </div>
          );
        })}
      </div>

      {membros.length === 0 && (
        <p className="mt-2 text-sm text-slate-400">Nenhum colaborador ativo nesta equipe.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={handleSalvar}
          disabled={salvando}
          className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-60"
        >
          {salvando ? 'Salvando...' : 'Salvar duplas'}
        </button>
        {mensagem && (
          <p className={`text-sm ${mensagem.erro ? 'text-red-600' : 'text-esmeralda-dark'}`}>
            {mensagem.texto}
          </p>
        )}
      </div>
    </div>
  );
}
