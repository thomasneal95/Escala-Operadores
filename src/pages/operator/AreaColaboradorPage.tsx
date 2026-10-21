import type { ReactNode } from 'react';
import { useAreaColaborador } from '../../features/schedules/useAreaColaborador';
import { useCalendarioToken } from '../../features/schedules/useCalendarioToken';
import { TermoAceiteModal } from '../../components/TermoAceiteModal';
import { ResumoOperador } from '../../components/ResumoOperador';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { FallbackErroTela } from '../../components/FallbackErroTela';
import { useToast } from '../../components/FeedbackProvider';
import { MinhaEscalaPage } from './MinhaEscalaPage';

function SecaoCalendario() {
  const { urlHttps, urlWebcal, carregando } = useCalendarioToken();
  const toast = useToast();

  async function copiarLink() {
    if (!urlHttps) return;
    try {
      await navigator.clipboard.writeText(urlHttps);
      toast('Link copiado! Cole no seu app de calendário em "Adicionar por URL".');
    } catch {
      toast('Não foi possível copiar automaticamente. Link: ' + urlHttps, 'erro');
    }
  }

  if (carregando || !urlHttps || !urlWebcal) {
    return null;
  }

  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
      <p className="font-medium text-tinta">Sincronizar com meu calendario</p>
      <p className="mt-1 text-sm text-slate-500">
        Assine uma vez e seus turnos aparecem automaticamente no seu calendario,
        sem precisar adicionar de novo toda semana.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <a href={urlWebcal} className="rounded-md bg-esmeralda px-4 py-2 text-sm font-medium text-white hover:bg-esmeralda-dark">Assinar (iPhone/Mac)</a>
        <button onClick={copiarLink} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Copiar link (Google Calendar)</button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        No Google Calendar: Configuracoes, Adicionar calendario, Por URL, e cole o link copiado.
      </p>
    </div>
  );
}

export function AreaColaboradorPage() {
  const { colaboradorId, periodo, periodosPublicados, carregando, erro } = useAreaColaborador();

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  if (erro) {
    return <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>;
  }

  let conteudo: ReactNode;

  // Fim de semana do resumo: o próximo já publicado; senão, o mais recente.
  const periodoDoResumo = periodosPublicados[0] ?? periodo;

  if (periodosPublicados.length > 0 && colaboradorId) {
    conteudo = (
      <div className="space-y-12">
        {periodosPublicados.map((p) => (
          <div key={p.id}>
            <TermoAceiteModal periodoId={p.id} dataInicio={p.data_inicio} dataFim={p.data_fim} />
            <MinhaEscalaPage colaboradorId={colaboradorId} periodo={p} />
          </div>
        ))}
      </div>
    );
  } else if (periodo && (periodo.status === 'confirmado' || periodo.status === 'encerrado') && colaboradorId) {
    conteudo = (
      <>
        <TermoAceiteModal
          periodoId={periodo.id}
          dataInicio={periodo.data_inicio}
          dataFim={periodo.data_fim}
        />
        <MinhaEscalaPage colaboradorId={colaboradorId} periodo={periodo} />
      </>
    );
  } else {
    conteudo = (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Ainda não há escala publicada para os próximos fins de semana.</p>
        <p className="mt-1 text-sm text-slate-400">
          A escala está sendo organizada. Volte em breve para consultar seus turnos.
        </p>
      </div>
    );
  }

  return (
    <div>
      {colaboradorId && periodoDoResumo && (
        <ErrorBoundary fallback={null}>
          <ResumoOperador colaboradorId={colaboradorId} periodo={periodoDoResumo} />
        </ErrorBoundary>
      )}
      <ErrorBoundary
        key={`${periodo?.status ?? 'sem-periodo'}-${periodosPublicados.length}`}
        fallback={<FallbackErroTela />}
      >
        {conteudo}
      </ErrorBoundary>
      <SecaoCalendario />
    </div>
  );
}
