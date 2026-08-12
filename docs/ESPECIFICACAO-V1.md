# Especificação Funcional — Escala Operadores (V1)

> Este documento descreve **o que** o sistema deve fazer na V1. Não descreve
> modelagem de banco de dados, nem contém código ou telas — é uma referência
> funcional para orientar as próximas etapas de implementação.
>
> Nenhuma funcionalidade, tabela, dependência ou tela foi criada a partir
> deste documento. Ele é puramente descritivo.

## Sumário

1. [Objetivo do sistema](#1-objetivo-do-sistema)
2. [Perfis de usuário](#2-perfis-de-usuário)
3. [Fluxo do final de semana](#3-fluxo-do-final-de-semana)
4. [Disponibilidade](#4-disponibilidade)
5. [Escala](#5-escala)
6. [Turnos](#6-turnos)
7. [Equipes](#7-equipes)
8. [Administração da escala](#8-administração-da-escala)
9. [Confirmação da escala](#9-confirmação-da-escala)
10. [Área do colaborador](#10-área-do-colaborador)
11. [Autenticação](#11-autenticação)
12. [Banco de dados](#12-banco-de-dados)
13. [Segurança](#13-segurança)
14. [Histórico](#14-histórico)
15. [Funcionalidades futuras (fora da V1)](#15-funcionalidades-futuras-fora-da-v1)
16. [Princípios arquiteturais](#16-princípios-arquiteturais)
17. [Critérios de aceitação da V1](#17-critérios-de-aceitação-da-v1)
18. [Regra fundamental](#18-regra-fundamental)

---

## 1. Objetivo do sistema

Permitir que uma empresa organize a disponibilidade e a escala de operadores
para operações de final de semana. O sistema deve permitir que:

1. Administradores cadastrem e gerenciem operadores.
2. Administradores criem períodos de operação de final de semana.
3. Administradores configurem os turnos e seus horários.
4. Colaboradores informem sua disponibilidade para determinado final de
   semana.
5. Administradores visualizem todas as disponibilidades.
6. Administradores analisem e montem manualmente a escala.
7. Administradores alterem a escala antes da confirmação.
8. Administradores confirmem a escala.
9. Após a confirmação, cada colaborador acesse o sistema e visualize
   **somente a sua própria escala**.
10. O sistema mantenha histórico dos finais de semana anteriores,
    disponibilidades e escalas.

## 2. Perfis de usuário

Existirão inicialmente dois perfis.

### ADMINISTRADOR
- Acesso completo ao sistema.
- Gerencia operadores.
- Gerencia equipes.
- Gerencia finais de semana.
- Configura turnos.
- Visualiza disponibilidades.
- Cria e altera escalas.
- Confirma escalas.
- Visualiza histórico.

### COLABORADOR
- Acessa sua conta.
- Visualiza os períodos de disponibilidade que estão abertos.
- Informa sua disponibilidade.
- Pode revisar sua disponibilidade enquanto o período estiver aberto.
- Após a confirmação da escala, visualiza somente sua própria escala.
- Não pode visualizar disponibilidade ou escala de outros colaboradores.
- Não pode alterar a escala.

## 3. Fluxo do final de semana

Cada operação é representada por um período de final de semana.

**Exemplo:** Final de semana de 15/08/2026 a 16/08/2026.

O período possui um dos seguintes status:

| Status | Descrição |
|---|---|
| **ABERTO** | Colaboradores podem informar ou alterar disponibilidade. Administrador pode visualizar as respostas. |
| **EM ORGANIZAÇÃO** | O recebimento de disponibilidade foi encerrado. Administrador está analisando as disponibilidades e montando a escala. Colaboradores não podem mais alterar a disponibilidade. |
| **CONFIRMADO** | A escala foi finalizada. Colaboradores podem visualizar sua própria escala. A escala não pode ser alterada por colaboradores. |
| **ENCERRADO** | Período histórico. Apenas consulta. |

O administrador deve poder alterar o status conforme as regras do sistema
(a transição entre status é uma ação administrativa, não automática).

## 4. Disponibilidade

A disponibilidade é registrada por:

- colaborador;
- final de semana;
- data;
- turno.

O colaborador pode selecionar múltiplos turnos no mesmo dia.

**Exemplo:**

```
SÁBADO
- Manhã: disponível
- Tarde: indisponível
- Noite: disponível

DOMINGO
- Manhã: indisponível
- Tarde: disponível
- Noite: indisponível
```

A disponibilidade **não** significa que o colaborador foi escalado. Ela
representa apenas a possibilidade de o colaborador trabalhar naquele período.

## 5. Escala

A escala representa a decisão final do administrador.

Disponibilidade e escala são entidades conceitualmente diferentes:

- **Disponibilidade:** João → sábado → noite → disponível
- **Escala:** João → sábado → noite → escalado

O administrador deve conseguir selecionar colaboradores disponíveis e
atribuí-los aos turnos, além de poder ajustar manualmente a escala de acordo
com a necessidade operacional.

## 6. Turnos

Os turnos não devem ficar fixos diretamente no código — devem ser
configuráveis pelo administrador.

**Turnos iniciais:**

| Turno | Horário |
|---|---|
| Manhã | 08:00 – 14:00 |
| Tarde | 14:00 – 20:00 |
| Noite | 20:00 – 02:00 |

O administrador deve poder alterar posteriormente os horários dos turnos. A
alteração deve ser armazenada como configuração, sem exigir alteração do
código-fonte.

## 7. Equipes

Cada colaborador pode pertencer a uma equipe.

**Exemplo:** Equipe A, Equipe B, Equipe C.

O sistema deve permitir:

- criar equipes;
- editar equipes;
- ativar/desativar equipes;
- associar colaboradores a equipes.

A equipe deve estar disponível como informação na área administrativa da
escala.

> **Fora do escopo da V1:** algoritmo automático de distribuição por equipe.
> A estrutura deve apenas permitir que essa funcionalidade seja adicionada
> futuramente, sem necessidade de redesenho.

## 8. Administração da escala

A área administrativa deve permitir visualizar:

- final de semana;
- status;
- colaboradores;
- equipes;
- disponibilidades;
- turnos;
- horários;
- escala atual.

O administrador deve conseguir:

- adicionar colaborador a um turno;
- remover colaborador;
- alterar turno;
- alterar dia;
- substituir colaborador;
- visualizar disponibilidade antes de escalar.

Antes da confirmação, a escala deve ser totalmente editável pelo
administrador.

## 9. Confirmação da escala

Deve existir uma ação explícita: **"Confirmar escala"**.

Antes de confirmar, o sistema deve apresentar uma confirmação, por exemplo:

> "Ao confirmar a escala, os colaboradores poderão visualizar suas
> respectivas escalas. Deseja continuar?"

Após a confirmação:

- o status passa para **CONFIRMADO**;
- os colaboradores passam a visualizar suas escalas;
- cada colaborador vê somente seus próprios registros.

O administrador continua tendo acesso completo após a confirmação.

> A arquitetura deve prever a possibilidade futura de reabrir uma escala
> confirmada para correções administrativas, mas **esse fluxo não será
> implementado automaticamente na V1** sem necessidade explícita.

## 10. Área do colaborador

O colaborador tem acesso a uma área própria.

**Enquanto houver final de semana ABERTO**, deve visualizar:

- período;
- sábado;
- domingo;
- turnos disponíveis para seleção;
- sua disponibilidade já registrada.

**Após a confirmação**, deve visualizar "Minha escala", por exemplo:

```
Final de semana: 15/08/2026 – 16/08/2026

Sábado
Noite
20:00 – 02:00

Domingo
Não trabalha
```

O colaborador **não** deve visualizar:

- escala de outros colaboradores;
- disponibilidade de outros colaboradores;
- informações administrativas;
- dados internos desnecessários.

## 11. Autenticação

O sistema deve possuir autenticação, com dois tipos de usuário:
administrador e colaborador.

A solução deve ser preparada para utilização do **Supabase Auth**.

> A autenticação **não será implementada** nesta etapa de documentação —
> apenas o requisito é registrado aqui para orientar decisões futuras de
> arquitetura.

## 12. Banco de dados

A arquitetura deve ser preparada para possuir, no mínimo, entidades
equivalentes a:

- usuários/perfis;
- colaboradores;
- equipes;
- finais de semana/períodos;
- turnos;
- disponibilidades;
- escalas.

> O banco de dados **não será criado agora**. A modelagem detalhada
> (tabelas, colunas, relacionamentos) será feita em uma etapa posterior.

## 13. Segurança

A arquitetura deve considerar, para etapas futuras:

- autenticação;
- autorização por perfil (administrador x colaborador);
- isolamento dos dados dos colaboradores;
- Row Level Security (RLS) no Supabase;
- colaboradores não podem consultar dados de outros colaboradores;
- somente administradores podem gerenciar a escala.

> Essas regras **não serão implementadas agora** — este documento apenas
> registra os requisitos de segurança a serem endereçados quando o Supabase
> for conectado.

## 14. Histórico

O sistema deve preservar o histórico dos finais de semana anteriores.
Registros antigos não devem ser apagados simplesmente porque um novo final
de semana foi criado.

Deve ser possível futuramente consultar, por período histórico:

- final de semana;
- disponibilidade;
- escala;
- colaborador;
- equipe;
- turno.

## 15. Funcionalidades futuras (fora da V1)

As funcionalidades abaixo são documentadas como visão futura, mas **não
serão implementadas na V1**:

- geração automática de escala;
- regras de distribuição por equipe;
- cálculo automático de cobertura;
- alerta de déficit de operadores;
- exportação para Excel;
- geração automática das mensagens individuais dos colaboradores;
- envio automático de mensagens;
- dashboard operacional;
- notificações;
- histórico avançado;
- auditoria detalhada;
- relatórios;
- integração com outros sistemas.

## 16. Princípios arquiteturais

A aplicação deve ser construída de forma modular.

**Tecnologias definidas:**

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- Git
- GitHub
- Vercel

Deve-se evitar lógica de negócio diretamente dentro dos componentes
visuais. Separar:

- componentes;
- páginas;
- regras de negócio;
- acesso a dados;
- tipos;
- hooks;
- autenticação.

Priorizar código simples, legível e fácil de manter.

## 17. Critérios de aceitação da V1

A V1 será considerada funcional quando:

1. Um administrador puder criar um final de semana.
2. O administrador puder configurar os turnos.
3. Um colaborador puder acessar sua conta.
4. Um colaborador puder informar disponibilidade.
5. O administrador puder visualizar as disponibilidades.
6. O administrador puder montar uma escala manualmente.
7. O administrador puder alterar a escala antes da confirmação.
8. O administrador puder confirmar a escala.
9. O colaborador puder visualizar sua própria escala após a confirmação.
10. Um colaborador não puder visualizar dados de outros colaboradores.
11. O sistema preservar o histórico dos finais de semana anteriores.

## 18. Regra fundamental

**Disponibilidade não é escala.**

- **Disponibilidade** = intenção/capacidade de trabalhar informada pelo
  colaborador.
- **Escala** = decisão final do administrador.

O sistema deve manter essas duas informações separadas em todas as camadas
(conceitual, de dados e de interface).
