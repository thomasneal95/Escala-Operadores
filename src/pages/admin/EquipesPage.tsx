import { useState, type FormEvent } from 'react';
import { useEquipes } from '../../features/teams/useEquipes';

export function EquipesPage() {
  const { equipes, carregando, erro, processando, criar, renomear, alternarAtivo } = useEquipes();
  const [novoNome, setNovoNome] = useState('');
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState('');

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

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {equipes.map((equipe) => (
              <tr key={equipe.id}>
                <td className="px-4 py-3">
                  {editandoId === equipe.id ? (
                    <input
                      type="text"
                      value={nomeEditado}
                      onChange={(e) => setNomeEditado(e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium text-tinta">{equipe.nome}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      equipe.ativo
                        ? 'bg-esmeralda-light text-esmeralda-dark'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {equipe.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}