import { useState } from 'react';
import type { FormEvent } from 'react';
import { useFaltas, type FaltaAdmin } from '../../features/faltas/useFaltas';
import { useToast, useConfirm } from '../../components/FeedbackProvider';

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarMesReferencia(mesReferencia: string) {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  const rotulo = new Date(Date.UTC(ano, mes - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
}

function mesAdjacente(mesReferencia: string, deslocamento: number) {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1 + deslocamento, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
}

interface LinhaEdicaoProps {
  falta: FaltaAdmin;
  processando: boolean;
  onSalvar: (motivo: string | null, justificada: boolean) => Promise<void>;
  onCancelar: () => void;
}

function LinhaEdicao({ falta, processando, onSalvar, onCancelar }: LinhaEdicaoProps) {
  const [motivo, setMotivo] = useState(falta.motivo ?? '');
  const [justificada, setJustificada] = useState(falta.justificada);

  return (
    <div className="mt-3 space-y-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
      <div>
        <label className="block text-xs font-medium text-slate-600">Motivo</label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={justificada}
          onChange={(e) => setJustificada(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-esmeralda focus:ring-esmeralda"
        />
        Falta justificada
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSalvar(motivo.trim() || null, justificada)}
          disabled={processando}
          className="rounded-md bg-esmeralda px-3 py-1.5 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-60"
        >
          {processando ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={processando}
          className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function FaltasPage() {
  const {
    colaboradores,
    faltas,
    mesReferencia,
    setMesReferencia,
    carregando,
    processando,
    erro,
    registrar,
    atualizar,
    excluir,
  } = useFaltas();
  const toast = useToast();
  const confirmar = useConfirm();

  const [colaboradorId, setColaboradorId] = useState('');
  const [data, setData] = useState(hojeISO());
  const [motivo, setMotivo] = useState('');
  const [justificada, setJustificada] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  async function handleRegistrar(e: FormEvent) {
    e.preventDefault();
    setErroForm(null);

    if (!colaboradorId) {
      setErroForm('Selecione o colaborador.');
      return;
    }
    if (!data) {
      setErroForm('Informe a data da falta.');
      return;
    }

    const resultado = await registrar({
      colaboradorId,
      data,
      motivo: motivo.trim() || null,
      justificada,
    });

    if (resultado.erro) {
      setErroForm(resultado.erro);
      return;
    }

    setColaboradorId('');
    setData(hojeISO());
    setMotivo('');
    setJustificada(false);
    toast('Falta registrada.');
  }

  async function handleSalvarEdicao(id: string, motivoEditado: string | null, justificadaEditada: boolean) {
    const resultado = await atualizar(id, { motivo: motivoEditado, justificada: justificadaEditada });
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }
    setEditandoId(null);
    toast('Falta atualizada.');
  }

  async function handleExcluir(id: string) {
    const confirmou = await confirmar({
      titulo: 'Excluir esta falta?',
      mensagem: 'Isso remove o registro permanentemente. Esta ação não pode ser desfeita.',
      textoConfirmar: 'Excluir',
      perigoso: true,
    });
    if (!confirmou) return;

    const resultado = await excluir(id);
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }
    toast('Falta excluída.');
  }

  return (
    <div>
      {erro && <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Faltas
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        Controle de faltas
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Registro de faltas nos dias normais (fora da escala de fim de semana). Lance só as
        exceções — quem faltou e quando.
      </p>

      <form
        onSubmit={handleRegistrar}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-600">Colaborador</label>
          <select
            value={colaboradorId}
            onChange={(e) => setColaboradorId(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
          >
            <option value="">Selecione...</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome_completo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
          />
        </div>

        <div className="min-w-[12rem] flex-1">
          <label className="block text-xs font-medium text-slate-600">Motivo (opcional)</label>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: atestado médico"
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
          />
        </div>

        <label className="flex items-center gap-2 pb-1.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={justificada}
            onChange={(e) => setJustificada(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-esmeralda focus:ring-esmeralda"
          />
          Justificada
        </label>

        <button
          type="submit"
          disabled={processando === 'novo'}
          className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark disabled:opacity-60"
        >
          {processando === 'novo' ? 'Registrando...' : 'Registrar falta'}
        </button>

        {erroForm && <p className="w-full text-sm text-red-600">{erroForm}</p>}
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-between">
        <button
          type="button"
          onClick={() => setMesReferencia(mesAdjacente(mesReferencia, -1))}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          ← Anterior
        </button>
        <p className="order-first w-full text-center font-medium text-tinta sm:order-none sm:w-auto">
          {formatarMesReferencia(mesReferencia)}
        </p>
        <button
          type="button"
          onClick={() => setMesReferencia(mesAdjacente(mesReferencia, 1))}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Próximo →
        </button>
      </div>

      {carregando ? (
        <p className="mt-6 text-sm text-slate-400">Carregando...</p>
      ) : faltas.length === 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Nenhuma falta registrada nesse mês.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {faltas.map((f) => (
            <div key={f.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-tinta">
                    {f.colaboradorNome}
                    <span className="ml-2 font-normal text-slate-400">· {formatarData(f.data)}</span>
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-400">
                    Registrado por {f.registradoPorNome}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      f.justificada
                        ? 'bg-esmeralda-light text-esmeralda-dark'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {f.justificada ? 'Justificada' : 'Não justificada'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditandoId(editandoId === f.id ? null : f.id)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    {editandoId === f.id ? 'Editando...' : 'Editar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluir(f.id)}
                    disabled={processando === f.id}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              {editandoId === f.id ? (
                <LinhaEdicao
                  falta={f}
                  processando={processando === f.id}
                  onSalvar={(motivoEditado, justificadaEditada) =>
                    handleSalvarEdicao(f.id, motivoEditado, justificadaEditada)
                  }
                  onCancelar={() => setEditandoId(null)}
                />
              ) : (
                f.motivo && <p className="mt-2 text-sm text-slate-600">{f.motivo}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
