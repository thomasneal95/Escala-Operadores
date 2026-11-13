import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { FaltasPage } from './FaltasPage';
import { ComissionamentoPage } from './ComissionamentoPage';
import { MultasAdminPage } from './MultasAdminPage';
import { QualidadePage } from './QualidadePage';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { FallbackErroTela } from '../../components/FallbackErroTela';
import { useNotificacoesAdmin } from '../../features/notificacoes/useNotificacoesAdmin';
import { ControleNotificacoes } from '../../components/AtivarNotificacoesCard';
import { abaDaUrl } from '../../lib/abaDaUrl';
import { Avatar, ListaNavegacao, MarcaJornada } from '../../components/layout/BarraLateral';
import type { GrupoNavegacao } from '../../components/layout/BarraLateral';
import { PaletaComandos, teclaAtalho, useAtalhoPaleta } from '../../components/layout/PaletaComandos';
import type { ComandoPaleta } from '../../components/layout/PaletaComandos';

type Aba =
  | 'painel'
  | 'escala'
  | 'equipes'
  | 'turnos'
  | 'colaboradores'
  | 'trocas'
  | 'mapa'
  | 'assiduidade'
  | 'faltas'
  | 'comissionamento'
  | 'multas'
  | 'qualidade'
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
  { id: 'faltas', rotulo: 'Faltas' },
  { id: 'comissionamento', rotulo: 'Comissionamento' },
  { id: 'multas', rotulo: 'Multas' },
  { id: 'qualidade', rotulo: 'Qualidade' },
  { id: 'historico', rotulo: 'Histórico' },
  { id: 'acesso', rotulo: 'Acesso' },
  { id: 'configuracoes', rotulo: 'Configurações' },
];

// Menu agrupado por assunto (a ordem aqui é a ordem na barra lateral).
const gruposDeAbas: { titulo: string; abas: Aba[] }[] = [
  { titulo: 'Visão geral', abas: ['painel', 'mapa'] },
  { titulo: 'Operação', abas: ['escala', 'turnos', 'equipes', 'trocas', 'faltas', 'assiduidade'] },
  { titulo: 'Pessoas', abas: ['colaboradores', 'acesso'] },
  { titulo: 'Resultados', abas: ['comissionamento', 'multas', 'qualidade'] },
  { titulo: 'Sistema', abas: ['historico', 'configuracoes'] },
];

const descricaoDaAba: Partial<Record<Aba, string>> = {
  painel: 'Resumo do dia e atalhos',
  escala: 'Montar, editar e confirmar a escala',
  mapa: 'Cobertura e análises da operação',
  trocas: 'Aprovar trocas de turno',
  comissionamento: 'Fechamento mensal e pagamentos',
  qualidade: 'Relatórios e painel de qualidade',
  acesso: 'Contas, senhas e acesso dos operadores',
};

// Texto de cada pendência na central de avisos.
function textoPendencia(aba: Aba, n: number) {
  const plural = n > 1;
  switch (aba) {
    case 'trocas':
      return `${n} troca${plural ? 's' : ''} aguardando aprovação`;
    case 'multas':
      return `${n} multa${plural ? 's' : ''} para revisar`;
    case 'escala':
      return 'Escala do próximo período para montar';
    case 'historico':
      return `${n} presença${plural ? 's' : ''} para conferir`;
    case 'comissionamento':
      return `${n} venda${plural ? 's' : ''} de infoproduto para conferir`;
    default:
      return `${n} pendência${plural ? 's' : ''}`;
  }
}

const CHAVE_MENU_FIXO = 'jornada360-menu-fixo';

function lerMenuFixo() {
  try {
    return localStorage.getItem(CHAVE_MENU_FIXO) === '1';
  } catch {
    return false;
  }
}

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
  faltas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="4.5" width="18" height="16" rx="1.5" />
      <path d="M3 9.5h18" strokeLinecap="round" />
      <path d="M8 3v3M16 3v3" strokeLinecap="round" />
      <path d="M9.5 13.5l5 5M14.5 13.5l-5 5" strokeLinecap="round" />
    </svg>
  ),
    comissionamento: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v10M9.5 9.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1 2.5 2.2c0 2.8-5 1.6-5 4.4 0 1.2 1.1 2.2 2.5 2.2s2.5-1.1 2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  multas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 9v4M12 16.5h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  qualidade: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M9 3.5V5h6V3.5" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
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

