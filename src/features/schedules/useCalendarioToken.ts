import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

export function useCalendarioToken() {
  const { session } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      if (!session?.user) {
        setCarregando(false);
        return;
      }

      const { data } = await supabase
        .from('colaboradores')
        .select('calendario_token')
        .eq('perfil_id', session.user.id)
        .single();

      setToken(data?.calendario_token ?? null);
      setCarregando(false);
    }

    carregar();
  }, [session]);

  const urlHttps = token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendario-feed?token=${token}`
    : null;

  const urlWebcal = urlHttps ? urlHttps.replace(/^https?:\/\//, 'webcal://') : null;

  return { carregando, urlHttps, urlWebcal };
}