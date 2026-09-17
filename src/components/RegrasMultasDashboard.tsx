import { Fragment } from 'react';
import { useConfiguracaoRegrasMultas } from '../features/multas/useConfiguracaoRegrasMultas';
import { iconePorChave, ICONE_ALERTA_MULTA } from '../lib/iconesMultas';

// Suporte bem simples a **negrito** dentro do texto do alerta, sem precisar
// de uma biblioteca de markdown pra uma coisa tão pequena.
function renderizarComNegrito(texto: string) {
  const partes = texto.split(/\*\*(.+?)\*\*/g);
  return partes.map((parte, i) =>
    i % 2 === 1 ? (
      <strong key={i}>{parte}</strong>
    ) : (
      <Fragment key={i}>{parte}</Fragment>
    )
  );
}

export function RegrasMultasDashboard() {
  const { config, carregando, erro } = useConfiguracaoRegrasMultas();

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  if (erro || !config) {
    return (
      <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        {erro ?? 'Não foi possível carregar as regras.'}
      </p>
    );
  }

  const paragrafosAlerta = config.alertaTexto.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ceruleo-light text-ceruleo">
            <span className="h-5 w-5">{iconePorChave('lista')}</span>
          </span>
          <div>
            <h2 className="font-display font-semibold text-tinta">
              Regras de convivência do escritório
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Regras para manter um ambiente organizado, limpo e agradável para toda a equipe.
            </p>
          </div>
        </div>
      </div>

      {config.categorias.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {config.categorias.map((categoria) => (
            <div key={categoria.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ceruleo-light text-ceruleo">
                  <span className="h-4 w-4">{iconePorChave(categoria.icone)}</span>
                </span>
                <p className="font-display font-semibold text-tinta">{categoria.titulo}</p>
              </div>
              <div className="mt-3 space-y-1.5">
                {categoria.regras.map((regra, i) => (
                  <p key={i} className="text-sm text-slate-600">
                    {regra}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {paragrafosAlerta.length > 0 && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <span className="h-5 w-5">{ICONE_ALERTA_MULTA}</span>
            </span>
            <div>
              <h3 className="font-display font-semibold text-amber-800">{config.alertaTitulo}</h3>
              <div className="mt-1.5 space-y-2 text-sm text-amber-800">
                {paragrafosAlerta.map((paragrafo, i) => (
                  <p key={i}>{renderizarComNegrito(paragrafo)}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
