# Roteiro de Testes — Banco de Dados V1

> Nenhum destes testes foi executado. Este documento descreve **o que**
> testar contra a migration
> [`supabase/migrations/20260811000000_initial_schema.sql`](../supabase/migrations/20260811000000_initial_schema.sql)
> antes de aplicá-la em produção — ver
> [`supabase/README.md`](../supabase/README.md) para como subir um banco
> local e rodar esses testes.
>
> Os blocos SQL são **ilustrativos** (roteiro manual ou base para testes
> automatizados futuros, ex.: `pgTAP` ou testes de integração da
> aplicação) — não foram rodados contra nenhum banco.
>
> Convenção: `esperado: sucesso` significa que a instrução deve ser
> aceita pelo PostgreSQL; `esperado: erro (SQLSTATE)` significa que deve
> ser rejeitada com o código indicado.

## Sumário

1. [Criação de colaborador](#1-criação-de-colaborador)
2. [Criação de equipe](#2-criação-de-equipe)
3. [Criação de período](#3-criação-de-período)
4. [Criação de turno](#4-criação-de-turno)
5. [Disponibilidade duplicada](#5-disponibilidade-duplicada)
6. [Escala duplicada](#6-escala-duplicada)
7. [Escala com horários sobrepostos](#7-escala-com-horários-sobrepostos)
8. [Escala com horários apenas encostando](#8-escala-com-horários-apenas-encostando)
9. [Turno atravessando meia-noite](#9-turno-atravessando-meia-noite)
10. [Alteração futura de turno sem alteração do snapshot histórico](#10-alteração-futura-de-turno-sem-alteração-do-snapshot-histórico)
11. [Confirmação do período](#11-confirmação-do-período)
12. [Tentativa de alterar estado confirmado](#12-tentativa-de-alterar-estado-confirmado)
13. [Preservação de histórico](#13-preservação-de-histórico)
14. [Matrícula duplicada](#14-matrícula-duplicada)
15. [Matrícula nula](#15-matrícula-nula)
16. [Colaboradores/equipes inativos](#16-colaboradoresequipes-inativos)

---

## Dados de apoio usados nos exemplos

Os testes abaixo assumem que já existe um `auth.users` de teste (criado
pelo próprio Supabase Auth em ambiente de teste — não faz parte desta
migration) e reutilizam os seguintes identificadores fictícios apenas
para ilustrar os comandos:

- `:perfil_admin` — um `perfis.id` com `papel = 'administrador'`.
- `:perfil_joao` — um `perfis.id` com `papel = 'colaborador'`.
- `:colab_joao` — o `colaboradores.id` correspondente a `:perfil_joao`.
- `:equipe_a` — um `equipes.id`.
- `:turno_manha`, `:turno_tarde`, `:turno_noite`, `:turno_outro` —
  `turnos.id` com os horários da seção 4 abaixo.
- `:periodo_1` — um `periodos_operacao.id` para o final de semana
  15–16/08/2026.

Nenhum desses registros deve ser inserido como dado permanente — servem
apenas de contexto para os comandos de teste, executados e desfeitos em
uma transação de teste (`ROLLBACK`) ou em um banco local descartável
(`supabase db reset`).

## 1. Criação de colaborador

**Objetivo:** confirmar que um colaborador só pode ser criado vinculado a
um perfil com `papel = 'colaborador'`, e que os campos de auditoria são
preenchidos automaticamente.

```sql
-- Pré-condição: perfis(:perfil_joao) já existe com papel = 'colaborador'.
INSERT INTO colaboradores (perfil_id, equipe_id, telefone)
VALUES (:perfil_joao, :equipe_a, '11999990000');
-- esperado: sucesso. created_at/updated_at preenchidos por DEFAULT now().
```

```sql
-- Colaborador sem equipe (equipe é opcional).
INSERT INTO colaboradores (perfil_id)
VALUES (:perfil_joao2);
-- esperado: sucesso (equipe_id NULL é permitido).
```

```sql
-- Perfil com papel = 'administrador' não pode virar colaborador.
INSERT INTO colaboradores (perfil_id)
VALUES (:perfil_admin);
-- esperado: erro (P0001) — "Perfil ... nao tem papel colaborador"
-- (trg_valida_perfil_colaborador).
```

**Valida:** `trg_valida_perfil_colaborador`, `DEFAULT now()` em
`created_at`/`updated_at`, FK `equipe_id` opcional.

## 2. Criação de equipe

```sql
INSERT INTO equipes (nome) VALUES ('Equipe A');
-- esperado: sucesso. ativo = true por default.

INSERT INTO equipes (nome) VALUES ('Equipe A');
-- esperado: erro (23505 unique_violation) — uq_equipe_nome.
```

**Valida:** `uq_equipe_nome`, `DEFAULT true` em `ativo`.

## 3. Criação de período

```sql
INSERT INTO periodos_operacao (data_inicio, data_fim, created_by)
VALUES ('2026-08-15', '2026-08-16', :perfil_admin);
-- esperado: sucesso. status = 'aberto' por default; confirmed_at/
-- confirmed_by permanecem NULL (correto, pois status não é confirmado).

INSERT INTO periodos_operacao (data_inicio, data_fim, created_by)
VALUES ('2026-08-16', '2026-08-15', :perfil_admin);
-- esperado: erro (23514 check_violation) — chk_periodo_datas
-- (data_fim >= data_inicio).

INSERT INTO periodos_operacao (data_inicio, data_fim, created_by)
VALUES ('2026-08-15', '2026-08-16', :perfil_admin);
-- (repetindo o par de datas do primeiro INSERT)
-- esperado: erro (23505 unique_violation) — uq_periodo_datas.
```

**Valida:** `chk_periodo_datas`, `uq_periodo_datas`, `DEFAULT 'aberto'`.

## 4. Criação de turno

```sql
INSERT INTO turnos (nome, hora_inicio, hora_fim) VALUES ('Manhã', '08:00', '14:00');
INSERT INTO turnos (nome, hora_inicio, hora_fim) VALUES ('Tarde', '14:00', '20:00');
INSERT INTO turnos (nome, hora_inicio, hora_fim) VALUES ('Noite', '20:00', '02:00');
-- esperado: sucesso para os três — inclusive "Noite", cujo hora_fim é
-- menor que hora_inicio (isso NÃO deve ser bloqueado, ver seção 9 abaixo).

INSERT INTO turnos (nome, hora_inicio, hora_fim) VALUES ('Quebrado', '10:00', '10:00');
-- esperado: erro (23514 check_violation) — chk_turno_horario_nao_degenerado
-- (hora_inicio <> hora_fim).

INSERT INTO turnos (nome, hora_inicio, hora_fim) VALUES ('Manhã', '09:00', '15:00');
-- esperado: erro (23505 unique_violation) — uq_turno_nome.
```

**Valida:** `uq_turno_nome`, `chk_turno_horario_nao_degenerado`, e que
`hora_fim < hora_inicio` **não** é tratado como erro.

## 5. Disponibilidade duplicada

```sql
INSERT INTO disponibilidades (colaborador_id, periodo_id, data, turno_id, disponivel)
VALUES (:colab_joao, :periodo_1, '2026-08-15', :turno_noite, true);
-- esperado: sucesso.

INSERT INTO disponibilidades (colaborador_id, periodo_id, data, turno_id, disponivel)
VALUES (:colab_joao, :periodo_1, '2026-08-15', :turno_noite, false);
-- esperado: erro (23505 unique_violation) — uq_disponibilidade.
-- (revisar a resposta é um UPDATE, não um segundo INSERT — ver teste 16
-- da especificação de disponibilidade, seção 3.6 da modelagem.)
```

**Valida:** `uq_disponibilidade (colaborador_id, periodo_id, data, turno_id)`.

## 6. Escala duplicada

```sql
INSERT INTO escalas (colaborador_id, periodo_id, data, turno_id, created_by)
VALUES (:colab_joao, :periodo_1, '2026-08-15', :turno_noite, :perfil_admin);
-- esperado: sucesso. turno_nome_snapshot/turno_hora_*_snapshot preenchidos
-- automaticamente por trg_snapshot_turno a partir de turnos(:turno_noite).

INSERT INTO escalas (colaborador_id, periodo_id, data, turno_id, created_by)
VALUES (:colab_joao, :periodo_1, '2026-08-15', :turno_noite, :perfil_admin);
-- esperado: erro (23505 unique_violation) — uq_escala_sem_conflito.
```

**Valida:** `uq_escala_sem_conflito`, `trg_snapshot_turno` no `INSERT`.

## 7. Escala com horários sobrepostos

Cenário do caso 3 da validação técnica (`docs/MODELO-BANCO-V1.md`, seção
6.1): `:turno_outro` cadastrado com `13:00–19:00`.

```sql
INSERT INTO escalas (colaborador_id, periodo_id, data, turno_id, created_by)
VALUES (:colab_joao, :periodo_1, '2026-08-15', :turno_manha, :perfil_admin);
-- Manhã 08:00-14:00 → esperado: sucesso.

INSERT INTO escalas (colaborador_id, periodo_id, data, turno_id, created_by)
VALUES (:colab_joao, :periodo_1, '2026-08-15', :turno_outro, :perfil_admin);
-- Outro 13:00-19:00, mesmo colaborador, mesmo dia → esperado:
-- erro (23P01 exclusion_violation) — excl_escala_sem_sobreposicao,
-- pois [13:00,19:00) intercepta [08:00,14:00) no intervalo [13:00,14:00).
```

**Valida:** `excl_escala_sem_sobreposicao` bloqueando corretamente turnos
**diferentes** com sobreposição — algo que `uq_escala_sem_conflito`
sozinha não detectaria (regra importante #6).

## 8. Escala com horários apenas encostando

Cenário do caso 2 da validação técnica.

```sql
INSERT INTO escalas (colaborador_id, periodo_id, data, turno_id, created_by)
VALUES (:colab_joao, :periodo_1, '2026-08-15', :turno_manha, :perfil_admin);
-- Manhã 08:00-14:00 → esperado: sucesso.

INSERT INTO escalas (colaborador_id, periodo_id, data, turno_id, created_by)
VALUES (:colab_joao, :periodo_1, '2026-08-15', :turno_tarde, :perfil_admin);
-- Tarde 14:00-20:00, mesmo colaborador, mesmo dia → esperado: SUCESSO.
-- [08:00,14:00) e [14:00,20:00) não compartilham nenhum instante — o
-- limite semiaberto '[)' da constraint trata 14:00 como pertencente
-- somente ao segundo intervalo.
```

**Valida:** limite `'[)'` do `tsrange` usado pela exclusion constraint
(regra importante #7) — turnos que apenas encostam **devem** ser
permitidos.

## 9. Turno atravessando meia-noite

Cenário dos casos 1, 4 e 5 da validação técnica.

```sql
-- Caso 1: Manhã (15/08) + Noite (15/08, cruza para 16/08) → permitido.
INSERT INTO escalas (colaborador_id, periodo_id, data, turno_id, created_by)
VALUES (:colab_joao, :periodo_1, '2026-08-15', :turno_manha, :perfil_admin);
INSERT INTO escalas (colaborador_id, periodo_id, data, turno_id, created_by)
VALUES (:colab_joao, :periodo_1, '2026-08-15', :turno_noite, :perfil_admin);
-- esperado: ambos com sucesso.
-- Conferir: SELECT inicio_efetivo, fim_efetivo FROM escalas
--   WHERE turno_id = :turno_noite AND data = '2026-08-15';
-- esperado: inicio_efetivo = 2026-08-15 20:00, fim_efetivo = 2026-08-16 02:00.

-- Caso 4: Noite (15/08, → 16/08 02:00) + "Madrugada" hipotética
-- (16/08, 01:00-05:00) do MESMO colaborador → bloqueado.
INSERT INTO turnos (nome, hora_inicio, hora_fim) VALUES ('Madrugada', '01:00', '05:00');
INSERT INTO escalas (colaborador_id, periodo_id, data, turno_id, created_by)
VALUES (:colab_joao, :periodo_1, '2026-08-16', :turno_madrugada, :perfil_admin);
-- esperado: erro (23P01 exclusion_violation) — [16/08 01:00, 16/08 02:00)
-- é comum às duas escalas, mesmo estando em linhas com "data" diferente.

-- Caso 5: Noite (15/08 → 16/08 02:00) + Manhã (16/08, 08:00-14:00) →
-- permitido.
INSERT INTO escalas (colaborador_id, periodo_id, data, turno_id, created_by)
VALUES (:colab_joao, :periodo_1, '2026-08-16', :turno_manha, :perfil_admin);
-- esperado: sucesso — 02:00 < 08:00, sem sobreposição.
```

**Valida:** cálculo de `fim_efetivo` para turnos com
`hora_fim <= hora_inicio` (soma de 24h), e que a exclusion constraint
compara **instantes absolutos**, capturando conflitos entre linhas com
`data` diferente (regra importante #8).

## 10. Alteração futura de turno sem alteração do snapshot histórico

```sql
INSERT INTO escalas (colaborador_id, periodo_id, data, turno_id, created_by)
VALUES (:colab_joao, :periodo_1, '2026-08-15', :turno_manha, :perfil_admin);

SELECT turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot,
       inicio_efetivo, fim_efetivo
FROM escalas WHERE turno_id = :turno_manha AND data = '2026-08-15';
-- anotar os valores retornados (esperado: 'Manhã', 08:00, 14:00, ...).

-- Administrador altera o cadastro do turno "Manhã" posteriormente:
UPDATE turnos SET hora_inicio = '09:00', hora_fim = '15:00', nome = 'Manhã (novo)'
WHERE id = :turno_manha;
-- esperado: sucesso (turnos é livremente editável — seção 3.5 da modelagem).

SELECT turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot,
       inicio_efetivo, fim_efetivo
FROM escalas WHERE turno_id = :turno_manha AND data = '2026-08-15';
-- esperado: EXATAMENTE os mesmos valores de antes ('Manhã', 08:00, 14:00,
-- ...) — a escala histórica não é afetada pela edição do turno.
```

**Valida:** o requisito central desta etapa — snapshot imutável em
`escalas`, `inicio_efetivo`/`fim_efetivo` calculados a partir do snapshot
(não de um `JOIN` ao vivo com `turnos`).

## 11. Confirmação do período

```sql
UPDATE periodos_operacao
SET status = 'confirmado'
WHERE id = :periodo_1;
-- esperado: erro (P0001) — "confirmed_at e confirmed_by sao obrigatorios
-- para status confirmado" (trg_valida_confirmacao_periodo).

UPDATE periodos_operacao
SET status = 'confirmado', confirmed_at = now(), confirmed_by = :perfil_admin
WHERE id = :periodo_1;
-- esperado: sucesso.
```

**Valida:** `trg_valida_confirmacao_periodo` exigindo `confirmed_at`/
`confirmed_by` exatamente quando `status IN ('confirmado', 'encerrado')`
(regra importante #9).

## 12. Tentativa de alterar estado confirmado

```sql
-- Tentar "desconfirmar" sem limpar os campos de confirmação.
UPDATE periodos_operacao
SET status = 'aberto'
WHERE id = :periodo_1 AND status = 'confirmado';
-- esperado: erro (P0001) — "confirmed_at/confirmed_by so podem ser
-- preenchidos em confirmado/encerrado" (os campos continuam preenchidos
-- do teste 11, então voltar para 'aberto' sem limpá-los é rejeitado).

-- Alterar uma escala de um período já confirmado.
UPDATE escalas SET turno_id = :turno_tarde WHERE colaborador_id = :colab_joao;
-- esperado: sucesso a nível de BANCO — esta migration não impede o
-- administrador (nem qualquer outra role) de alterar escalas de um
-- período confirmado; a restrição "colaborador não pode alterar escala
-- confirmada" é uma regra de AUTORIZAÇÃO (RLS), não implementada nesta
-- etapa (ver docs/MODELO-BANCO-V1.md, seção 14). Este teste serve para
-- confirmar essa lacuna esperada, não para validar um bloqueio que ainda
-- não existe.
```

**Valida:** a trigger de confirmação impede um estado
inconsistente de campos (`status` × `confirmed_at`/`confirmed_by`), mas
**não** impede edição de dados de um período confirmado — isso é
esperado nesta etapa e fica documentado explicitamente para não ser
confundido com uma falha de teste quando o RLS ainda não existir.

## 13. Preservação de histórico

```sql
-- Colaborador com disponibilidade/escala associada não pode ser excluído.
DELETE FROM colaboradores WHERE id = :colab_joao;
-- esperado: erro (23503 foreign_key_violation) — FK RESTRICT a partir de
-- disponibilidades.colaborador_id / escalas.colaborador_id.

-- Equipe com colaborador vinculado (mesmo inativo) não pode ser excluída.
DELETE FROM equipes WHERE id = :equipe_a;
-- esperado: erro (23503 foreign_key_violation) — FK RESTRICT a partir de
-- colaboradores.equipe_id.

-- Período com disponibilidade/escala associada não pode ser excluído.
DELETE FROM periodos_operacao WHERE id = :periodo_1;
-- esperado: erro (23503 foreign_key_violation).

-- Turno SEM nenhuma referência pode ser excluído fisicamente (exceção
-- deliberada — seção 8 da modelagem).
INSERT INTO turnos (nome, hora_inicio, hora_fim) VALUES ('Nunca usado', '05:00', '06:00');
DELETE FROM turnos WHERE nome = 'Nunca usado';
-- esperado: sucesso.
```

**Valida:** `ON DELETE RESTRICT` em todas as FKs históricas (regra
importante #1), e a exceção documentada para registros nunca
referenciados.

## 14. Matrícula duplicada

```sql
INSERT INTO colaboradores (perfil_id, matricula) VALUES (:perfil_joao, 'MAT-001');
INSERT INTO colaboradores (perfil_id, matricula) VALUES (:perfil_maria, 'MAT-001');
-- esperado: erro (23505 unique_violation) — uq_colaborador_matricula.
```

**Valida:** índice único parcial `uq_colaborador_matricula` quando a
matrícula é informada.

## 15. Matrícula nula

```sql
INSERT INTO colaboradores (perfil_id, matricula) VALUES (:perfil_joao, NULL);
INSERT INTO colaboradores (perfil_id, matricula) VALUES (:perfil_maria, NULL);
-- esperado: sucesso para ambos — o índice único parcial só se aplica a
-- matricula IS NOT NULL, então múltiplos colaboradores sem matrícula
-- coexistem sem conflito.
```

**Valida:** que `uq_colaborador_matricula` é um índice **parcial**
(`WHERE matricula IS NOT NULL`), não uma `UNIQUE` comum — matrícula
continua opcional (regra importante #5).

## 16. Colaboradores/equipes inativos

```sql
UPDATE colaboradores SET ativo = false WHERE id = :colab_joao;
UPDATE equipes SET ativo = false WHERE id = :equipe_a;
-- esperado: sucesso para ambos — desativação lógica é sempre permitida
-- (regra importante #2), inclusive quando há histórico associado.

-- Mesmo inativo, o colaborador continua bloqueado para exclusão física
-- se tiver histórico:
DELETE FROM colaboradores WHERE id = :colab_joao;
-- esperado: erro (23503 foreign_key_violation) — ativo = false NÃO é um
-- "bypass" da proteção de histórico.

-- Disponibilidades/escalas antigas de um colaborador/equipe agora
-- inativos continuam legíveis normalmente (nenhuma FK ou trigger impede
-- SELECT).
SELECT * FROM escalas WHERE colaborador_id = :colab_joao;
-- esperado: sucesso, retorna as linhas existentes normalmente.
```

**Valida:** `ativo = false` como mecanismo de desativação (regra
importante #2), sem afetar a preservação de histórico nem a
consultabilidade dos dados antigos.

## Cobertura em relação às regras importantes da etapa

| Regra importante | Testes que cobrem |
|---|---|
| 1. Sem `ON DELETE CASCADE` em dados históricos | 13 |
| 2. Colaboradores/equipes desativáveis via `ativo=false` | 16 |
| 3. Disponibilidade e escala independentes | 5, 6 (ausência de qualquer FK cruzada é estrutural, não testável por um único comando — confirmada por inspeção do schema) |
| 4/5. Snapshot do turno preservado | 10 |
| 6. Exclusion constraint bloqueia sobreposição | 7, 9 |
| 7. Turnos encostando são permitidos | 8 |
| 8. Turnos que cruzam meia-noite calculados corretamente | 9 |
| 9. `confirmed_at`/`confirmed_by` obrigatórios em confirmado/encerrado | 11, 12 |
