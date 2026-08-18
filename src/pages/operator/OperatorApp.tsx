import { useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { AreaColaboradorPage } from './AreaColaboradorPage';
import { ColegasEquipePage } from './ColegasEquipePage';
import { HistoricoEscalasPage } from './HistoricoEscalasPage';
import { SolicitacoesTrocaPage } from './SolicitacoesTrocaPage';

type Aba = 'minha-area' | 'equipe' | 'trocas' | 'historico';

const abas: { id: Aba; rotulo: string }[] = [
  { id: 'minha-area', rotulo: 'Minha área' },
  { id: 'equipe', rotulo: 'Equipe' },
  { id: 'trocas', rotulo: 'Trocas' },
  { id: 'historico', rotulo: 'Histórico' },
];

const iconeMenu = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
  </svg>
);

export function OperatorApp() {
  const { perfil, sair } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<Aba>('minha-area');
  const [menuAberto, setMenuAberto] = useState(false);

  function selecionarAba(aba: Aba) {
    setAbaAtiva(aba);
    setMenuAberto(false);
  }

  return (
    <div className="min-h-screen bg-nuvem">
      <header className="bg-tinta">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuAberto(true)}
              className="rounded-md p-1.5 text-white hover:bg-white/10 sm:hidden"
              aria-label="Abrir menu"
            >
              <span className="block h-6 w-6">{iconeMenu}</span>
            </button>
            <div>
              <p className="text-sm text-slate-400">Olá,</p>
              <p className="font-display font-medium text-white">{perfil?.nome_completo}</p>
            </div>
          </div>
          <button
            onClick={sair}
            className="rounded-md border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Sair
          </button>
        </div>

        {/* Navegação por abas — só aparece em telas maiores (celular usa o menu lateral) */}
        <nav className="hidden px-6 sm:block">
          <div className="mx-auto flex max-w-2xl gap-6">
            {abas.map((aba) => (
              <button
                key={aba.id}
                onClick={() => selecionarAba(aba.id)}
                className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition ${
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
        {abaAtiva === 'trocas' && <SolicitacoesTrocaPage />}
        {abaAtiva === 'historico' && <HistoricoEscalasPage />}
      </main>

      {/* Menu lateral (drawer) — só no celular */}
      <div
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity sm:hidden ${
          menuAberto ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMenuAberto(false)}
      >
        <div
          className={`h-full w-64 max-w-[80%] bg-tinta shadow-xl transition-transform ${
            menuAberto ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <p className="font-display font-medium text-white">Menu</p>
            <button
              onClick={() => setMenuAberto(false)}
              className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Fechar menu"
            >
              ×
            </button>
          </div>
          <nav className="mt-2 flex flex-col px-2">
            {abas.map((aba) => (
              <button
                key={aba.id}
                onClick={() => selecionarAba(aba.id)}
                className={`rounded-md px-3 py-3 text-left text-sm font-medium transition ${
                  abaAtiva === aba.id
                    ? 'bg-esmeralda text-white'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                {aba.rotulo}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}