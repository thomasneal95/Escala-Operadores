import { useEffect, useState } from 'react';
import { useAuth } from '../features/auth/AuthContext';

interface PassoTour {
  titulo: string;
  descricao: string;
}

const passos: PassoTour[] = [
  {
    titulo: 'Bem-vindo(a)! 👋',
    descricao:
      'Este é o sistema de escala de fim de semana. Vamos fazer um tour rápido pelas telas principais — leva só um minuto.',
  },
  {
    titulo: 'Minha área',
    descricao:
      'Aqui você marca em quais turnos está disponível para trabalhar no fim de semana, e depois vê sua escala confirmada, quando estiver pronta.',
  },
  {
    titulo: 'Equipe',
    descricao:
      'Veja quem são seus colegas da mesma equipe, com telefone de contato.',
  },
  {
    titulo: 'Trocas',
    descricao:
      'Precisa trocar um turno com um colega? Solicite aqui. O colega aceita, e depois o admin aprova para a troca valer de verdade.',
  },
  {
    titulo: 'Histórico',
    descricao:
      'Consulte fins de semana anteriores: quais turnos você trabalhou, e se sua presença já foi confirmada.',
  },
];

function chaveStorage(userId: string) {
  return `escala_operadores_tour_visto_${userId}`;
}

export function TourOperador() {
  const { session } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [passoAtual, setPassoAtual] = useState(0);

  useEffect(() => {
    if (!session?.user) return;
    const jaViu = localStorage.getItem(chaveStorage(session.user.id));
    if (!jaViu) {
      setAberto(true);
    }
  }, [session]);

  function fechar() {
    if (session?.user) {
      localStorage.setItem(chaveStorage(session.user.id), 'true');
    }
    setAberto(false);
  }

  if (!aberto) return null;

  const ehUltimo = passoAtual === passos.length - 1;
  const passo = passos[passoAtual];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 className="font-display text-lg font-semibold text-tinta">{passo.titulo}</h3>
        <p className="mt-2 text-sm text-slate-600">{passo.descricao}</p>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {passos.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i === passoAtual ? 'bg-esmeralda' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button onClick={fechar} className="text-sm font-medium text-slate-400 hover:text-slate-600">
            Pular tour
          </button>

          <div className="flex gap-2">
            {passoAtual > 0 && (
              <button
                onClick={() => setPassoAtual((p) => p - 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Voltar
              </button>
            )}
            <button
              onClick={() => (ehUltimo ? fechar() : setPassoAtual((p) => p + 1))}
              className="rounded-md bg-esmeralda px-4 py-1.5 text-sm font-medium text-white hover:bg-esmeralda-dark"
            >
              {ehUltimo ? 'Começar a usar' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}