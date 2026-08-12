import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface ConfiguracaoRecorrencia {
  dia_abertura: number;
  hora_abertura: string;
  dia_fechamento: number;
  hora_fechamento: string;
  ativo: boolean;
}

export function useConfiguracaoRecorrencia() {
  const [config, setConfig] = useState<ConfiguracaoRecorrencia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase
      .from('configuracao_recorrencia')
      .select('dia_abertura, hora_abertura, dia_fechamento, hora_fechamento, ativo')
      .single();

    if (error) {
      setErro('Não foi possível carregar a configuração.');
      setCarregando(false);
      return;
    }

    setConfig(data);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar(novaConfig: ConfiguracaoRecorrencia) {
    setSalvando(true);
    setErro(null);

    const { error } = await supabase
      .from('configuracao_recorrencia')
      .update(novaConfig)
      .eq('id', true);

    setSalvando(false);

    if (error) {
      const mensagem = 'Não foi possível salvar a configuração.';
      setErro(mensagem);
      return { erro: mensagem };
    }

    setConfig(novaConfig);
    return { erro: null };
  }

  return { config, carregando, erro, salvando, salvar };
}