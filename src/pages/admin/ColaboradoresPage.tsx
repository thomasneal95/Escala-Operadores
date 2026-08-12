import { useState, type FormEvent } from 'react';
import { useCriarColaborador } from '../../features/employees/useCriarColaborador';
import { useColaboradores } from '../../features/employees/useColaboradores';
import { useEquipes } from '../../features/teams/useEquipes';

interface FormularioNovoColaborador {
  nome_completo: string;
  email: string;
  senha: string;
  equipe_id: string;
  telefone: string;
  matricula: string;
}

const formularioVazio: FormularioNovoColaborador = {
  nome_completo: '',
  email: '',
  senha: '',
  equipe_id: '',
  telefone: '',
  matricula: '',
};

export function ColaboradoresPage() {
  const { criar, processando: criando } = useCriarColaborador();
  const {
    colaboradores,
    carregando,
    erro,
    processando: atualizando,
    recarregar,
    atualizarEquipe,
    alternarAtivo,
  } = useColaboradores();
  const { equipes } = useEquipes();

  const [form, setForm] = useState<FormularioNovoColaborador>(formularioVazio);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function handleCriar(event: FormEvent) {
    event.preventDefault();
    setErroForm(null);
    setSucesso(null);

    const resultado = await criar({
      nome_completo: form.nome_completo,
      email: form.email,
      senha: form.senha,
      equipe_id: form.equipe_id || null,
      telefone: form.telefone || null,
      matricula: form.matricula || null,
    });

    if (resultado.erro) {
      setErroForm(resultado.erro);
      return;
    }

    setSucesso(`Colaborador "${form.nome_completo}" criado com sucesso.`);
    setForm(formularioVazio);
    await recarregar();
  }

  return (
    <div>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-display font-semibold text-tinta">Novo colaborador</h2>
        <form onSubmit={handleCriar} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nome completo</label>
            <input
              type="text"
              required
              value={form.nome_completo}
              onChange={(e) => setForm({ ...form, nome_completo: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">E-mail</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Senha inicial</label>
            <input
              type="text"
              required
              minLength={6}
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
              placeholder="mín. 6 caracteres"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Equipe</label>
            <select
              value={form.equipe_id}
              onChange={(e) => setForm({ ...form, equipe_id: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
            >
              <option value="">Sem equipe</option>
              {equipes
                .filter((e) => e.ativo)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Telefone (opcional)</label>
            <input
              type="text"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Matrícula (opcional)</label>
            <input
              type="text"
              value={form.matricula}
              onChange={(e) => setForm({ ...form, matricula: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={criando}
              className="rounded-md bg-esmeralda px-4 py-2 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {criando ? 'Criando...' : 'Criar colaborador'}
            </button>
          </div>
        </form>

        {erroForm && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erroForm}</p>
        )}
        {sucesso && (
          <p className="mt-3 rounded-md bg-esmeralda-light px-3 py-2 text-sm text-esmeralda-dark">
            {sucesso}
          </p>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {erro && (
          <p className="m-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
        )}
        {carregando ? (
          <p className="p-4 text-sm text-slate-400">Carregando...</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Equipe</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {colaboradores.map((colaborador) => (
                <tr key={colaborador.id}>
                  <td className="px-4 py-3 font-medium text-tinta">
                    {colaborador.nome_completo}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={colaborador.equipe_id ?? ''}
                      onChange={(e) => atualizarEquipe(colaborador.id, e.target.value || null)}
                      disabled={atualizando}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">Sem equipe</option>
                      {equipes
                        .filter((e) => e.ativo)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nome}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {colaborador.telefone ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        colaborador.ativo
                          ? 'bg-esmeralda-light text-esmeralda-dark'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {colaborador.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => alternarAtivo(colaborador.id, !colaborador.ativo)}
                      disabled={atualizando}
                      className="text-sm font-medium text-slate-600 hover:text-tinta"
                    >
                      {colaborador.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}