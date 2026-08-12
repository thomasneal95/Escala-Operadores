# Supabase — Escala Operadores

Este diretório contém as migrations SQL versionadas do banco de dados do
projeto. Nenhuma migration listada aqui foi executada em ambiente remoto
até o momento — ver `docs/MODELO-BANCO-V1.md` para a modelagem aprovada e
`docs/TESTES-BANCO-V1.md` para o roteiro de testes que deve ser executado
antes de qualquer aplicação em produção.

## Estrutura

```
supabase/
└── migrations/
    └── 20260811000000_initial_schema.sql   -- schema inicial (V1)
```

## Pré-requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado
  (`npm install -g supabase` ou via `scoop`/`brew`, conforme o sistema).
- Docker Desktop em execução, caso queira aplicar a migration em um banco
  **local** (o Supabase CLI sobe um PostgreSQL local via Docker).
- Um projeto Supabase já criado, caso a intenção seja aplicar contra um
  ambiente remoto (não recomendado nesta etapa — ver seção "Antes de ir
  para produção" abaixo).
- Nenhuma credencial, token ou senha deve ser commitada neste diretório.
  O CLI do Supabase gerencia autenticação via `supabase login` e arquivos
  de configuração locais que **não** devem ser versionados (ver
  `.gitignore` do projeto).

## Como aplicar a migration localmente

1. Inicializar o projeto Supabase local (uma única vez, se ainda não
   existir `supabase/config.toml`):

   ```bash
   supabase init
   ```

2. Subir o banco local (PostgreSQL + demais serviços do Supabase, via
   Docker):

   ```bash
   supabase start
   ```

3. Aplicar as migrations pendentes no banco local:

   ```bash
   supabase db reset
   ```

   `db reset` recria o banco local do zero e aplica todas as migrations em
   `supabase/migrations/` na ordem dos seus nomes (prefixo de timestamp) —
   é a forma recomendada de validar a migration do zero, já que garante
   que ela roda em um schema limpo, sem estado residual.

   Alternativamente, para aplicar apenas migrations novas sobre um banco
   local já existente (sem recriar do zero):

   ```bash
   supabase migration up
   ```

4. Inspecionar o schema resultante (opcional, mas recomendado):

   ```bash
   supabase db diff --schema public
   ```

   ou conectar diretamente com `psql`/um cliente SQL na porta local
   informada por `supabase status` e inspecionar tabelas, constraints e
   triggers manualmente.

## Extensões utilizadas

| Extensão | Motivo |
|---|---|
| `pgcrypto` | Fornece `gen_random_uuid()`, usado como `DEFAULT` de todas as chaves primárias `uuid`. |
| `btree_gist` | Permite combinar igualdade de `uuid` com sobreposição de `tsrange` numa única *exclusion constraint* (`EXCLUDE USING gist`), usada em `escalas` para impedir conflito de horário. Extensão padrão do PostgreSQL, disponível em projetos Supabase hospedados sem necessidade de privilégios extras. |

Ambas são habilitadas pela própria migration (`CREATE EXTENSION IF NOT
EXISTS ...`) — nenhum passo manual adicional é necessário antes de
aplicá-la.

## ⚠️ Aviso de segurança — ausência de RLS nesta etapa

Como esta migration **não habilita Row Level Security** em nenhuma
tabela (por decisão explícita desta etapa — ver seção seguinte), se ela
for aplicada a um projeto Supabase acessível pela API (PostgREST) antes
do RLS ser implementado, as tabelas ficam sujeitas apenas aos `GRANT`s
padrão do Supabase para os papéis `anon`/`authenticated` — ou seja,
**sem RLS, não há isolamento por colaborador nem restrição de escrita**.
Isso é aceitável para um banco **local** de desenvolvimento/teste (não
exposto publicamente), mas esta migration **não deve ser aplicada a um
projeto Supabase hospedado e acessível externamente** até que a etapa de
RLS seja concluída e revisada.

## O que esta migration cria

- Tipos: `papel_usuario`, `status_periodo`.
- Tabelas: `perfis`, `equipes`, `colaboradores`, `turnos`,
  `periodos_operacao`, `disponibilidades`, `escalas`.
- Funções e triggers de integridade (validação de papel do colaborador,
  validação de data pertencente ao período, bloqueio de disponibilidade
  fora do prazo, confirmação persistente do período, snapshot do turno na
  escala, auditoria genérica de `updated_at`).
- Constraints: chaves primárias/estrangeiras, `UNIQUE`, `CHECK`, o índice
  único parcial de matrícula e a *exclusion constraint* de conflito de
  horário.

**O que esta migration explicitamente NÃO cria:**

- Nenhuma política de Row Level Security (RLS) — etapa futura e separada,
  para permitir revisão cuidadosa das políticas antes de habilitá-las (ver
  `docs/MODELO-BANCO-V1.md`, seção 14).
- Nenhum usuário, colaborador, equipe, turno ou período de exemplo — o
  schema é criado vazio.
- Nenhuma tela, rota de API ou lógica de aplicação.

## Pontos que precisam ser testados antes de produção

Ver `docs/TESTES-BANCO-V1.md` para o roteiro completo. Resumo dos pontos
mais sensíveis, que dependem de execução real (não apenas leitura do
SQL):

1. **Exclusion constraint de conflito de horário** (`excl_escala_sem_sobreposicao`)
   — confirmar que os 5 casos de teste da validação técnica
   (`docs/MODELO-BANCO-V1.md`, seção 6.1) se comportam como esperado
   contra um banco real, incluindo turnos que cruzam a meia-noite.
2. **Colunas geradas (`GENERATED ALWAYS AS ... STORED`)** em `escalas`
   (`inicio_efetivo`, `fim_efetivo`) — confirmar que a versão de
   PostgreSQL do projeto Supabase de destino suporta plenamente colunas
   geradas armazenadas em conjunto com `EXCLUDE USING gist` (suportado
   desde o PostgreSQL 12; Supabase roda versões mais recentes, mas vale
   confirmar na primeira aplicação real).
3. **Triggers de validação cruzada entre tabelas** (data pertence ao
   período, perfil é colaborador, confirmação persistente) — testar
   tanto o caminho de sucesso quanto o de rejeição (mensagens de erro
   devem ser claras o suficiente para depuração).
4. **Comportamento de `ON DELETE RESTRICT`** — confirmar que tentativas
   de excluir colaboradores/equipes/turnos/períodos com histórico
   associado são de fato recusadas pelo banco.
5. **Extensão `btree_gist`** — confirmar que está disponível e habilitável
   no plano/projeto Supabase de destino (é uma extensão padrão, mas vale
   confirmar antes de depender dela em produção).

## Antes de ir para produção

- Executar o roteiro completo de `docs/TESTES-BANCO-V1.md` contra um
  projeto Supabase de teste (não o de produção).
- Revisar e implementar as políticas de RLS (etapa separada, ainda não
  iniciada).
- Só então aplicar a migration em produção, via `supabase db push` (ou
  pipeline de CI/CD equivalente) — **não incluído neste documento, pois
  esta etapa ainda não deve ser executada**.
