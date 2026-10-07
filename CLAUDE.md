# Escala Operadores

## Contexto do projeto

Sistema web, já em produção, para gerenciamento da escala de operadores:
disponibilidade, montagem e confirmação de escalas (inclusive geração
automática), trocas de turno, faltas, multas, comissionamento e fechamento
mensal. Há dois perfis (`perfis.papel`): `administrador` (vê `AdminApp`) e
operador/colaborador (vê `OperatorApp`). A especificação original está em
`docs/ESPECIFICACAO-V1.md`; o sistema já foi bem além da V1.

Este projeto é **completamente independente** de qualquer outro projeto no
ambiente do usuário (ex.: `demand-buddy-app`). Nenhum arquivo, configuração ou
dependência deve ser compartilhado ou copiado entre eles.

## Stack

- React 19 + TypeScript + Vite + Tailwind CSS 4
- Supabase (Postgres com RLS, Auth, Realtime, Edge Functions) via
  `@supabase/supabase-js` — cliente em `src/lib/supabase/client.ts`
- npm, Git, oxlint
- Hospedagem: Vercel (https://escala-operadores.vercel.app)

Não usar TanStack Start nem Lovable (ou qualquer ferramenta relacionada).

## Ambientes e deploy — ATENÇÃO

Existe **um único projeto Supabase** (ref `cmveztaigvnxzegwoicq`), que é o de
produção. Não há banco de staging.

- **Rodar local (`npm run dev`) usa o banco de produção.** Testes manuais
  pela interface leem e alteram dados reais — evitar criar/excluir registros
  de teste sem combinar com o usuário.
- **Push no `master` publica na hora:**
  - o Vercel faz o deploy do front-end;
  - se o push tocar `supabase/migrations/**` ou `supabase/functions/**`, o
    workflow `.github/workflows/deploy-supabase.yml` roda `supabase db push`
    e `supabase functions deploy` em produção.
- Por isso: rodar `npm run build` antes de commitar, revisar migrations com
  cuidado (devem ser seguras sobre dados existentes) e só dar push com
  aprovação do usuário.

Variáveis de ambiente (arquivo `.env.local`, ignorado pelo Git):
`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (chave publicável,
pública por natureza). Nunca commitar chaves `service_role` ou senhas.

## Estrutura

```
src/
├── App.tsx              # escolhe Login / AdminApp / OperatorApp pelo perfil
├── components/          # componentes compartilhados (modais, feedback, etc.)
├── features/            # hooks de dados por domínio (falam com o Supabase)
│   ├── auth/            # AuthContext (sessão + perfil)
│   ├── availability/    # disponibilidade
│   ├── employees/       # colaboradores e gestão de acesso
│   ├── faltas/
│   ├── multas/
│   ├── notificacoes/
│   └── schedules/       # escala, períodos, turnos, equipes, comissionamento,
│                        # fechamento mensal, análises, trocas, histórico
├── pages/
│   ├── admin/           # telas do administrador (AdminApp.tsx = navegação)
│   └── operator/        # telas do operador (OperatorApp.tsx = navegação)
├── lib/                 # cliente Supabase e utilitários
├── hooks/
└── types/database.ts    # tipos das tabelas
supabase/
├── migrations/          # SQL versionado, aplicado em ordem pelo timestamp
├── functions/           # edge functions (Deno)
└── snippets/            # consultas avulsas — não são aplicadas no deploy
```

## Convenções

- Código, nomes de tabelas/colunas e UI em português.
- Lógica de acesso a dados fica em hooks dentro de `src/features/<domínio>`;
  as páginas apenas consomem esses hooks.
- Toda mudança de banco é uma nova migration em `supabase/migrations/`
  (`AAAAMMDDHHMMSS_descricao.sql`) — nunca editar migrations já aplicadas.
  Lembrar de RLS e grants para tabelas novas.
- Mensagens de commit em português, no presente, descrevendo o efeito
  (ex.: "Adiciona controle de faltas nos dias normais").
- Manter o escopo de cada mudança restrito ao que for pedido.

## Comandos

- `npm run dev` — servidor de desenvolvimento (porta 5173)
- `npm run build` — `tsc -b` + `vite build` (usar como verificação antes de
  commitar)
- `npm run lint` — oxlint
- `npm run preview` — serve o build de produção localmente