const iconeBusca = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" strokeLinecap="round" />
  </svg>
);

const iconeSino = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" strokeLinejoin="round" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" strokeLinecap="round" />
  </svg>
);

const iconeAlfinete = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z" strokeLinejoin="round" />
    <path d="M12 14v6" strokeLinecap="round" />
  </svg>
);

const iconeSair = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M15 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 12H9" strokeLinecap="round" />
    <path d="M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function AdminApp() {
  const { perfil, sair } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState<Aba>(() =>
    abaDaUrl(
      abas.map((a) => a.id),
      'painel'
    )
  );
  const [menuAberto, setMenuAberto] = useState(false);
  const [paletaAberta, setPaletaAberta] = useState(false);
  const [avisosAbertos, setAvisosAbertos] = useState(false);
  // Barra lateral do desktop: recolhida (só ícones) e abre ao passar o mouse;
  // "fixar" deixa aberta e empurra o conteúdo.
  const [menuFixo, setMenuFixo] = useState(lerMenuFixo);
  const [sobreMenu, setSobreMenu] = useState(false);
  const recolhida = !menuFixo && !sobreMenu;
  const avisosRef = useRef<HTMLDivElement>(null);

  const { trocasPendentes, multasPendentes, escalaParaMontar, presencasPendentes, infoprodutosPendentes } =
    useNotificacoesAdmin();

  const contagemPorAba: Partial<Record<Aba, number>> = {
    trocas: trocasPendentes,
    multas: multasPendentes,
    escala: escalaParaMontar,
    historico: presencasPendentes,
    comissionamento: infoprodutosPendentes,
  };
  // Não conta a aba em que a pessoa já está — ela já está vendo o que
  // precisa ver ali, o ponto no menu é só pra avisar de OUTRA aba.
  const pendencias = (Object.entries(contagemPorAba) as [Aba, number][]).filter(
    ([id, valor]) => id !== abaAtiva && valor > 0
  );
  const totalNotificacoes = pendencias.reduce((soma, [, valor]) => soma + valor, 0);

  // Esc fecha o menu e a central de avisos.
  useEffect(() => {
    if (!menuAberto && !avisosAbertos) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuAberto(false);
        setAvisosAbertos(false);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [menuAberto, avisosAbertos]);

  // Clique fora fecha a central de avisos.
  useEffect(() => {
    if (!avisosAbertos) return;
    const aoClicar = (e: MouseEvent) => {
      if (!avisosRef.current?.contains(e.target as Node)) setAvisosAbertos(false);
    };
    window.addEventListener('mousedown', aoClicar);
    return () => window.removeEventListener('mousedown', aoClicar);
  }, [avisosAbertos]);

  const selecionarAba = useCallback((aba: Aba) => {
    setAbaAtiva(aba);
    setMenuAberto(false);
    setAvisosAbertos(false);
    window.scrollTo({ top: 0 });
  }, []);

  function alternarMenuFixo() {
    setMenuFixo((atual) => {
      try {
        localStorage.setItem(CHAVE_MENU_FIXO, atual ? '0' : '1');
      } catch {
        // sem armazenamento: vale só nesta visita
      }
      return !atual;
    });
  }

  const abrirPaleta = useCallback(() => setPaletaAberta(true), []);
  useAtalhoPaleta(abrirPaleta);

  const rotuloDe = (id: Aba) => abas.find((a) => a.id === id)?.rotulo ?? '';
  const grupoAtivo = gruposDeAbas.find((g) => g.abas.includes(abaAtiva))?.titulo ?? '';

  const grupos: GrupoNavegacao<Aba>[] = gruposDeAbas.map((g) => ({
    titulo: g.titulo,
    itens: g.abas.map((id) => ({
      id,
      rotulo: rotuloDe(id),
      icone: iconesPorAba[id],
      contagem: contagemPorAba[id],
    })),
  }));

  const comandos: ComandoPaleta[] = useMemo(
    () => [
      ...gruposDeAbas.flatMap((g) =>
        g.abas.map((id) => ({
          id,
          rotulo: abas.find((a) => a.id === id)?.rotulo ?? id,
          grupo: g.titulo,
          descricao: descricaoDaAba[id],
          icone: iconesPorAba[id],
          sinonimos: id === 'mapa' ? 'mapa cobertura' : id === 'acesso' ? 'senha login conta entrar' : undefined,
          executar: () => selecionarAba(id),
        }))
      ),
      {
        id: 'sair',
        rotulo: 'Sair da conta',
        grupo: 'Conta',
        icone: iconeSair,
        sinonimos: 'logout',
        executar: sair,
      },
    ],
    [selecionarAba, sair]
  );

  const rodapeNavegacao = (focavel: boolean, compacto: boolean) => (
    <div className="border-t border-white/[0.07] px-3 py-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <Avatar nome={perfil?.nome_completo} tamanho="sm" />
        <div className={`min-w-0 transition-opacity duration-200 ${compacto ? 'opacity-0' : 'opacity-100'}`}>
          <p className="truncate whitespace-nowrap text-sm font-medium text-white">{perfil?.nome_completo}</p>
          <p className="whitespace-nowrap text-xs text-slate-500">Administrador</p>
        </div>
      </div>
      <div className={compacto ? 'hidden' : ''}>
        <ControleNotificacoes />
      </div>
      <button
        onClick={sair}
        tabIndex={focavel ? 0 : -1}
        title={compacto ? 'Sair' : undefined}
        className="mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <span className="h-5 w-5 shrink-0">{iconeSair}</span>
        <span className={`whitespace-nowrap transition-opacity duration-200 ${compacto ? 'opacity-0' : 'opacity-100'}`}>
          Sair
        </span>
      </button>
    </div>
  );

  return (
    <div className="fundo-app min-h-screen">
      {/* Barra lateral do desktop */}
      <aside
        onMouseEnter={() => setSobreMenu(true)}
        onMouseLeave={() => setSobreMenu(false)}
        onFocus={() => setSobreMenu(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobreMenu(false);
        }}
        className={`fundo-navegacao fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden border-r border-white/[0.06] transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex ${
          recolhida ? 'w-[76px]' : 'w-[264px]'
        } ${!menuFixo && !recolhida ? 'shadow-2xl' : ''}`}
        aria-label="Menu principal"
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-[18px]">
          <MarcaJornada subtitulo="Administração" compacta={recolhida} />
          <button
            onClick={alternarMenuFixo}
            title={menuFixo ? 'Soltar o menu' : 'Fixar o menu aberto'}
            aria-pressed={menuFixo}
            className={`h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
              recolhida ? 'hidden' : 'flex'
            } ${menuFixo ? 'bg-white/10 text-esmeralda' : 'text-slate-500 hover:bg-white/[0.06] hover:text-white'}`}
          >
            <span className={`h-4 w-4 transition-transform ${menuFixo ? '' : 'rotate-45'}`}>{iconeAlfinete}</span>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-2">
          <ListaNavegacao grupos={grupos} ativo={abaAtiva} aoSelecionar={selecionarAba} recolhida={recolhida} />
        </nav>
        {rodapeNavegacao(true, recolhida)}
      </aside>

      <div
        className={`transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          menuFixo ? 'lg:pl-[264px]' : 'lg:pl-[76px]'
        }`}
      >
        {/* Barra superior */}
        <header className="vidro sticky top-0 z-30 border-b border-tinta/[0.06] topo-seguro">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setMenuAberto(true)}
              className="relative -ml-1 rounded-lg p-2 text-tinta transition hover:bg-tinta/5 lg:hidden"
              aria-label="Abrir menu"
              aria-expanded={menuAberto}
            >
              <span className="block h-6 w-6">{iconeMenu}</span>
              {totalNotificacoes > 0 && (
                <span className="pulso-notificacao absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                <span className="hidden sm:inline">Administração</span>
                <span className="hidden text-slate-300 sm:inline">/</span>
                <span className="text-esmeralda-dark">{grupoAtivo}</span>
              </p>
              <p key={abaAtiva} className="animate-fade-in truncate font-display text-[17px] font-semibold tracking-tight text-tinta">
                {rotuloDe(abaAtiva)}
              </p>
            </div>

            <button
              onClick={abrirPaleta}
              className="group flex items-center gap-2 rounded-xl border border-tinta/10 bg-white/70 p-2 text-sm text-slate-500 shadow-sm transition hover:border-tinta/20 hover:bg-white hover:text-tinta sm:w-56 sm:px-3"
              aria-label="Buscar telas"
            >
              <span className="h-[18px] w-[18px] shrink-0">{iconeBusca}</span>
              <span className="hidden flex-1 text-left sm:block">Buscar...</span>
              <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:block">
                {teclaAtalho} K
              </kbd>
            </button>

            <div ref={avisosRef} className="relative">
              <button
                onClick={() => setAvisosAbertos((a) => !a)}
                className={`relative rounded-xl border p-2 shadow-sm transition ${
                  avisosAbertos
                    ? 'border-tinta bg-tinta text-white'
                    : 'border-tinta/10 bg-white/70 text-slate-600 hover:border-tinta/20 hover:bg-white hover:text-tinta'
                }`}
                aria-label={`Pendências${totalNotificacoes ? ` (${totalNotificacoes})` : ''}`}
                aria-expanded={avisosAbertos}
              >
                <span className="block h-[18px] w-[18px]">{iconeSino}</span>
                {totalNotificacoes > 0 && (
                  <span className="pulso-notificacao absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-nuvem">
                    {totalNotificacoes > 9 ? '9+' : totalNotificacoes}
                  </span>
                )}
              </button>
              {avisosAbertos && (
                <div className="animate-escala-in absolute right-0 top-[calc(100%+0.5rem)] w-[min(20rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl border border-tinta/10 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="font-display font-semibold text-tinta">Pendências</p>
                    <p className="text-xs text-slate-500">
                      {pendencias.length ? 'O que está esperando por você' : 'Tudo em dia por aqui.'}
                    </p>
                  </div>
                  {pendencias.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-esmeralda-light text-esmeralda-dark">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                          <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <p className="text-sm text-slate-500">Nenhuma pendência.</p>
                    </div>
                  ) : (
                    <ul className="p-1.5">
                      {pendencias.map(([id, n]) => (
                        <li key={id}>
                          <button
                            onClick={() => selecionarAba(id)}
                            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                              <span className="h-[18px] w-[18px]">{iconesPorAba[id]}</span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-tinta">{textoPendencia(id, n)}</span>
                              <span className="block text-xs text-slate-400">{rotuloDe(id)}</span>
                            </span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-tinta">
                              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Conteúdo principal */}
        <main className="px-4 pt-8 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-screen-2xl">
            <ErrorBoundary key={abaAtiva} fallback={<FallbackErroTela />}>
              <div className="entrada-pagina">
                {abaAtiva === 'painel' && <PainelAdminPage aoNavegar={selecionarAba} />}
                {abaAtiva === 'escala' && <VisaoAdminPage />}
                {abaAtiva === 'equipes' && <EquipesPage />}
                {abaAtiva === 'turnos' && <TurnosPage />}
                {abaAtiva === 'colaboradores' && <ColaboradoresPage />}
                {abaAtiva === 'trocas' && <SolicitacoesTrocaAdminPage />}
                {abaAtiva === 'mapa' && <MapaCoberturaPage />}
                {abaAtiva === 'assiduidade' && <AssiduidadePage />}
                {abaAtiva === 'faltas' && <FaltasPage />}
                {abaAtiva === 'comissionamento' && <ComissionamentoPage infoprodutosPendentes={infoprodutosPendentes} />}
                {abaAtiva === 'multas' && <MultasAdminPage />}
                {abaAtiva === 'qualidade' && <QualidadePage />}
                {abaAtiva === 'historico' && <HistoricoAdminPage />}
                {abaAtiva === 'acesso' && <GestaoAcessoPage />}
                {abaAtiva === 'configuracoes' && <ConfiguracoesPage />}
              </div>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Menu (gaveta) no celular e tablet */}
      <div
        className={`fixed inset-0 z-50 bg-tinta/50 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          menuAberto ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMenuAberto(false)}
        aria-hidden={!menuAberto}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={`fundo-navegacao flex h-full w-[280px] max-w-[85%] flex-col topo-seguro pb-[env(safe-area-inset-bottom)] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            menuAberto ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-16 shrink-0 items-center justify-between px-[18px]">
            <MarcaJornada subtitulo="Administração" />
            <button
              onClick={() => setMenuAberto(false)}
              tabIndex={menuAberto ? 0 : -1}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Fechar menu"
            >
              ×
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
            <ListaNavegacao grupos={grupos} ativo={abaAtiva} aoSelecionar={selecionarAba} focavel={menuAberto} />
          </nav>
          {rodapeNavegacao(menuAberto, false)}
        </div>
      </div>

      <PaletaComandos aberta={paletaAberta} aoFechar={() => setPaletaAberta(false)} comandos={comandos} />
    </div>
  );
}
