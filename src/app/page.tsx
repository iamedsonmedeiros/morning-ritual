import Link from "next/link";

const morningSteps = [
  {
    title: "Silêncio",
    subtitle: "respiração, oração, meditação ou apenas pausa",
    minutes: "3–5 min",
  },
  {
    title: "Afirmações",
    subtitle: "relembrar identidade, direção e foco do dia",
    minutes: "2 min",
  },
  {
    title: "Visualização",
    subtitle: "imaginar o dia ideal e o próximo passo real",
    minutes: "2 min",
  },
  {
    title: "Exercício",
    subtitle: "ativação física para ligar corpo e mente",
    minutes: "5–10 min",
  },
  {
    title: "Leitura",
    subtitle: "conteúdo que melhora decisões e repertório",
    minutes: "5 min",
  },
  {
    title: "Escrita",
    subtitle: "registrar prioridades, reflexões e compromissos",
    minutes: "5 min",
  },
];

const highlights = [
  "Rotina guiada, não só checklist solto.",
  "Hábitos diários com histórico e consistência.",
  "Metas simples para manter direção de longo prazo.",
  "Primeira versão web, pronta para virar PWA depois.",
];

const roadmap = [
  "Definir a rotina da manhã em poucos passos.",
  "Marcar hábitos e ver progresso diário.",
  "Acompanhar streak e execução real.",
  "Voltar no dia seguinte sem complicação.",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_28%),linear-gradient(180deg,#07111f_0%,#091521_48%,#f8fafc_48%,#f8fafc_100%)] text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 pb-16 pt-6 lg:px-10">
        <header className="flex items-center justify-between gap-4 text-white/90">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/90">
              app.edson.digital
            </p>
            <h1 className="text-lg font-semibold tracking-tight">
              Morning Ritual
            </h1>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/onboarding"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Ver onboarding
            </Link>
            <Link
              href="/app/hoje"
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Abrir aplicativo
            </Link>
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-center gap-12 pt-16 lg:flex-row lg:items-center lg:justify-between lg:pt-0">
          <div className="max-w-2xl text-white">
            <div className="mb-6 inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
              Rotina guiada inspirada no Milagre da Manhã
            </div>

            <h2 className="max-w-xl text-5xl font-black leading-tight tracking-tight sm:text-6xl">
              Comece a manhã com estrutura, foco e consistência.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Um web app simples para transformar a primeira hora do dia em um ritual
              prático: silêncio, afirmações, visualização, exercício, leitura e escrita —
              sem excesso de complexidade.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
<Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              Entrar no beta
            </Link>
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Simular onboarding
              </Link>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {highlights.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200 backdrop-blur"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 text-white shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Hoje</p>
                <h3 className="mt-2 text-2xl font-bold">Rotina da manhã</h3>
              </div>
              <div className="rounded-full bg-cyan-400/15 px-3 py-1 text-sm font-semibold text-cyan-200">
                15 min
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {morningSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/5 p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-sm font-bold text-slate-950">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{step.title}</p>
                      <span className="text-xs text-slate-400">{step.minutes}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      {step.subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] bg-white p-8 shadow-xl shadow-slate-200/70 ring-1 ring-slate-200">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-700">
              MVP
            </p>
            <h3 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              O que entra na primeira versão.
            </h3>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {roadmap.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700 ring-1 ring-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] bg-cyan-500 p-8 text-slate-950 shadow-xl shadow-cyan-200/60">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-950/70">
              Próximo passo
            </p>
            <h3 className="mt-3 text-3xl font-black tracking-tight">
              Validar, usar e evoluir sem depender da App Store.
            </h3>
            <p className="mt-5 text-sm leading-7 text-slate-900/85">
              A versão beta já nasce como web app e pode virar PWA depois. O foco é
              simples: fazer a pessoa voltar amanhã e continuar a rotina.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/app/hoje"
                className="rounded-full border border-slate-950/10 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Abrir aplicativo
              </Link>
              <Link
                href="/onboarding"
                className="rounded-full border border-slate-950/10 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Fazer onboarding
              </Link>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
