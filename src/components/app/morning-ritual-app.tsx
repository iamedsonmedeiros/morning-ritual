"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { bootstrapMorningRitual } from "@/lib/supabase/bootstrap";

type Routine = {
  id: string;
  name: string;
};

type RoutineStep = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  minutes: number | null;
  is_required: boolean;
};

type Habit = {
  id: string;
  title: string;
  description: string | null;
  frequency: "daily" | "weekly";
  active: boolean;
};

type Goal = {
  id: string;
  title: string;
  description: string | null;
  target_value: number | null;
  current_value: number;
  status: "active" | "paused" | "done";
};

type RoutineStepLog = {
  routine_step_id: string;
  completed: boolean;
};

type HabitLog = {
  habit_id: string;
  completed: boolean;
};

type RoutineLog = {
  date: string;
  completed_steps: number;
  total_steps: number;
};

type DailyReview = {
  what_went_well: string | null;
  what_to_improve: string | null;
  mood: string | null;
  notes: string | null;
};

type ReminderSettings = {
  enabled: boolean;
  morningTime: string;
  nightTime: string;
};

type ReminderKind = "morning" | "night";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type AppScreen = "hoje" | "habitos" | "config";

interface MorningRitualAppProps {
  screen: AppScreen;
}

const reminderStorageKey = "morning-ritual.reminders";
const installHintStorageKey = "morning-ritual.install-hint-dismissed";
const defaultReminderSettings: ReminderSettings = {
  enabled: false,
  morningTime: "07:30",
  nightTime: "21:00",
};

type CachedMorningRitualSnapshot = {
  userId: string;
  dayKey: string;
  userEmail: string;
  routine: Routine | null;
  routineSteps: RoutineStep[];
  habits: Habit[];
  goals: Goal[];
  stepLogs: RoutineStepLog[];
  habitLogs: HabitLog[];
  routineHistory: RoutineLog[];
  review: DailyReview;
};

let morningRitualSnapshotCache: CachedMorningRitualSnapshot | null = null;

function getNextOccurrence(timeValue: string, from = new Date()) {
  const [hourString, minuteString] = timeValue.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);
  const target = new Date(from);

  target.setHours(hour, minute, 0, 0);

  if (target.getTime() <= from.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target;
}

function getLocalDayKey(date = new Date()) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return new Intl.DateTimeFormat("sv-SE", { timeZone }).format(date);
}

type OneSignalLike = {
  Notifications?: {
    requestPermission?: () => Promise<NotificationPermission | "granted" | "denied" | "default">;
  };
};

function getOneSignal() {
  if (typeof window === "undefined") return null;
  return (window as Window & { OneSignal?: OneSignalLike }).OneSignal ?? null;
}

function isConsistencyDay(log: RoutineLog) {
  return log.total_steps > 0 && log.completed_steps >= Math.max(1, Math.ceil(log.total_steps * 0.8));
}


