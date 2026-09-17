import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

export interface CategoriaRegraMulta {
  id: string;
  titulo: string;
  icone: string;
  regras: string[];
}

export interface ConfiguracaoRegrasMultas {
  categorias: CategoriaRegraMulta[];
  alertaTitulo: string;
  alertaTexto: string;
}

export function useConfiguracaoRegrasMultas() {
  const [config, setConfig] = useState<ConfiguracaoRegrasMultas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase
      .from('configuracao_multas')
      .select('categorias, alerta_titulo, alerta_texto')
      .eq('id', true)
      .single();

    if (error) {
      setErro('Não foi possível carregar as regras de multa.');
      setCarregando(false);
      return;
    }

    setConfig({
      categorias: (data?.categorias as CategoriaRegraMulta[] | null) ?? [],
      alertaTitulo: data?.alerta_titulo ?? '',
      alertaTexto: data?.alerta_texto ?? '',
    });
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar(novaConfig: ConfiguracaoRegrasMultas) {
    setSalvando(true);
    setErro(null);

    const { error } = await supabase
      .from('configuracao_multas')
      .update({
        categorias: novaConfig.categorias,
        alerta_titulo: novaConfig.alertaTitulo,
        alerta_texto: novaConfig.alertaTexto,
      })
      .eq('id', true);

    setSalvando(false);

    if (error) {
      const mensagem = 'Não foi possível salvar as regras.';
      setErro(mensagem);
      return { erro: mensagem };
    }

    setConfig(novaConfig);
    return { erro: null };
  }

  return { config, carregando, salvando, erro, salvar };
}
