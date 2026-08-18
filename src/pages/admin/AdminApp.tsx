import { useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { PainelAdminPage } from './PainelAdminPage';
import { VisaoAdminPage } from './VisaoAdminPage';
import { EquipesPage } from './EquipesPage';
import { TurnosPage } from './TurnosPage';
import { ColaboradoresPage } from './ColaboradoresPage';
import { ConfiguracoesPage } from './ConfiguracoesPage';
import { HistoricoAdminPage } from './HistoricoAdminPage';
import { GestaoAcessoPage } from './GestaoAcessoPage';

type Aba =
  | 'painel'
  | 'escala'
  | 'equipes'
  | 'turnos'
  | 'colaboradores'
  | 'configuracoes'
  | 'historico'
  | 'acesso';

const abas: { id: Aba; rotulo: string }[] = [
  { id: 'painel', rotulo: 'Painel' },
  { id: 'escala', rotulo: 'Escala' },
  { id: 'equipes', rotulo: 'Equipes' },
  { id: 'turnos', rotulo: 'Turnos' },
  { id: 'colaboradores', rotulo: 'Colaboradores' },
  { id: 'historico', rotulo: 'Histórico' },
  { id: 'acesso', rotulo: 'Acesso' },
  { id: 'configuracoes', rotulo: 'Configurações' },
];

export function AdminApp() {
  const { perfil, sair } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<Aba>('painel');

  return (
    <div className="min-h-screen bg-nuvem">
      <header className="bg-tinta">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-slate-400">Painel administrativo</p>
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
          <div className="mx-auto flex max-w-5xl gap-6 overflow-x-auto">
            {abas.map((aba) => (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
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

      <main className="mx-auto max-w-5xl px-6 py-10">
        {abaAtiva === 'painel' && <PainelAdminPage aoNavegar={setAbaAtiva} />}
        {abaAtiva === 'escala' && <VisaoAdminPage />}
        {abaAtiva === 'equipes' && <EquipesPage />}
        {abaAtiva === 'turnos' && <TurnosPage />}
        {abaAtiva === 'colaboradores' && <ColaboradoresPage />}
        {abaAtiva === 'historico' && <HistoricoAdminPage />}
        {abaAtiva === 'acesso' && <GestaoAcessoPage />}
        {abaAtiva === 'configuracoes' && <ConfiguracoesPage />}
      </main>
    </div>
  );
}