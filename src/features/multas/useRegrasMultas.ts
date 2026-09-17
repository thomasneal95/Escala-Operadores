import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

export function useRegrasMultas() {
  const [regras, setRegras] = useState<string>('');
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase
      .from('configuracao_multas')
      .select('regras')
      .eq('id', true)
      .single();

    if (error) {
      setErro('Não foi possível carregar as regras de multa.');
      setCarregando(false);
      return;
    }

    setRegras(data?.regras ?? '');
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function atualizarRegras(novoTexto: string) {
    setAtualizando(true);
    setErro(null);

    const { error } = await supabase
      .from('configuracao_multas')
      .update({ regras: novoTexto })
      .eq('id', true);

    setAtualizando(false);

    if (error) {
      const mensagem = 'Não foi possível salvar as regras.';
      setErro(mensagem);
      return { erro: mensagem };
    }

    setRegras(novoTexto);
    return { erro: null };
  }

  return { regras, carregando, atualizando, erro, atualizarRegras };
}
