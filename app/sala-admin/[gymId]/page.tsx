"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { RoutineRoomMode, type RoomRoutine } from "@/features/routines/components/routine-room-mode";
import type { WeeklyPlan } from "@/features/routines/routine-plan";

type Member = { id: string; name: string };
type RoutineRow = { id: string; name: string; description?: string | null; target_audience?: string | null; difficulty?: string | null; duration?: number | null; exercises?: unknown; member_id?: string | null; weekly_plan?: unknown; valid_from?: string | null; valid_until?: string | null; archived_at?: string | null; day_intensities?: Record<string, "green" | "yellow" | "red"> | null; plan_cycle?: "weekly" | "biweekly" | "monthly" | null; cycle_plan?: Record<string, WeeklyPlan> | null };

export default function AdminRoomPage() {
  const { gymId = "" } = useParams<{ gymId: string }>();
  const [routines, setRoutines] = useState<RoomRoutine[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!gymId) return;
    const load = async () => {
      setLoading(true);
      const [{ data: routineData, error: routinesError }, { data: memberData, error: membersError }] = await Promise.all([
        supabase.from("routines").select("id, name, description, target_audience, difficulty, duration, exercises, member_id, weekly_plan, valid_from, valid_until, archived_at, day_intensities, plan_cycle, cycle_plan").eq("gym_id", gymId).order("name"),
        supabase.from("members").select("id, name").eq("gym_id", gymId).order("name"),
      ]);
      if (routinesError || membersError) {
        console.error("Error loading room", routinesError ?? membersError);
        setError("No pudimos abrir esta sala. Verificá que hayas iniciado sesión en este gimnasio.");
      } else {
        setMembers((memberData ?? []) as Member[]);
        setRoutines(((routineData ?? []) as RoutineRow[]).map((routine) => ({
          id: routine.id,
          name: routine.name,
          description: routine.description ?? "",
          targetAudience: routine.target_audience ?? "",
          difficulty: routine.difficulty ?? "",
          duration: routine.duration ?? 0,
          exercises: Array.isArray(routine.exercises) ? routine.exercises as RoomRoutine["exercises"] : [],
          memberId: routine.member_id ?? null,
          weeklyPlan: routine.weekly_plan && typeof routine.weekly_plan === "object" ? routine.weekly_plan as WeeklyPlan : {},
          validFrom: routine.valid_from ?? null,
          validUntil: routine.valid_until ?? null,
          archivedAt: routine.archived_at ?? null,
          dayIntensities: routine.day_intensities ?? {},
          planCycle: routine.plan_cycle ?? "weekly",
          cyclePlan: routine.cycle_plan ?? {},
        })));
      }
      setLoading(false);
    };
    void load();
  }, [gymId]);

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-background p-6"><p className="text-muted-foreground">Abriendo modo sala...</p></main>;
  if (error) return <main className="flex min-h-screen items-center justify-center bg-background p-6"><div className="max-w-md rounded-2xl border p-6 text-center"><Dumbbell className="mx-auto h-8 w-8 text-blue-600" /><h1 className="mt-3 text-xl font-black">No pudimos abrir la sala</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p></div></main>;
  return <main className="min-h-screen bg-background p-4 sm:p-6"><RoutineRoomMode routines={routines} members={members} onExit={() => window.close()} onRefresh={() => window.location.reload()} onRoutineOpened={(routine) => { void supabase.from("routines").update({ last_opened_at: new Date().toISOString() }).eq("id", routine.id).eq("gym_id", gymId); }} /></main>;
}
