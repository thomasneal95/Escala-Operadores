import { useAuth } from '../../features/auth/AuthContext';
import { useAreaColaborador } from '../../features/schedules/useAreaColaborador';
import { DisponibilidadePage } from './DisponibilidadePage';
import { MinhaEscalaPage } from './MinhaEscalaPage';

export function AreaColaboradorPage() {
  const { perfil, sair } = useAuth();
  const { colaboradorId, periodo, carregando, erro } = useAreaColaborador();

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-nuvem text-slate-500">
        Carregando...
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-nuvem">
        <header className="bg-tinta">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm text-slate-400">Olá,</p>
              <p className="font-display font-medium text-white">{perfil?.nome_completo}</p>
            </div>
            <button
              onClick={sair}
              className="rounded-md border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Sair
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-6 py-10">
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
        </main>
      </div>
    );
  }

  // Período confirmado ou encerrado: mostra a escala.
  if (periodo && (periodo.status === 'confirmado' || periodo.status === 'encerrado') && colaboradorId) {
    return <MinhaEscalaPage colaboradorId={colaboradorId} periodo={periodo} />;
  }

  // Período em organização: disponibilidade encerrada, escala ainda não confirmada.
  if (periodo && periodo.status === 'em_organizacao') {
    return (
      <div className="min-h-screen bg-nuvem">
        <header className="bg-tinta">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm text-slate-400">Olá,</p>
              <p className="font-display font-medium text-white">{perfil?.nome_completo}</p>
            </div>
            <button
              onClick={sair}
              className="rounded-md border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Sair
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-6 py-10">
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-600">
              O recebimento de disponibilidade foi encerrado.
            </p>
            <p className="mt-1 text-sm text-slate-400">
              A escala está sendo organizada. Volte em breve para consultar seus turnos.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Período aberto (ou nenhum período): tela normal de disponibilidade.
  return <DisponibilidadePage />;
}