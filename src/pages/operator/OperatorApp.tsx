import { useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { AreaColaboradorPage } from './AreaColaboradorPage';
import { ColegasEquipePage } from './ColegasEquipePage';
import { HistoricoEscalasPage } from './HistoricoEscalasPage';

type Aba = 'minha-area' | 'equipe' | 'historico';

const abas: { id: Aba; rotulo: string }[] = [
  { id: 'minha-area', rotulo: 'Minha área' },
  { id: 'equipe', rotulo: 'Equipe' },
  { id: 'historico', rotulo: 'Histórico' },
];

export function OperatorApp() {
  const { perfil, sair } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<Aba>('minha-area');

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

        <nav className="px-6">
          <div className="mx-auto flex max-w-2xl gap-6">
            {abas.map((aba) => (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className={`border-b-2 px-1 py-3 text-sm font-medium transition ${
                  abaAtiva === aba.id
                    ? 'border-esmeralda text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {aba.rotulo}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {abaAtiva === 'minha-area' && <AreaColaboradorPage />}
        {abaAtiva === 'equipe' && <ColegasEquipePage />}
        {abaAtiva === 'historico' && <HistoricoEscalasPage />}
      </main>
    </div>
  );
}