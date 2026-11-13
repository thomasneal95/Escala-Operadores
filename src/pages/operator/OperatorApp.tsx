import { useCallback, useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { AreaColaboradorPage } from './AreaColaboradorPage';
import { ColegasEquipePage } from './ColegasEquipePage';
import { HistoricoEscalasPage } from './HistoricoEscalasPage';
import { SolicitacoesTrocaPage } from './SolicitacoesTrocaPage';
import { MultasPage } from './MultasPage';
import { MeusGanhosPage } from './MeusGanhosPage';
import { DesempenhoPage } from './DesempenhoPage';
import { MinhaQualidadePage } from './MinhaQualidadePage';
import { InfoprodutosOperadorPage } from './InfoprodutosOperadorPage';
import { MeuComissionamentoExternoPage } from './MeuComissionamentoExternoPage';
import { useSouExterno } from '../../features/ganhos/useSouExterno';
import { TourOperador } from '../../components/TourOperador';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { FallbackErroTela } from '../../components/FallbackErroTela';
import { useNotificacoesOperador } from '../../features/notificacoes/useNotificacoesOperador';
import { ControleNotificacoes } from '../../components/AtivarNotificacoesCard';
import { abaDaUrl } from '../../lib/abaDaUrl';
import { Avatar, ListaNavegacao, MarcaJornada } from '../../components/layout/BarraLateral';
import type { GrupoNavegacao } from '../../components/layout/BarraLateral';
import { PaletaComandos, teclaAtalho, useAtalhoPaleta } from '../../components/layout/PaletaComandos';
import type { ComandoPaleta } from '../../components/layout/PaletaComandos';

type Aba = 'minha-area' | 'equipe' | 'trocas' | 'ganhos' | 'desempenho' | 'qualidade' | 'infoprodutos' | 'multas' | 'historico';

const abas: { id: Aba; rotulo: string }[] = [
  { id: 'minha-area', rotulo: 'Minha área' },
  { id: 'equipe', rotulo: 'Equipe' },
  { id: 'trocas', rotulo: 'Trocas' },
  { id: 'ganhos', rotulo: 'Meus ganhos' },
  { id: 'desempenho', rotulo: 'Desempenho' },
  { id: 'qualidade', rotulo: 'Qualidade' },
  { id: 'infoprodutos', rotulo: 'Infoprodutos' },
  { id: 'multas', rotulo: 'Multas' },
  { id: 'historico', rotulo: 'Histórico' },
];

// Operador externo pago por FTD (ex.: João): só o comissionamento e os
// infoprodutos dele.
const abasExterno: { id: Aba; rotulo: string }[] = [
  { id: 'ganhos', rotulo: 'Meu comissionamento' },
  { id: 'infoprodutos', rotulo: 'Infoprodutos' },
];

// Agrupamento da barra lateral.
const gruposDeAbas: { titulo: string; abas: Aba[] }[] = [
  { titulo: 'Meu dia a dia', abas: ['minha-area', 'equipe', 'trocas'] },
  { titulo: 'Meus resultados', abas: ['ganhos', 'desempenho', 'qualidade', 'infoprodutos'] },
  { titulo: 'Registros', abas: ['multas', 'historico'] },
];

// Abas que ficam direto na barra de baixo do celular (o resto vai em "Mais").
const abasDaBarraInferior: Aba[] = ['minha-area', 'trocas', 'qualidade', 'ganhos'];

const rotuloCurto: Partial<Record<Aba, string>> = {
  'minha-area': 'Início',
  ganhos: 'Ganhos',
};

const iconeMais = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
  </svg>
);

