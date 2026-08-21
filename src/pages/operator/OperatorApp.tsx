import { useState } from 'react';
import type { ReactElement } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { AreaColaboradorPage } from './AreaColaboradorPage';
import { ColegasEquipePage } from './ColegasEquipePage';
import { HistoricoEscalasPage } from './HistoricoEscalasPage';
import { SolicitacoesTrocaPage } from './SolicitacoesTrocaPage';
import { TourOperador } from '../../components/TourOperador';

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

const iconesPorAba: Record<Aba, ReactElement> = {
  'minha-area': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  equipe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 14.2c2.5.4 4.5 2.6 4.5 5.3" strokeLinecap="round" />
    </svg>
  ),
  trocas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 7h13l-3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 17H7l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  historico: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 2h6" strokeLinecap="round" />
    </svg>
  ),
};

const iconeSair = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M15 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 12H9" strokeLinecap="round" />
    <path d="M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
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
      <TourOperador />

      {/* Cabeçalho — só aparece no celular (desktop usa a barra lateral) */}
      <header className="bg-tinta sm:hidden">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuAberto(true)}
              className="rounded-md p-1.5 text-white hover:bg-white/10"
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
      </header>

      {/* Barra lateral fixa — só aparece em telas maiores */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col bg-tinta sm:flex">
        <div className="border-b border-white/10 px-6 py-6">
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-esmeralda">
            Escala Operadores
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-white">Olá, {perfil?.nome_completo?.split(' ')[0]}</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {abas.map((aba) => {
            const ativo = abaAtiva === aba.id;
            return (
              <button
                key={aba.id}
                onClick={() => selecionarAba(aba.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition ${
                  ativo
                    ? 'bg-esmeralda text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="h-5 w-5 shrink-0">{iconesPorAba[aba.id]}</span>
                {aba.rotulo}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <div className="rounded-md px-3 py-2">
            <p className="text-xs text-slate-400">Logado como</p>
            <p className="truncate text-sm font-medium text-white">{perfil?.nome_completo}</p>
          </div>
          <button
            onClick={sair}
            className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <span className="h-5 w-5 shrink-0">{iconeSair}</span>
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="px-6 py-10 sm:ml-64">
        <div className="mx-auto max-w-2xl">
          {abaAtiva === 'minha-area' && <AreaColaboradorPage />}
          {abaAtiva === 'equipe' && <ColegasEquipePage />}
          {abaAtiva === 'trocas' && <SolicitacoesTrocaPage />}
          {abaAtiva === 'historico' && <HistoricoEscalasPage />}
        </div>
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
          <nav className="mt-2 flex flex-col gap-1 px-2">
            {abas.map((aba) => (
              <button
                key={aba.id}
                onClick={() => selecionarAba(aba.id)}
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-medium transition ${
                  abaAtiva === aba.id
                    ? 'bg-esmeralda text-white'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                <span className="h-5 w-5 shrink-0">{iconesPorAba[aba.id]}</span>
                {aba.rotulo}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}