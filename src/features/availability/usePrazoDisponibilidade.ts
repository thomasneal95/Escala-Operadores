import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

export function usePrazoDisponibilidade() {
  const [prazo, setPrazo] = useState<Date | null>(null);
  const [ativo, setAtivo] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('configuracao_recorrencia')
        .select('dia_fechamento, hora_fechamento, ativo')
        .single();

      if (data) {
        setAtivo(data.ativo);

        const [horas, minutos] = data.hora_fechamento.split(':').map(Number);
        const agoraLocal = new Date();
        const diaAtual = agoraLocal.getDay(); // 0=domingo..6=sábado, mesma convenção do banco
        const diasAteFechamento = (data.dia_fechamento - diaAtual + 7) % 7;

        const candidato = new Date(agoraLocal);
        candidato.setDate(agoraLocal.getDate() + diasAteFechamento);
        candidato.setHours(horas, minutos, 0, 0);

        // Se o dia calculado já passou do horário hoje, é semana que vem.
        if (candidato.getTime() <= agoraLocal.getTime()) {
          candidato.setDate(candidato.getDate() + 7);
        }

        setPrazo(candidato);
      }

      setCarregando(false);
    }

    carregar();
  }, []);

  // Atualiza o "agora" a cada minuto, para o texto ir contando ao vivo.
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const texto = useMemo(() => {
    if (!prazo) return null;

    const diffMs = prazo.getTime() - agora.getTime();
    if (diffMs <= 0) return 'O prazo para enviar disponibilidade já encerrou.';

    const diffMin = Math.floor(diffMs / 60000);
    const dias = Math.floor(diffMin / (60 * 24));
    const horasRestantes = Math.floor((diffMin % (60 * 24)) / 60);

    const partes: string[] = [];
    if (dias > 0) partes.push(`${dias} dia${dias > 1 ? 's' : ''}`);
    if (horasRestantes > 0) partes.push(`${horasRestantes} hora${horasRestantes > 1 ? 's' : ''}`);
    if (partes.length === 0) partes.push('menos de 1 hora');

    return `Faltam ${partes.join(' e ')} para o fechamento do recebimento`;
  }, [prazo, agora]);

  return { texto, ativo, carregando };
}