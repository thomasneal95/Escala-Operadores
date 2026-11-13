import { useState, type FormEvent, type MouseEvent } from 'react';
import { useAuth } from '../features/auth/AuthContext';

// Motivo devolvido pelo Supabase Auth → mensagem para quem está entrando.
function mensagemDeErro(codigo: string) {
  switch (codigo) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.';
    case 'user_banned':
      return 'Seu acesso está bloqueado. Fale com o administrador.';
    case 'email_not_confirmed':
      return 'Seu e-mail ainda não foi confirmado. Fale com o administrador.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
    case 'sem_conexao':
      return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
    default:
      return `Não foi possível entrar (${codigo}). Fale com o administrador.`;
  }
}

const destaques = [
  {
    titulo: 'Escala e trocas',
    texto: 'Seu rodízio, turnos e trocas com os colegas em um só lugar.',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M3 9.5h18M8 3v3M16 3v3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    titulo: 'Desempenho e ganhos',
    texto: 'Acompanhe resultados e comissões mês a mês.',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M3 17l5-5 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 7h5v5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    titulo: 'Qualidade',
    texto: 'Feedbacks claros e desafios para evoluir sempre.',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5Z" strokeLinejoin="round" />
      </svg>
    ),
  },
];

// Fundo animado: duas manchas de luz nas cores da marca, se movendo devagar.
function Aurora() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -left-1/4 -top-1/4 h-[70vmax] w-[70vmax] rounded-full opacity-50 blur-[100px]"
        style={{
          background: 'radial-gradient(circle, var(--color-esmeralda) 0%, transparent 65%)',
          animation: 'aurora-a 18s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 h-[75vmax] w-[75vmax] rounded-full opacity-45 blur-[110px]"
        style={{
          background: 'radial-gradient(circle, var(--color-ceruleo) 0%, transparent 62%)',
          animation: 'aurora-b 22s ease-in-out infinite',
        }}
      />
      {/* Grade fina, sumindo nas bordas */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />
    </div>
  );
}

// "360": anéis em órbita com pontos girando em velocidades diferentes.
function Orbitas() {
  const aneis = [
    { r: 150, duracao: 38, cor: 'var(--color-esmeralda)', inicio: 0 },
    { r: 205, duracao: 54, cor: 'var(--color-ceruleo)', inicio: 120 },
    { r: 260, duracao: 72, cor: '#ffffff', inicio: 240 },
  ];
  return (
    <svg viewBox="-280 -280 560 560" className="h-full w-full" aria-hidden>
      {aneis.map((a, i) => (
        <g key={a.r} transform={`rotate(${a.inicio})`}>
          <circle r={a.r} fill="none" stroke="white" strokeOpacity={0.08} strokeDasharray={i === 1 ? '2 6' : undefined} />
          <g style={{ transformOrigin: '0 0', animation: `orbita ${a.duracao}s linear infinite` }}>
            <circle cx={a.r} cy={0} r={5} fill={a.cor} />
            <circle cx={a.r} cy={0} r={14} fill={a.cor} opacity={0.18} />
          </g>
        </g>
      ))}
    </svg>
  );
}

export function LoginPage() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    const { erro: erroLogin } = await entrar(email, senha);

    setEnviando(false);

    if (erroLogin) {
      setErro(mensagemDeErro(erroLogin));
    }
  }

  // Brilho que segue o cursor dentro do cartão.
  function moverBrilho(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  }

  const classeCampo =
    'h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-[15px] text-tinta shadow-sm placeholder:text-slate-400';

  return (
    <div className="relative flex min-h-screen bg-tinta-950">
      {/* Painel da marca — desktop */}
      <section className="fundo-navegacao relative hidden flex-1 overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-14">
        <Aurora />
        <div className="pointer-events-none absolute -right-48 top-1/2 h-[640px] w-[640px] -translate-y-1/2 opacity-90">
          <Orbitas />
        </div>

        <div className="animate-fade-in-up relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.07] ring-1 ring-white/10 backdrop-blur">
            <img src="/favicon.svg" alt="" className="h-6 w-6" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-white">Jornada 360</span>
        </div>

        <div className="relative max-w-lg">
          <p className="animate-fade-in-up font-mono text-xs font-medium uppercase tracking-[0.25em] text-esmeralda">
            Operação em movimento
          </p>
          <h1
            className="animate-fade-in-up mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-white xl:text-6xl"
            style={{ animationDelay: '60ms', animationFillMode: 'backwards' }}
          >
            Sua jornada,
            <br />
            <span className="bg-gradient-to-r from-esmeralda via-[#5fd3a5] to-ceruleo bg-clip-text text-transparent">
              em 360°.
            </span>
          </h1>
          <ul className="mt-10 space-y-5">
            {destaques.map((d, i) => (
              <li
                key={d.titulo}
                className="animate-fade-in-up flex items-start gap-4"
                style={{ animationDelay: `${140 + i * 80}ms`, animationFillMode: 'backwards' }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-esmeralda ring-1 ring-white/10">
                  <span className="h-5 w-5">{d.icone}</span>
                </span>
                <span>
                  <span className="block font-medium text-white">{d.titulo}</span>
                  <span className="block text-sm text-slate-400">{d.texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
          © {new Date().getFullYear()} Jornada 360
        </p>
      </section>

      {/* Formulário */}
      <section className="relative flex flex-1 items-center justify-center overflow-hidden p-5 lg:max-w-[560px] lg:bg-nuvem lg:p-12">
        <div className="lg:hidden">
          <Aurora />
        </div>
        <div
          className="pointer-events-none absolute inset-0 hidden lg:block"
          aria-hidden
          style={{
            background:
              'radial-gradient(30rem 22rem at 100% 0%, rgb(47 155 214 / 0.10), transparent 70%), radial-gradient(26rem 20rem at 0% 100%, rgb(26 163 107 / 0.10), transparent 70%)',
          }}
        />

        <div
          onMouseMove={moverBrilho}
          className="animate-fade-in-up group relative z-10 w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/95 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10 lg:max-w-[400px] lg:border-tinta/[0.06] lg:bg-white lg:shadow-xl"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background:
                'radial-gradient(420px circle at var(--mx, 50%) var(--my, 0%), rgb(26 163 107 / 0.08), transparent 45%)',
            }}
          />

          <div className="relative">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-tinta shadow-md">
                <img src="/favicon.svg" alt="" className="h-6 w-6" />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight text-tinta">Jornada 360</span>
            </div>

            <h2 className="mt-7 font-display text-[1.75rem] font-semibold tracking-tight text-tinta lg:mt-0">
              Bem-vindo(a) de volta
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">Entre com sua conta para continuar.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="text-sm font-medium text-slate-700">
                  E-mail
                </label>
                <div className="relative mt-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400">
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />
                    <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={classeCampo}
                    placeholder="voce@empresa.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="senha" className="text-sm font-medium text-slate-700">
                  Senha
                </label>
                <div className="relative mt-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400">
                    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
                    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" strokeLinecap="round" />
                  </svg>
                  <input
                    id="senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className={`${classeCampo} pr-12`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((atual) => !atual)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrarSenha ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 4.24A9.77 9.77 0 0112 4c5 0 9 4 10 8-.31 1.06-.82 2.07-1.5 3M6.1 6.1C3.9 7.5 2.3 9.6 2 12c1 4 5 8 10 8 1.13 0 2.22-.18 3.24-.52"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2 12c1-4 5-8 10-8s9 4 10 8c-1 4-5 8-10 8s-9-4-10-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {erro && (
                <p className="animate-fade-in flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 h-4 w-4 shrink-0">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7.5v5M12 16h.01" strokeLinecap="round" />
                  </svg>
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="group/botao relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-esmeralda font-medium text-white transition hover:bg-esmeralda-dark disabled:cursor-not-allowed disabled:opacity-70"
              >
                {enviando ? (
                  <>
                    <span className="animate-orbita h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 transition-transform duration-300 group-hover/botao:translate-x-1">
                      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-xs text-slate-400">
              Esqueceu sua senha? Fale com o administrador da sua equipe.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
