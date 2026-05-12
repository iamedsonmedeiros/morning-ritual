"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { bootstrapMorningRitual } from "@/lib/supabase/bootstrap";
import { defaultHabits, defaultRoutineSteps } from "@/lib/morning-ritual";

type ProfileFormState = {
  name: string;
  goalType: "disciplina" | "produtividade" | "habitos" | "rotina_da_manha";
  morningMinutes: string;
  routineName: string;
};

const goalOptions = [
  {
    value: "rotina_da_manha" as const,
    label: "Rotina da manhã",
    description: "Construir consistência logo nas primeiras horas do dia.",
  },
  {
    value: "disciplina" as const,
    label: "Disciplina",
    description: "Criar execução diária e reduzir dependência de motivação.",
  },
  {
    value: "produtividade" as const,
    label: "Produtividade",
    description: "Ganhar clareza, foco e priorização no dia a dia.",
  },
  {
    value: "habitos" as const,
    label: "Hábitos",
    description: "Fazer a repetição virar sistema e não força de vontade.",
  },
];

const minuteOptions = ["10", "15", "20", "30"];

const ritualPreview = [
  "Você vai sair com uma rotina inicial pronta.",
  "O app já abre com hábitos, metas e revisão diária.",
  "Depois é só começar a usar e ajustar no caminho.",
];

export function OnboardingForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<ProfileFormState>({
    name: "",
    goalType: "rotina_da_manha",
    morningMinutes: "15",
    routineName: "Rotina principal",
  });

  const selectedGoal = useMemo(
    () => goalOptions.find((option) => option.value === form.goalType) ?? goalOptions[0],
    [form.goalType]
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: userResult, error: userError } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!userResult.user) {
          router.replace("/sign-in");
          return;
        }

        const user = userResult.user;
        const userEmail = user.email ?? "";
        setEmail(userEmail);

        await bootstrapMorningRitual(supabase, user.id, userEmail);

        const [{ data: profile }, { data: routine }] = await Promise.all([
          supabase
            .from("profiles")
            .select("name,goal_type,morning_minutes")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("routines")
            .select("name")
            .eq("user_id", user.id)
            .eq("is_default", true)
            .maybeSingle(),
        ]);

        if (!mounted) return;

        setForm({
          name: profile?.name ?? userEmail.split("@")[0] ?? "Edson",
          goalType: (profile?.goal_type as ProfileFormState["goalType"]) ?? "rotina_da_manha",
          morningMinutes: String(profile?.morning_minutes ?? 15),
          routineName: routine?.name ?? "Rotina principal",
        });
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Falha ao carregar o onboarding.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userResult, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!userResult.user) {
        router.replace("/sign-in");
        return;
      }

      const user = userResult.user;
      const name = form.name.trim() || user.email?.split("@")[0] || "Edson";
      const routineName = form.routineName.trim() || "Rotina principal";

      const profileResult = await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          name,
          goal_type: form.goalType,
          morning_minutes: Number(form.morningMinutes),
        },
        { onConflict: "user_id" }
      );

      if (profileResult.error) throw profileResult.error;

      const routineResult = await supabase
        .from("routines")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .maybeSingle();

      if (routineResult.error) throw routineResult.error;

      if (routineResult.data?.id) {
        const updateResult = await supabase
          .from("routines")
          .update({ name: routineName })
          .eq("id", routineResult.data.id);

        if (updateResult.error) throw updateResult.error;
      } else {
        const insertResult = await supabase.from("routines").insert({
          user_id: user.id,
          name: routineName,
          is_default: true,
        });

        if (insertResult.error) throw insertResult.error;
      }

      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui salvar o onboarding.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-white backdrop-blur">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">Primeiro uso</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight">Configure sua base em 2 minutos</h2>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          Aqui a ideia é simples: definir como o app vai te chamar, qual o foco principal e
          quanto tempo você quer dedicar à rotina da manhã.
        </p>

        <div className="mt-6 space-y-3">
          {ritualPreview.map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm leading-6 text-slate-200">
              {item}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
          <p className="text-sm font-semibold text-cyan-100">Escolha um foco com toque</p>
          <div className="mt-3 grid gap-3">
            {goalOptions.map((option) => {
              const selected = form.goalType === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, goalType: option.value }))}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    selected
                      ? "border-cyan-300 bg-cyan-300/20 text-white shadow-lg shadow-cyan-950/20"
                      : "border-white/10 bg-slate-950/40 text-slate-200 hover:bg-slate-950/70"
                  }`}
                >
                  <p className="font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">
          <p className="text-sm font-semibold text-cyan-100">O que já vem pronto</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
            {defaultRoutineSteps.map((step) => (
              <li key={step.title}>• {step.title}</li>
            ))}
          </ul>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {defaultHabits.map((habit) => (
            <div key={habit.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              {habit.title}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/app"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Ir direto ao app
          </Link>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white p-6 text-slate-950 shadow-xl shadow-cyan-950/20">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-700">Configuração</p>
        <h3 className="mt-3 text-3xl font-black tracking-tight">Escolha a versão inicial</h3>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Isso vai atualizar seu perfil e deixar a rotina principal pronta para usar.
        </p>

        {loading ? (
          <div className="mt-8 space-y-4 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-11 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-11 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-11 animate-pulse rounded-full bg-slate-200" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="name" className="text-sm font-medium text-slate-700">
                Como posso te chamar?
              </label>
              <input
                id="name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={email ? email.split("@")[0] : "Edson"}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400"
              />
            </div>

            <div>
              <label htmlFor="routineName" className="text-sm font-medium text-slate-700">
                Nome da rotina
              </label>
              <input
                id="routineName"
                value={form.routineName}
                onChange={(event) => setForm((current) => ({ ...current, routineName: event.target.value }))}
                placeholder="Rotina principal"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400"
              />
            </div>

            <div>
              <label htmlFor="goalType" className="text-sm font-medium text-slate-700">
                Foco principal
              </label>
              <select
                id="goalType"
                value={form.goalType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    goalType: event.target.value as ProfileFormState["goalType"],
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-cyan-400"
              >
                {goalOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm leading-6 text-slate-500">{selectedGoal.description}</p>
            </div>

            <div>
              <label htmlFor="morningMinutes" className="text-sm font-medium text-slate-700">
                Tempo diário
              </label>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {minuteOptions.map((minute) => {
                  const selected = form.morningMinutes === minute;

                  return (
                    <button
                      key={minute}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, morningMinutes: minute }))}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                        selected
                          ? "border-cyan-400 bg-cyan-50 text-cyan-950"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {minute} min
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Resumo da configuração</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>• Nome: {form.name.trim() || email.split("@")[0] || "Edson"}</li>
                <li>• Rotina: {form.routineName.trim() || "Rotina principal"}</li>
                <li>• Foco: {selectedGoal.label}</li>
                <li>• Tempo: {form.morningMinutes} minutos</li>
              </ul>
            </div>

            {error ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar e abrir o app"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
