import Link from "next/link";
import { SignInForm } from "@/components/sign-in-form";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">Acesso</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">Entrar no Morning Ritual</h1>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Vamos usar e-mail e senha no início. Assim o beta funciona sem depender de envio de e-mails e continua simples.
            </p>

            <div className="mt-6 space-y-3 text-sm leading-6 text-slate-200">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">1. Você entra com e-mail e senha</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">2. O app cria ou acessa sua conta</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">3. Você vai direto para a rotina</div>
            </div>

            <Link
              href="/"
              className="mt-6 inline-flex rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Voltar
            </Link>
          </section>

          <div>
            <SignInForm />
          </div>
        </div>
      </div>
    </main>
  );
}
