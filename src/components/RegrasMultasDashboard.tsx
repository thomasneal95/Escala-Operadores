import type { ReactElement } from 'react';

interface Categoria {
  titulo: string;
  icone: ReactElement;
  regras: string[];
}

const iconeCozinha = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M5 9h11a3 3 0 0 1 0 6h-.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 9v7a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3V9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 4v2M11 4v2M14 4v2" strokeLinecap="round" />
  </svg>
);

const iconeBanheiro = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path
      d="M12 3c2 2.2 4 5 4 7.5a4 4 0 1 1-8 0C8 8 10 5.2 12 3Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M9.5 10.5c0 1.4 1.1 2.5 2.5 2.5" strokeLinecap="round" />
  </svg>
);

const iconeMesa = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="3.5" y="5" width="17" height="11" rx="1.5" />
    <path d="M8 20h8M12 16v4" strokeLinecap="round" />
  </svg>
);

const iconeMochila = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path
      d="M7 9V7a5 5 0 0 1 10 0v2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="5" y="9" width="14" height="12" rx="2.5" />
    <path d="M9 13h6M9 17h6" strokeLinecap="round" />
  </svg>
);

const iconeRegras = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" />
    <path d="M9 12h6M9 15.5h6M9 8.5h3" strokeLinecap="round" />
  </svg>
);

const iconeAlerta = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path
      d="M12 3.5 21 19H3L12 3.5Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12 10v4" strokeLinecap="round" />
    <path d="M12 16.8h.01" strokeLinecap="round" />
  </svg>
);

const categorias: Categoria[] = [
  {
    titulo: 'Cozinha',
    icone: iconeCozinha,
    regras: [
      'Utilizou qualquer louça? Lave imediatamente após o uso.',
      'Caso faça suas refeições na bancada, limpe o local ao finalizar.',
      'Passe uma vassoura se sujou para manter a cozinha limpa.',
      'Para evitar acúmulo de louça na pia, seque a louça assim que lavar.',
    ],
  },
  {
    titulo: 'Banheiro',
    icone: iconeBanheiro,
    regras: ['Mantenha o vaso sanitário limpo após cada utilização.'],
  },
  {
    titulo: 'Mesa de trabalho',
    icone: iconeMesa,
    regras: ['Mantenha sua mesa sempre limpa, organizada e livre de objetos desnecessários.'],
  },
  {
    titulo: 'Mochilas',
    icone: iconeMochila,
    regras: ['Todas as mochilas devem estar em local que não atrapalhe a movimentação de qualquer pessoa.'],
  },
];

export function RegrasMultasDashboard() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ceruleo-light text-ceruleo">
            <span className="h-5 w-5">{iconeRegras}</span>
          </span>
          <div>
            <h2 className="font-display font-semibold text-tinta">
              Regras de convivência do escritório
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Regras para manter um ambiente organizado, limpo e agradável para toda a equipe.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {categorias.map((categoria) => (
          <div key={categoria.titulo} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ceruleo-light text-ceruleo">
                <span className="h-4 w-4">{categoria.icone}</span>
              </span>
              <p className="font-display font-semibold text-tinta">{categoria.titulo}</p>
            </div>
            <div className="mt-3 space-y-1.5">
              {categoria.regras.map((regra) => (
                <p key={regra} className="text-sm text-slate-600">
                  {regra}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <span className="h-5 w-5">{iconeAlerta}</span>
          </span>
          <div>
            <h3 className="font-display font-semibold text-amber-800">
              Multa por descumprimento
            </h3>
            <div className="mt-1.5 space-y-2 text-sm text-amber-800">
              <p>
                Para garantir o cumprimento das regras e a boa convivência entre todos, o
                descumprimento de qualquer regra acima estará sujeito a multa de{' '}
                <strong>R$ 20,00</strong> por ocorrência.
              </p>
              <p>
                As multas valem para todos os dias e serão cobradas toda segunda-feira. Se a
                semana virar sem o pagamento, o valor da multa pendente passa a ter juros de{' '}
                <strong>50%</strong>.
              </p>
              <p>
                Agradecemos a compreensão e a colaboração de todos. Pequenas atitudes fazem toda a
                diferença para mantermos um ambiente de trabalho mais organizado, produtivo e
                agradável.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
