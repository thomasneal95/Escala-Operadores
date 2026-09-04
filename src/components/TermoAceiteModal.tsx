import { useTermoAceite } from '../features/schedules/useTermoAceite';
import { useToast } from './FeedbackProvider';
import { useModalAcessivel } from '../hooks/useModalAcessivel';

interface TermoAceiteModalProps {
  periodoId: string;
  dataInicio: string;
  dataFim: string;
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function TermoAceiteModal({ periodoId, dataInicio, dataFim }: TermoAceiteModalProps) {
  const { jaAceitou, carregando, processando, aceitar } = useTermoAceite(periodoId);
  const toast = useToast();

  async function handleAceitar() {
    const resultado = await aceitar();
    if (resultado.erro) {
      toast(resultado.erro, 'erro');
    }
  }

  const aberto = !carregando && !jaAceitou;
  // Sem onEscape: este modal é intencionalmente bloqueante — só fecha
  // quando o colaborador confirma ciência do turno.
  const ref = useModalAcessivel(aberto);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-termo-aceite"
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
      >
        <h3 id="titulo-termo-aceite" className="font-display text-lg font-semibold text-tinta">
          Sua escala foi confirmada
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Antes de continuar, confirme que você está ciente do seu turno para o fim de
          semana de <span className="font-medium">{formatarData(dataInicio)}</span> a{' '}
          <span className="font-medium">{formatarData(dataFim)}</span>.
        </p>
        <button
          onClick={handleAceitar}
          disabled={processando}
          className="mt-5 w-full rounded-md bg-esmeralda px-4 py-2.5 font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processando ? 'Confirmando...' : 'Confirmo que estou ciente do meu turno'}
        </button>
      </div>
    </div>
  );
}