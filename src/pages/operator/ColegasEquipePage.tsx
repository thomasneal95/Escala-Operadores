import { useColegasEquipe } from '../../features/teams/useColegasEquipe';

function formatarTelefone(telefone: string) {
  const digitos = telefone.replace(/\D/g, '');

  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }

  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }

  return telefone;
}

export function ColegasEquipePage() {
  const { equipeNome, colegas, carregando, erro } = useColegasEquipe();

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      <p className="font-mono text-xs font-medium uppercase tracking-widest text-ceruleo">
        Minha equipe
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-tinta">
        {equipeNome ?? 'Sem equipe'}
      </h1>

      {!equipeNome ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Você ainda não foi associado a nenhuma equipe.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {colegas.map((colega) => (
              <li key={colega.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-tinta">
                    {colega.nome_completo}
                    {colega.souEu && (
                      <span className="ml-2 rounded-full bg-esmeralda-light px-2 py-0.5 text-xs font-medium text-esmeralda-dark">
                        Você
                      </span>
                    )}
                  </p>
                </div>
                {colega.telefone && (
                  <p className="font-mono text-sm text-slate-400">
                    {formatarTelefone(colega.telefone)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}