const iconeBusca = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" strokeLinecap="round" />
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
  ganhos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5v11" strokeLinecap="round" />
    </svg>
  ),
  desempenho: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" />
    </svg>
  ),
  qualidade: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5Z" strokeLinejoin="round" />
    </svg>
  ),
  infoprodutos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 7h16l-1.5 12a1 1 0 0 1-1 .9h-11a1 1 0 0 1-1-.9L4 7Z" strokeLinejoin="round" />
      <path d="M9 10V6a3 3 0 0 1 6 0v4" strokeLinecap="round" />
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
  const [abaAtiva, setAbaAtiva] = useState<Aba>(() =>
    abaDaUrl(
      abas.map((a) => a.id),
      'minha-area'
    )
  );
  const [maisAberto, setMaisAberto] = useState(false);
  const [paletaAberta, setPaletaAberta] = useState(false);
  const { externo, carregando: carregandoAcesso } = useSouExterno();
  const abasVisiveis = carregandoAcesso ? [] : externo ? abasExterno : abas;

  // O externo não tem as outras abas: abre no comissionamento dele.
  useEffect(() => {
    if (externo && !abasExterno.some((a) => a.id === abaAtiva)) setAbaAtiva('ganhos');
  }, [externo, abaAtiva]);
  const {
    escalasNovas,
    trocasPendentes,
    trocasDecididas,
    multasNovas,
    mesesFechados,
    vendasConferidas,
    marcarVisto,
  } = useNotificacoesOperador();

  const contagemPorAba: Partial<Record<Aba, number>> = {
    'minha-area': escalasNovas,
    trocas: trocasPendentes + trocasDecididas,
    ganhos: mesesFechados,
    infoprodutos: vendasConferidas,
    multas: multasNovas,
  };

  // Abrir a aba conta como "visto" para os avisos dela.
  useEffect(() => {
    const escopo: Partial<Record<Aba, string>> = {
      'minha-area': 'escala',
      trocas: 'trocas',
      ganhos: 'ganhos',
      infoprodutos: 'infoprodutos',
    };
    const atual = escopo[abaAtiva];
    if (atual) marcarVisto(atual);
  }, [abaAtiva, marcarVisto]);

  // Esc fecha a gaveta "Mais".
  useEffect(() => {
    if (!maisAberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMaisAberto(false);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [maisAberto]);

  const selecionarAba = useCallback((aba: Aba) => {
    setAbaAtiva(aba);
    setMaisAberto(false);
    window.scrollTo({ top: 0 });
  }, []);

  const abrirPaleta = useCallback(() => setPaletaAberta(true), []);
  useAtalhoPaleta(abrirPaleta);

  const rotuloDe = (id: Aba) => abasVisiveis.find((a) => a.id === id)?.rotulo ?? '';
  const visivel = (id: Aba) => abasVisiveis.some((a) => a.id === id);
  const contagemVisivel = (id: Aba) => (id === abaAtiva ? 0 : (contagemPorAba[id] ?? 0));

  const grupos: GrupoNavegacao<Aba>[] = externo
    ? [
        {
          itens: abasExterno.map((a) => ({
            id: a.id,
            rotulo: a.rotulo,
            icone: iconesPorAba[a.id],
            contagem: contagemPorAba[a.id],
          })),
        },
      ]
    : gruposDeAbas.map((g) => ({
        titulo: g.titulo,
        itens: g.abas.filter(visivel).map((id) => ({
          id,
          rotulo: rotuloDe(id),
          icone: iconesPorAba[id],
          contagem: contagemPorAba[id],
        })),
      }));

  // Barra de baixo do celular: até 4 abas + "Mais" com o restante.
  const abasInferiores = externo ? abasExterno.map((a) => a.id) : abasDaBarraInferior.filter(visivel);
  const abasNoMais = abasVisiveis.filter((a) => !abasInferiores.includes(a.id));
  const maisTemAviso = abasNoMais.some((a) => contagemVisivel(a.id) > 0);
  const maisSelecionado = abasNoMais.some((a) => a.id === abaAtiva);

  const primeiroNome = perfil?.nome_completo?.split(' ')[0] ?? '';

  const comandos: ComandoPaleta[] = [
    ...abasVisiveis.map((a) => ({
      id: a.id,
      rotulo: a.rotulo,
      grupo: gruposDeAbas.find((g) => g.abas.includes(a.id))?.titulo ?? 'Telas',
      icone: iconesPorAba[a.id],
      contagem: contagemVisivel(a.id),
      sinonimos: a.id === 'minha-area' ? 'inicio escala rodizio' : undefined,
      executar: () => selecionarAba(a.id),
    })),
    { id: 'sair', rotulo: 'Sair da conta', grupo: 'Conta', icone: iconeSair, executar: sair },
  ];

  return (
    <div className="fundo-app min-h-screen">
      {!carregandoAcesso && !externo && <TourOperador />}

      {/* Cabeçalho — só no celular (desktop usa a barra lateral) */}
      <header className="vidro sticky top-0 z-30 border-b border-tinta/[0.06] topo-seguro sm:hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar nome={perfil?.nome_completo} />
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Olá,</p>
              <p className="truncate font-display font-semibold tracking-tight text-tinta">{primeiroNome}</p>
            </div>
          </div>
          <button
            onClick={sair}
            className="flex items-center gap-1.5 rounded-xl border border-tinta/10 bg-white/70 px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-white hover:text-tinta"
          >
            <span className="h-4 w-4">{iconeSair}</span>
            Sair
          </button>
        </div>
      </header>

      {/* Barra lateral fixa — telas maiores */}
      <aside className="fundo-navegacao fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-white/[0.06] sm:flex">
        <div className="px-5 pb-4 pt-5">
          <MarcaJornada subtitulo={externo ? 'Comissionamento' : 'Portal do operador'} />
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/[0.06]">
            <Avatar nome={perfil?.nome_completo} />
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Olá,</p>
              <p className="truncate font-display font-semibold text-white">{primeiroNome}</p>
            </div>
          </div>
          <button
            onClick={abrirPaleta}
            className="mt-3 flex w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-400 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
          >
            <span className="h-4 w-4 shrink-0">{iconeBusca}</span>
            <span className="flex-1 text-left">Buscar...</span>
            <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              {teclaAtalho} K
            </kbd>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {!carregandoAcesso && <ListaNavegacao grupos={grupos} ativo={abaAtiva} aoSelecionar={selecionarAba} />}
        </nav>

        <div className="border-t border-white/[0.07] px-3 py-3">
          <ControleNotificacoes />
          <button
            onClick={sair}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <span className="h-5 w-5 shrink-0">{iconeSair}</span>
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="px-5 pt-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:ml-64 sm:px-8 sm:pt-10 sm:pb-12">
        <div className={`mx-auto ${externo ? 'max-w-5xl' : 'max-w-2xl'}`}>
          <ErrorBoundary key={abaAtiva} fallback={<FallbackErroTela />}>
            <div className="entrada-pagina">
              {carregandoAcesso ? null : externo ? (
                <>
                  {abaAtiva === 'ganhos' && <MeuComissionamentoExternoPage />}
                  {abaAtiva === 'infoprodutos' && <InfoprodutosOperadorPage />}
                </>
              ) : (
                <>
                  {abaAtiva === 'minha-area' && <AreaColaboradorPage />}
                  {abaAtiva === 'equipe' && <ColegasEquipePage />}
                  {abaAtiva === 'trocas' && <SolicitacoesTrocaPage />}
                  {abaAtiva === 'ganhos' && <MeusGanhosPage />}
                  {abaAtiva === 'desempenho' && <DesempenhoPage />}
                  {abaAtiva === 'qualidade' && <MinhaQualidadePage />}
                  {abaAtiva === 'infoprodutos' && <InfoprodutosOperadorPage />}
                  {abaAtiva === 'multas' && <MultasPage />}
                  {abaAtiva === 'historico' && <HistoricoEscalasPage />}
                </>
              )}
            </div>
          </ErrorBoundary>
        </div>
      </main>

      {/* Barra de abas inferior — celular */}
      {!carregandoAcesso && (
        <nav
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 sm:hidden"
          aria-label="Navegação"
        >
          <div className="fundo-navegacao flex items-stretch justify-around gap-1 rounded-[1.4rem] p-1.5 shadow-[0_18px_40px_-12px_rgba(10,20,38,0.55)] ring-1 ring-white/10">
            {abasInferiores.map((id) => (
              <BotaoBarraInferior
                key={id}
                ativo={abaAtiva === id}
                rotulo={rotuloCurto[id] ?? rotuloDe(id)}
                icone={iconesPorAba[id]}
                aviso={contagemVisivel(id) > 0}
                aoClicar={() => selecionarAba(id)}
              />
            ))}
            {abasNoMais.length > 0 && (
              <BotaoBarraInferior
                ativo={maisSelecionado || maisAberto}
                rotulo="Mais"
                icone={iconeMais}
                aviso={maisTemAviso}
                aoClicar={() => setMaisAberto(true)}
              />
            )}
          </div>
        </nav>
      )}

      {/* "Mais" — folha que sobe do rodapé, no celular */}
      <div
        className={`fixed inset-0 z-40 bg-tinta/50 backdrop-blur-[2px] transition-opacity duration-300 sm:hidden ${
          maisAberto ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMaisAberto(false)}
        aria-hidden={!maisAberto}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mais opções"
          className={`fundo-navegacao absolute inset-x-0 bottom-0 rounded-t-[1.75rem] px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            maisAberto ? 'translate-y-0' : 'translate-y-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
          <div className="grid grid-cols-3 gap-2">
            {abasNoMais.map((a) => {
              const ativo = abaAtiva === a.id;
              const aviso = contagemVisivel(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => selecionarAba(a.id)}
                  tabIndex={maisAberto ? 0 : -1}
                  className={`relative flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-xs font-medium transition ${
                    ativo
                      ? 'bg-gradient-to-br from-esmeralda to-esmeralda-dark text-white shadow-[0_10px_24px_-10px_rgba(26,163,107,0.9)]'
                      : 'bg-white/[0.05] text-slate-300 ring-1 ring-white/[0.06] active:bg-white/10'
                  }`}
                >
                  <span className="h-6 w-6">{iconesPorAba[a.id]}</span>
                  {a.rotulo}
                  {aviso > 0 && (
                    <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {aviso > 9 ? '9+' : aviso}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 border-t border-white/[0.07] pt-2">
            <ControleNotificacoes />
          </div>
        </div>
      </div>

      <PaletaComandos aberta={paletaAberta} aoFechar={() => setPaletaAberta(false)} comandos={comandos} />
    </div>
  );
}

function BotaoBarraInferior({
  ativo,
  rotulo,
  icone,
  aviso,
  aoClicar,
}: {
  ativo: boolean;
  rotulo: string;
  icone: ReactNode;
  aviso: boolean;
  aoClicar: () => void;
}) {
  return (
    <button
      onClick={aoClicar}
      aria-current={ativo ? 'page' : undefined}
      className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[1rem] px-1 pb-1.5 pt-2 text-[10.5px] font-medium transition-all duration-300 ${
        ativo
          ? 'bg-gradient-to-b from-esmeralda to-esmeralda-dark text-white shadow-[0_8px_20px_-8px_rgba(26,163,107,0.9),inset_0_1px_0_rgba(255,255,255,0.2)]'
          : 'text-slate-400 active:text-white'
      }`}
    >
      <span className={`relative h-[22px] w-[22px] transition-transform duration-300 ${ativo ? '-translate-y-px scale-105' : ''}`}>
        {icone}
        {aviso && (
          <span className="pulso-notificacao absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-tinta" />
        )}
      </span>
      <span className="max-w-full truncate">{rotulo}</span>
    </button>
  );
}
