# Arquitetura do Morning Ritual

Este documento descreve a arquitetura funcional do projeto, os principais fluxos, a estrutura das rotas e o modelo de dados.

## Visão geral

Morning Ritual é um web app em Next.js focado em rotina diária. A aplicação foi desenhada para:

- funcionar bem no celular
- ter navegação simples e rápida
- centralizar o uso diário na tela `Hoje`
- registrar hábitos, passos, metas e revisão do dia
- sincronizar tudo com Supabase OSS
- entregar notificações web/PWA com OneSignal

## Princípios de produto

### 1. Hoje é a home real
A tela `Hoje` é o centro da experiência. É nela que o usuário:
- vê o progresso do dia
- marca passos da rotina
- acessa hábitos e configurações
- entende o que precisa fazer agora

### 2. Config concentra setup e ajustes
A tela `Config` junta:
- onboarding inicial
- nome e estrutura da rotina
- ajustes de lembretes
- fluxos relacionados a notificação

### 3. Mobile primeiro
O layout prioriza:
- cards grandes
- botões legíveis
- hierarquia visual clara
- espaço suficiente para evitar overflow em telas pequenas

### 4. Dados por usuário
Tudo é separado por usuário via Supabase e RLS.

## Rotas

### Públicas
- `/` — landing page
- `/sign-in` — autenticação
- `/onboarding` — configuração inicial

### Aplicação
- `/app` — redireciona para `/app/hoje`
- `/app/hoje` — rotina principal
- `/app/habitos` — gestão e histórico de hábitos
- `/app/config` — configurações e lembretes

## Estrutura de componentes

### `src/components/app/morning-ritual-app.tsx`
É o componente central do app. Ele recebe a tela atual como prop e renderiza a experiência principal com variações de conteúdo por rota.

Responsabilidades:
- calcular estados de progresso e status do dia
- renderizar a tela `Hoje`
- renderizar a tela `Hábitos`
- renderizar a tela `Config`
- exibir blocos de onboarding e lembretes
- exibir estados vazios e mensagens de feedback

### `src/components/app/app-bottom-nav.tsx`
Barra inferior fixa do app no mobile.

Características:
- três itens: `Hoje`, `Hábitos`, `Config`
- ícones inline
- estado ativo destacado
- comportamento fixo e com safe area

### `src/components/onboarding-form.tsx`
Fluxo de onboarding inicial.

Coleta:
- nome
- foco principal
- minutos diários
- nome da rotina

Também faz bootstrap da base inicial no banco.

### `src/components/sign-in-form.tsx`
Fluxo de login/cadastro com Supabase Auth.

## Fluxo de autenticação

1. O usuário entra em `/sign-in`
2. O formulário tenta criar conta com e-mail e senha
3. Se já existir, o fluxo tenta autenticar com senha
4. Depois do login, o usuário vai para o app
5. O onboarding pode completar ou ajustar dados iniciais

## Fluxo de onboarding

O onboarding define o ponto inicial da experiência.

### O que salva
- perfil do usuário
- foco principal
- tempo diário da rotina
- nome da rotina padrão
- base de hábitos padrão
- base de passos padrão
- meta inicial

### Bootstrap de dados
O helper `bootstrapMorningRitual` garante que, ao entrar pela primeira vez, o usuário receba:
- perfil inicial
- rotina padrão
- passos da rotina
- hábitos padrão
- meta inicial

## Fluxo de uso diário

### Tela Hoje
A tela `Hoje` mostra:
- nome da rotina
- status do dia
- progresso percentual
- resumos rápidos de passos, hábitos, noite e sequência
- ações principais
- lista de passos da rotina

### Tela Hábitos
A tela `Hábitos` funciona como área de gestão e histórico:
- visão dos últimos dias
- resumo do que está salvo
- organização dos dados de consistência

### Tela Config
A tela `Config` concentra:
- lembretes
- onboarding
- horários de manhã e noite
- estado das notificações

