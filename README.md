# Morning Ritual

Web app de rotina, hábitos e consistência inspirado no Milagre da Manhã.

## Stack
- Next.js 16
- TypeScript
- Tailwind CSS
- Supabase OSS direto

## Rotas
- `/` — landing page
- `/sign-in` — login por link mágico
- `/onboarding` — simulação do onboarding
- `/app` — beta da rotina de hoje

## Setup local
1. Copie `.env.example` para `.env.local`
2. Preencha:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Rode:
   ```bash
   npm install
   npm run dev
   ```

## Banco de dados
O schema inicial está em `supabase/schema.sql`.

## Próximo passo
Conectar o app à tabela de perfil e ao fluxo de autenticação do Supabase.