export default function MorningRitualApp({ screen }: MorningRitualAppProps) {
  const router = useRouter();
  const screenTitle =
    screen === "hoje" ? "Hoje" : screen === "habitos" ? "Hábitos" : "Config";
  const screenDescription =
    screen === "hoje"
      ? "Acompanhe o essencial e continue."
      : screen === "habitos"
        ? "Aqui você cuida dos hábitos ativos e faz o check-in rápido da manhã."
        : "Aqui você ajusta lembretes, rotina e metas sem ruído.";
  const initialDayKey = typeof window === "undefined" ? "" : getLocalDayKey();
  const cachedSnapshot =
    initialDayKey && morningRitualSnapshotCache?.dayKey === initialDayKey ? morningRitualSnapshotCache : null;
  const [loading, setLoading] = useState(!cachedSnapshot);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedData, setHasLoadedData] = useState(Boolean(cachedSnapshot));
  const [userEmail, setUserEmail] = useState(cachedSnapshot?.userEmail ?? "");
  const userLabel = userEmail ? `Logado como ${userEmail}.` : "Sua rotina está pronta para rodar.";
  const [routine, setRoutine] = useState<Routine | null>(cachedSnapshot?.routine ?? null);
  const [routineSteps, setRoutineSteps] = useState<RoutineStep[]>(cachedSnapshot?.routineSteps ?? []);
  const [habits, setHabits] = useState<Habit[]>(cachedSnapshot?.habits ?? []);
  const [goals, setGoals] = useState<Goal[]>(cachedSnapshot?.goals ?? []);
  const [stepLogs, setStepLogs] = useState<RoutineStepLog[]>(cachedSnapshot?.stepLogs ?? []);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>(cachedSnapshot?.habitLogs ?? []);
  const [routineHistory, setRoutineHistory] = useState<RoutineLog[]>(cachedSnapshot?.routineHistory ?? []);
  const [today, setToday] = useState(initialDayKey);
  const [review, setReview] = useState<DailyReview>(
    cachedSnapshot?.review ?? {
      what_went_well: "",
      what_to_improve: "",
      mood: "",
      notes: "",
    }
  );
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(() => {
    if (typeof window === "undefined") return defaultReminderSettings;

    const saved = window.localStorage.getItem(reminderStorageKey);
    if (!saved) return defaultReminderSettings;

    try {
      const parsed = JSON.parse(saved) as Partial<ReminderSettings>;
      return {
        enabled: Boolean(parsed.enabled),
        morningTime: typeof parsed.morningTime === "string" ? parsed.morningTime : defaultReminderSettings.morningTime,
        nightTime: typeof parsed.nightTime === "string" ? parsed.nightTime : defaultReminderSettings.nightTime,
      };
    } catch {
      return defaultReminderSettings;
    }
  });
  const [reminderTick, setReminderTick] = useState(0);
  const [snapshotTick, setSnapshotTick] = useState(0);
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);
  const isIOSDevice = useMemo(() => {
    if (typeof window === "undefined") return false;
    const userAgent = window.navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(userAgent) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  }, []);
  const isAndroidDevice = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /Android/i.test(window.navigator.userAgent || "");
  }, []);
  const oneSignalAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "8169eb70-9bf2-4f6d-8ea7-2c105a57ef12";
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [installHintDismissed, setInstallHintDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(installHintStorageKey) === "1";
  });
  const [habitDraft, setHabitDraft] = useState({
    title: "",
    description: "",
    frequency: "daily" as "daily" | "weekly",
  });
  const [habitAction, setHabitAction] = useState<string | null>(null);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [routineAction, setRoutineAction] = useState<string | null>(null);
  const [stepAction, setStepAction] = useState<string | null>(null);
  const [goalAction, setGoalAction] = useState<string | null>(null);
  const [routineDraft, setRoutineDraft] = useState({ name: "" });
  const [stepDraft, setStepDraft] = useState({
    title: "",
    description: "",
    position: "",
    minutes: "",
    is_required: true,
  });
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState({
    title: "",
    description: "",
    target_value: "",
    current_value: "0",
    status: "active" as "active" | "paused" | "done",
  });
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  const stepLogMap = useMemo(
    () => new Map(stepLogs.filter((log) => log.completed).map((log) => [log.routine_step_id, true])),
    [stepLogs]
  );

  const habitLogMap = useMemo(
    () => new Map(habitLogs.filter((log) => log.completed).map((log) => [log.habit_id, true])),
    [habitLogs]
  );

  const completedStepCount = useMemo(
    () => routineSteps.filter((step) => stepLogMap.get(step.id)).length,
    [routineSteps, stepLogMap]
  );
  const totalStepCount = routineSteps.length;
  const progressPercent = totalStepCount ? Math.round((completedStepCount / totalStepCount) * 100) : 0;
  const activeHabits = habits.filter((habit) => habit.active);
  const completedHabitCount = activeHabits.filter((habit) => habitLogMap.get(habit.id)).length;
  const streakDays = routineHistory.filter((log) => log.completed_steps >= Math.max(1, Math.ceil(log.total_steps * 0.8))).length;

  const currentDayKey = today || getLocalDayKey();
  const activeGoal = goals.find((goal) => goal.status === "active") ?? goals[0] ?? null;
  const completedConsistencyDays = routineHistory.filter(isConsistencyDay).length;
  const activeGoalProgressValue = activeGoal ? completedConsistencyDays : 0;
  const activeGoalTargetValue = activeGoal?.target_value ?? 30;
  const currentDateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
  const currentDateHeading = currentDateLabel.charAt(0).toUpperCase() + currentDateLabel.slice(1);
  const reviewHasContent = Boolean(
    [review.what_went_well, review.what_to_improve, review.mood, review.notes].some((value) => (value ?? "").trim())
  );
  const morningProgressText = totalStepCount > 0 ? `${completedStepCount}/${totalStepCount} passos` : "Sem passos hoje";
  const habitProgressText = activeHabits.length > 0 ? `${completedHabitCount}/${activeHabits.length} hábitos` : "Sem hábitos ativos";
  const reviewStatusText = reviewHasContent ? "Revisão preenchida" : "Revisão pendente";
  const dayStatusText = progressPercent === 100 ? "Ritual concluído" : completedStepCount > 0 ? "Em andamento" : "Ainda não começou";
  const nextActionHref = progressPercent === 100 ? "#noite" : "#manha";
  const nextActionLabel = progressPercent === 100 ? (reviewHasContent ? "Dia concluído" : "Fechar a noite agora") : completedStepCount > 0 ? "Continuar agora" : "Começar agora";
  const reminderPermissionText =
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission === "granted"
        ? "Permitida"
        : Notification.permission === "denied"
          ? "Bloqueada"
          : "Pendente"
      : isIOSDevice && !isStandaloneApp
        ? "Só no app instalado"
        : "Não suportada";
  const supportsReminderNotifications = typeof window !== "undefined" && "Notification" in window;
  const morningReminderPreview = getNextOccurrence(reminderSettings.morningTime);
  const nightReminderPreview = getNextOccurrence(reminderSettings.nightTime);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncToday = () => {
      const nextToday = getLocalDayKey();
      setToday((current) => (current === nextToday ? current : nextToday));
      setSnapshotTick((current) => current + 1);
    };

    syncToday();
    const interval = window.setInterval(syncToday, 60_000);
    const handleVisibilityChange = () => {
      if (!document.hidden) syncToday();
    };
    const handleWindowFocus = () => syncToday();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!currentDayKey) return;

      setLoading(true);
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
        const email = user.email ?? "";
        setUserEmail(email);

        await bootstrapMorningRitual(supabase, user.id, email);

        const [routineResult, habitsResult, goalsResult, stepLogResult, habitLogResult, historyResult, reviewResult] =
          await Promise.all([
            supabase.from("routines").select("id,name").eq("user_id", user.id).eq("is_default", true).limit(1),
            supabase.from("habits").select("id,title,description,frequency,active").eq("user_id", user.id).order("created_at"),
            supabase
              .from("goals")
              .select("id,title,description,target_value,current_value,status")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false }),
            supabase.from("routine_step_logs").select("routine_step_id,completed").eq("user_id", user.id).eq("date", currentDayKey),
            supabase.from("habit_logs").select("habit_id,completed").eq("user_id", user.id).eq("date", currentDayKey),
            supabase
              .from("routine_logs")
              .select("date,completed_steps,total_steps")
              .eq("user_id", user.id)
              .order("date", { ascending: false }),
            supabase
              .from("daily_reviews")
              .select("what_went_well,what_to_improve,mood,notes")
              .eq("user_id", user.id)
              .eq("date", currentDayKey)
              .maybeSingle(),
          ]);

        if (routineResult.error) throw routineResult.error;
        if (habitsResult.error) throw habitsResult.error;
        if (goalsResult.error) throw goalsResult.error;
        if (stepLogResult.error) throw stepLogResult.error;
        if (habitLogResult.error) throw habitLogResult.error;
        if (historyResult.error) throw historyResult.error;
        if (reviewResult.error) throw reviewResult.error;

        const routineRow = routineResult.data?.[0] ?? null;
        const routineId = routineRow?.id ?? null;

        const stepsResult = routineId
          ? await supabase
              .from("routine_steps")
              .select("id,title,description,position,minutes,is_required")
              .eq("routine_id", routineId)
              .order("position")
          : { data: [], error: null };

        if (stepsResult.error) throw stepsResult.error;

        if (!mounted) return;

        const nextSnapshot: CachedMorningRitualSnapshot = {
          userId: user.id,
          dayKey: currentDayKey,
          userEmail: email,
          routine: routineRow,
          routineSteps: (stepsResult.data as RoutineStep[]) ?? [],
          habits: (habitsResult.data as Habit[]) ?? [],
          goals: (goalsResult.data as Goal[]) ?? [],
          stepLogs: (stepLogResult.data as RoutineStepLog[]) ?? [],
          habitLogs: (habitLogResult.data as HabitLog[]) ?? [],
          routineHistory: (historyResult.data as RoutineLog[]) ?? [],
          review:
            reviewResult.data ?? {
              what_went_well: "",
              what_to_improve: "",
              mood: "",
              notes: "",
            },
        };

        morningRitualSnapshotCache = nextSnapshot;
        setRoutine(nextSnapshot.routine);
        setRoutineDraft({ name: nextSnapshot.routine?.name ?? "" });
        setRoutineSteps(nextSnapshot.routineSteps);
        setHabits(nextSnapshot.habits);
        setGoals(nextSnapshot.goals);
        setStepLogs(nextSnapshot.stepLogs);
        setHabitLogs(nextSnapshot.habitLogs);
        setRoutineHistory(nextSnapshot.routineHistory);
        setReview(nextSnapshot.review);
        setHasLoadedData(true);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Falha ao carregar o app.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [router, currentDayKey, snapshotTick]);
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(reminderStorageKey, JSON.stringify(reminderSettings));
  }, [reminderSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

    const applyStandalone = window.setTimeout(() => {
      setIsStandaloneApp(standalone);
    }, 0);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setIsStandaloneApp(true);
      setReminderFeedback("App instalado. Agora ele pode ser aberto como aplicativo no celular.");
    };

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleStandaloneChange = () => {
      const nextStandalone = mediaQuery.matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      setIsStandaloneApp(nextStandalone);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    mediaQuery.addEventListener("change", handleStandaloneChange);

    return () => {
      window.clearTimeout(applyStandalone);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery.removeEventListener("change", handleStandaloneChange);
    };
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      !reminderSettings.enabled
    ) {
      return;
    }

    const timers: number[] = [];

    const scheduleReminder = (kind: ReminderKind, timeValue: string) => {
      const nextOccurrence = getNextOccurrence(timeValue);
      const delay = Math.max(1000, nextOccurrence.getTime() - Date.now());

      const timer = window.setTimeout(() => {
        const title = kind === "morning" ? "Hora de começar a manhã" : "Hora de fechar a noite";
        const body =
          kind === "morning"
            ? "Abra o Morning Ritual e faça o check-in da manhã."
            : "Abra o Morning Ritual e conclua a revisão da noite.";

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(title, {
            body,
            tag: `morning-ritual-${kind}`,
          });
        } else {
          setReminderFeedback(body);
        }

        setReminderTick((current) => current + 1);
      }, delay);

      timers.push(timer);
    };

    scheduleReminder("morning", reminderSettings.morningTime);
    scheduleReminder("night", reminderSettings.nightTime);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [reminderSettings, reminderTick]);

  async function syncReminderSubscription(enabled: boolean) {
    if (!enabled) {
      return { status: "disabled" as const };
    }

    const oneSignal = getOneSignal();
    if (!oneSignal || !oneSignalAppId) {
      return { status: "local" as const };
    }

    if (typeof oneSignal.Notifications?.requestPermission !== "function") {
      return { status: "local" as const };
    }

    const permission = await oneSignal.Notifications.requestPermission();
    if (permission !== "granted") {
      return { status: "blocked" as const };
    }

    return { status: "onesignal" as const };
  }

  async function enableReminderNotifications() {
    if (!supportsReminderNotifications) {
      setReminderFeedback(
        isIOSDevice && !isStandaloneApp
          ? "No iPhone, instale o app na Tela de Início para ativar lembretes."
          : "Este navegador não suporta notificações."
      );
      setReminderSettings((current) => ({ ...current, enabled: false }));
      return;
    }

    try {
      const pushResult = await syncReminderSubscription(true);
      if (pushResult.status === "blocked") {
        setReminderSettings((current) => ({ ...current, enabled: false }));
        setReminderFeedback("Permissão negada. Dá para salvar os horários, mas sem alerta do OneSignal.");
        return;
      }

      setReminderSettings((current) => ({ ...current, enabled: true }));
      setReminderFeedback(
        pushResult.status === "onesignal"
          ? "Notificações ativadas com OneSignal."
          : oneSignalAppId
            ? "OneSignal ainda está carregando. O teste fica como notificação no app por enquanto."
            : "Lembretes ativados no app. Configure o appId do OneSignal para push remoto."
      );
    } catch (error) {
      console.error("Erro ao registrar notificações", error);
      setReminderSettings((current) => ({ ...current, enabled: true }));
      setReminderFeedback(
        "Não consegui concluir a ativação agora, mas o app segue mostrando o lembrete enquanto estiver aberto."
      );
    }
  }

  async function disableReminderNotifications() {
    try {
      await syncReminderSubscription(false);
    } catch (error) {
      console.error("Erro ao desativar notificações", error);
    }

    setReminderSettings((current) => ({ ...current, enabled: false }));
    setReminderFeedback("Lembretes desativados.");
  }

  async function installApp() {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      setReminderFeedback(
        choice.outcome === "accepted"
          ? "Instalação aceita. O app está pronto na tela inicial."
          : "Instalação cancelada. Você pode tentar de novo depois."
      );
      setDeferredInstallPrompt(null);
      return;
    }

    if (isIOSDevice || !("BeforeInstallPromptEvent" in window) || !deferredInstallPrompt) {
      setInstallModalOpen(true);
      setReminderFeedback(null);
      return;
    }

    setReminderFeedback(
      isStandaloneApp
        ? "Você já está usando o app instalado no celular."
        : "Para instalar, use o menu do navegador e escolha 'Adicionar à tela inicial'."
    );
  }

  function dismissInstallHint() {
    setInstallHintDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(installHintStorageKey, "1");
    }
  }

  async function sendReminderPreview(kind: ReminderKind) {
    const title = kind === "morning" ? "Hora de começar a manhã" : "Hora de fechar a noite";
    const body =
      kind === "morning"
        ? "Abra o Morning Ritual e faça o check-in da manhã."
        : "Abra o Morning Ritual e conclua a revisão da noite.";

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, tag: `morning-ritual-test-${kind}` });
      setReminderFeedback(
        oneSignalAppId
          ? "Teste enviado no app. O envio real fica com o OneSignal quando você disparar por lá."
          : "Teste enviado no app."
      );
      return;
    }

    setReminderFeedback(body);
  }

  async function syncRoutineProgress(
    supabase = createSupabaseBrowserClient(),
    stepState: RoutineStepLog[] = stepLogs
  ) {
    if (!routine) return;

    const completedSteps = stepState.filter((item) => item.completed).length;
    await supabase.from("routine_logs").upsert(
      {
        routine_id: routine.id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        date: currentDayKey,
        completed_steps: completedSteps,
        total_steps: routineSteps.length,
        completed_at: completedSteps === routineSteps.length && routineSteps.length > 0 ? new Date().toISOString() : null,
      },
      { onConflict: "routine_id,date" }
    );
  }

  async function toggleStep(stepId: string) {
    const supabase = createSupabaseBrowserClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;
    if (!user || !routine) return;

    const current = stepLogs.find((log) => log.routine_step_id === stepId)?.completed ?? false;
    const next = !current;
    setSaving(stepId);

    try {
      const { error: upsertError } = await supabase.from("routine_step_logs").upsert(
        {
          routine_id: routine.id,
          routine_step_id: stepId,
          user_id: user.id,
          date: currentDayKey,
          completed: next,
          completed_at: next ? new Date().toISOString() : null,
        },
        { onConflict: "routine_step_id,date" }
      );
      if (upsertError) throw upsertError;

      const updated = stepLogs.some((log) => log.routine_step_id === stepId)
        ? stepLogs.map((log) => (log.routine_step_id === stepId ? { ...log, completed: next } : log))
        : [...stepLogs, { routine_step_id: stepId, completed: next }];

      setStepLogs(updated);
      await syncRoutineProgress(supabase, updated);
      const { data: historyResult } = await supabase
        .from("routine_logs")
        .select("date,completed_steps,total_steps")
        .eq("user_id", user.id)
        .order("date", { ascending: false });
      setRoutineHistory((historyResult as RoutineLog[]) ?? []);
      setSnapshotTick((current) => current + 1);
    } finally {
      setSaving(null);
    }
  }

  async function toggleHabit(habitId: string) {
    const supabase = createSupabaseBrowserClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;
    if (!user) return;

    const current = habitLogs.find((log) => log.habit_id === habitId)?.completed ?? false;
    const next = !current;
    setSaving(habitId);

    try {
      const { error: upsertError } = await supabase.from("habit_logs").upsert(
        {
          habit_id: habitId,
          user_id: user.id,
          date: currentDayKey,
          completed: next,
          completed_at: next ? new Date().toISOString() : null,
        },
        { onConflict: "habit_id,date" }
      );
      if (upsertError) throw upsertError;

      setHabitLogs((currentLogs) =>
        currentLogs.some((log) => log.habit_id === habitId)
          ? currentLogs.map((log) => (log.habit_id === habitId ? { ...log, completed: next } : log))
          : [...currentLogs, { habit_id: habitId, completed: next }]
      );
      setSnapshotTick((current) => current + 1);
    } finally {
      setSaving(null);
    }
  }

  async function saveHabit() {
    const supabase = createSupabaseBrowserClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;
    if (!user || !habitDraft.title.trim()) return;

    const payload = {
      title: habitDraft.title.trim(),
      description: habitDraft.description.trim() || null,
      frequency: habitDraft.frequency,
      active: true,
    };

    setHabitAction(editingHabitId ?? "create");
    try {
      if (editingHabitId) {
        const { data, error } = await supabase
          .from("habits")
          .update(payload)
          .eq("id", editingHabitId)
          .select("id,title,description,frequency,active")
          .single();
        if (error) throw error;
        setHabits((current) => current.map((habit) => (habit.id === editingHabitId ? (data as Habit) : habit)));
      } else {
        const { data, error } = await supabase
          .from("habits")
          .insert({
            user_id: user.id,
            ...payload,
          })
          .select("id,title,description,frequency,active")
          .single();
        if (error) throw error;
        setHabits((current) => [...current, data as Habit]);
      }
      setHabitDraft({ title: "", description: "", frequency: "daily" });
      setEditingHabitId(null);
    } finally {
      setHabitAction(null);
    }
  }

  function editHabit(habit: Habit) {
    setEditingHabitId(habit.id);
    setHabitDraft({
      title: habit.title,
      description: habit.description ?? "",
      frequency: habit.frequency,
    });
  }

  async function toggleHabitActive(habitId: string) {
    const supabase = createSupabaseBrowserClient();
    const current = habits.find((habit) => habit.id === habitId);
    if (!current) return;

    setHabitAction(habitId);
    try {
      const { error } = await supabase
        .from("habits")
        .update({ active: !current.active })
        .eq("id", habitId)
        .select("id,title,description,frequency,active");
      if (error) throw error;
      setHabits((currentHabits) =>
        currentHabits.map((habit) => (habit.id === habitId ? { ...habit, active: !habit.active } : habit))
      );
    } finally {
      setHabitAction(null);
    }
  }

  async function deleteHabit(habitId: string) {
    const supabase = createSupabaseBrowserClient();
    setHabitAction(habitId);
    try {
      const { error } = await supabase.from("habits").delete().eq("id", habitId);
      if (error) throw error;
      setHabits((currentHabits) => currentHabits.filter((habit) => habit.id !== habitId));
      setHabitLogs((currentLogs) => currentLogs.filter((log) => log.habit_id !== habitId));
    } finally {
      setHabitAction(null);
    }
  }

  async function updateRoutineName() {
    const supabase = createSupabaseBrowserClient();
    if (!routine || !routineDraft.name.trim()) return;

    setRoutineAction(routine.id);
    try {
      const { error } = await supabase
        .from("routines")
        .update({ name: routineDraft.name.trim() })
        .eq("id", routine.id);
      if (error) throw error;
      setRoutine({ ...routine, name: routineDraft.name.trim() });
    } finally {
      setRoutineAction(null);
    }
  }

  async function saveStep() {
    const supabase = createSupabaseBrowserClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;
    if (!user || !routine || !stepDraft.title.trim()) return;

    const payload = {
      routine_id: routine.id,
      title: stepDraft.title.trim(),
      description: stepDraft.description.trim() || null,
      position: Number(stepDraft.position) || routineSteps.length + 1,
      minutes: stepDraft.minutes ? Number(stepDraft.minutes) : null,
      is_required: stepDraft.is_required,
    };

    setStepAction(editingStepId ?? "create");
    try {
      if (editingStepId) {
        const { data, error } = await supabase
          .from("routine_steps")
          .update(payload)
          .eq("id", editingStepId)
          .select("id,title,description,position,minutes,is_required")
          .single();
        if (error) throw error;
        setRoutineSteps((current) => current.map((step) => (step.id === editingStepId ? (data as RoutineStep) : step)).sort((a, b) => a.position - b.position));
      } else {
        const { data, error } = await supabase
          .from("routine_steps")
          .insert(payload)
          .select("id,title,description,position,minutes,is_required")
          .single();
        if (error) throw error;
        setRoutineSteps((current) => [...current, data as RoutineStep].sort((a, b) => a.position - b.position));
      }
      setStepDraft({ title: "", description: "", position: "", minutes: "", is_required: true });
      setEditingStepId(null);
    } finally {
      setStepAction(null);
    }
  }

  function editStep(step: RoutineStep) {
    setEditingStepId(step.id);
    setStepDraft({
      title: step.title,
      description: step.description ?? "",
      position: String(step.position),
      minutes: step.minutes ? String(step.minutes) : "",
      is_required: step.is_required,
    });
  }

  async function deleteStep(stepId: string) {
    const supabase = createSupabaseBrowserClient();
    setStepAction(stepId);
    try {
      const { error } = await supabase.from("routine_steps").delete().eq("id", stepId);
      if (error) throw error;
      setRoutineSteps((current) => current.filter((step) => step.id !== stepId));
      setStepLogs((current) => current.filter((log) => log.routine_step_id !== stepId));
    } finally {
      setStepAction(null);
    }
  }

  async function saveGoal() {
    const supabase = createSupabaseBrowserClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;
    if (!user || !goalDraft.title.trim()) return;

    const payload = {
      user_id: user.id,
      title: goalDraft.title.trim(),
      description: goalDraft.description.trim() || null,
      target_value: goalDraft.target_value ? Number(goalDraft.target_value) : null,
      current_value: Number(goalDraft.current_value) || 0,
      status: goalDraft.status,
    };

    setGoalAction(editingGoalId ?? "create");
    try {
      if (editingGoalId) {
        const { data, error } = await supabase
          .from("goals")
          .update(payload)
          .eq("id", editingGoalId)
          .select("id,title,description,target_value,current_value,status")
          .single();
        if (error) throw error;
        setGoals((current) => current.map((goal) => (goal.id === editingGoalId ? (data as Goal) : goal)));
      } else {
        const { data, error } = await supabase
          .from("goals")
          .insert(payload)
          .select("id,title,description,target_value,current_value,status")
          .single();
        if (error) throw error;
        setGoals((current) => [data as Goal, ...current]);
      }
      setGoalDraft({ title: "", description: "", target_value: "", current_value: "0", status: "active" });
      setEditingGoalId(null);
    } finally {
      setGoalAction(null);
    }
  }

  function editGoal(goal: Goal) {
    setEditingGoalId(goal.id);
    setGoalDraft({
      title: goal.title,
      description: goal.description ?? "",
      target_value: goal.target_value ? String(goal.target_value) : "",
      current_value: String(goal.current_value),
      status: goal.status,
    });
  }

  async function deleteGoal(goalId: string) {
    const supabase = createSupabaseBrowserClient();
    setGoalAction(goalId);
    try {
      const { error } = await supabase.from("goals").delete().eq("id", goalId);
      if (error) throw error;
      setGoals((current) => current.filter((goal) => goal.id !== goalId));
    } finally {
      setGoalAction(null);
    }
  }

  async function setGoalStatus(goalId: string, status: Goal["status"]) {
    const supabase = createSupabaseBrowserClient();
    setGoalAction(goalId);
    try {
      const { error } = await supabase.from("goals").update({ status }).eq("id", goalId);
      if (error) throw error;
      setGoals((current) => current.map((goal) => (goal.id === goalId ? { ...goal, status } : goal)));
    } finally {
      setGoalAction(null);
    }
  }

  async function saveReview() {
    const supabase = createSupabaseBrowserClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;
    if (!user) return;

    setSaving("review");
    try {
      const { error } = await supabase.from("daily_reviews").upsert(
        {
          user_id: user.id,
          date: currentDayKey,
          what_went_well: review.what_went_well || null,
          what_to_improve: review.what_to_improve || null,
          mood: review.mood || null,
          notes: review.notes || null,
        },
        { onConflict: "user_id,date" }
      );
      if (error) throw error;
      setSnapshotTick((current) => current + 1);
    } finally {
      setSaving(null);
    }
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  if (loading && !hasLoadedData) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 text-sm text-slate-300">
          Carregando sua rotina...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center">
          <div className="rounded-[2rem] border border-rose-400/20 bg-rose-500/10 p-6 text-sm text-rose-100">
            <p className="font-semibold">Deu ruim ao carregar o app.</p>
            <p className="mt-2">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Recarregar
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 px-4 py-6 pb-[calc(24rem+env(safe-area-inset-bottom))] text-slate-50 sm:px-6 lg:px-8 md:pb-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:gap-6">
        <header className="flex flex-col gap-2 rounded-[2rem] border border-white/10 bg-white/5 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.35em] text-cyan-300/80">Hoje</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{screenTitle}</h1>
            <p className="mt-2 max-w-xl text-xs leading-5 text-slate-300 sm:text-sm sm:leading-6">{userLabel} {screenDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              onClick={signOut}
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Sair
            </button>
          </div>
          {loading && hasLoadedData ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-300 sm:text-xs">Atualizando rotina em segundo plano...</p>
          ) : null}
          {!isStandaloneApp && !installHintDismissed ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 md:hidden">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-300">PWA</p>
                  <p className="mt-1 text-sm font-semibold text-white">Instale o Aplicativo</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    No iPhone, toque em instalar e eu mostro o passo a passo certo para adicionar à tela inicial.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={installApp}
                    className="rounded-full bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Instalar
                  </button>
                  <button
                    type="button"
                    onClick={dismissInstallHint}
                    className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div
            id="hoje"
            className={screen === "hoje" ? "scroll-mt-24 rounded-[2rem] border border-white/10 bg-white p-4 text-slate-950 shadow-2xl shadow-cyan-950/20 sm:p-6" : "hidden"}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-700">Hoje</p>
                <h2 className="mt-1 truncate text-xl font-black sm:text-2xl">{routine?.name ?? "Rotina principal"}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">{currentDateHeading} · {dayStatusText}</p>
              </div>
              <div className="w-fit self-start rounded-2xl bg-slate-950 px-3 py-2 text-right text-white sm:rounded-3xl sm:px-4 sm:py-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-cyan-300 sm:text-[10px]">Progresso</p>
                <p className="mt-1 text-xl font-black sm:text-2xl">{progressPercent}%</p>
                <p className="text-[10px] text-slate-300 sm:text-xs">concluído</p>
              </div>
            </div>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100 sm:mt-6 sm:h-3">
              <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:gap-3 xl:grid-cols-4">
              {[
                { label: "Passos", value: morningProgressText },
                { label: "Hábitos", value: habitProgressText },
                { label: "Noite", value: reviewStatusText },
                { label: "Sequência", value: `${streakDays} dias` },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500 sm:text-xs">{item.label}</p>
                  <p className="mt-1.5 text-base font-black text-slate-950 sm:mt-2 sm:text-xl">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:gap-3">
              <a
                href={nextActionHref}
                className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 sm:px-5 sm:py-3"
              >
                {nextActionLabel}
              </a>
              <Link
                href="/app/habitos"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:px-5 sm:py-3"
              >
                Hábitos
              </Link>
              <Link
                href="/app/config"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:px-5 sm:py-3"
              >
                Config
              </Link>
            </div>


            <div className="mt-6 space-y-3 sm:mt-8">
              {routineSteps.map((step, index) => {
                const completed = stepLogMap.get(step.id) ?? false;
                return (
                  <button
                    key={step.id}
                    type="button"
                    disabled={saving === step.id}
                    onClick={() => toggleStep(step.id)}
                    className={`flex w-full items-start gap-4 rounded-3xl border p-4 text-left transition ${
                      completed ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${completed ? "bg-cyan-400 text-slate-950" : "bg-slate-950 text-white"}`}>
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-950">{step.title}</p>
                        <span className="text-xs font-medium text-slate-500">{step.minutes ? `${step.minutes} min` : "tempo livre"}</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{step.description ?? ""}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${completed ? "bg-cyan-400 text-slate-950" : "bg-slate-100 text-slate-600"}`}>
                      {saving === step.id ? "salvando" : completed ? "feito" : "marcar"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div
              id="config"
              className={screen === "config" ? "rounded-[2rem] border border-cyan-400/20 bg-cyan-400/10 p-6 text-white" : "hidden"}
            >
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/80">Lembretes</p>
              <h3 className="mt-2 text-2xl font-black">Lembretes</h3>
              <p className="mt-2 text-sm leading-6 text-cyan-50/90">Defina manhã e noite sem sair desta tela.</p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/25 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-100/80">Rotina</p>
                <p className="mt-2 text-sm leading-6 text-cyan-50/90">Ajuste os passos e o onboarding aqui.</p>
                <Link
                  href="/onboarding"
                  className="mt-4 inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Abrir rotina
                </Link>
              </div>

              {reminderFeedback ? (
                <div className="mt-4 rounded-2xl bg-slate-950/30 px-4 py-3 text-sm leading-6 text-white">
                  {reminderFeedback}
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="block font-semibold text-cyan-50">Manhã</span>
                  <input
                    type="time"
                    value={reminderSettings.morningTime}
                    onChange={(event) =>
                      setReminderSettings((current) => ({ ...current, morningTime: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="block font-semibold text-cyan-50">Noite</span>
                  <input
                    type="time"
                    value={reminderSettings.nightTime}
                    onChange={(event) =>
                      setReminderSettings((current) => ({ ...current, nightTime: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white outline-none"
                  />
                </label>
              </div>

              <p className="mt-4 text-xs leading-5 text-cyan-50/80">
                {isIOSDevice && !isStandaloneApp
                  ? "No iPhone, instale na Tela de Início para liberar push."
                  : isAndroidDevice
                    ? "No Android, Chrome recebe push no navegador."
                    : "Push web funciona em navegadores compatíveis."}
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={reminderSettings.enabled ? disableReminderNotifications : enableReminderNotifications}
                  disabled={!supportsReminderNotifications && !reminderSettings.enabled}
                  className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    reminderSettings.enabled ? "bg-rose-500 hover:bg-rose-400" : "bg-slate-950 hover:bg-slate-800"
                  }`}
                >
                  {reminderSettings.enabled
                    ? "Desligar"
                    : isIOSDevice && !isStandaloneApp
                      ? "Instalar para ligar"
                      : "Ligar"}
                </button>
                <button
                  type="button"
                  onClick={() => sendReminderPreview("morning")}
                  disabled={!supportsReminderNotifications}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Testar manhã
                </button>
                <button
                  type="button"
                  onClick={() => sendReminderPreview("night")}
                  disabled={!supportsReminderNotifications}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Testar noite
                </button>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-950/20 p-4 text-sm leading-6 text-cyan-50">
                <p className="font-semibold text-white">Lembretes: {reminderSettings.enabled ? "ligados" : "desligados"}</p>
                <p className="mt-1">Canal: {reminderSettings.enabled ? (oneSignalAppId ? "OneSignal" : "app") : "desligado"}</p>
                <p className="mt-1">Permissão: {reminderPermissionText}</p>
                <p className="mt-1">Próximo lembrete da manhã: {morningReminderPreview.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                <p className="mt-1">Próximo lembrete da noite: {nightReminderPreview.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>

            <div
              id="manha"
              className={screen !== "config" ? "rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6" : "hidden"}
            >
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Manhã</p>
              <h3 className="mt-2 text-xl font-black sm:text-2xl">Check-in da manhã</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">Marque os passos e os hábitos para começar o dia com clareza, sem complicar. Se você quiser, comece pelo primeiro item e siga em sequência.</p>

              <div className="mt-5 space-y-3">
                {activeHabits.map((habit) => {
                  const done = habitLogMap.get(habit.id) ?? false;
                  return (
                    <button
                      key={habit.id}
                      type="button"
                      disabled={saving === habit.id}
                      onClick={() => toggleHabit(habit.id)}
                      className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                        done ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div>
                        <p className="font-medium text-white">{habit.title}</p>
                        <p className="mt-1 text-xs text-slate-400">{habit.description ?? "Hábito diário do MVP"}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${done ? "bg-cyan-400 text-slate-950" : "bg-white/10 text-slate-200"}`}>
                        {saving === habit.id ? "salvando" : done ? "feito" : "pendente"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              id="habitos"
              className={screen === "habitos" ? "rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6" : "hidden"}
            >
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Gerenciar hábitos</p>
              <h3 className="mt-2 text-2xl font-black">Criar, editar ou apagar</h3>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <div className="space-y-2.5">
                  <input
                    value={habitDraft.title}
                    onChange={(event) => setHabitDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Nome do hábito"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <input
                    value={habitDraft.description}
                    onChange={(event) => setHabitDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Descrição curta"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <select
                    value={habitDraft.frequency}
                    onChange={(event) => setHabitDraft((current) => ({ ...current, frequency: event.target.value as "daily" | "weekly" }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                  </select>
                  <button
                    type="button"
                    onClick={saveHabit}
                    disabled={habitAction !== null || !habitDraft.title.trim()}
                    className="w-full rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                  >
                    {habitAction === (editingHabitId ?? "create") ? "Salvando..." : editingHabitId ? "Atualizar hábito" : "Adicionar hábito"}
                  </button>
                  {editingHabitId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingHabitId(null);
                        setHabitDraft({ title: "", description: "", frequency: "daily" });
                      }}
                      className="w-full rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Cancelar edição
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {habits.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-sm text-slate-300">
                    Nenhum hábito ainda. Crie o primeiro para começar a controlar a rotina.
                  </div>
                ) : (
                  habits.map((habit) => (
                    <div key={habit.id} className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-white">{habit.title}</p>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                              {habit.frequency === "daily" ? "diário" : "semanal"}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${habit.active ? "bg-cyan-400/20 text-cyan-300" : "bg-white/10 text-slate-400"}`}>
                              {habit.active ? "ativo" : "pausado"}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-5 text-slate-300">{habit.description ?? "Sem descrição"}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => editHabit(habit)}
                            className="rounded-full border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/10"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleHabitActive(habit.id)}
                            disabled={habitAction === habit.id}
                            className="rounded-full border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                          >
                            {habitAction === habit.id ? "..." : habit.active ? "Pausar" : "Ativar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteHabit(habit.id)}
                            disabled={habitAction === habit.id}
                            className="rounded-full border border-rose-400/20 px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-60"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              className={screen === "config" ? "rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6" : "hidden"}
            >
              <h3 className="mt-2 text-2xl font-black">Nome e passos</h3>
              <div className="mt-4 space-y-3">
                <input
                  value={routineDraft.name}
                  onChange={(event) => setRoutineDraft({ name: event.target.value })}
                  placeholder="Nome da rotina"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={updateRoutineName}
                  disabled={!routineDraft.name.trim() || routineAction === routine?.id}
                  className="w-full rounded-full bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                >
                  {routineAction === routine?.id ? "Salvando..." : "Salvar nome da rotina"}
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{editingStepId ? "Editar passo" : "Novo passo"}</p>
                <div className="mt-3 space-y-2.5">
                  <input
                    value={stepDraft.title}
                    onChange={(event) => setStepDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Título do passo"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <input
                    value={stepDraft.description}
                    onChange={(event) => setStepDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Descrição"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      value={stepDraft.position}
                      onChange={(event) => setStepDraft((current) => ({ ...current, position: event.target.value }))}
                      placeholder="Posição"
                      type="number"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                    />
                    <input
                      value={stepDraft.minutes}
                      onChange={(event) => setStepDraft((current) => ({ ...current, minutes: event.target.value }))}
                      placeholder="Minutos"
                      type="number"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                    />
                  </div>
                  <label className="flex items-center gap-2.5 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={stepDraft.is_required}
                      onChange={(event) => setStepDraft((current) => ({ ...current, is_required: event.target.checked }))}
                    />
                    Passo obrigatório
                  </label>
                  <button
                    type="button"
                    onClick={saveStep}
                    disabled={stepAction !== null || !stepDraft.title.trim()}
                    className="w-full rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                  >
                    {stepAction === (editingStepId ?? "create") ? "Salvando..." : editingStepId ? "Atualizar passo" : "Adicionar passo"}
                  </button>
                  {editingStepId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStepId(null);
                        setStepDraft({ title: "", description: "", position: "", minutes: "", is_required: true });
                      }}
                      className="w-full rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Cancelar edição
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {routineSteps.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-sm text-slate-300">Nenhum passo cadastrado.</div>
                ) : (
                  routineSteps.map((step) => (
                    <div key={step.id} className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-white">{step.position}. {step.title}</p>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-300">{step.minutes ?? 0} min</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${step.is_required ? "bg-cyan-400/20 text-cyan-300" : "bg-white/10 text-slate-400"}`}>
                              {step.is_required ? "obrigatório" : "opcional"}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-5 text-slate-300">{step.description ?? "Sem descrição"}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => editStep(step)}
                            className="rounded-full border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/10"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteStep(step.id)}
                            disabled={stepAction === step.id}
                            className="rounded-full border border-rose-400/20 px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-60"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              className={screen === "config" ? "rounded-[2rem] bg-cyan-400 p-4 text-slate-950" : "hidden"}
            >
              <h3 className="mt-1 text-lg font-black">{activeGoal?.title ?? "Sem meta ativa"}</h3>
              <p className="mt-1.5 text-sm leading-5 text-slate-900/80">{activeGoal?.description ?? "Crie uma meta para acompanhar consistência e evolução."}</p>
              <div className="mt-2.5 rounded-2xl bg-white/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Progresso</p>
                <p className="mt-1 text-base font-black">{activeGoal ? `${activeGoalProgressValue}/${activeGoalTargetValue}` : "0/0"}</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.26em] text-cyan-300/80">Gerenciar metas</p>
              <h3 className="mt-2 text-lg font-black">Criar, editar, ativar</h3>
              <div className="mt-3 space-y-2.5">
                <input
                  value={goalDraft.title}
                  onChange={(event) => setGoalDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Título da meta"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <textarea
                  value={goalDraft.description}
                  onChange={(event) => setGoalDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Descrição da meta"
                  className="min-h-20 w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    value={goalDraft.current_value}
                    onChange={(event) => setGoalDraft((current) => ({ ...current, current_value: event.target.value }))}
                    placeholder="Atual"
                    type="number"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <input
                    value={goalDraft.target_value}
                    onChange={(event) => setGoalDraft((current) => ({ ...current, target_value: event.target.value }))}
                    placeholder="Meta"
                    type="number"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
                <select
                  value={goalDraft.status}
                  onChange={(event) => setGoalDraft((current) => ({ ...current, status: event.target.value as Goal["status"] }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none"
                >
                  <option value="active">Ativa</option>
                  <option value="paused">Pausada</option>
                  <option value="done">Concluída</option>
                </select>
                <button
                  type="button"
                  onClick={saveGoal}
                  disabled={goalAction !== null || !goalDraft.title.trim()}
                  className="w-full rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                >
                  {goalAction === (editingGoalId ?? "create") ? "Salvando..." : editingGoalId ? "Atualizar meta" : "Adicionar meta"}
                </button>
                {editingGoalId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGoalId(null);
                      setGoalDraft({ title: "", description: "", target_value: "", current_value: "0", status: "active" });
                    }}
                    className="w-full rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Cancelar edição
                  </button>
                ) : null}
              </div>

              <div className="mt-3.5 space-y-2.5">
                {goals.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">Nenhuma meta cadastrada.</div>
                ) : (
                  goals.map((goal) => (
                    <div key={goal.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-white">{goal.title}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${goal.status === "active" ? "bg-cyan-400/20 text-cyan-300" : "bg-white/10 text-slate-400"}`}>
                              {goal.status === "active" ? "ativa" : goal.status === "paused" ? "pausada" : "concluída"}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-5 text-slate-300">{goal.description ?? "Sem descrição"}</p>
                          <p className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">{goal.id === activeGoal?.id ? `${activeGoalProgressValue}/${activeGoalTargetValue}` : `${goal.current_value}/${goal.target_value ?? 0}`}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => editGoal(goal)}
                            className="rounded-full border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/10"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setGoalStatus(goal.id, goal.status === "active" ? "paused" : "active")}
                            disabled={goalAction === goal.id}
                            className="rounded-full border border-cyan-400/20 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-500/10 disabled:opacity-60"
                          >
                            {goal.status === "active" ? "Pausar" : "Ativar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteGoal(goal.id)}
                            disabled={goalAction === goal.id}
                            className="rounded-full border border-rose-400/20 px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-60"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              id="noite"
              className={screen === "hoje" ? "rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6" : "hidden"}
            >
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Noite</p>
              <h3 className="mt-2 text-xl font-black sm:text-2xl">Fechamento do dia</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">Use esta área para registrar o que saiu bem, o que precisa ajustar e como terminou o dia. Essa é a parte que fecha o ciclo.</p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
                <p className="font-semibold text-white">{reviewStatusText}</p>
                <p className="mt-1 leading-6 text-slate-300">
                  {reviewHasContent
                    ? "Você já deixou o fechamento pronto. Se quiser, pode atualizar os campos agora."
                    : "Preencha no fim do dia para fechar o ciclo e começar amanhã com mais clareza."}
                </p>
              </div>
              <div className="mt-4 space-y-3">
                <textarea
                  value={review.what_went_well ?? ""}
                  onChange={(event) => setReview((current) => ({ ...current, what_went_well: event.target.value }))}
                  placeholder="O que saiu bem hoje?"
                  className="min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <textarea
                  value={review.what_to_improve ?? ""}
                  onChange={(event) => setReview((current) => ({ ...current, what_to_improve: event.target.value }))}
                  placeholder="O que melhorar amanhã?"
                  className="min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <input
                  value={review.mood ?? ""}
                  onChange={(event) => setReview((current) => ({ ...current, mood: event.target.value }))}
                  placeholder="Humor / energia"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <textarea
                  value={review.notes ?? ""}
                  onChange={(event) => setReview((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Notas extras"
                  className="min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={saveReview}
                  disabled={saving === "review"}
                  className="w-full rounded-full bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                >
                  {saving === "review" ? "Salvando..." : "Salvar revisão"}
                </button>
              </div>
            </div>

          </aside>
        </section>

        <section className={screen !== "habitos" ? "grid gap-4 sm:gap-6 lg:grid-cols-[0.9fr_1.1fr]" : "hidden"}>
          <div
            className={screen !== "habitos" ? "rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6" : "hidden"}
          >
            <h3 className="mt-2 text-xl font-black sm:text-2xl">Últimos 7 dias</h3>
            <div className="mt-5 space-y-3">
              {routineHistory.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Ainda sem histórico. Hoje é o primeiro ponto de virada.</div>
              ) : (
                routineHistory.slice(0, 7).map((entry) => {
                  const percent = entry.total_steps ? Math.round((entry.completed_steps / entry.total_steps) * 100) : 0;
                  return (
                    <div key={entry.date} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{entry.date}</p>
                        <p className="text-sm text-cyan-300">{percent}%</p>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${percent}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{entry.completed_steps}/{entry.total_steps} passos concluídos</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div
            className={screen !== "habitos" ? "rounded-[2rem] border border-white/10 bg-white/5 p-4 sm:p-6" : "hidden"}
          >
            <h3 className="mt-2 text-xl font-black sm:text-2xl">Resumo do que ficou salvo</h3>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Passos ativos</p>
                <p className="mt-2 text-2xl font-black">{routineSteps.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Hábitos ativos</p>
                <p className="mt-2 text-2xl font-black">{activeHabits.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Meta ativa</p>
                <p className="mt-2 text-lg font-black">{activeGoal?.status ?? "nenhuma"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Data de hoje</p>
                <p className="mt-2 text-lg font-black">{today}</p>
              </div>
            </div>
          </div>
        </section>

        {installModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 px-4 pb-4 pt-12 backdrop-blur-sm md:items-center md:pb-0">
            <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950 p-5 text-white shadow-2xl shadow-slate-950/60">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-300">Mobile / PWA</p>
                  <h3 className="mt-2 text-xl font-black">Instale o Aplicativo</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInstallModalOpen(false)}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                {isIOSDevice ? (
                  <>
                    <p>No iPhone, faça assim:</p>
                    <ol className="list-decimal space-y-1 pl-5">
                      <li>Toque no botão de compartilhamento do Safari.</li>
                      <li>Escolha <span className="font-semibold text-white">Adicionar à Tela de Início</span>.</li>
                      <li>Confirme em <span className="font-semibold text-white">Adicionar</span>.</li>
                    </ol>
                  </>
                ) : deferredInstallPrompt ? (
                  <>
                    <p>O navegador já pode instalar o app agora.</p>
                    <p>Toque em <span className="font-semibold text-white">Instalar</span> para criar o ícone na tela inicial.</p>
                  </>
                ) : (
                  <>
                    <p>Se o navegador não mostrar o prompt, use o menu e escolha adicionar à tela inicial.</p>
                  </>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {deferredInstallPrompt && !isIOSDevice ? (
                  <button
                    type="button"
                    onClick={installApp}
                    className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Instalar agora
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    dismissInstallHint();
                    setInstallModalOpen(false);
                  }}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
