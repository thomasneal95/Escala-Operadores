import { useAreaColaborador } from '../../features/schedules/useAreaColaborador';
import { DisponibilidadePage } from './DisponibilidadePage';
import { MinhaEscalaPage } from './MinhaEscalaPage';

export function AreaColaboradorPage() {
  const { colaboradorId, periodo, carregando, erro } = useAreaColaborador();

  if (carregando) {
    return <p className="text-sm text-slate-400">Carregando...</p>;
  }

  if (erro) {
    return <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>;
  }

  // Período confirmado ou encerrado: mostra a escala.
  if (periodo && (periodo.status === 'confirmado' || periodo.status === 'encerrado') && colaboradorId) {
    return <MinhaEscalaPage colaboradorId={colaboradorId} periodo={periodo} />;
  }

  // Período em organização: disponibilidade encerrada, escala ainda não confirmada.
  if (periodo && periodo.status === 'em_organizacao') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">O recebimento de disponibilidade foi encerrado.</p>
        <p className="mt-1 text-sm text-slate-400">
          A escala está sendo organizada. Volte em breve para consultar seus turnos.
        </p>
      </div>
    );
  }

  // Período aberto (ou nenhum período): tela normal de disponibilidade.
  return <DisponibilidadePage />;
}