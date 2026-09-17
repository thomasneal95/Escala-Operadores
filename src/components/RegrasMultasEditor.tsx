import { useEffect, useState } from 'react';
import {
  useConfiguracaoRegrasMultas,
  type CategoriaRegraMulta,
} from '../features/multas/useConfiguracaoRegrasMultas';
import { ICONES_MULTAS, ROTULOS_ICONES_MULTAS, iconePorChave } from '../lib/iconesMultas';
import { useToast } from './FeedbackProvider';

const chavesIcones = Object.keys(ICONES_MULTAS) as (keyof typeof ICONES_MULTAS)[];

function categoriaVazia(): CategoriaRegraMulta {
  return { id: crypto.randomUUID(), titulo: '', icone: 'lista', regras: [''] };
}

export function RegrasMultasEditor() {
  const { config, carregando, salvando, erro, salvar } = useConfiguracaoRegrasMultas();
  const toast = useToast();

  const [categorias, setCategorias] = useState<CategoriaRegraMulta[]>([]);
  const [alertaTitulo, setAlertaTitulo] = useState('');
  const [alertaTexto, setAlertaTexto] = useState('');
  const [valorMulta, setValorMulta] = useState('20');
  const [erroForm, setErroForm] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setCategorias(config.categorias);
      setAlertaTitulo(config.alertaTitulo);
      setAlertaTexto(config.alertaTexto);
      setValorMulta(String(config.valorMulta));
    }
  }, [config]);

  function atualizarCategoria(id: string, campo: 'titulo' | 'icone', valor: string) {
    setCategorias((atual) => atual.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));
  }

  function atualizarRegra(categoriaId: string, indice: number, valor: string) {
    setCategorias((atual) =>
      atual.map((c) =>
        c.id === categoriaId
          ? { ...c, regras: c.regras.map((r, i) => (i === indice ? valor : r)) }
          : c
      )
    );
  }

  function adicionarRegra(categoriaId: string) {
    setCategorias((atual) =>
      atual.map((c) => (c.id === categoriaId ? { ...c, regras: [...c.regras, ''] } : c))
    );
  }

  function removerRegra(categoriaId: string, indice: number) {
    setCategorias((atual) =>
      atual.map((c) =>
        c.id === categoriaId ? { ...c, regras: c.regras.filter((_, i) => i !== indice) } : c
      )
    );
  }

  function adicionarCategoria() {
    setCategorias((atual) => [...atual, categoriaVazia()]);
  }

  function removerCategoria(id: string) {
    setCategorias((atual) => atual.filter((c) => c.id !== id));
  }

  async function handleSalvar() {
    setErroForm(null);

    const categoriasLimpas = categorias
      .map((c) => ({ ...c, titulo: c.titulo.trim(), regras: c.regras.map((r) => r.trim()).filter(Boolean) }))
      .filter((c) => c.titulo.length > 0);

    for (const c of categoriasLimpas) {
      if (c.regras.length === 0) {
        setErroForm(`A categoria "${c.titulo}" precisa de pelo menos uma regra.`);
        return;
      }
    }

    if (!alertaTitulo.trim() || !alertaTexto.trim()) {
      setErroForm('Preencha o título e o texto do alerta.');
      return;
    }

    const valorNumerico = Number(valorMulta.replace(',', '.'));
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setErroForm('Informe um valor de multa válido.');
      return;
    }

    const resultado = await salvar({
      categorias: categoriasLimpas,
      alertaTitulo: alertaTitulo.trim(),
      alertaTexto: alertaTexto.trim(),
      valorMulta: valorNumerico,
    });

    if (resultado.erro) {
      toast(resultado.erro, 'erro');
      return;
    }

    toast('Regras salvas com sucesso.');
  }

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {categorias.map((categoria) => (
        <div key={categoria.id} className="rounded-md border border-slate-200 p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">Ícone</label>
              <select
                value={categoria.icone}
                onChange={(e) => atualizarCategoria(categoria.id, 'icone', e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
              >
                {chavesIcones.map((chave) => (
                  <option key={chave} value={chave}>
                    {ROTULOS_ICONES_MULTAS[chave]}
                  </option>
                ))}
              </select>
              <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-ceruleo-light text-ceruleo">
                <span className="h-4 w-4">{iconePorChave(categoria.icone)}</span>
              </span>
            </div>

            <div className="min-w-[200px] flex-1">
              <label className="block text-xs font-medium text-slate-600">Título da categoria</label>
              <input
                type="text"
                value={categoria.titulo}
                onChange={(e) => atualizarCategoria(categoria.id, 'titulo', e.target.value)}
                placeholder="Ex.: Cozinha"
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
              />
            </div>

            <button
              type="button"
              onClick={() => removerCategoria(categoria.id)}
              className="mt-5 text-xs font-medium text-red-600 hover:text-red-700"
            >
              Remover categoria
            </button>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-600">Regras</label>
            <div className="mt-1 space-y-2">
              {categoria.regras.map((regra, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={regra}
                    onChange={(e) => atualizarRegra(categoria.id, i, e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-tinta focus:border-esmeralda focus:outline-none focus:ring-1 focus:ring-esmeralda"
                  />
                  <button
                    type="button"
                    onClick={() => removerRegra(categoria.id, i)}
                    className="shrink-0 text-slate-400 hover:text-red-600"
                    aria-label="Remover regra"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => adicionarRegra(categoria.id)}
              className="mt-2 text-xs font-medium text-ceruleo hover:text-ceruleo/80"
            >
              + Adicionar regra
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={adicionarCategoria}
        className="rounded-md border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        + Adicionar categoria
      </button>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
        <label className="block text-xs font-medium text-amber-800">
          Valor da multa (R$)
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={valorMulta}
          onChange={(e) => setValorMulta(e.target.value)}
          className="mt-1 w-32 rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm text-tinta focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <p className="mt-1 text-xs text-amber-700">
          Valor cobrado por multa aprovada. Mudar aqui não afeta multas já aprovadas antes —
          só as próximas.
        </p>

        <label className="mt-3 block text-xs font-medium text-amber-800">
          Título da caixa de alerta
        </label>
        <input
          type="text"
          value={alertaTitulo}
          onChange={(e) => setAlertaTitulo(e.target.value)}
          className="mt-1 w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm text-tinta focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />

        <label className="mt-3 block text-xs font-medium text-amber-800">
          Texto do alerta
        </label>
        <textarea
          value={alertaTexto}
          onChange={(e) => setAlertaTexto(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm text-tinta focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <p className="mt-1 text-xs text-amber-700">
          Separe parágrafos com uma linha em branco. Use **texto** para deixar algo em negrito
          (ex.: **R$ 20,00**).
        </p>
      </div>

      {erroForm && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erroForm}</p>}

      <button
        type="button"
        onClick={handleSalvar}
        disabled={salvando}
        className="rounded-md bg-esmeralda px-5 py-2.5 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {salvando ? 'Salvando...' : 'Salvar regras'}
      </button>
    </div>
  );
}
