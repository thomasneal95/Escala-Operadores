import { useState, type FormEvent } from 'react';
import { useApontarMulta } from '../features/multas/useApontarMulta';
import { useModalAcessivel } from '../hooks/useModalAcessivel';

interface ApontarMultaModalProps {
  aberto: boolean;
  onFechar: () => void;
  onEnviado: () => void;
}

const NAO_SEI_INFORMAR = '__nao_sei_informar__';

export function ApontarMultaModal({ aberto, onFechar, onEnviado }: ApontarMultaModalProps) {
  const { turnos, colaboradores, carregando, enviando, erro, criarSolicitacao } =
    useApontarMulta();
  const ref = useModalAcessivel(aberto, onFechar);

  const [turnoId, setTurnoId] = useState('');
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState('');
  const [anonimo, setAnonimo] = useState(false);
  const [imagens, setImagens] = useState<File[]>([]);
  const [erroForm, setErroForm] = useState<string | null>(null);

  if (!aberto) return null;

  function limparEFechar() {
    setTurnoId('');
    setColaboradorSelecionado('');
    setAnonimo(false);
    setImagens([]);
    setErroForm(null);
    onFechar();
  }

  async function handleEnviar(event: FormEvent) {
    event.preventDefault();
    setErroForm(null);

    if (!turnoId) {
      setErroForm('Selecione o turno.');
      return;
    }
    if (!colaboradorSelecionado) {
      setErroForm('Selecione quem deve ser multado (ou "Não sei informar").');
      return;
    }
    if (imagens.length === 0) {
      setErroForm('Anexe ao menos uma imagem de comprovação.');
      return;
    }

    const resultado = await criarSolicitacao({
      turnoId,
      colaboradorApontadoId:
        colaboradorSelecionado === NAO_SEI_INFORMAR ? null : colaboradorSelecionado,
      anonimo,
      imagens,
    });

    if (resultado.erro) {
      setErroForm(resultado.erro);
      return;
    }

    onEnviado();
    limparEFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-apontar-multa"
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <h3 id="titulo-apontar-multa" className="font-display text-lg font-semibold text-tinta">
            Apontar multa
          </h3>
          <button
            onClick={limparEFechar}
            className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {carregando ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : (
            <form onSubmit={handleEnviar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Turno em que aconteceu
                </label>
                <select
                  value={turnoId}
                  onChange={(e) => setTurnoId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
                >
                  <option value="">Selecione...</option>
                  {turnos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Quem deve ser multado
                </label>
                <select
                  value={colaboradorSelecionado}
                  onChange={(e) => setColaboradorSelecionado(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
                >
                  <option value="">Selecione...</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome_completo}
                    </option>
                  ))}
                  <option value={NAO_SEI_INFORMAR}>Não sei informar</option>
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Use "Não sei informar" se a bagunça pode ser de outro turno.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Imagem(ns) de comprovação
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  required
                  onChange={(e) => setImagens(Array.from(e.target.files ?? []))}
                  className="mt-1 w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
                {imagens.length > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {imagens.length} arquivo{imagens.length > 1 ? 's' : ''} selecionado
                    {imagens.length > 1 ? 's' : ''}.
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={anonimo}
                  onChange={(e) => setAnonimo(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-esmeralda focus:ring-esmeralda"
                />
                <span className="text-sm font-medium text-slate-700">Enviar de forma anônima</span>
              </label>
              <p className="-mt-2 text-xs text-slate-400">
                Seu nome não aparecerá para os outros colaboradores no mural.
              </p>

              {(erroForm || erro) && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {erroForm ?? erro}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-md bg-esmeralda px-4 py-2.5 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enviando ? 'Enviando...' : 'Enviar apontamento'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
