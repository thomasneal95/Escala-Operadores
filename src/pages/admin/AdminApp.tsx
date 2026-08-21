import { useState } from 'react';
import type { ReactElement } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { PainelAdminPage } from './PainelAdminPage';
import { VisaoAdminPage } from './VisaoAdminPage';
import { EquipesPage } from './EquipesPage';
import { TurnosPage } from './TurnosPage';
import { ColaboradoresPage } from './ColaboradoresPage';
import { ConfiguracoesPage } from './ConfiguracoesPage';
import { HistoricoAdminPage } from './HistoricoAdminPage';
import { GestaoAcessoPage } from './GestaoAcessoPage';
import { SolicitacoesTrocaAdminPage } from './SolicitacoesTrocaAdminPage';
import { MapaCoberturaPage } from './MapaCoberturaPage';
import { AssiduidadePage } from './AssiduidadePage';

type Aba =
  | 'painel'
  | 'escala'
  | 'equipes'
  | 'turnos'
  | 'colaboradores'
  | 'trocas'
  | 'mapa'
  | 'assiduidade'
  | 'configuracoes'
  | 'historico'
  | 'acesso';

const abas: { id: Aba; rotulo: string }[] = [
  { id: 'painel', rotulo: 'Painel' },
  { id: 'escala', rotulo: 'Escala' },
  { id: 'equipes', rotulo: 'Equipes' },
  { id: 'turnos', rotulo: 'Turnos' },
  { id: 'colaboradores', rotulo: 'Colaboradores' },
  { id: 'trocas', rotulo: 'Trocas' },
  { id: 'mapa', rotulo: 'Análises' },
  { id: 'assiduidade', rotulo: 'Assiduidade' },
  { id: 'historico', rotulo: 'Histórico' },
  { id: 'acesso', rotulo: 'Acesso' },
  { id: 'configuracoes', rotulo: 'Configurações' },
];

const iconeMenu = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
  </svg>
);

const iconesPorAba: Record<Aba, ReactElement> = {
  painel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="9" rx="1.2" />
      <rect x="14" y="3" width="7" height="5" rx="1.2" />
      <rect x="14" y="12" width="7" height="9" rx="1.2" />
      <rect x="3" y="16" width="7" height="5" rx="1.2" />
    </svg>
  ),
  escala: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="4.5" width="18" height="16" rx="1.5" />
      <path d="M3 9.5h18" strokeLinecap="round" />
      <path d="M8 3v3M16 3v3" strokeLinecap="round" />
    </svg>
  ),
  equipes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 14.2c2.5.4 4.5 2.6 4.5 5.3" strokeLinecap="round" />
    </svg>
  ),
  turnos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3.2 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  colaboradores: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="8" r="3.3" />
      <path d="M4.5 20c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5" strokeLinecap="round" />
    </svg>
  ),
  trocas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 7h13l-3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 17H7l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  mapa: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 20V10M11 20V4M18 20v-7" strokeLinecap="round" />
      <path d="M3 20h18" strokeLinecap="round" />
    </svg>
  ),
  assiduidade: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M3 17l5-5 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 7h5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  historico: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 2h6" strokeLinecap="round" />
    </svg>
  ),
  acesso: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" strokeLinecap="round" />
    </svg>
  ),
  configuracoes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-.9-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.75 1.7 1L11 21h4l.4-2.5c.6-.25 1.2-.6 1.7-1l2.3.9 2-3.4-2-1.5Z"
        strokeLinejoin="round"
      />
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

export function AdminApp() {
  const { perfil, sair } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<Aba>('painel');
  const [menuAberto, setMenuAberto] = useState(false);

  function selecionarAba(aba: Aba) {
    setAbaAtiva(aba);
    setMenuAberto(false);
  }

  return (
    <div className="min-h-screen bg-nuvem">
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
              <p className="text-sm text-slate-400">Painel administrativo</p>
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
          <p className="mt-1 font-display text-lg font-semibold text-white">Administração</p>
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
        <div className="mx-auto max-w-5xl">
          {abaAtiva === 'painel' && <PainelAdminPage aoNavegar={setAbaAtiva} />}
          {abaAtiva === 'escala' && <VisaoAdminPage />}
          {abaAtiva === 'equipes' && <EquipesPage />}
          {abaAtiva === 'turnos' && <TurnosPage />}
          {abaAtiva === 'colaboradores' && <ColaboradoresPage />}
          {abaAtiva === 'trocas' && <SolicitacoesTrocaAdminPage />}
          {abaAtiva === 'mapa' && <MapaCoberturaPage />}
          {abaAtiva === 'assiduidade' && <AssiduidadePage />}
          {abaAtiva === 'historico' && <HistoricoAdminPage />}
          {abaAtiva === 'acesso' && <GestaoAcessoPage />}
          {abaAtiva === 'configuracoes' && <ConfiguracoesPage />}
        </div>
      </main>

      {/* Menu lateral (gaveta) — só no celular */}
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