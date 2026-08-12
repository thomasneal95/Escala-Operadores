import { useState, type FormEvent } from 'react';
import { useTurnos } from '../../features/shifts/useTurnos';
import { HoraSelect } from '../../features/shifts/HoraSelect';

interface FormularioTurno {
  nome: string;
  hora_inicio: string;
  hora_fim: string;
  ordem_exibicao: string;
}

const formularioVazio: FormularioTurno = {
  nome: '',
  hora_inicio: '',
  hora_fim: '',
  ordem_exibicao: '',
};

export function TurnosPage() {
  const { turnos, carregando, erro, processando, criar, atualizar, alternarAtivo } = useTurnos();
  const [novoTurno, setNovoTurno] = useState<FormularioTurno>(formularioVazio);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [dadosEdicao, setDadosEdicao] = useState<FormularioTurno>(formularioVazio);

  async function handleCriar(event: FormEvent) {
    event.preventDefault();
    setErroForm(null);

    const resultado = await criar({
      nome: novoTurno.nome,
      hora_inicio: novoTurno.hora_inicio,
      hora_fim: novoTurno.hora_fim,
      ordem_exibicao: novoTurno.ordem_exibicao ? Number(novoTurno.ordem_exibicao) : null,
    });

    if (resultado.erro) {
      setErroForm(resultado.erro);
      return;
    }

    setNovoTurno(formularioVazio);
  }

  function iniciarEdicao(turno: {
    id: string;
    nome: string;
    hora_inicio: string;
    hora_fim: string;
    ordem_exibicao: number | null;
  }) {
    setEditandoId(turno.id);
    setDadosEdicao({
      nome: turno.nome,
      hora_inicio: turno.hora_inicio.slice(0, 5),
      hora_fim: turno.hora_fim.slice(0, 5),
      ordem_exibicao: turno.ordem_exibicao?.toString() ?? '',
    });
  }

  async function salvarEdicao(id: string) {
    setErroForm(null);
    const resultado = await atualizar(id, {
      nome: dadosEdicao.nome,
      hora_inicio: dadosEdicao.hora_inicio,
      hora_fim: dadosEdicao.hora_fim,
      ordem_exibicao: dadosEdicao.ordem_exibicao ? Number(dadosEdicao.ordem_exibicao) : null,
    });

    if (resultado.erro) {
      setErroForm(resultado.erro);
      return;
    }

    setEditandoId(null);
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
        <h2 className="font-display font-semibold text-tinta">Novo turno</h2>
        <form onSubmit={handleCriar} className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nome</label>
            <input
              type="text"
              required
              value={novoTurno.nome}
              onChange={(e) => setNovoTurno({ ...novoTurno, nome: e.target.value })}
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
              placeholder="Madrugada"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Início</label>
            <div className="mt-1">
              <HoraSelect
                value={novoTurno.hora_inicio}
                onChange={(v) => setNovoTurno({ ...novoTurno, hora_inicio: v })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Fim</label>
            <div className="mt-1">
              <HoraSelect
                value={novoTurno.hora_fim}
                onChange={(v) => setNovoTurno({ ...novoTurno, hora_fim: v })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Ordem</label>
            <input
              type="number"
              value={novoTurno.ordem_exibicao}
              onChange={(e) => setNovoTurno({ ...novoTurno, ordem_exibicao: e.target.value })}
              className="mt-1 w-20 rounded-md border border-slate-300 px-3 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
              placeholder="4"
            />
          </div>
          <button
            type="submit"
            disabled={processando}
            className="rounded-md bg-esmeralda px-4 py-2 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processando ? 'Criando...' : 'Criar turno'}
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
              <th className="px-4 py-3 font-medium">Início</th>
              <th className="px-4 py-3 font-medium">Fim</th>
              <th className="px-4 py-3 font-medium">Ordem</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {turnos.map((turno) => {
              const emEdicao = editandoId === turno.id;

              return (
                <tr key={turno.id}>
                  <td className="px-4 py-3">
                    {emEdicao ? (
                      <input
                        type="text"
                        value={dadosEdicao.nome}
                        onChange={(e) => setDadosEdicao({ ...dadosEdicao, nome: e.target.value })}
                        className="rounded-md border border-slate-300 px-2 py-1"
                      />
                    ) : (
                      <span className="font-medium text-tinta">{turno.nome}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {emEdicao ? (
                      <HoraSelect
                        value={dadosEdicao.hora_inicio}
                        onChange={(v) => setDadosEdicao({ ...dadosEdicao, hora_inicio: v })}
                      />
                    ) : (
                      turno.hora_inicio.slice(0, 5)
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {emEdicao ? (
                      <HoraSelect
                        value={dadosEdicao.hora_fim}
                        onChange={(v) => setDadosEdicao({ ...dadosEdicao, hora_fim: v })}
                      />
                    ) : (
                      turno.hora_fim.slice(0, 5)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {emEdicao ? (
                      <input
                        type="number"
                        value={dadosEdicao.ordem_exibicao}
                        onChange={(e) =>
                          setDadosEdicao({ ...dadosEdicao, ordem_exibicao: e.target.value })
                        }
                        className="w-16 rounded-md border border-slate-300 px-2 py-1"
                      />
                    ) : (
                      turno.ordem_exibicao ?? '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        turno.ativo
                          ? 'bg-esmeralda-light text-esmeralda-dark'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {turno.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      {emEdicao ? (
                        <>
                          <button
                            onClick={() => salvarEdicao(turno.id)}
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
                            onClick={() => iniciarEdicao(turno)}
                            className="text-sm font-medium text-slate-600 hover:text-tinta"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => alternarAtivo(turno.id, !turno.ativo)}
                            disabled={processando}
                            className="text-sm font-medium text-slate-600 hover:text-tinta"
                          >
                            {turno.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                        </>
                      )}
                    </div>
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