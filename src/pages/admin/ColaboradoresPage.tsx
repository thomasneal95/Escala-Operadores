import { useState, type FormEvent } from 'react';
import { useCriarColaborador } from '../../features/employees/useCriarColaborador';
import { useColaboradores } from '../../features/employees/useColaboradores';
import { useAlterarSenhaColaborador } from '../../features/employees/useAlterarSenhaColaborador';
import { useEquipes } from '../../features/teams/useEquipes';
import { useTurnos } from '../../features/shifts/useTurnos';

interface FormularioNovoColaborador {
  nome_completo: string;
  email: string;
  senha: string;
  equipe_id: string;
  telefone: string;
  matricula: string;
  turno_semana_id: string;
}

const formularioVazio: FormularioNovoColaborador = {
  nome_completo: '',
  email: '',
  senha: '',
  equipe_id: '',
  telefone: '',
  matricula: '',
  turno_semana_id: '',
};

interface DadosEdicao {
  nome_completo: string;
  telefone: string;
  matricula: string;
  turno_semana_id: string;
}

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
    atualizarCadastro,
  } = useColaboradores();
  const { alterarSenha, processando: alterandoSenha } = useAlterarSenhaColaborador();
  const { equipes } = useEquipes();
  const { turnos } = useTurnos();

  const [form, setForm] = useState<FormularioNovoColaborador>(formularioVazio);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [dadosEdicao, setDadosEdicao] = useState<DadosEdicao>({
    nome_completo: '',
    telefone: '',
    matricula: '',
    turno_semana_id: '',
  });

  const [senhaId, setSenhaId] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState('');

  const [erroLinha, setErroLinha] = useState<Record<string, string>>({});
  const [sucessoLinha, setSucessoLinha] = useState<Record<string, string>>({});

  function nomeTurnoPorId(turnoId: string | null) {
    if (!turnoId) return '—';
    return turnos.find((t) => t.id === turnoId)?.nome ?? '—';
  }

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
      turno_semana_id: form.turno_semana_id || null,
    });

    if (resultado.erro) {
      setErroForm(resultado.erro);
      return;
    }

    setSucesso(`Colaborador "${form.nome_completo}" criado com sucesso.`);
    setForm(formularioVazio);
    await recarregar();
  }

  function iniciarEdicao(colaborador: {
    id: string;
    nome_completo: string;
    telefone: string | null;
    matricula: string | null;
    turno_semana_id: string | null;
  }) {
    setSenhaId(null);
    setEditandoId(colaborador.id);
    setDadosEdicao({
      nome_completo: colaborador.nome_completo,
      telefone: colaborador.telefone ?? '',
      matricula: colaborador.matricula ?? '',
      turno_semana_id: colaborador.turno_semana_id ?? '',
    });
  }

  async function salvarEdicao(colaboradorId: string, perfilId: string) {
    setErroLinha((atual) => ({ ...atual, [colaboradorId]: '' }));

    const resultado = await atualizarCadastro(colaboradorId, perfilId, {
      nome_completo: dadosEdicao.nome_completo,
      telefone: dadosEdicao.telefone || null,
      matricula: dadosEdicao.matricula || null,
      turno_semana_id: dadosEdicao.turno_semana_id || null,
    });

    if (resultado.erro) {
      setErroLinha((atual) => ({ ...atual, [colaboradorId]: resultado.erro as string }));
      return;
    }

    setEditandoId(null);
    setSucessoLinha((atual) => ({ ...atual, [colaboradorId]: 'Cadastro atualizado.' }));
  }

  function iniciarAlterarSenha(colaboradorId: string) {
    setEditandoId(null);
    setSenhaId(colaboradorId);
    setNovaSenha('');
  }

  async function salvarSenha(colaboradorId: string, perfilId: string) {
    setErroLinha((atual) => ({ ...atual, [colaboradorId]: '' }));

    if (novaSenha.length < 6) {
      setErroLinha((atual) => ({
        ...atual,
        [colaboradorId]: 'A senha precisa ter pelo menos 6 caracteres.',
      }));
      return;
    }

    const resultado = await alterarSenha(perfilId, novaSenha);

    if (resultado.erro) {
      setErroLinha((atual) => ({ ...atual, [colaboradorId]: resultado.erro as string }));
      return;
    }

    setSenhaId(null);
    setNovaSenha('');
    setSucessoLinha((atual) => ({ ...atual, [colaboradorId]: 'Senha alterada com sucesso.' }));
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
            <label className="block text-sm font-medium text-slate-700">
              Turno da semana
            </label>
            <select
              value={form.turno_semana_id}
              onChange={(e) => setForm({ ...form, turno_semana_id: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
            >
              <option value="">Não informado</option>
              {turnos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Turno que a pessoa trabalha durante a semana (usado na escala automática).
            </p>
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
                <th className="px-4 py-3 font-medium">Turno semana</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {colaboradores.map((colaborador) => {
                const emEdicao = editandoId === colaborador.id;
                const alterandoSenhaDele = senhaId === colaborador.id;

                return (
                  <tr key={colaborador.id}>
                    <td className="px-4 py-3">
                      {emEdicao ? (
                        <input
                          type="text"
                          value={dadosEdicao.nome_completo}
                          onChange={(e) =>
                            setDadosEdicao({ ...dadosEdicao, nome_completo: e.target.value })
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1"
                        />
                      ) : (
                        <p className="font-medium text-tinta">{colaborador.nome_completo}</p>
                      )}
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
                    <td className="px-4 py-3">
                      {emEdicao ? (
                        <select
                          value={dadosEdicao.turno_semana_id}
                          onChange={(e) =>
                            setDadosEdicao({ ...dadosEdicao, turno_semana_id: e.target.value })
                          }
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value="">Não informado</option>
                          {turnos.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-500">
                          {nomeTurnoPorId(colaborador.turno_semana_id)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {emEdicao ? (
                        <input
                          type="text"
                          value={dadosEdicao.telefone}
                          onChange={(e) =>
                            setDadosEdicao({ ...dadosEdicao, telefone: e.target.value })
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1 font-sans"
                          placeholder="Telefone"
                        />
                      ) : (
                        colaborador.telefone ?? '—'
                      )}
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
                      {emEdicao ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            type="text"
                            value={dadosEdicao.matricula}
                            onChange={(e) =>
                              setDadosEdicao({ ...dadosEdicao, matricula: e.target.value })
                            }
                            className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                            placeholder="Matrícula"
                          />
                          <button
                            onClick={() => salvarEdicao(colaborador.id, colaborador.perfil_id)}
                            disabled={atualizando}
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
                        </div>
                      ) : alterandoSenhaDele ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            type="text"
                            value={novaSenha}
                            onChange={(e) => setNovaSenha(e.target.value)}
                            className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm"
                            placeholder="Nova senha (mín. 6)"
                            autoFocus
                          />
                          <button
                            onClick={() => salvarSenha(colaborador.id, colaborador.perfil_id)}
                            disabled={alterandoSenha}
                            className="text-sm font-medium text-esmeralda-dark hover:text-esmeralda"
                          >
                            Salvar senha
                          </button>
                          <button
                            onClick={() => setSenhaId(null)}
                            className="text-sm font-medium text-slate-500 hover:text-slate-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => iniciarEdicao(colaborador)}
                            className="text-sm font-medium text-slate-600 hover:text-tinta"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => iniciarAlterarSenha(colaborador.id)}
                            className="text-sm font-medium text-slate-600 hover:text-tinta"
                          >
                            Alterar senha
                          </button>
                          <button
                            onClick={() => alternarAtivo(colaborador.id, !colaborador.ativo)}
                            disabled={atualizando}
                            className="text-sm font-medium text-slate-600 hover:text-tinta"
                          >
                            {colaborador.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                      )}

                      {erroLinha[colaborador.id] && (
                        <p className="mt-1 text-xs text-red-600">{erroLinha[colaborador.id]}</p>
                      )}
                      {sucessoLinha[colaborador.id] && !erroLinha[colaborador.id] && (
                        <p className="mt-1 text-xs text-esmeralda-dark">
                          {sucessoLinha[colaborador.id]}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}