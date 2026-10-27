import { useState } from 'react';
import { useGestaoAcesso } from '../../features/employees/useGestaoAcesso';
import { useExcluirColaborador } from '../../features/employees/useExcluirColaborador';
import { useAlterarSenhaColaborador } from '../../features/employees/useAlterarSenhaColaborador';
import { useConfirm } from '../../components/FeedbackProvider';
import { useDiagnosticoAcesso, type DiagnosticoAcesso } from '../../features/employees/useDiagnosticoAcesso';

export function GestaoAcessoPage() {
  const { perfis, carregando, erro, processando, alterarPapel, recarregar } = useGestaoAcesso();
  const { excluir, processando: excluindo } = useExcluirColaborador();
  const { alterarSenha, processando: alterandoSenha } = useAlterarSenhaColaborador();
  const confirmar = useConfirm();
  const [erroLinha, setErroLinha] = useState<Record<string, string>>({});
  const [mensagemLinha, setMensagemLinha] = useState<Record<string, string>>({});
  const [senhaId, setSenhaId] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const diagnostico = useDiagnosticoAcesso();
  const [diagnosticos, setDiagnosticos] = useState<Record<string, DiagnosticoAcesso>>({});

  async function verificarAcesso(
    perfilId: string,
    acao: 'diagnosticar' | 'liberar' | 'confirmar_email' = 'diagnosticar'
  ) {
    setErroLinha((atual) => ({ ...atual, [perfilId]: '' }));
    const resultado =
      acao === 'liberar'
        ? await diagnostico.liberar(perfilId)
        : acao === 'confirmar_email'
          ? await diagnostico.confirmarEmail(perfilId)
          : await diagnostico.diagnosticar(perfilId);
    if (resultado.erro || !resultado.diagnostico) {
      setErroLinha((atual) => ({ ...atual, [perfilId]: resultado.erro ?? '' }));
      return;
    }
    setDiagnosticos((atual) => ({ ...atual, [perfilId]: resultado.diagnostico as DiagnosticoAcesso }));
  }

  async function handleAlterar(perfilId: string, novoPapel: 'administrador' | 'colaborador') {
    setErroLinha((atual) => ({ ...atual, [perfilId]: '' }));
    const resultado = await alterarPapel(perfilId, novoPapel);
    if (resultado.erro) {
      setErroLinha((atual) => ({ ...atual, [perfilId]: resultado.erro as string }));
    }
  }

  async function handleExcluir(perfilId: string, nome: string) {
    const confirmou = await confirmar(
      `Tem certeza que deseja excluir "${nome}" definitivamente?\n\n` +
        'A exclusão só é permitida para cadastros sem nenhum registro ' +
        '(escala, disponibilidade, falta, multa, fechamento...).\n\n' +
        'Para quem já tem histórico, use "Desativar" na tela de Colaboradores.'
    );

    if (!confirmou) return;

    setErroLinha((atual) => ({ ...atual, [perfilId]: '' }));
    setMensagemLinha((atual) => ({ ...atual, [perfilId]: '' }));

    const resultado = await excluir(perfilId);

    if (resultado.erro) {
      setErroLinha((atual) => ({ ...atual, [perfilId]: resultado.erro as string }));
      return;
    }

    await recarregar();
  }

  function iniciarAlterarSenha(perfilId: string) {
    setSenhaId(perfilId);
    setNovaSenha('');
    setErroLinha((atual) => ({ ...atual, [perfilId]: '' }));
    setMensagemLinha((atual) => ({ ...atual, [perfilId]: '' }));
  }

  async function salvarSenha(perfilId: string) {
    setErroLinha((atual) => ({ ...atual, [perfilId]: '' }));

    if (novaSenha.length < 6) {
      setErroLinha((atual) => ({
        ...atual,
        [perfilId]: 'A senha precisa ter pelo menos 6 caracteres.',
      }));
      return;
    }

    const resultado = await alterarSenha(perfilId, novaSenha);

    if (resultado.erro) {
      setErroLinha((atual) => ({ ...atual, [perfilId]: resultado.erro as string }));
      return;
    }

    setSenhaId(null);
    setNovaSenha('');
    setMensagemLinha((atual) => ({ ...atual, [perfilId]: 'Senha alterada com sucesso.' }));
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
        colaborador. Também é aqui que você altera a senha de qualquer pessoa.
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
            {perfis.map((perfil) => {
              const alterandoSenhaDele = senhaId === perfil.id;

              return (
                <tr key={perfil.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-tinta">{perfil.nome_completo}</p>
                    {perfil.papel === 'colaborador' && !perfil.temCadastroColaborador && (
                      <p className="mt-0.5 text-xs text-amber-600">
                        Sem cadastro de colaborador (equipe/telefone) — adicione na aba
                        Colaboradores, se necessário.
                      </p>
                    )}
                    {diagnosticos[perfil.id] && (
                      <PainelDiagnostico
                        d={diagnosticos[perfil.id]}
                        processando={diagnostico.processando === perfil.id}
                        onLiberar={() => verificarAcesso(perfil.id, 'liberar')}
                        onConfirmarEmail={() => verificarAcesso(perfil.id, 'confirmar_email')}
                        onFechar={() =>
                          setDiagnosticos(({ [perfil.id]: _, ...resto }) => resto)
                        }
                      />
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
                    {!perfil.ativo && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {alterandoSenhaDele ? (
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
                          onClick={() => salvarSenha(perfil.id)}
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
                        <button
                          onClick={() => iniciarAlterarSenha(perfil.id)}
                          className="text-sm font-medium text-slate-600 hover:text-tinta"
                        >
                          Alterar senha
                        </button>
                        <button
                          onClick={() => verificarAcesso(perfil.id)}
                          disabled={diagnostico.processando === perfil.id}
                          className="text-sm font-medium text-ceruleo hover:underline disabled:opacity-50"
                        >
                          {diagnostico.processando === perfil.id ? 'Verificando...' : 'Verificar acesso'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function dataHora(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca';
}

// O que o login tem da pessoa e, quando é o caso, o motivo provável de ela
// não conseguir entrar.
function PainelDiagnostico({
  d,
  processando,
  onLiberar,
  onConfirmarEmail,
  onFechar,
}: {
  d: DiagnosticoAcesso;
  processando: boolean;
  onLiberar: () => void;
  onConfirmarEmail: () => void;
  onFechar: () => void;
}) {
  const problemas: string[] = [];
  if (!d.existeLogin) problemas.push('Não existe login para este perfil. Será preciso recriar o cadastro.');
  if (d.existeLogin && !d.perfilAtivo) problemas.push('O perfil está desativado — o login fica bloqueado de propósito.');
  if (d.bloqueado && d.perfilAtivo) problemas.push('O login está bloqueado, mas o perfil está ativo.');
  if (d.existeLogin && !d.emailConfirmado) problemas.push('O e-mail de login não está confirmado.');
  if (d.emailLogin && d.emailPerfil && d.emailLogin.toLowerCase() !== d.emailPerfil.toLowerCase()) {
    problemas.push(`O e-mail do cadastro (${d.emailPerfil}) é diferente do e-mail de login.`);
  }

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
      {d.existeLogin && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt className="text-slate-400">E-mail de login</dt>
          <dd className="break-all font-medium text-tinta">{d.emailLogin}</dd>
          <dt className="text-slate-400">Situação</dt>
          <dd>{d.bloqueado ? 'Bloqueado' : 'Liberado'}{d.emailConfirmado ? '' : ' · e-mail não confirmado'}</dd>
          <dt className="text-slate-400">Último acesso</dt>
          <dd>{dataHora(d.ultimoLogin)}</dd>
        </dl>
      )}
      {problemas.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-red-700">
          {problemas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-esmeralda-dark">
          Nenhum bloqueio no login. Se a pessoa não consegue entrar, confira se ela digita exatamente o
          e-mail acima; se estiver certo, o problema é a senha — use "Alterar senha".
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-3">
        {d.bloqueado && d.perfilAtivo && (
          <button onClick={onLiberar} disabled={processando} className="font-medium text-ceruleo hover:underline">
            Liberar login
          </button>
        )}
        {d.existeLogin && !d.emailConfirmado && (
          <button onClick={onConfirmarEmail} disabled={processando} className="font-medium text-ceruleo hover:underline">
            Confirmar e-mail
          </button>
        )}
        <button onClick={onFechar} className="font-medium text-slate-500 hover:text-slate-700">
          Fechar
        </button>
      </div>
    </div>
  );
}
