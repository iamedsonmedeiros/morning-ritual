import Link from "next/link";
import { OnboardingForm } from "@/components/onboarding-form";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">Onboarding</p>
          <h1 className="text-3xl font-black tracking-tight">Seu primeiro passo no Morning Ritual</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-300">
            Em vez de um formulário genérico, aqui você configura a base do app: nome,
            objetivo principal, tempo diário e rotina inicial.
          </p>
        </header>

        <OnboardingForm />

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Voltar para a home
          </Link>
        </div>
      </div>
    </main>
  );
}
