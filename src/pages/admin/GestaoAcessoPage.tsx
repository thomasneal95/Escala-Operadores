import { useState } from 'react';
import { useGestaoAcesso } from '../../features/employees/useGestaoAcesso';
import { useExcluirColaborador } from '../../features/employees/useExcluirColaborador';
import { useConfirm } from '../../components/FeedbackProvider';

export function GestaoAcessoPage() {
  const { perfis, carregando, erro, processando, alterarPapel, recarregar } = useGestaoAcesso();
  const { excluir, processando: excluindo } = useExcluirColaborador();
  const confirmar = useConfirm();
  const [erroLinha, setErroLinha] = useState<Record<string, string>>({});
  const [mensagemLinha, setMensagemLinha] = useState<Record<string, string>>({});

  async function handleAlterar(perfilId: string, novoPapel: 'administrador' | 'colaborador') {
    setErroLinha((atual) => ({ ...atual, [perfilId]: '' }));
    const resultado = await alterarPapel(perfilId, novoPapel);
    if (resultado.erro) {
      setErroLinha((atual) => ({ ...atual, [perfilId]: resultado.erro as string }));
    }
  }

    async function handleExcluir(perfilId: string, nome: string) {
    const confirmou = await confirmar(
      `Tem certeza que deseja excluir "${nome}"?\n\n` +
        'Se este colaborador nunca teve disponibilidade ou escala registrada, ' +
        'ele será excluído completamente do sistema.\n\n' +
        'Se ele já tiver histórico de escalas, o cadastro será desativado e o ' +
        'acesso bloqueado, mas o histórico será preservado.'
    );

    if (!confirmou) return;

    setErroLinha((atual) => ({ ...atual, [perfilId]: '' }));
    setMensagemLinha((atual) => ({ ...atual, [perfilId]: '' }));

    const resultado = await excluir(perfilId);

    if (resultado.erro) {
      setErroLinha((atual) => ({ ...atual, [perfilId]: resultado.erro as string }));
      return;
    }

    if (resultado.modo === 'excluido') {
      await recarregar();
    } else {
      setMensagemLinha((atual) => ({
        ...atual,
        [perfilId]: 'Colaborador desativado e acesso bloqueado (histórico preservado).',
      }));
      await recarregar();
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

      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Acesso
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        Administradores e colaboradores
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Defina quem tem acesso ao painel administrativo e quem acessa como
        colaborador. Colaboradores que saíram da empresa podem ser excluídos
        aqui.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Papel atual</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {perfis.map((perfil) => (
              <tr key={perfil.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-tinta">{perfil.nome_completo}</p>
                  {perfil.papel === 'colaborador' && !perfil.temCadastroColaborador && (
                    <p className="mt-0.5 text-xs text-amber-600">
                      Sem cadastro de colaborador (equipe/telefone) — adicione na aba
                      Colaboradores, se necessário.
                    </p>
                  )}
                  {mensagemLinha[perfil.id] && (
                    <p className="mt-0.5 text-xs text-esmeralda-dark">
                      {mensagemLinha[perfil.id]}
                    </p>
                  )}
                  {erroLinha[perfil.id] && (
                    <p className="mt-0.5 text-xs text-red-600">{erroLinha[perfil.id]}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      perfil.papel === 'administrador'
                        ? 'bg-profundo-light text-profundo'
                        : 'bg-ceruleo-light text-ceruleo'
                    }`}
                  >
                    {perfil.papel === 'administrador' ? 'Administrador' : 'Colaborador'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-3">
                    {perfil.papel === 'administrador' ? (
                      <button
                        onClick={() => handleAlterar(perfil.id, 'colaborador')}
                        disabled={processando === perfil.id}
                        className="text-sm font-medium text-slate-600 hover:text-tinta disabled:opacity-50"
                      >
                        Tornar colaborador
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleAlterar(perfil.id, 'administrador')}
                          disabled={processando === perfil.id}
                          className="text-sm font-medium text-slate-600 hover:text-tinta disabled:opacity-50"
                        >
                          Tornar administrador
                        </button>
                        <button
                          onClick={() => handleExcluir(perfil.id, perfil.nome_completo)}
                          disabled={excluindo}
                          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          Excluir
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