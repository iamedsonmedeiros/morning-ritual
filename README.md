# Morning Ritual

Morning Ritual é um web app de rotina diária, hábitos, metas e revisão inspirado na lógica do *Milagre da Manhã*.

A proposta é simples:
- abrir no celular sem fricção
- seguir uma rotina guiada
- marcar hábitos e passos concluídos
- acompanhar consistência real ao longo dos dias
- manter a experiência com cara de app nativo, não de painel técnico

## Objetivo do produto

O app foi desenhado para ser a base diária do usuário em três momentos:
- **Hoje**: a rotina principal do dia
- **Hábitos**: acompanhamento e manutenção dos hábitos
- **Config**: onboarding, ajustes e lembretes

A navegação interna foi pensada para ser fluida, especialmente no mobile, com foco na tela `Hoje` como home real do uso diário.

## Stack

- **Next.js 16**
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Supabase OSS** para autenticação e persistência
- **OneSignal** para notificações web/PWA

## Rotas principais

### Públicas
- `/` — landing page do produto
- `/sign-in` — cadastro/login
- `/onboarding` — configuração inicial da rotina

### App
- `/app` — redireciona para `/app/hoje`
- `/app/hoje` — tela principal do dia
- `/app/habitos` — hábitos e histórico
- `/app/config` — ajustes, onboarding e notificações

## Como o app se organiza

### 1. Landing page
A página inicial apresenta o produto, a proposta e os principais atalhos para entrar no beta ou simular o onboarding.

### 2. Autenticação
A tela de login usa Supabase Auth. O fluxo atual aceita:
- criar conta
- entrar com e-mail e senha

### 3. Onboarding
O onboarding coleta a base do perfil do usuário:
- nome
- foco principal
- tempo diário da rotina
- nome da rotina principal

Depois disso, o app inicializa os dados padrão da experiência.

### 4. Uso diário
A tela `Hoje` concentra o fluxo principal:
- progresso do dia
- passos da rotina
- atalhos para hábitos e config
- revisão da noite

### 5. Estrutura de dados
O schema do Supabase guarda:
- perfis
- rotinas
- passos da rotina
- hábitos
- logs de passos
- logs de hábitos
- logs de rotina
- metas
- revisões diárias
- lembretes

## Experiência de produto

As principais decisões de UX hoje são:
- manter a `Hoje` como home real
- evitar aparência de dashboard administrativo
- usar cards grandes, claros e nativos no mobile
- preservar navegação inferior simples
- reduzir fricção entre as telas

## Notificações

O app usa **OneSignal** para notificações web/PWA.

No fluxo atual:
- o SDK web do OneSignal é carregado no layout do app
- existe um worker em `public/OneSignalSDKWorker.js`
- a integração é pensada para funcionar com PWA e navegador compatível

## Configuração local

### 1. Instale dependências
```bash
npm install
```

### 2. Crie o arquivo de ambiente
Copie o exemplo de ambiente para `.env.local` e preencha os valores.

Variáveis esperadas:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_ONESIGNAL_APP_ID`

### 3. Rode o projeto
```bash
npm run dev
```

Abra:
- `http://localhost:3000`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Banco de dados

O schema está em:
- `supabase/schema.sql`

Ele define:
- enums do domínio
- tabelas principais
- triggers de `updated_at`
- políticas RLS para dados por usuário

## Estrutura de pastas

- `src/app` — rotas e layouts do Next.js
- `src/components` — componentes de UI e formulários
- `src/lib` — helpers de domínio e integração com Supabase
- `public` — assets estáticos e worker do OneSignal
- `supabase/schema.sql` — schema e políticas do banco

## Deploy

O projeto está preparado para rodar em produção como app web no domínio:
- `app.edson.digital`

O deploy em produção deve sempre respeitar:
- build sem erro
- lint sem erro
- configuração correta do Supabase
- configuração correta do OneSignal

## Convenções do projeto

- responder em português brasileiro nas interfaces e documentação
- manter a interface minimalista e direta
- priorizar mobile
- evitar textos longos demais em telas de uso diário
- manter o dia calculado pelo timezone local do navegador
- preservar a tela `Hoje` como ponto central do uso

## Próximos passos desejáveis

- evoluir o fluxo de notificações com OneSignal
- aprimorar o histórico da rotina
- expandir a camada de métricas e consistência
- refinar onboarding e primeiros usos
- manter o app cada vez mais fluido no mobile

## Documentação técnica

Veja também:
- [Arquitetura e fluxo do app](docs/arquitetura.md)
