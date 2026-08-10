# Escala Operadores

## Contexto do projeto

Sistema web para gerenciamento de disponibilidade e escala de operadores para
operações de final de semana. Permite que operadores informem sua
disponibilidade e que administradores organizem equipes, turnos e escalas.

Este projeto é **completamente independente** de qualquer outro projeto no
ambiente do usuário (ex.: `demand-buddy-app`). Nenhum arquivo, configuração ou
dependência deve ser compartilhado ou copiado entre eles.

## Estado atual

Etapa inicial: apenas o esqueleto do projeto foi criado (React + TypeScript +
Vite + Tailwind CSS), com estrutura de pastas preparada para as features
futuras. Nenhuma funcionalidade de negócio foi implementada ainda.

## Stack obrigatória

- React
- TypeScript
- Vite
- Tailwind CSS
- npm (gerenciador de pacotes)
- Git (controle de versão)

## Regras arquiteturais

- **Não usar TanStack Start.**
- **Não usar Lovable** nem qualquer ferramenta/artefato relacionado a ele.
- **Não conectar ao Supabase** até que seja explicitamente solicitado.
- Não implementar autenticação, login, cadastro de operadores,
  disponibilidade, escalas, dashboards ou regras automáticas antes de
  solicitação explícita.
- Não reutilizar arquivos, configurações ou dependências de outros projetos
  (em especial `demand-buddy-app`).
- Manter o escopo de cada etapa restrito ao que for pedido — evitar
  funcionalidades, abstrações ou dependências antecipadas.

## Estrutura de pastas (`src/`)

```
src/
├── assets/              # imagens, ícones e outros arquivos estáticos
├── components/
│   └── ui/              # componentes de interface reutilizáveis
├── features/            # lógica de domínio por funcionalidade
│   ├── auth/            # autenticação
│   ├── operators/       # gerenciamento de operadores
│   ├── teams/           # gerenciamento de equipes
│   ├── shifts/          # gerenciamento de turnos
│   ├── availability/    # disponibilidade dos operadores
│   └── schedules/       # escalas
├── pages/
│   ├── operator/        # área do operador
│   └── admin/           # área administrativa
├── lib/
│   └── supabase/        # cliente e integração com Supabase (a ser conectado)
├── hooks/               # hooks React compartilhados
└── types/               # tipos e interfaces TypeScript compartilhados
```

Pastas ainda vazias contêm um arquivo `.gitkeep` apenas para serem versionadas
pelo Git; devem ser removidas conforme cada área recebe conteúdo real.

## Comandos

- `npm run dev` — inicia o servidor de desenvolvimento
- `npm run build` — gera o build de produção (roda `tsc -b` + `vite build`)
- `npm run lint` — executa o ESLint
- `npm run preview` — serve o build de produção localmente
