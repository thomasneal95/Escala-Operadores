interface Colaborador {
  id: string;
  nome_completo: string;
}

interface SeletorColaboradorProps {
  disponiveis: Colaborador[];
  onSelecionar: (colaboradorId: string) => void;
  desabilitado?: boolean;
}

export function SeletorColaborador({
  disponiveis,
  onSelecionar,
  desabilitado,
}: SeletorColaboradorProps) {
  if (disponiveis.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-200 px-2 py-1 text-xs text-slate-400">
        Nenhum colaborador disponível
      </p>
    );
  }

  return (
    <select
      value=""
      disabled={desabilitado}
      onChange={(e) => {
        if (e.target.value) {
          onSelecionar(e.target.value);
        }
      }}
      className="w-full rounded-md border border-dashed border-slate-300 bg-white px-2 py-1 text-xs text-slate-500 hover:border-esmeralda disabled:cursor-wait disabled:opacity-60"
    >
      <option value="">+ Adicionar</option>
      {disponiveis.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nome_completo}
        </option>
      ))}
    </select>
  );
}