## Notificações com OneSignal

A integração atual é baseada em OneSignal e não no fluxo antigo de Web Push/VAPID.

### Componentes relevantes
- carregamento do SDK web no layout do app
- worker em `public/OneSignalSDKWorker.js`
- inicialização via `NEXT_PUBLIC_ONESIGNAL_APP_ID`

### Ideia de fluxo
1. carregar o SDK no app
2. pedir permissão de notificação quando fizer sentido
3. registrar o dispositivo no OneSignal
4. enviar notificações server-side via OneSignal

## Banco de dados

O schema está em `supabase/schema.sql`.

### Tabelas principais
- `profiles`
- `routines`
- `routine_steps`
- `habits`
- `habit_logs`
- `routine_step_logs`
- `routine_logs`
- `goals`
- `daily_reviews`
- `reminders`

### O que cada uma cobre
- `profiles`: identidade e preferências do usuário
- `routines`: rotina padrão
- `routine_steps`: passos da rotina
- `habits`: hábitos ativos
- `habit_logs`: conclusão diária de hábitos
- `routine_step_logs`: conclusão de passos da rotina
- `routine_logs`: resumo diário da rotina
- `goals`: metas de longo prazo
- `daily_reviews`: fechamento da noite
- `reminders`: configuração de lembretes

## Regras de acesso

O projeto usa RLS em todas as tabelas principais.

Regra-base:
- o usuário só pode ver, inserir, alterar e excluir os próprios registros

Isso é aplicado com policies do tipo:
- `*_select_own`
- `*_insert_own`
- `*_update_own`
- `*_delete_own`

## Helper de Supabase

### `src/lib/supabase/client.ts`
Cria o client do navegador com:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### `src/lib/supabase/server.ts`
Cria o client do servidor com suporte a cookies.

### `src/lib/supabase/bootstrap.ts`
Popula os dados iniciais do usuário quando necessário.

## Dados padrão da experiência

O arquivo `src/lib/morning-ritual.ts` define os padrões iniciais.

### Rotina padrão
- Silêncio
- Afirmações
- Visualização
- Exercício
- Leitura
- Escrita

### Hábitos padrão
- Beber água ao acordar
- 10 min sem celular
- Planejar 3 prioridades

### Meta padrão
- Construir consistência pela manhã

## Estado e cálculos relevantes

Na tela principal, o app calcula:
- progresso do dia
- texto de status
- progresso de passos
- progresso de hábitos
- sequência de dias
- ação seguinte

Importante:
- o dia deve respeitar o timezone local do navegador
- o progresso da consistência deve refletir os logs reais, não um valor fixo

## Layout e responsividade

O app foi ajustado para evitar estouro de margem no mobile.

Medidas relevantes:
- `overflow-x-hidden` no container principal
- padding inferior maior para coexistir com navegação fixa
- cards com espaçamento menor em telas pequenas
- títulos responsivos

## Build e execução

### Scripts
```bash
npm run dev
npm run build
npm run start
npm run lint
```

### Fluxo de validação
Sempre que a UI ou lógica muda:
1. rodar lint
2. rodar build
3. revisar no celular
4. publicar no servidor

## Deploy

O app está preparado para subir em produção no domínio do projeto.

Fluxo típico:
1. atualizar código
2. validar `lint` e `build`
3. publicar no servidor
4. reiniciar o serviço `morning-ritual`

## Decisões de UX já consolidadas

- evitar recarga visual pesada entre abas
- manter navegação interna simples
- deixar a tela `Hoje` como ponto de entrada
- concentrar setup em `Config`
- manter o app com aparência nativa e limpa

## Próximas melhorias recomendadas

- documentar os endpoints e ações do OneSignal quando estiverem consolidados
- adicionar guia de deploy mais automatizado
- detalhar a camada de métricas de hábito e streak
- registrar padrões de troubleshooting do servidor
