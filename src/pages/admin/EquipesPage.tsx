import { useState, type FormEvent } from 'react';
import { useEquipes } from '../../features/teams/useEquipes';
import { useVagasEquipe } from '../../features/teams/useVagasEquipe';
import { useTurnos } from '../../features/shifts/useTurnos';

export function EquipesPage() {
  const { equipes, carregando, erro, processando, criar, renomear, alternarAtivo } = useEquipes();
  const { turnos } = useTurnos();
  const { vagasDe, definirVagas, salvando } = useVagasEquipe();

  const [novoNome, setNovoNome] = useState('');
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [equipeExpandida, setEquipeExpandida] = useState<string | null>(null);

  async function handleCriar(event: FormEvent) {
    event.preventDefault();
    setErroForm(null);

    const resultado = await criar(novoNome);
    if (resultado.erro) {
      setErroForm(resultado.erro);
      return;
    }

    setNovoNome('');
  }

  function iniciarEdicao(id: string, nomeAtual: string) {
    setEditandoId(id);
    setNomeEditado(nomeAtual);
  }

  async function salvarEdicao(id: string) {
    const resultado = await renomear(id, nomeEditado);
    if (!resultado.erro) {
      setEditandoId(null);
    }
  }

  function alternarExpansao(equipeId: string) {
    setEquipeExpandida((atual) => (atual === equipeId ? null : equipeId));
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
        <h2 className="font-display font-semibold text-tinta">Nova equipe</h2>
        <form onSubmit={handleCriar} className="mt-4 flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <label htmlFor="nome_equipe" className="block text-sm font-medium text-slate-700">
              Nome
            </label>
            <input
              id="nome_equipe"
              type="text"
              required
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
              placeholder="Equipe B"
            />
          </div>
          <button
            type="submit"
            disabled={processando}
            className="rounded-md bg-esmeralda px-4 py-2 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processando ? 'Criando...' : 'Criar equipe'}
          </button>
        </form>
        {erroForm && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erroForm}</p>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {equipes.map((equipe) => {
          const expandida = equipeExpandida === equipe.id;

          return (
            <div
              key={equipe.id}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {editandoId === equipe.id ? (
                    <input
                      type="text"
                      value={nomeEditado}
                      onChange={(e) => setNomeEditado(e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium text-tinta">{equipe.nome}</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      equipe.ativo
                        ? 'bg-esmeralda-light text-esmeralda-dark'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {equipe.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {editandoId === equipe.id ? (
                    <>
                      <button
                        onClick={() => salvarEdicao(equipe.id)}
                        disabled={processando}
                        className="text-sm font-medium text-esmeralda-dark hover:text-esmeralda"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        className="text-sm font-medium text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => alternarExpansao(equipe.id)}
                        className="text-sm font-medium text-ceruleo hover:text-ceruleo/80"
                      >
                        {expandida ? 'Ocultar vagas' : 'Configurar vagas'}
                      </button>
                      <button
                        onClick={() => iniciarEdicao(equipe.id, equipe.nome)}
                        className="text-sm font-medium text-slate-600 hover:text-tinta"
                      >
                        Renomear
                      </button>
                      <button
                        onClick={() => alternarAtivo(equipe.id, !equipe.ativo)}
                        disabled={processando}
                        className="text-sm font-medium text-slate-600 hover:text-tinta"
                      >
                        {equipe.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {expandida && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Vagas necessárias por turno (fim de semana)
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {turnos.map((turno) => (
                      <div key={turno.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                        <span className="text-sm text-tinta">{turno.nome}</span>
                        <input
                          type="number"
                          min={0}
                          value={vagasDe(equipe.id, turno.id)}
                          onChange={(e) =>
                            definirVagas(equipe.id, turno.id, Number(e.target.value))
                          }
                          disabled={salvando}
                          className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  {turnos.length === 0 && (
                    <p className="mt-2 text-sm text-slate-400">
                      Nenhum turno cadastrado ainda.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}