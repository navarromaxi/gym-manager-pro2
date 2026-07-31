export type RoutineExercise = { name: string; sets: number; reps: string; weight: string; rest: string; notes: string };
export type RoutineSection = { id: string; title: string; exercises: RoutineExercise[] };
export type WeeklyDayPlan = RoutineExercise[] | RoutineSection[];
export type WeeklyPlan = Record<string, WeeklyDayPlan>;

export const WEEK_DAYS = [
  { key: "monday", label: "Lunes" }, { key: "tuesday", label: "Martes" }, { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" }, { key: "friday", label: "Viernes" }, { key: "saturday", label: "Sábado" }, { key: "sunday", label: "Domingo" },
] as const;

export function emptyExercise(): RoutineExercise { return { name: "", sets: 3, reps: "", weight: "", rest: "", notes: "" }; }
export function blankExercises(rows = 4): RoutineExercise[] { return Array.from({ length: rows }, () => emptyExercise()); }
export function createSection(title = "Nueva sección", rows = 4): RoutineSection { return { id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, exercises: blankExercises(rows) }; }

export function getDaySections(plan: WeeklyPlan | null | undefined, day: string): RoutineSection[] {
  const value = plan?.[day];
  if (!Array.isArray(value) || !value.length) return [];
  if ("exercises" in value[0]) return value as RoutineSection[];
  return [{ id: `legacy-${day}`, title: "Ejercicios", exercises: value as RoutineExercise[] }];
}

export function getDayExercises(plan: WeeklyPlan | null | undefined, day: string): RoutineExercise[] {
  return getDaySections(plan, day).flatMap((section) => section.exercises);
}

export function normalizeWeeklyPlan(plan: WeeklyPlan | null | undefined): WeeklyPlan {
  return Object.fromEntries(Object.keys(plan ?? {}).map((day) => [day, getDaySections(plan, day)]));
}
