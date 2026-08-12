# Modelagem de Banco de Dados — Escala Operadores (V1)

> Este documento é **puramente conceitual e lógico**. Nenhuma tabela foi
> criada no Supabase, nenhum SQL foi executado e nenhuma migration foi
> gerada. Os trechos de SQL aqui presentes são **ilustrativos**, servindo
> como especificação para uma implementação física futura — não foram
> rodados contra nenhum banco.
>
> Base: [`docs/ESPECIFICACAO-V1.md`](./ESPECIFICACAO-V1.md).
>
> **Revisão 2** — ajustes de integridade e preservação histórica sobre a
> modelagem conceitualmente aprovada: histórico de turno na escala,
> prevenção de conflito de horários sobrepostos, confirmação persistente
> do período, auditoria (`created_at`/`updated_at`) e reforço das regras
> de não exclusão física. Ver seção 20 para o resumo das mudanças desta
> revisão.

## Sumário

0. [Convenções gerais](#0-convenções-gerais)
1. [Decisão: "final de semana" é uma entidade própria?](#1-decisão-final-de-semana-é-uma-entidade-própria)
2. [Visão geral das entidades](#2-visão-geral-das-entidades)
3. [Detalhamento das tabelas](#3-detalhamento-das-tabelas)
   - [3.1 `perfis`](#31-perfis)
   - [3.2 `colaboradores`](#32-colaboradores)
   - [3.3 `equipes`](#33-equipes)
   - [3.4 `periodos_operacao`](#34-periodos_operacao)
   - [3.5 `turnos`](#35-turnos)
   - [3.6 `disponibilidades`](#36-disponibilidades)
   - [3.7 `escalas`](#37-escalas)
4. [Cardinalidade dos relacionamentos](#4-cardinalidade-dos-relacionamentos)
5. [Restrições de unicidade](#5-restrições-de-unicidade)
6. [Prevenção de conflito de horários entre turnos](#6-prevenção-de-conflito-de-horários-entre-turnos)
   - [6.1 Validação técnica — conflito de horários](#61-validação-técnica--conflito-de-horários)
7. [O que pode ser alterado após a confirmação da escala](#7-o-que-pode-ser-alterado-após-a-confirmação-da-escala)
8. [Preservação de histórico](#8-preservação-de-histórico)
9. [Representação dos status do período e confirmação persistente](#9-representação-dos-status-do-período-e-confirmação-persistente)
10. [Separação técnica entre disponibilidade e escala](#10-separação-técnica-entre-disponibilidade-e-escala)
11. [Turnos configuráveis e histórico do turno na escala](#11-turnos-configuráveis-e-histórico-do-turno-na-escala)
12. [Auditoria (`created_at` / `updated_at`)](#12-auditoria-created_at--updated_at)
13. [Preparação para funcionalidades futuras](#13-preparação-para-funcionalidades-futuras)
14. [Segurança (Supabase Auth + RLS futuro)](#14-segurança-supabase-auth--rls-futuro)
15. [Análise de redundância](#15-análise-de-redundância)
16. [A. Diagrama textual dos relacionamentos](#16-a-diagrama-textual-dos-relacionamentos)
17. [B. Exemplo de dados fictícios](#17-b-exemplo-de-dados-fictícios)
18. [C. Regras de integridade a implementar no PostgreSQL](#18-c-regras-de-integridade-a-implementar-no-postgresql)
19. [D. Pontos que precisam de decisão antes da implementação física](#19-d-pontos-que-precisam-de-decisão-antes-da-implementação-física)
20. [Resumo das alterações desta revisão](#20-resumo-das-alterações-desta-revisão)

---

## 0. Convenções gerais

- Banco alvo: **PostgreSQL** (via Supabase).
- Chaves primárias: `uuid` (`gen_random_uuid()`), compatível com
  `auth.users.id` do Supabase Auth.
- Datas: `date` (sem hora) para dias de calendário; `time` para horários de
  turno; `timestamptz` para carimbos de tempo.
- **Convenção de nomes de auditoria (em inglês, por serem colunas de
  metadado técnico, não de vocabulário de negócio):** `created_at`,
  `updated_at`, `created_by`, `updated_by`, `confirmed_at`, `confirmed_by`.
  Todo o restante do vocabulário (tabelas, colunas de negócio, enums)
  permanece em português, seguindo `ESPECIFICACAO-V1.md`.
- Nenhuma tabela usa **exclusão física** como fluxo normal de negócio.
  Desativação lógica (`ativo boolean`) é o padrão para entidades de
  cadastro (equipes, turnos, colaboradores). Detalhado na seção 8.
- Nomes de tabela em português, no plural; nomes de `enum` em português,
  no singular.

## 1. Decisão: "final de semana" é uma entidade própria?

**Sim — `periodos_operacao` (final de semana) é uma tabela própria, e não
apenas um par de datas espalhado pelas outras tabelas.** Motivos:

1. **Precisa de estado.** O final de semana tem um ciclo de vida
   (ABERTO → EM ORGANIZAÇÃO → CONFIRMADO → ENCERRADO). Um status é uma
   propriedade do *período*, não das datas em si — não haveria onde
   guardá-lo se o período não existisse como registro.
2. **Precisa de identidade estável.** `disponibilidades` e `escalas`
   precisam apontar para "este final de semana específico" com uma chave
   estrangeira simples e estável, em vez de repetir e comparar
   `data_inicio`/`data_fim` em toda consulta.
3. **Evita duplicidade e ambiguidade.** Sem uma tabela própria, nada
   impede que duas pessoas "criem" o mesmo final de semana com datas
   ligeiramente diferentes por engano. Com uma tabela e uma restrição
   `UNIQUE(data_inicio, data_fim)`, o final de semana é criado uma única
   vez e todo o resto referencia esse registro.
4. **Auditoria de confirmação.** A confirmação (quem confirmou, quando)
   precisa de um lugar para ser persistida (seção 9) — esse lugar é o
   registro do período.
5. **Histórico consultável.** Consultar "todas as disponibilidades e
   escalas do final de semana de 15–16/08/2026" fica trivial com um JOIN
   por `periodo_id`, em vez de filtros por intervalo de datas em todas as
   tabelas.

Uma modelagem alternativa (sem tabela própria, usando apenas as colunas
`data` de `disponibilidades`/`escalas`) foi descartada porque exigiria
recalcular "a qual final de semana esta data pertence" a cada consulta, e
não teria onde guardar o status do período nem o carimbo de confirmação —
informações que a especificação exige explicitamente (seções 3 e 9 da
especificação).

## 2. Visão geral das entidades

| Tabela | Responsabilidade única |
|---|---|
| `perfis` | Identidade de acesso (papel: administrador ou colaborador), estendendo `auth.users` do Supabase. |
| `colaboradores` | Dados operacionais de quem pode ser escalado (equipe, matrícula, status). |
| `equipes` | Agrupamento nomeado de colaboradores. |
| `periodos_operacao` | Um final de semana de operação e seu ciclo de vida (status). |
| `turnos` | Configuração de nome + horário de um turno, reutilizável entre períodos. |
| `disponibilidades` | Intenção/capacidade informada pelo colaborador para um (período, data, turno). |
| `escalas` | Decisão final do administrador de alocação para um (período, data, turno). |

Nenhuma tabela adicional foi criada "porque parecia útil" — a justificativa
de cada uma está na seção 15 (análise de redundância).

## 3. Detalhamento das tabelas

### 3.1 `perfis`

**Finalidade:** representar o perfil de acesso de um usuário autenticado
(administrador ou colaborador), em extensão à tabela `auth.users` gerenciada
pelo Supabase Auth. Não contém dados operacionais de escala.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | sim (PK) | Igual a `auth.users.id` (relação 1:1 com o usuário autenticado). |
| `papel` | `enum papel_usuario` (`administrador`, `colaborador`) | sim | Define o nível de acesso. |
| `nome_completo` | `text` | sim | Nome de exibição. |
| `ativo` | `boolean` | sim (default `true`) | Permite bloquear acesso sem apagar o perfil. |
| `created_at` | `timestamptz` | sim (default `now()`) | Data de criação do perfil. |
| `updated_at` | `timestamptz` | sim (default `now()`) | Última alteração (nome, papel ou `ativo`). |

- **Chave primária:** `id`.
- **Chave estrangeira:** `id` → `auth.users.id` (`ON DELETE CASCADE`, único
  caso em que cascata é aceitável, pois remover o usuário de autenticação
  torna o perfil inválido por definição).
- **Valores permitidos:** `papel IN ('administrador', 'colaborador')`.
- **Regra de integridade:** um `auth.users` só pode ter **um** `perfis`
  (garantido pela própria PK igual à FK).
- **Relacionamentos:** `1—1` com `colaboradores` (apenas quando
  `papel = 'colaborador'`); referenciado por `periodos_operacao`
  (`created_by`, `confirmed_by`) e por `escalas` (`created_by`,
  `updated_by`).

### 3.2 `colaboradores`

**Finalidade:** representar os dados operacionais de um trabalhador que
pode informar disponibilidade e ser escalado. É a extensão "operacional" de
um `perfis` com `papel = 'colaborador'`.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | sim (PK) | Identificador do colaborador. |
| `perfil_id` | `uuid` | sim (FK, `UNIQUE`) | Vínculo 1:1 com `perfis.id`. |
| `equipe_id` | `uuid` | não (FK) | Equipe atual do colaborador. |
| `matricula` | `text` | **não — opcional** (`UNIQUE` quando preenchido) | Código interno; decisão confirmada nesta revisão (seção 20, item 5). |
| `telefone` | `text` | não | Contato opcional. |
| `ativo` | `boolean` | sim (default `true`) | **Indicador de ativo/inativo** — desligamento lógico, nunca exclusão física quando houver histórico (seção 8). |
| `created_at` | `timestamptz` | sim (default `now()`) | Data de cadastro. |
| `updated_at` | `timestamptz` | sim (default `now()`) | Última alteração (equipe, telefone, matrícula, `ativo`). |

- **Chave primária:** `id`.
- **Chaves estrangeiras:**
  - `perfil_id` → `perfis.id` (`ON DELETE RESTRICT`, `UNIQUE`).
  - `equipe_id` → `equipes.id` (`ON DELETE RESTRICT`, nullable).
- **Regras de integridade:**
  - Um colaborador sempre corresponde a exatamente um perfil com
    `papel = 'colaborador'` (trigger, ver seção 18).
  - Colaborador sem equipe é permitido (`equipe_id NULL`) — cadastro pode
    preceder a organização em equipes.
  - `matricula`, quando preenchida, deve ser única (índice único parcial,
    seção 18) — quando `NULL`, múltiplos colaboradores podem não ter
    matrícula sem conflito.
- **Relacionamentos:** `N—1` com `equipes`; `1—1` com `perfis`; `1—N` com
  `disponibilidades` e `escalas`.

### 3.3 `equipes`

**Finalidade:** agrupar colaboradores sob um nome, para uso informativo na
administração da escala. **Sem** qualquer lógica de distribuição automática
na V1 (fora de escopo, seção 15 da especificação).

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | sim (PK) | Identificador da equipe. |
| `nome` | `text` | sim (`UNIQUE`) | Ex.: "Equipe A". |
| `ativo` | `boolean` | sim (default `true`) | **Indicador de ativo/inativo** — ativar/desativar sem apagar. |
| `created_at` | `timestamptz` | sim (default `now()`) | Data de criação. |
| `updated_at` | `timestamptz` | sim (default `now()`) | Última alteração (nome, `ativo`). |

- **Chave primária:** `id`.
- **Regra de integridade:** **não deve ser excluída fisicamente quando
  possuir histórico relacionado** — garantido pela FK `ON DELETE
  RESTRICT` em `colaboradores.equipe_id`: o banco recusa o `DELETE`
  enquanto existir qualquer colaborador (mesmo inativo) vinculado a essa
  equipe. Desativar via `ativo = false` é o caminho recomendado (seção 8).
- **Relacionamentos:** `1—N` com `colaboradores`.

### 3.4 `periodos_operacao`

**Finalidade:** representar um final de semana de operação e seu ciclo de
vida, incluindo o registro persistente de status e confirmação. Ver
justificativa completa na seção 1.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | sim (PK) | Identificador do período. |
| `data_inicio` | `date` | sim | Sábado do período. |
| `data_fim` | `date` | sim | Domingo do período. |
| `status` | `enum status_periodo` (`aberto`, `em_organizacao`, `confirmado`, `encerrado`) | sim (default `aberto`) | Ciclo de vida (seção 9). |
| `confirmed_at` | `timestamptz` | não | **Data/hora da confirmação.** Preenchido apenas na transição para `confirmado`. |
| `confirmed_by` | `uuid` | não (FK → `perfis.id`) | **Administrador responsável pela confirmação.** |
| `created_by` | `uuid` | sim (FK → `perfis.id`) | Administrador que criou o período. |
| `created_at` | `timestamptz` | sim (default `now()`) | Data de criação. |
| `updated_at` | `timestamptz` | sim (default `now()`) | Última alteração (status, observações). |
| `observacoes` | `text` | não | Notas administrativas livres. |

- **Chave primária:** `id`.
- **Chaves estrangeiras:** `created_by` e `confirmed_by` → `perfis.id`
  (`ON DELETE RESTRICT`).
- **Valores permitidos:** `status IN ('aberto','em_organizacao','confirmado','encerrado')`.
- **Regras de integridade:**
  - `data_fim >= data_inicio`.
  - `confirmed_at`/`confirmed_by` só podem estar preenchidos quando
    `status IN ('confirmado','encerrado')`, e são **obrigatórios** nesses
    dois status (trigger, ver seção 18) — é assim que o sistema
    "identifica que aquela escala está confirmada" de forma persistente
    (explicado em detalhe na seção 9).
- **Relacionamentos:** `1—N` com `disponibilidades` e `escalas`.

### 3.5 `turnos`

**Finalidade:** ser a **única fonte de verdade** para nome e horário de um
turno, evitando que "Manhã"/"Tarde"/"Noite" existam apenas como texto solto
em várias tabelas. Editar um turno aqui reflete em toda a aplicação sem
alterar código.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | sim (PK) | Identificador do turno. |
| `nome` | `text` | sim (`UNIQUE`) | Ex.: "Manhã", "Tarde", "Noite". |
| `hora_inicio` | `time` | sim | Ex.: `08:00`. |
| `hora_fim` | `time` | sim | Ex.: `14:00`. Pode ser **menor** que `hora_inicio` (turno "Noite": `20:00`–`02:00`, cruza a meia-noite — isso é esperado e **não** deve ser bloqueado por CHECK). |
| `ordem_exibicao` | `integer` | não | Ordenação na interface (não altera regra de negócio). |
| `ativo` | `boolean` | sim (default `true`) | Ativar/desativar sem apagar. |
| `created_at` | `timestamptz` | sim (default `now()`) | Data de criação. |
| `updated_at` | `timestamptz` | sim (default `now()`) | Última alteração (nome, horário, `ativo`) — **não afeta escalas já criadas**, ver seção 11. |

- **Chave primária:** `id`.
- **Regra de integridade:** não excluir fisicamente turnos referenciados
  por `disponibilidades`/`escalas` (garantido por `ON DELETE RESTRICT`
  nas FKs dessas tabelas); desativar via `ativo = false`.
- **Relacionamentos:** `1—N` com `disponibilidades` e `escalas`.
- **Nota sobre histórico:** ver seção 11 sobre por que `escalas` guarda uma
  cópia (snapshot) do horário vigente no momento da alocação.

### 3.6 `disponibilidades`

**Finalidade:** registrar a intenção/capacidade do colaborador de
trabalhar em um turno específico de um dia específico de um período. **Não
representa alocação.**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | sim (PK) | Identificador do registro. |
| `colaborador_id` | `uuid` | sim (FK) | Quem informou. |
| `periodo_id` | `uuid` | sim (FK) | Final de semana de referência. |
| `data` | `date` | sim | Deve ser `data_inicio` ou `data_fim` do período referenciado. |
| `turno_id` | `uuid` | sim (FK) | Turno referenciado. |
| `disponivel` | `boolean` | sim | `true` = disponível, `false` = indisponível (registro explícito, não apenas ausência de linha). |
| `observacao` | `text` | não | Nota livre do colaborador. |
| `created_at` | `timestamptz` | sim (default `now()`) | Primeiro registro. |
| `updated_at` | `timestamptz` | sim (default `now()`) | Última alteração (upsert, enquanto o período está `aberto`). |

- **Chave primária:** `id`.
- **Chaves estrangeiras:** `colaborador_id` → `colaboradores.id`,
  `periodo_id` → `periodos_operacao.id`, `turno_id` → `turnos.id`
  (todas `ON DELETE RESTRICT`).
- **Restrição única:** `UNIQUE (colaborador_id, periodo_id, data, turno_id)`
  — um colaborador tem no máximo **um** registro de disponibilidade por
  combinação de período/data/turno; alterar a resposta é um `UPDATE`
  (upsert), não uma nova linha. Isso também é o que permite múltiplos
  turnos no mesmo dia: a unicidade é por `turno_id`, não por `data`.
- **Regra de integridade:** `data` deve pertencer ao intervalo
  (`data_inicio`/`data_fim`) do `periodo_id` referenciado (trigger, ver
  seção 18, pois envolve outra tabela). Escrita só é permitida enquanto
  `periodos_operacao.status = 'aberto'` (trigger, seção 18, reforçado por
  RLS futura, seção 14).
- **Preservação de histórico:** disponibilidades **não são excluídas
  fisicamente** após o encerramento do período (seção 8) — permanecem
  como registro do que foi informado, mesmo sem nunca terem virado
  escala.
- **Relacionamentos:** `N—1` com `colaboradores`, `periodos_operacao` e
  `turnos`. **Sem relação com `escalas`** (seção 10).

### 3.7 `escalas`

**Finalidade:** registrar a decisão final do administrador — quem está
efetivamente alocado em qual turno, dia e período. **Entidade
independente de `disponibilidades`, sem FK entre elas** (seção 10).

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | sim (PK) | Identificador da alocação. |
| `colaborador_id` | `uuid` | sim (FK) | Quem foi escalado. |
| `periodo_id` | `uuid` | sim (FK) | Final de semana. |
| `data` | `date` | sim | Deve pertencer ao período referenciado. |
| `turno_id` | `uuid` | sim (FK) | Turno referenciado — mantém o relacionamento vivo com a configuração atual do turno. |
| `turno_nome_snapshot` | `text` | sim | **Cópia imutável** do nome do turno no momento da alocação (histórico — seção 11). |
| `turno_hora_inicio_snapshot` | `time` | sim | **Cópia imutável** do horário de início vigente na alocação. |
| `turno_hora_fim_snapshot` | `time` | sim | **Cópia imutável** do horário de fim vigente na alocação. |
| `created_by` | `uuid` | sim (FK → `perfis.id`) | Administrador que criou a alocação. |
| `created_at` | `timestamptz` | sim (default `now()`) | Data da alocação. |
| `updated_by` | `uuid` | não (FK → `perfis.id`) | Último administrador que alterou. |
| `updated_at` | `timestamptz` | sim (default `now()`) | Última alteração. |

- **Chave primária:** `id`.
- **Chaves estrangeiras:** `colaborador_id` → `colaboradores.id`,
  `periodo_id` → `periodos_operacao.id`, `turno_id` → `turnos.id`,
  `created_by`/`updated_by` → `perfis.id` (todas `ON DELETE RESTRICT`).
- **Restrição única (regra explícita do negócio):**
  `UNIQUE (colaborador_id, periodo_id, data, turno_id)` — impede que a
  mesma pessoa tenha duas alocações conflitantes no mesmo
  período/data/turno.
- **Restrição de exclusão (`EXCLUDE`) contra sobreposição de horário:**
  além da `UNIQUE` acima, uma *exclusion constraint* impede que o mesmo
  `colaborador_id` tenha dois intervalos de horário que se sobrepõem,
  mesmo em turnos **diferentes** — ver seção 6 (explicação) e seção 18
  (SQL ilustrativo).
- **Regras de integridade:**
  - `data` deve pertencer ao intervalo do `periodo_id` referenciado
    (mesmo trigger de `disponibilidades`).
  - `turno_nome_snapshot`/`turno_hora_*_snapshot` são preenchidos
    automaticamente a partir de `turnos` no momento do `INSERT`, e
    atualizados novamente se o administrador trocar o `turno_id` de uma
    escala existente (trigger, seção 18) — nunca editados manualmente.
  - **Não existe** coluna de "status de confirmação" nesta tabela: a
    confirmação é uma propriedade do **período** (seções 7/9), não de
    cada linha de escala, evitando dois lugares para a mesma informação.
- **Preservação de histórico:** escalas de períodos `confirmado`/
  `encerrado` **não são excluídas fisicamente** (seção 8); alterações
  antes da confirmação (rascunho) podem incluir remoção física da linha
  — ver ponto pendente D.19.5.
- **Relacionamentos:** `N—1` com `colaboradores`, `periodos_operacao` e
  `turnos`.

## 4. Cardinalidade dos relacionamentos

| Relacionamento | Cardinalidade |
|---|---|
| `perfis` — `colaboradores` | 1 — 1 (só para perfis com papel `colaborador`) |
| `equipes` — `colaboradores` | 1 — N (uma equipe tem vários colaboradores; colaborador tem no máximo 1 equipe) |
| `colaboradores` — `disponibilidades` | 1 — N |
| `colaboradores` — `escalas` | 1 — N |
| `periodos_operacao` — `disponibilidades` | 1 — N |
| `periodos_operacao` — `escalas` | 1 — N |
| `turnos` — `disponibilidades` | 1 — N |
| `turnos` — `escalas` | 1 — N |
| `perfis` — `periodos_operacao` (via `created_by`/`confirmed_by`) | 1 — N |
| `perfis` — `escalas` (via `created_by`/`updated_by`) | 1 — N |

Não existe relacionamento direto `N—N` nesta modelagem: toda relação
muitos-para-muitos aparente (ex.: colaborador × turno × data) é resolvida
pelas tabelas de fato `disponibilidades` e `escalas`, que funcionam como
tabelas associativas com atributos próprios (`disponivel`,
`turno_*_snapshot`, etc.) — por isso não são meras tabelas de junção
genéricas, e sim entidades com significado de negócio próprio.

## 5. Restrições de unicidade

| Tabela | Campo(s) com `UNIQUE` | Motivo |
|---|---|---|
| `perfis` | `id` (= `auth.users.id`) | 1 perfil por usuário autenticado. |
| `colaboradores` | `perfil_id` | 1 colaborador por perfil. |
| `colaboradores` | `matricula` (parcial, quando não nulo) | Matrícula é opcional; quando preenchida, deve ser única (seção 20, item 5). |
| `equipes` | `nome` | Evita equipes duplicadas. |
| `turnos` | `nome` | Evita turnos duplicados; renomear é `UPDATE`, não criar novo. |
| `periodos_operacao` | `(data_inicio, data_fim)` | Evita criar o mesmo final de semana duas vezes. |
| `disponibilidades` | `(colaborador_id, periodo_id, data, turno_id)` | 1 resposta por colaborador/período/dia/turno. |
| `escalas` | `(colaborador_id, periodo_id, data, turno_id)` | **Requisito explícito:** impede alocação conflitante da mesma pessoa no mesmo período/dia/turno. |

Nenhuma outra combinação precisa ser única — em particular, `escalas` **não**
tem unicidade por `(periodo_id, data, turno_id)` sozinho, porque vários
colaboradores diferentes podem (e devem) ocupar o mesmo turno/dia.

> A prevenção de **sobreposição de horário entre turnos diferentes** não é
> resolvida por `UNIQUE` — precisa de uma *exclusion constraint*,
> detalhada na seção 6.

## 6. Prevenção de conflito de horários entre turnos

A `UNIQUE(colaborador_id, periodo_id, data, turno_id)` (seção 5) impede
que o mesmo colaborador seja escalado duas vezes **no mesmo turno**, mas
**não impede** que ele seja escalado em **dois turnos diferentes** cujos
horários se sobrepõem no relógio — por exemplo, um turno "Tarde"
(14:00–20:00) e um turno "Extra" (18:00–22:00) cadastrados como turnos
distintos. Como os horários dos turnos são **configuráveis** (seção 11),
essa regra não pode ser fixada em código: precisa ser resolvida no banco,
a partir dos horários realmente vigentes em cada alocação.

**Estratégia adotada:**

1. Calcular, para cada linha de `escalas`, um **intervalo de tempo
   absoluto** (`tsrange`), combinando a coluna `data` com
   `turno_hora_inicio_snapshot`/`turno_hora_fim_snapshot` — os mesmos
   campos de snapshot já usados para preservar o histórico do turno
   (seção 11). O cálculo trata corretamente turnos que cruzam a
   meia-noite (ex.: "Noite" 20:00–02:00 termina no dia seguinte).
2. Aplicar uma ***exclusion constraint*** (`EXCLUDE USING gist`, com a
   extensão `btree_gist`) que impede, a nível de banco, que dois
   intervalos do **mesmo `colaborador_id`** se sobreponham —
   independentemente de estarem "no mesmo dia" ou atravessarem a virada
   da meia-noite para o dia seguinte do mesmo período.

**Por que usar o snapshot (e não um `JOIN` ao vivo com `turnos`) para esse
cálculo:**

- O snapshot já é a fonte de verdade imutável do horário efetivamente
  usado naquela alocação (seção 11); reaproveitá-lo evita duplicar a
  lógica de "horário vigente" em dois lugares.
- Se a checagem dependesse de um `JOIN` ao vivo com `turnos`, alterar o
  horário de um turno **depois** de uma escala confirmada poderia, em
  tese, tornar uma alocação já confirmada "retroativamente inválida"
  perante a constraint — o snapshot evita esse efeito colateral.
- A regra continua funcionando **mesmo que os horários dos turnos mudem
  no futuro**, porque ela nunca olha para `turnos` diretamente — apenas
  para o que foi congelado em cada `escalas` no momento da alocação.

O SQL ilustrativo completo (função de cálculo do intervalo + constraint)
está na seção 18. **Esta estratégia foi submetida a uma validação técnica
dedicada — seção 6.1 — que refinou o desenho original em dois pontos antes
de aprová-la para implementação.**

### 6.1 Validação técnica — conflito de horários

Esta seção documenta a validação técnica da estratégia da seção 6,
conduzida antes da implementação física no Supabase. Nenhum SQL foi
executado — a validação foi feita por análise manual da semântica de
`tsrange`/`EXCLUDE USING gist` e por simulação, linha a linha, dos casos
de teste abaixo.

#### Estratégia escolhida

Entre as alternativas levantadas — **(A)** um único intervalo calculado
armazenado em `escalas`, **(B)** colunas explícitas de início/fim efetivos,
**(C)** uma coluna `tsrange` gerada/mantida por trigger, ou **(D)** outra
estratégia — a mais robusta para PostgreSQL/Supabase é uma **combinação de
B e C**, e não qualquer uma isoladamente:

- **B** (colunas explícitas `inicio_efetivo`/`fim_efetivo`, tipo
  `timestamp`) para ter o horário efetivo da alocação **legível e
  consultável diretamente** (ex.: "às 20h", sem precisar desempacotar um
  `tsrange` com `lower()`/`upper()` para exibir em tela ou ordenar
  relatórios).
- **C**, não como uma terceira coluna gerada armazenando o `tsrange`, mas
  como uma **expressão dentro da própria `EXCLUDE constraint`**
  (`tsrange(inicio_efetivo, fim_efetivo, '[)')`) — pelo motivo técnico
  explicado abaixo.
- **A** (um único campo "intervalo" opaco, sem início/fim legíveis) foi
  descartada: funciona para a constraint, mas dificulta consultas comuns
  ("a que horas termina este turno?") e depuração.
- **D** (checagem manual via `SELECT` prévio + `INSERT`, em vez de uma
  constraint declarativa) foi descartada por **não ser segura sob
  concorrência**: duas transações concorrentes poderiam passar pelo
  `SELECT` de checagem antes de qualquer uma commitar o `INSERT`,
  resultando em dupla alocação. Uma *exclusion constraint* é validada
  pelo próprio índice GiST de forma atômica, eliminando essa condição de
  corrida sem precisar de `SERIALIZABLE` nem locks explícitos.

**Achado técnico importante que gerou o refinamento B+C:** o PostgreSQL
**não permite que uma coluna gerada (`GENERATED ALWAYS AS`) referencie
outra coluna gerada**. O desenho original da seção 6/18 (uma única coluna
`intervalo_ocupado tsrange` gerada diretamente de `data` +
`turno_hora_inicio_snapshot`/`turno_hora_fim_snapshot`) continua válido
por si só — mas se, adicionalmente, quiséssemos também colunas legíveis
`inicio_efetivo`/`fim_efetivo`, elas **não poderiam gerar
`intervalo_ocupado` a partir de si mesmas**. A solução: `inicio_efetivo`
e `fim_efetivo` são geradas a partir das colunas-base (`data`,
`turno_hora_inicio_snapshot`, `turno_hora_fim_snapshot`), e o `tsrange`
usado pela constraint é escrito como **expressão** dentro do próprio
`EXCLUDE` (que pode referenciar colunas geradas livremente — a restrição
do Postgres é apenas entre colunas geradas entre si). O SQL completo e
revisado está na seção 18.

#### Estrutura dos campos necessários

| Coluna | Tipo | Origem | Papel |
|---|---|---|---|
| `data` | `date` | já existente | Dia calendário da alocação. |
| `turno_hora_inicio_snapshot` / `turno_hora_fim_snapshot` | `time` | já existente (seção 11) | Horário congelado no momento da alocação — nunca reflete edições futuras em `turnos`. |
| `inicio_efetivo` | `timestamp`, gerada (`STORED`) | `data + turno_hora_inicio_snapshot` | Instante absoluto de início, legível/consultável diretamente. |
| `fim_efetivo` | `timestamp`, gerada (`STORED`) | `data + turno_hora_inicio_snapshot` + duração (considerando virada de meia-noite) | Instante absoluto de fim, legível/consultável diretamente. |
| *(sem coluna própria)* `tsrange(inicio_efetivo, fim_efetivo, '[)')` | expressão | usada apenas dentro da `EXCLUDE` | Base da checagem de sobreposição — não precisa existir como coluna. |

Nenhuma coluna nova de negócio é exposta ao usuário final — `inicio_efetivo`/
`fim_efetivo` são metadados técnicos de suporte à integridade, mas também
úteis para telas administrativas ("ordenar escalas por horário de início").

#### Tratamento da meia-noite

Duração do turno calculada apenas a partir de `time` (sem depender de
quantos turnos existem ou de qualquer duração fixa). A subtração entre
dois valores `time` já retorna nativamente um `interval` em PostgreSQL,
então a fórmula usa essa subtração diretamente, somando 24 horas apenas
quando o turno cruza a meia-noite — sem precisar converter para segundos
via `EXTRACT(EPOCH FROM ...)`/`make_interval()` (simplificação adotada na
migration física em relação a um rascunho anterior deste documento):

```
SE turno_hora_fim_snapshot <= turno_hora_inicio_snapshot
  ENTÃO duração = interval '24 horas'
                  + (turno_hora_fim_snapshot − turno_hora_inicio_snapshot)   -- cruza a meia-noite
  SENÃO duração = turno_hora_fim_snapshot − turno_hora_inicio_snapshot       -- mesmo dia
```

`fim_efetivo = inicio_efetivo + duração`. Essa fórmula não assume 3 turnos
nem durações fixas de 6 horas — funciona para qualquer par
`hora_inicio`/`hora_fim` que o administrador configurar, inclusive turnos
de 30 minutos ou de 23 horas. O único caso ambíguo é `hora_inicio =
hora_fim` (duração calculada como 24h inteiras, o que pode não ser a
intenção do administrador) — ver limitação 1 abaixo.

#### Validação dos casos de teste fornecidos

| Caso | Turno A | Turno B | Resultado esperado | Verificação |
|---|---|---|---|---|
| 1 | 15/08 Manhã 08:00–14:00 → `[15/08 08:00, 15/08 14:00)` | 15/08 Noite 20:00–02:00 → `[15/08 20:00, 16/08 02:00)` | Permitido | Intervalos não se tocam nem se cruzam → `&&` = falso. ✅ |
| 2 | 15/08 Manhã 08:00–14:00 → `[15/08 08:00, 15/08 14:00)` | 15/08 Tarde 14:00–20:00 → `[15/08 14:00, 15/08 20:00)` | Permitido (apenas encostam) | Com limite `'[)'`, o ponto `14:00` pertence só ao 2º intervalo → `&&` = falso. ✅ |
| 3 | 15/08 Manhã 08:00–14:00 → `[15/08 08:00, 15/08 14:00)` | 15/08 Outro 13:00–19:00 → `[15/08 13:00, 15/08 19:00)` | Bloqueado | Faixa comum `[13:00,14:00)` → `&&` = verdadeiro. ✅ |
| 4 | 15/08 Noite 20:00–02:00 → `[15/08 20:00, 16/08 02:00)` | 16/08 "Madrugada" 01:00–05:00 → `[16/08 01:00, 16/08 05:00)` | Bloqueado | Faixa comum `[16/08 01:00, 16/08 02:00)` → `&&` = verdadeiro, **mesmo em dias/`data` diferentes**. ✅ |
| 5 | 15/08 Noite 20:00–02:00 → `[15/08 20:00, 16/08 02:00)` | 16/08 Manhã 08:00–14:00 → `[16/08 08:00, 16/08 14:00)` | Permitido | `02:00 < 08:00`, sem faixa comum → `&&` = falso. ✅ |

Os cinco casos fornecidos são satisfeitos pela estratégia. O ponto crítico
é o uso de **instantes absolutos** (`timestamp`, combinando `data` +
hora) em vez de comparar apenas os componentes de hora — é isso que
resolve corretamente o caso 4 (comparação entre dias adjacentes do mesmo
período) sem nenhuma lógica especial de "dia seguinte" na hora da
consulta: a virada de meia-noite já foi resolvida uma vez, no cálculo de
`fim_efetivo`.

**Nota sobre escopo do período (caso 4):** a `EXCLUDE` constraint compara
**todas** as escalas do colaborador, independentemente de `periodo_id` —
ela não restringe a checagem "à mesma operação". Isso é intencional e
**mais correto** do que restringir por período: fisicamente, uma pessoa
não pode estar em dois lugares ao mesmo tempo, independentemente de qual
período administrativo cada escala foi registrada. Se dois
`periodos_operacao` tiverem datas que colidem (por erro de cadastro), a
constraint ainda protege corretamente contra a dupla alocação.

#### Comportamento esperado da `EXCLUDE constraint`

1. **Ao inserir uma escala:** o trigger de snapshot (seção 11) preenche
   `turno_nome_snapshot`/`turno_hora_*_snapshot`; as colunas geradas
   `inicio_efetivo`/`fim_efetivo` são calculadas automaticamente pelo
   próprio Postgres a partir delas; a `EXCLUDE` é então avaliada pelo
   índice GiST **na mesma instrução**, antes do commit. Se houver
   sobreposição com qualquer escala existente do mesmo colaborador, o
   `INSERT` é rejeitado com erro `exclusion_violation` (SQLSTATE
   `23P01`).
2. **Ao alterar `turno_id` de uma escala existente:** o trigger de
   snapshot dispara novamente (seção 11, já ajustado para `UPDATE OF
   turno_id`), atualizando os `*_snapshot`; como `inicio_efetivo`/
   `fim_efetivo` são gerados a partir desses snapshots, eles recalculam
   automaticamente; a `EXCLUDE` é reavaliada como em qualquer `UPDATE`.
3. **Ao alterar apenas a `data`** (mover o dia da alocação, sem trocar o
   turno): nenhum trigger adicional é necessário — `inicio_efetivo`/
   `fim_efetivo` dependem de `data` diretamente, então recalculam sozinhos
   por serem colunas geradas.
4. **Em caso de conflito**, a aplicação deve capturar o SQLSTATE
   `23P01` e apresentar uma mensagem de negócio ("este colaborador já
   está escalado em um horário conflitante"), em vez de expor o erro cru
   do Postgres — implementação futura, não coberta por este documento.
5. **Concorrência:** dois administradores tentando escalar o mesmo
   colaborador em horários conflitantes, em transações simultâneas, são
   resolvidos corretamente pelo próprio índice — um dos `INSERT`s falha,
   sem necessidade de lock explícito nem nível de isolamento especial.
6. **Operações em lote (recomendação):** para permitir que um
   administrador troque dois colaboradores de turno "ao mesmo tempo"
   dentro de uma única transação (onde um estado intermediário poderia
   parecer conflitante), recomenda-se declarar a constraint como
   `DEFERRABLE INITIALLY IMMEDIATE` (seção 18) — comportamento padrão
   idêntico ao não-diferido para operações comuns, mas com a opção de
   `SET CONSTRAINTS ... DEFERRED` dentro de uma transação específica que
   precise reordenar múltiplas escalas atomicamente.

#### Limitações importantes

1. **Turno com `hora_inicio = hora_fim`.** A fórmula de duração trata
   esse caso como um turno de 24h inteiras (cruza a meia-noite e "dá a
   volta"), o que provavelmente não é a intenção de um erro de
   cadastro. **Recomendação:** adicionar `CHECK (hora_inicio <>
   hora_fim)` em `turnos` (seção 18) para eliminar essa ambiguidade na
   origem, em vez de deixar a `EXCLUDE` lidar com um valor estranho.
2. **Duração máxima de ~24h por turno.** Como o modelo representa um
   turno por um par de `time` (não por uma duração explícita em horas),
   nenhum turno pode ultrapassar 24 horas contínuas. Turnos multi-dia
   (ex.: plantão de 36h) exigiriam um modelo diferente — fora do escopo
   da V1 e não mencionado na especificação.
3. **Não cobre "escalar alguém indisponível".** A `EXCLUDE` só impede
   conflito de horário **entre escalas do mesmo colaborador** — não
   consulta `disponibilidades`. Isso é consistente com a separação
   conceitual das duas entidades (seção 10) e com o ponto pendente
   D.19.1 (ainda em aberto, sem relação com esta validação).
4. **`btree_gist` é uma extensão, não um recurso nativo.** Precisa ser
   habilitada uma vez por projeto Supabase (`CREATE EXTENSION IF NOT
   EXISTS btree_gist;`) — é uma extensão *contrib* padrão, disponível e
   permitida em projetos Supabase hospedados, sem exigir privilégios de
   superusuário além do que o Supabase já concede por padrão para
   extensões da allowlist.
5. **Redundância parcial com a `UNIQUE` existente.** Uma vez que a
   `EXCLUDE` bloqueia qualquer sobreposição do mesmo colaborador — o que
   inclui o caso trivial de duas linhas idênticas
   (`colaborador_id, periodo_id, data, turno_id` repetidos, que geram o
   mesmo intervalo) — a `UNIQUE(colaborador_id, periodo_id, data,
   turno_id)` da seção 5 torna-se, na prática, redundante para *prevenir*
   duplicidade exata. **Decisão: manter as duas mesmo assim**, porque
   `unique_violation` (`23505`) e `exclusion_violation` (`23P01`) são
   SQLSTATEs diferentes, permitindo que a aplicação distinga "você já
   tem exatamente esta alocação" de "isto conflita com outro turno" — uma
   diferença de UX que vale o custo desprezível de manter um índice
   único adicional. Ver também seção 16 (análise de redundância).
6. **Pressupõe hora local única (sem fuso horário).** `inicio_efetivo`/
   `fim_efetivo` usam `timestamp` (sem fuso), porque os turnos são
   definidos por horário de relógio local da operação ("20h" significa
   20h no local, não um instante UTC fixo). Isso é correto para uma
   operação de um único local/fuso, que é o cenário da especificação.
   Se o sistema um dia precisar operar em múltiplos fusos horários
   simultâneos, este ponto precisaria ser revisitado (provavelmente com
   `tstzrange` e um fuso associado a cada período/local) — não é uma
   necessidade da V1.
7. **Não valida decisões de negócio, só coerência física de horário.**
   A constraint não sabe (nem deveria saber) se a alocação é "razoável"
   (ex.: descanso mínimo entre turnos) — apenas que dois intervalos não
   se sobrepõem no tempo. Regras de descanso mínimo, se um dia
   necessárias, seriam uma regra de negócio adicional, não coberta aqui.

#### Como isso será implementado posteriormente na migration

Nenhuma migration foi criada nesta etapa. Quando a implementação física
ocorrer, a migration deverá, nesta ordem:

1. `CREATE EXTENSION IF NOT EXISTS btree_gist;`
2. Adicionar `CHECK (hora_inicio <> hora_fim)` em `turnos`.
3. Adicionar as colunas geradas `inicio_efetivo`/`fim_efetivo` em
   `escalas` (dependem apenas de `data` e das colunas `*_snapshot`, já
   existentes).
4. Adicionar a `EXCLUDE USING gist (colaborador_id WITH =,
   tsrange(inicio_efetivo, fim_efetivo, '[)') WITH &&) DEFERRABLE
   INITIALLY IMMEDIATE`.
5. Testar os 5 casos desta seção com dados reais em ambiente de teste
   antes de aplicar em produção (ponto pendente D.19.6, com escopo
   reduzido após esta validação — falta apenas a execução real, a
   análise lógica já foi concluída aqui).

**Veredito desta validação → "APROVADO PARA IMPLEMENTAÇÃO"** (com o
desenho refinado acima, que substitui o rascunho original da seção 6 nos
pontos indicados). O SQL completo e já atualizado está na seção 18.

## 7. O que pode ser alterado após a confirmação da escala

| Tabela | Antes da confirmação (`aberto`/`em_organizacao`) | Após confirmação (`confirmado`/`encerrado`) |
|---|---|---|
| `disponibilidades` | Editável pelo colaborador enquanto `status = 'aberto'`; após virar `em_organizacao`, só leitura para o colaborador (regra de aplicação/RLS). | Somente leitura para todos — é registro histórico da intenção informada. |
| `escalas` | Totalmente editável pelo administrador (adicionar, remover, substituir, mudar turno/dia). | Continua editável **apenas pelo administrador** (a especificação, seção 9, exige que ele mantenha acesso completo); colaboradores nunca tiveram permissão de escrita aqui, então nada muda tecnicamente para eles. Edição comum via fluxo normal de tela deve ser desencorajada pela aplicação uma vez confirmado — qualquer correção deveria, futuramente, passar por um fluxo explícito de reabertura (ver seção 19, ponto D.19.3). |
| `periodos_operacao` | Status avança apenas por ação do administrador. | Status pode avançar para `encerrado`; alteração de `data_inicio`/`data_fim` não deve ocorrer depois de `confirmado` (regra de aplicação). `confirmed_at`/`confirmed_by` tornam-se imutáveis na prática (nenhum fluxo da V1 os reescreve). |
| `equipes`, `turnos`, `colaboradores` | Sempre editáveis pelo administrador, independentemente do status de qualquer período — são cadastros, não dados do período. |

## 8. Preservação de histórico

Regras explícitas de não destruição de histórico operacional:

1. **Períodos encerrados não devem ser excluídos.** `periodos_operacao`
   nunca sofre `DELETE` — inclusive (e principalmente) depois de
   `encerrado`. É o próprio registro do histórico de cada final de
   semana.
2. **Disponibilidades históricas não devem ser destruídas
   desnecessariamente.** Uma vez que o período sai de `aberto`, as
   linhas de `disponibilidades` daquele período nunca são apagadas — elas
   documentam o que foi informado, independentemente de terem virado
   escala ou não.
3. **Escalas históricas não devem ser destruídas desnecessariamente.**
   A partir do momento em que o período é `confirmado` (e
   permanentemente depois de `encerrado`), as linhas de `escalas` não
   sofrem `DELETE` físico — apenas os campos de auditoria (`updated_by`/
   `updated_at`) registram eventuais correções administrativas
   posteriores. Remoções físicas só são aceitáveis **antes** da
   confirmação, enquanto a escala ainda é rascunho (ver ponto pendente
   D.19.5).
4. **Colaboradores não devem ser fisicamente excluídos quando possuírem
   histórico.** Garantido em nível de banco: a FK
   `disponibilidades.colaborador_id`/`escalas.colaborador_id` →
   `colaboradores.id` é `ON DELETE RESTRICT`, então o `DELETE` de um
   colaborador com qualquer disponibilidade ou escala associada é
   recusado pelo PostgreSQL. O caminho correto é `colaboradores.ativo =
   false`.
5. **Equipes não devem ser fisicamente excluídas quando possuírem
   histórico.** Mesma lógica: a FK `colaboradores.equipe_id` →
   `equipes.id` é `ON DELETE RESTRICT`. Uma equipe só pode ser
   fisicamente excluída se **nunca** teve colaborador algum vinculado; do
   contrário, o caminho é `equipes.ativo = false`.

**Exceção deliberada** (registros que podem ser excluídos sem qualquer
perda de histórico, por nunca terem gerado dado real): um `turno` ou uma
`equipe` criados por engano e nunca referenciados por nenhuma
`disponibilidade`/`escala`/`colaborador` podem ser removidos fisicamente
— a própria ausência de referências (nenhuma FK apontando para eles)
garante que não há histórico a preservar.

O campo `turno_nome_snapshot`/`turno_hora_*_snapshot` em `escalas`
(seção 11) é o que garante que, mesmo que um turno seja renomeado ou
tenha seu horário alterado no futuro, o histórico de uma escala já
confirmada continue mostrando o horário **real** em que a pessoa
trabalhou naquele dia — sem isso, a regra 3 acima ficaria frágil, pois a
escala "não seria destruída", mas exibiria dados incorretos.

## 9. Representação dos status do período e confirmação persistente

```sql
-- Ilustrativo — não executado.
CREATE TYPE status_periodo AS ENUM (
  'aberto',
  'em_organizacao',
  'confirmado',
  'encerrado'
);
```

Transições esperadas (validadas por trigger, seção 18 — não implementadas
agora):

```
aberto ──────────▶ em_organizacao ──────────▶ confirmado ──────────▶ encerrado
```

- Não há caminho de volta nesta V1 (nenhuma transição regressiva é
  implementada). A "reabertura" de uma escala confirmada é reconhecida
  como necessidade futura na especificação (seção 9 da especificação),
  mas deliberadamente **não modelada agora** — ver ponto D.19.3.

**Confirmação persistente:** `periodos_operacao` guarda três informações
que, juntas, tornam a confirmação uma decisão persistente e consultável
a qualquer momento, sem ambiguidade:

| Informação exigida | Campo |
|---|---|
| Status | `status` (inclui `confirmado`, mas também as demais fases do ciclo de vida) |
| Data/hora da confirmação | `confirmed_at` |
| Administrador responsável pela confirmação | `confirmed_by` |

Com isso, "o sistema conseguir identificar que aquela escala está
confirmada" (requisito desta revisão) se resume a uma leitura simples:
`periodos_operacao.status = 'confirmado'` (ou `'encerrado'`) para o
`periodo_id` da escala em questão — sem precisar de nenhuma coluna
adicional em `escalas` (ver justificativa de não duplicar esse dado na
seção 15). "Impedir alterações comuns feitas por colaboradores" depois da
confirmação é, então, uma regra de autorização (RLS, seção 14) que
consulta esse mesmo status — colaboradores nunca têm permissão de escrita
em `escalas` de qualquer forma, então o principal efeito prático da
confirmação é **liberar leitura** da própria escala para o colaborador
(seção 7).

## 10. Separação técnica entre disponibilidade e escala

- São **duas tabelas físicas distintas** (`disponibilidades` e `escalas`),
  sem herança nem tabela compartilhada.
- **Não existe FK entre elas — nem obrigatória, nem opcional.** `escalas`
  não possui nenhuma coluna que referencie `disponibilidades.id`. A
  correlação entre "o que a pessoa disse" e "o que foi decidido" é feita,
  quando necessário, por uma consulta que casa as chaves de negócio em
  comum: `colaborador_id + periodo_id + data + turno_id`.
- Isso torna impossível, a nível de modelo, confundir uma resposta de
  disponibilidade com uma alocação de escala — são linhas em tabelas
  diferentes, com colunas diferentes (`disponivel` de um lado,
  `turno_*_snapshot` e `created_by` do outro).
- Consequência prática: o administrador **pode** escalar alguém que não
  respondeu ou que marcou indisponível — o modelo não impede isso (a
  especificação não define essa regra como bloqueio; ver ponto D.19.1
  para decisão futura sobre se isso deve gerar um alerta).

## 11. Turnos configuráveis e histórico do turno na escala

**Configurabilidade:** `turnos` é uma tabela normal de cadastro (`nome`,
`hora_inicio`, `hora_fim`), editável pelo administrador via `UPDATE` — sem
exigir deploy ou alteração de código para mudar nome/horário.

**Histórico do turno na escala (ajuste desta revisão):** uma alteração
futura no cadastro de um turno **não pode** alterar a informação
histórica de uma escala já criada. A estratégia adotada mantém os dois
objetivos ao mesmo tempo — configurabilidade e imutabilidade histórica —
por meio de duas colunas com papéis diferentes em `escalas`:

| Coluna | Papel |
|---|---|
| `turno_id` | Mantém o **relacionamento vivo** com o turno (útil para navegação/filtro, e para saber "qual turno, mesmo que renomeado, gerou esta escala"). |
| `turno_nome_snapshot`, `turno_hora_inicio_snapshot`, `turno_hora_fim_snapshot` | **Cópia congelada** do nome e horário **exatamente como estavam no momento em que a escala foi criada** (ou teve o turno alterado). Nunca são reescritos por uma edição posterior em `turnos`. |

- `disponibilidades.turno_id` **não** tem snapshot — permanece uma FK
  simples, sempre refletindo a configuração **atual** do turno. Isso é
  intencional: disponibilidade é informação de curto prazo, relevante
  apenas enquanto o período está `aberto`; ela nunca precisa "lembrar" um
  horário antigo.
- Em `escalas`, o preenchimento do snapshot é automático (trigger, seção
  18): ao inserir uma escala, ou ao trocar o `turno_id` de uma escala
  existente, o trigger copia `nome`/`hora_inicio`/`hora_fim` de `turnos`
  para as colunas `*_snapshot` naquele instante. Fora desse momento, as
  colunas `*_snapshot` não são alteradas por mais nenhuma outra operação
  — nem mesmo se o turno original for renomeado ou tiver o horário
  mudado semanas depois.
- Esse mesmo snapshot é reaproveitado pela regra de prevenção de conflito
  de horários (seção 6), evitando duplicar a noção de "horário efetivo
  de uma escala" em dois lugares do esquema.

## 12. Auditoria (`created_at` / `updated_at`)

Todos os registros principais recebem `created_at` (preenchido no
`INSERT`) e `updated_at` (mantido por uma única função de trigger
genérica, reaproveitada em todas as tabelas — ver seção 18, para evitar
repetir a mesma lógica sete vezes).

| Tabela | `created_at` | `updated_at` | O que dispara a atualização |
|---|---|---|---|
| `perfis` | sim | sim | Alterar `nome_completo`, `papel` ou `ativo`. |
| `colaboradores` | sim | sim | Alterar `equipe_id`, `telefone`, `matricula` ou `ativo`. |
| `equipes` | sim | sim | Renomear ou alternar `ativo`. |
| `turnos` | sim | sim | Renomear ou alterar `hora_inicio`/`hora_fim`/`ativo`. |
| `periodos_operacao` | sim | sim | Alterar `status`/`observacoes`. A confirmação em si tem seu próprio par dedicado (`confirmed_at`/`confirmed_by`, seção 9), por ser um evento de negócio distinto de uma edição genérica. |
| `disponibilidades` | sim | sim | Upsert de resposta do colaborador enquanto o período está `aberto`. |
| `escalas` | sim | sim | Qualquer ajuste administrativo na alocação. Além disso, `created_by`/`updated_by` (→ `perfis.id`) registram **qual** administrador fez cada ação — necessário porque mais de um administrador pode montar/ajustar a mesma escala. |

`created_by`/`updated_by` (rastro de **autor**, além do carimbo de
**tempo**) só existem onde havia exigência real de rastreabilidade
administrativa: `periodos_operacao` (`created_by`, `confirmed_by`) e
`escalas` (`created_by`, `updated_by`). As demais tabelas (`perfis`,
`colaboradores`, `equipes`, `turnos`, `disponibilidades`) não recebem
colunas de autor — não há requisito da especificação para "quem
cadastrou este turno", e adicioná-las inflaria o esquema sem uso real
(seção 15).

## 13. Preparação para funcionalidades futuras

A modelagem não implementa, mas **não bloqueia**, os itens da seção 15 da
especificação:

| Funcionalidade futura | Como o modelo já comporta, sem implementá-la agora |
|---|---|
| Geração automática de escala / distribuição por equipe | `colaboradores.equipe_id` e `disponibilidades` já existem; um algoritmo futuro apenas passaria a **inserir** linhas em `escalas`, sem mudança de esquema. |
| Cálculo de cobertura / alerta de déficit | Pode ser calculado por consulta agregando `escalas` por `(periodo_id, data, turno_id)`; não requer nova tabela. |
| Exportação / relatórios | Consultas de leitura sobre o esquema existente; não requer nova tabela. |
| Notificações / mensagens automáticas | Pode ser implementado como serviço externo que lê `escalas` e `colaboradores.telefone`; não requer alteração no modelo atual. |
| Auditoria detalhada | Já há `created_by`/`updated_by`/`created_at`/`updated_at` em `escalas` e `created_by`/`confirmed_by`/`created_at`/`updated_at` em `periodos_operacao` (seção 12) como base mínima; um log completo de todas as mudanças (tabela de auditoria genérica) pode ser adicionado depois **sem** alterar as tabelas atuais. |

Nenhuma tabela "vazia" foi criada só para essas funcionalidades — elas
serão modeladas quando forem de fato implementadas.

## 14. Segurança (Supabase Auth + RLS futuro)

**Não implementado agora.** Requisitos documentados para quando o Supabase
Auth e o RLS forem habilitados:

- `perfis.id` é o mesmo `uuid` de `auth.users.id`, o que permite políticas
  RLS baseadas em `auth.uid()` sem tabela de mapeamento adicional.
- **Colaborador:**
  - `SELECT` em `disponibilidades`/`escalas` restrito a linhas onde
    `colaborador_id` corresponde ao `colaboradores.id` do próprio
    `auth.uid()`.
  - `INSERT`/`UPDATE` em `disponibilidades` restrito às próprias linhas, e
    somente quando `periodos_operacao.status = 'aberto'`.
  - Nenhuma permissão de escrita em `escalas`, `equipes`, `turnos`,
    `periodos_operacao` ou em `colaboradores`/`perfis` de terceiros.
  - `SELECT` em `escalas` só deve ser permitido para o próprio
    colaborador quando `periodos_operacao.status IN ('confirmado',
    'encerrado')`.
- **Administrador:**
  - Acesso completo de leitura e escrita em todas as tabelas do domínio.
- Todas as políticas dependem de `perfis.papel`, consultado via uma
  função auxiliar (ex.: `is_admin()`), a ser definida na etapa de
  implementação de RLS — não criada agora.

## 15. Análise de redundância

Tabelas/relacionamentos/colunas **considerados e descartados** para
manter o modelo enxuto:

- **Tabela `dias`** (para representar sábado/domingo como entidade):
  descartada — `data` como coluna `date` em `disponibilidades`/`escalas`
  já é suficiente; uma tabela de dias não agregaria regra de negócio
  própria.
- **Tabela de junção `colaboradores_equipes` (N—N)**: descartada — a
  especificação define que "cada colaborador poderá pertencer a **uma**
  equipe" (singular), então uma FK simples (`colaboradores.equipe_id`)
  já resolve; uma tabela N—N adicionaria complexidade sem requisito que a
  justifique hoje.
- **Coluna/tabela de status em `escalas`**: descartada — o status
  "confirmado" já existe em `periodos_operacao.status` e se aplica a
  todas as escalas daquele período; duplicar esse campo em cada linha de
  `escalas` criaria risco de inconsistência (uma escala "confirmada" e
  outra "não confirmada" dentro do mesmo período confirmado). Ver seção 9.
- **FK de `escalas` para `disponibilidades`**: descartada
  deliberadamente — ver seção 10; a especificação exige que as duas
  entidades sejam conceitualmente independentes, e mesmo uma FK
  *opcional* (nullable) acoplaria as duas tabelas sem necessidade.
- **Tabela `usuarios` separada de `perfis`**: descartada — `auth.users`
  (gerenciada pelo Supabase) já cumpre esse papel; `perfis` é a extensão
  necessária apenas para guardar `papel` e `nome_completo`, evitando
  duplicar o que o Supabase Auth já fornece.
- **Denormalizar `equipe_id` em `disponibilidades`/`escalas`**: descartada
  — a equipe do colaborador já é acessível via JOIN com `colaboradores`;
  copiá-la também não tem justificativa de histórico (diferente do
  horário do turno, a equipe atual não é uma informação "congelada no
  tempo" pela especificação).
- **Tabela dedicada para registrar conflitos de horário**: descartada —
  resolvida com uma *exclusion constraint* (`EXCLUDE USING gist`)
  diretamente em `escalas` (seção 6), sem necessidade de tabela auxiliar
  nem de lógica de verificação na aplicação.
- **Colunas `created_by`/`updated_by` em todas as tabelas**: descartada —
  adicionar autor em `perfis`, `colaboradores`, `equipes`, `turnos` e
  `disponibilidades` não tem requisito da especificação e infla o
  esquema sem uso real; mantidas apenas em `periodos_operacao` e
  `escalas` (seção 12), onde há necessidade concreta de saber qual
  administrador agiu.
- **Sete funções de trigger distintas para manter `updated_at`**:
  descartada — uma única função `set_updated_at()` (seção 18) é aplicada
  às sete tabelas, evitando repetir a mesma lógica sete vezes.
- **Remover a `UNIQUE(colaborador_id, periodo_id, data, turno_id)` de
  `escalas` por ela ser coberta pela `EXCLUDE` de sobreposição de
  horário**: avaliada e **descartada** — a `EXCLUDE` (seção 6.1) de fato
  também bloqueia o caso de duplicidade exata que a `UNIQUE` cobre, mas
  as duas constraints falham com SQLSTATEs diferentes
  (`unique_violation` vs. `exclusion_violation`), o que permite à
  aplicação distinguir "duplicata exata" de "conflito com outro turno" —
  uma diferença de mensagem ao usuário que justifica manter ambas.

## 16. A. Diagrama textual dos relacionamentos

```
auth.users (Supabase Auth)
   │  1:1
   ▼
perfis (papel: administrador | colaborador)
   │  1:1 (somente quando papel = colaborador)
   ▼
colaboradores  ◀──1:N── equipes
      │  \
 1:N  │   \  1:N
      ▼    ▼
disponibilidades   escalas
      │                  │
N:1   │                  │   N:1
      ▼                  ▼
   periodos_operacao (1:N para ambas)
      │                  │
N:1   │                  │   N:1
      ▼                  ▼
      turnos (1:N para ambas)

perfis ──1:N (created_by / confirmed_by)──▶ periodos_operacao
perfis ──1:N (created_by / updated_by)──▶ escalas

escalas ──EXCLUDE (mesmo colaborador_id, horários sobrepostos)── escalas
   (auto-relacionamento de integridade, não uma FK — seção 6)
```

Leitura: `disponibilidades` e `escalas` são as duas tabelas centrais, cada
uma ligando `colaboradores` × `periodos_operacao` × `turnos`, mas **sem
relação direta entre si**. A linha tracejada conceitual no final do
diagrama representa a restrição de não sobreposição de horários — não é
um relacionamento de chave estrangeira, e sim uma regra de integridade
que compara linhas de `escalas` entre si.

## 17. B. Exemplo de dados fictícios

**Período:**

| id | data_inicio | data_fim | status | confirmed_at | confirmed_by |
|---|---|---|---|---|---|
| `periodo-001` | 2026-08-15 | 2026-08-16 | `confirmado` | 2026-08-13 18:00 | `perfil-admin-maria` |

**Turnos (cadastro global, reutilizado em qualquer período):**

| id | nome | hora_inicio | hora_fim |
|---|---|---|---|
| `turno-manha` | Manhã | 08:00 | 14:00 |
| `turno-tarde` | Tarde | 14:00 | 20:00 |
| `turno-noite` | Noite | 20:00 | 02:00 |

**Equipe e colaborador:**

| id | nome |
|---|---|
| `equipe-a` | Equipe A |

| id | perfil_id | equipe_id | matricula | ativo |
|---|---|---|---|---|
| `colab-joao` | `perfil-joao` | `equipe-a` | `NULL` | `true` |

**Disponibilidades informadas por João para este período:**

| colaborador_id | periodo_id | data | turno_id | disponivel |
|---|---|---|---|---|
| `colab-joao` | `periodo-001` | 2026-08-15 | `turno-manha` | `false` |
| `colab-joao` | `periodo-001` | 2026-08-15 | `turno-tarde` | `false` |
| `colab-joao` | `periodo-001` | 2026-08-15 | `turno-noite` | `true` |
| `colab-joao` | `periodo-001` | 2026-08-16 | `turno-manha` | `false` |
| `colab-joao` | `periodo-001` | 2026-08-16 | `turno-tarde` | `true` |
| `colab-joao` | `periodo-001` | 2026-08-16 | `turno-noite` | `false` |

**Escala decidida pelo administrador (apenas sábado à noite, conforme o
exemplo da especificação — João "não trabalha" no domingo):**

| colaborador_id | periodo_id | data | turno_id | turno_nome_snapshot | turno_hora_inicio_snapshot | turno_hora_fim_snapshot | created_by |
|---|---|---|---|---|---|---|---|
| `colab-joao` | `periodo-001` | 2026-08-15 | `turno-noite` | Noite | 20:00 | 02:00 | `perfil-admin-maria` |

Isso corresponde exatamente ao exemplo textual da especificação (seção 10
da especificação): "Sábado — Noite — 20:00–02:00" e "Domingo — Não
trabalha" (ausência de linha em `escalas` para 2026-08-16 = não escalado
nesse dia).

**Ilustração da regra de conflito de horário (seção 6):** se um segundo
turno "Extra" (18:00–22:00) existisse e o administrador tentasse escalar
João também nesse turno em 2026-08-15, a *exclusion constraint* rejeitaria
a operação, pois o intervalo `[15/08 18:00, 15/08 22:00)` se sobrepõe ao
intervalo já ocupado `[15/08 20:00, 16/08 02:00)` do turno "Noite" — mesmo
sendo `turno_id` diferente, o que a `UNIQUE` sozinha não pegaria.

## 18. C. Regras de integridade a implementar no PostgreSQL

> Ilustrativo — nenhum destes comandos foi executado.

**Restrições declarativas (`CHECK`, `UNIQUE`, `FOREIGN KEY`):**

```sql
ALTER TABLE periodos_operacao
  ADD CONSTRAINT chk_periodo_datas CHECK (data_fim >= data_inicio),
  ADD CONSTRAINT uq_periodo_datas UNIQUE (data_inicio, data_fim);

ALTER TABLE turnos
  ADD CONSTRAINT uq_turno_nome UNIQUE (nome);

ALTER TABLE colaboradores
  ADD CONSTRAINT uq_colaborador_perfil UNIQUE (perfil_id);
-- matrícula opcional, única apenas quando informada:
CREATE UNIQUE INDEX uq_colaborador_matricula
  ON colaboradores (matricula) WHERE matricula IS NOT NULL;

ALTER TABLE disponibilidades
  ADD CONSTRAINT uq_disponibilidade UNIQUE (colaborador_id, periodo_id, data, turno_id);

ALTER TABLE escalas
  ADD CONSTRAINT uq_escala_sem_conflito UNIQUE (colaborador_id, periodo_id, data, turno_id);
```

**Auditoria — `updated_at` genérico (uma função, sete gatilhos):**

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_updated_at_perfis            BEFORE UPDATE ON perfis            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_at_colaboradores     BEFORE UPDATE ON colaboradores     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_at_equipes           BEFORE UPDATE ON equipes           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_at_turnos            BEFORE UPDATE ON turnos            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_at_periodos_operacao BEFORE UPDATE ON periodos_operacao FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_at_disponibilidades  BEFORE UPDATE ON disponibilidades  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_updated_at_escalas           BEFORE UPDATE ON escalas           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Regras que dependem de outra tabela (exigem `TRIGGER`, pois `CHECK` do
PostgreSQL não pode consultar outras tabelas):**

```sql
-- Garante que a "data" de disponibilidades/escalas pertence ao período referenciado.
CREATE OR REPLACE FUNCTION valida_data_pertence_ao_periodo()
RETURNS trigger AS $$
DECLARE
  p RECORD;
BEGIN
  SELECT data_inicio, data_fim INTO p
  FROM periodos_operacao WHERE id = NEW.periodo_id;

  IF NEW.data NOT IN (p.data_inicio, p.data_fim) THEN
    RAISE EXCEPTION 'A data % não pertence ao período %', NEW.data, NEW.periodo_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_valida_data_disponibilidade
  BEFORE INSERT OR UPDATE ON disponibilidades
  FOR EACH ROW EXECUTE FUNCTION valida_data_pertence_ao_periodo();

CREATE TRIGGER trg_valida_data_escala
  BEFORE INSERT OR UPDATE ON escalas
  FOR EACH ROW EXECUTE FUNCTION valida_data_pertence_ao_periodo();
```

```sql
-- Preenche/atualiza o snapshot do turno ao criar a escala ou ao trocar o turno_id.
CREATE OR REPLACE FUNCTION preenche_snapshot_turno()
RETURNS trigger AS $$
BEGIN
  SELECT nome, hora_inicio, hora_fim
    INTO NEW.turno_nome_snapshot, NEW.turno_hora_inicio_snapshot, NEW.turno_hora_fim_snapshot
    FROM turnos WHERE id = NEW.turno_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_snapshot_turno
  BEFORE INSERT OR UPDATE OF turno_id ON escalas
  FOR EACH ROW EXECUTE FUNCTION preenche_snapshot_turno();
```

```sql
-- Impede alterar disponibilidade fora do status "aberto".
CREATE OR REPLACE FUNCTION bloqueia_disponibilidade_fora_do_prazo()
RETURNS trigger AS $$
DECLARE
  status_atual status_periodo;
BEGIN
  SELECT status INTO status_atual FROM periodos_operacao WHERE id = NEW.periodo_id;
  IF status_atual <> 'aberto' THEN
    RAISE EXCEPTION 'Período % não está aberto para disponibilidade', NEW.periodo_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloqueia_disponibilidade
  BEFORE INSERT OR UPDATE ON disponibilidades
  FOR EACH ROW EXECUTE FUNCTION bloqueia_disponibilidade_fora_do_prazo();
```

```sql
-- Garante que só existe linha em "colaboradores" para perfis com papel = 'colaborador'.
CREATE OR REPLACE FUNCTION valida_perfil_do_colaborador()
RETURNS trigger AS $$
DECLARE
  papel_do_perfil papel_usuario;
BEGIN
  SELECT papel INTO papel_do_perfil FROM perfis WHERE id = NEW.perfil_id;
  IF papel_do_perfil <> 'colaborador' THEN
    RAISE EXCEPTION 'Perfil % não tem papel colaborador', NEW.perfil_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_valida_perfil_colaborador
  BEFORE INSERT OR UPDATE ON colaboradores
  FOR EACH ROW EXECUTE FUNCTION valida_perfil_do_colaborador();
```

```sql
-- Garante que confirmed_at/confirmed_by só existem (e são obrigatórios) quando o status é confirmado/encerrado.
CREATE OR REPLACE FUNCTION valida_confirmacao_periodo()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('confirmado', 'encerrado') THEN
    IF NEW.confirmed_at IS NULL OR NEW.confirmed_by IS NULL THEN
      RAISE EXCEPTION 'confirmed_at e confirmed_by são obrigatórios para status %', NEW.status;
    END IF;
  ELSE
    IF NEW.confirmed_at IS NOT NULL OR NEW.confirmed_by IS NOT NULL THEN
      RAISE EXCEPTION 'confirmed_at/confirmed_by só podem ser preenchidos em confirmado/encerrado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_valida_confirmacao_periodo
  BEFORE INSERT OR UPDATE ON periodos_operacao
  FOR EACH ROW EXECUTE FUNCTION valida_confirmacao_periodo();
```

**Prevenção de sobreposição de horário (desenho refinado após a validação
técnica da seção 6.1):**

```sql
-- Extensão necessária para combinar igualdade (uuid) e sobreposição (tsrange)
-- numa única exclusion constraint. Disponível como extensão padrão no Supabase.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Elimina a ambiguidade de um turno com hora_inicio = hora_fim
-- (seção 6.1, limitação 1) antes que ela chegue à checagem de horário.
ALTER TABLE turnos
  ADD CONSTRAINT chk_turno_horario_nao_degenerado CHECK (hora_inicio <> hora_fim);

-- Início e fim efetivos (instantes absolutos), gerados a partir do
-- snapshot imutável do turno — nunca recalculados por edição futura em
-- "turnos". Duas colunas geradas independentes (não uma referenciando a
-- outra), pois o PostgreSQL não permite que uma coluna gerada referencie
-- outra coluna gerada (seção 6.1).
ALTER TABLE escalas
  ADD COLUMN inicio_efetivo timestamp
    GENERATED ALWAYS AS (data + turno_hora_inicio_snapshot) STORED,
  ADD COLUMN fim_efetivo timestamp
    GENERATED ALWAYS AS (
      (data + turno_hora_inicio_snapshot)
        + CASE
            WHEN turno_hora_fim_snapshot <= turno_hora_inicio_snapshot
              THEN interval '24 hours' + (turno_hora_fim_snapshot - turno_hora_inicio_snapshot)
            ELSE (turno_hora_fim_snapshot - turno_hora_inicio_snapshot)
          END
    ) STORED;

-- Impede que o mesmo colaborador tenha dois intervalos sobrepostos,
-- mesmo em turnos diferentes e mesmo atravessando dias do período.
-- O tsrange é uma EXPRESSÃO da constraint (não uma 3ª coluna gerada),
-- o que contorna a restrição citada acima.
ALTER TABLE escalas
  ADD CONSTRAINT excl_escala_sem_sobreposicao
  EXCLUDE USING gist (
    colaborador_id WITH =,
    tsrange(inicio_efetivo, fim_efetivo, '[)') WITH &&
  )
  DEFERRABLE INITIALLY IMMEDIATE;
```

> Desenho validado tecnicamente na seção 6.1 (estratégia B+C, casos de
> teste 1–5 verificados manualmente). Falta apenas a execução real deste
> SQL em ambiente de teste antes da implementação física — ver ponto
> D.19.6.

**`ON DELETE RESTRICT`** (padrão implícito do PostgreSQL quando nenhuma
ação é especificada) em **todas** as chaves estrangeiras de
`disponibilidades`, `escalas` e `colaboradores` — garante, a nível de
banco, que não é possível excluir um colaborador, turno, equipe ou
período que já tenha dado histórico associado (seção 8).

## 19. D. Pontos que precisam de decisão antes da implementação física

1. **Escalar alguém indisponível ou sem resposta:** o modelo permite (não
   há FK/CHECK que impeça), mas é preciso decidir se a interface deve
   exibir um aviso/confirmação extra nesse caso.
2. **Administrador que também é colaborador:** hoje o modelo assume que
   `colaboradores` só existe para `perfis.papel = 'colaborador'`. Se um
   administrador também puder ser escalado, é preciso decidir se ele
   também terá uma linha em `colaboradores`.
3. **Reabertura de escala confirmada:** a especificação prevê essa
   necessidade futura, mas não define a regra. Antes de implementar, será
   preciso decidir: reabrir volta o período para `em_organizacao`? As
   escalas antigas são mantidas e sobrescritas, ou versionadas
   (mantendo o registro anterior para auditoria)?
4. **Período sempre sábado+domingo:** o modelo assume exatamente duas
   datas por período (`data_inicio`/`data_fim`, ambas usadas na validação
   por trigger). Se um "final de semana" puder incluir uma véspera de
   feriado (3 dias), a regra de validação de `data` precisa ser
   generalizada de "igual a uma das duas datas" para "dentro do
   intervalo".
5. **Exclusão física de escala em rascunho:** antes da confirmação,
   "remover colaborador de um turno" (seção 8 da especificação) foi
   modelado como `DELETE` físico da linha em `escalas`. Avaliar se, mesmo
   em rascunho, a empresa prefere manter um rastro (soft delete) dessas
   remoções para fins de auditoria interna.
6. **Execução real da exclusion constraint de sobreposição de horário:**
   a análise lógica dos 5 casos de teste já foi concluída na validação
   técnica da seção 6.1 (aprovada). Falta apenas **rodar o SQL de fato**
   em um ambiente de teste Supabase (não feito neste documento, por
   instrução explícita de não executar SQL) para confirmar que o
   PostgreSQL aceita a combinação de colunas geradas + `EXCLUDE USING
   gist` como esperado, e que a extensão `btree_gist` está disponível no
   projeto Supabase de destino.

> Removidos desta lista (já decididos nesta revisão): "turnos com
> horários sobrepostos" — resolvido na seção 6 com *exclusion
> constraint*; e "matrícula obrigatória" — decidido como **opcional**
> (seção 3.2/5).

## 20. Resumo das alterações desta revisão

1. **Histórico dos turnos:** mantido o mecanismo de snapshot em `escalas`
   (`turno_nome_snapshot`, `turno_hora_inicio_snapshot`,
   `turno_hora_fim_snapshot`), agora com o trigger de preenchimento
   também cobrindo `UPDATE OF turno_id` (antes só cobria `INSERT`) —
   seção 11.
2. **Conflito de horários:** nova regra de integridade (seção 6),
   implementada como *exclusion constraint* (`EXCLUDE USING gist` +
   `btree_gist`) sobre um intervalo de tempo calculado a partir do
   snapshot de horário — impede sobreposição mesmo entre turnos
   diferentes e mesmo com horários configuráveis.
3. **Confirmação:** campos renomeados/confirmados como `confirmed_at` e
   `confirmed_by` em `periodos_operacao`, agora com um trigger que os
   torna obrigatórios exatamente quando `status IN ('confirmado',
   'encerrado')` e proibidos fora disso — seção 9.
4. **Auditoria:** `created_at`/`updated_at` padronizados (em inglês, por
   convenção de metadado técnico) em todas as sete tabelas, mantidos por
   uma única função de trigger reaproveitada; `created_by`/`updated_by`
   mantidos apenas em `periodos_operacao` e `escalas`, onde há
   necessidade real de rastrear o autor — seção 12.
5. **Colaboradores:** matrícula confirmada como opcional, única quando
   preenchida (índice único parcial); indicador `ativo` mantido — seção
   3.2/5.
6. **Equipes:** indicador `ativo` mantido; reforçada a proibição de
   exclusão física quando há histórico (via `ON DELETE RESTRICT`) — seção
   3.3/8.
7. **Histórico:** seção 8 reescrita como lista explícita das cinco regras
   pedidas (períodos, disponibilidades, escalas, colaboradores, equipes).
8. **Disponibilidade independente da escala:** reafirmado — sem FK, nem
   obrigatória nem opcional, entre `escalas` e `disponibilidades` — seção
   10.
9. **Integridade:** todas as constraints e triggers foram revisadas à luz
   dos ajustes acima (seção 18); dois triggers deixavam de existir apesar
   de prometidos no texto (validação de papel do colaborador e validação
   de `confirmed_at`/`confirmed_by`) — ambos foram adicionados.
10. **Diagrama:** atualizado com os novos nomes de campo (`created_by`,
    `confirmed_by`, `updated_by`) e uma anotação sobre a *exclusion
    constraint* de sobreposição de horário — seção 16.
11. **Decisões pendentes:** removidos "turnos sobrepostos" e "matrícula
    obrigatória" (ambos decididos nesta revisão); adicionado um novo
    ponto sobre validação prática da *exclusion constraint* — seção 19.
