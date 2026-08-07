"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type LibraryExerciseOption = {
  id: string;
  name: string;
  category: string;
  instructions: string | null;
  video_url: string | null;
};

export function ExerciseLibraryPicker({
  value,
  exercises,
  onSelect,
}: {
  value: string;
  exercises: LibraryExerciseOption[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () => Array.from(new Set(exercises.map((item) => item.category || "General"))).sort(),
    [exercises],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return exercises
      .filter((item) => {
        const matchesCategory = category === "all" || (item.category || "General") === category;
        const matchesQuery = !normalized || [item.name, item.category, item.instructions]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalized);
        return matchesCategory && matchesQuery;
      })
      .slice(0, 40);
  }, [category, exercises, query]);

  const choose = (name: string) => {
    onSelect(name);
    setOpen(false);
    setQuery("");
    setCategory("all");
  };

  return (
    <div className="relative flex min-w-44">
      <Input
        value={value}
        onChange={(event) => onSelect(event.target.value)}
        className="h-9 border-slate-200 bg-white pr-9 text-slate-950 placeholder:text-slate-400"
        placeholder="Escribir ejercicio..."
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Abrir biblioteca de ejercicios" className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-r border border-l-0 border-blue-700 bg-blue-700 text-white hover:bg-blue-800">
            <ChevronDown className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="z-50 flex w-[min(380px,calc(100vw-32px))] max-h-[calc(100dvh-2rem)] flex-col overflow-hidden border-blue-400 p-0"
          style={{ backgroundColor: "#0f2742", color: "#f8fafc" }}
        >
        <div className="shrink-0 border-b border-blue-700 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4" style={{ color: "#bfdbfe" }} />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 border-blue-300 bg-white pl-9 text-slate-950 placeholder:text-slate-500"
              placeholder="Buscar ejercicio..."
            />
          </div>
          <div className="mt-2 flex max-h-20 flex-wrap gap-1 overflow-y-auto">
            <button type="button" onClick={() => setCategory("all")} className={category === "all" ? "rounded-full bg-sky-400 px-2 py-1 text-xs font-semibold text-slate-950" : "rounded-full bg-slate-700 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-600"}>Todas</button>
            {categories.map((item) => (
              <button type="button" key={item} onClick={() => setCategory(item)} className={category === item ? "rounded-full bg-sky-400 px-2 py-1 text-xs font-semibold text-slate-950" : "rounded-full bg-slate-700 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-600"}>{item}</button>
            ))}
          </div>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1"
          onWheel={(event) => event.stopPropagation()}
        >
          {query.trim() && !exercises.some((item) => item.name.trim().toLowerCase() === query.trim().toLowerCase()) ? (
            <button type="button" onClick={() => choose(query.trim())} className="w-full rounded-lg border border-dashed border-sky-300 bg-sky-100 px-3 py-2 text-left text-sm font-semibold text-slate-950 hover:bg-sky-200">
              Usar "{query.trim()}" sin biblioteca
            </button>
          ) : null}
          {filtered.map((exercise) => (
            <button type="button" key={exercise.id} onClick={() => choose(exercise.name)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-sky-900" style={{ color: "#f8fafc" }}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold" style={{ color: "#ffffff" }}>{exercise.name}</span>
                <span className="shrink-0 rounded-full bg-sky-200 px-2 py-0.5 text-[11px] font-bold text-slate-950">{exercise.category || "General"}</span>
              </div>
              {exercise.instructions ? <p className="mt-0.5 line-clamp-1 text-xs" style={{ color: "#bfdbfe" }}>{exercise.instructions}</p> : null}
            </button>
          ))}
          {!filtered.length && !query.trim() ? <p className="px-3 py-6 text-center text-sm text-sky-100">No hay ejercicios en esta categoría.</p> : null}
          {!filtered.length && query.trim() ? <p className="px-3 py-3 text-sm text-sky-100">No encontramos coincidencias.</p> : null}
        </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
