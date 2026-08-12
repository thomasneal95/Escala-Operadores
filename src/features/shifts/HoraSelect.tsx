interface HoraSelectProps {
  value: string; // formato "HH:MM"
  onChange: (novoValor: string) => void;
  passoMinutos?: number;
}

export function HoraSelect({ value, onChange, passoMinutos = 10 }: HoraSelectProps) {
  const [horaAtual, minutoAtual] = value ? value.split(':') : ['', ''];

  const horas = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutos = Array.from({ length: Math.ceil(60 / passoMinutos) }, (_, i) =>
    (i * passoMinutos).toString().padStart(2, '0')
  );

  function atualizar(hora: string, minuto: string) {
    if (hora && minuto) {
      onChange(`${hora}:${minuto}`);
    }
  }

  return (
    <div className="flex gap-1">
      <select
        value={horaAtual}
        onChange={(e) => atualizar(e.target.value, minutoAtual || minutos[0])}
        className="rounded-md border border-slate-300 px-2 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
      >
        <option value="" disabled>
          --
        </option>
        {horas.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="self-center text-slate-400">:</span>
      <select
        value={minutoAtual}
        onChange={(e) => atualizar(horaAtual || horas[0], e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-2 text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
      >
        <option value="" disabled>
          --
        </option>
        {minutos.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}