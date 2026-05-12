import { defaultGoal, defaultHabits, defaultRoutineSteps } from "@/lib/morning-ritual";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function bootstrapMorningRitual(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
) {
  const profileResult = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profileResult.data) {
    await supabase.from("profiles").insert({
      user_id: userId,
      name: email?.split("@")[0] ?? "Edson",
      goal_type: "rotina_da_manha",
      morning_minutes: 20,
    });
  }

  let routineId: string | null = null;
  const routineResult = await supabase
    .from("routines")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (routineResult.data?.id) {
    routineId = routineResult.data.id;
  } else {
    const createdRoutine = await supabase
      .from("routines")
      .insert({ user_id: userId, name: "Rotina principal", is_default: true })
      .select("id")
      .single();
    routineId = createdRoutine.data?.id ?? null;
  }

  if (routineId) {
    const existingSteps = await supabase
      .from("routine_steps")
      .select("id")
      .eq("routine_id", routineId);

    if (!existingSteps.data || existingSteps.data.length === 0) {
      await supabase.from("routine_steps").insert(
        defaultRoutineSteps.map((step, index) => ({
          routine_id: routineId,
          title: step.title,
          description: step.description,
          position: index + 1,
          minutes: Number(step.duration.replace(/\D+/g, "")) || null,
          is_required: step.isRequired,
        }))
      );
    }
  }

  const existingHabits = await supabase.from("habits").select("id").eq("user_id", userId);
  if (!existingHabits.data || existingHabits.data.length === 0) {
    await supabase.from("habits").insert(
      defaultHabits.map((habit) => ({
        user_id: userId,
        title: habit.title,
        description: null,
        frequency: "daily",
        active: habit.active,
      }))
    );
  }

  const existingGoals = await supabase.from("goals").select("id").eq("user_id", userId);
  if (!existingGoals.data || existingGoals.data.length === 0) {
    await supabase.from("goals").insert({
      user_id: userId,
      title: defaultGoal.title,
      description: defaultGoal.description,
      status: "active",
      current_value: 0,
      target_value: 30,
    });
  }

  return { routineId };
}
