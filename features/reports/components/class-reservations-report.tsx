"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarCheck2, Trophy, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MonthlyStat = { month: string; reservations_count: number; template_id?: string; member_id?: string };
type NamedItem = { id: string; name?: string | null; title?: string | null };

const monthFormatter = new Intl.DateTimeFormat("es-UY", { month: "short", year: "numeric" });

export function ClassReservationsReport({ gymId, periodStart, periodEnd }: { gymId: string; periodStart: Date | null; periodEnd: Date | null }) {
  const [templateStats, setTemplateStats] = useState<MonthlyStat[]>([]);
  const [memberStats, setMemberStats] = useState<MonthlyStat[]>([]);
  const [templates, setTemplates] = useState<NamedItem[]>([]);
  const [members, setMembers] = useState<NamedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gymId) return;
    const load = async () => {
      setLoading(true);
      const [templateStatsResponse, memberStatsResponse, templatesResponse, membersResponse] = await Promise.all([
        supabase.from("class_template_monthly_stats").select("template_id, month, reservations_count").eq("gym_id", gymId),
        supabase.from("member_class_monthly_stats").select("member_id, month, reservations_count").eq("gym_id", gymId),
        supabase.from("class_templates").select("id, title").eq("gym_id", gymId),
        supabase.from("members").select("id, name").eq("gym_id", gymId),
      ]);
      setTemplateStats((templateStatsResponse.data ?? []) as MonthlyStat[]);
      setMemberStats((memberStatsResponse.data ?? []) as MonthlyStat[]);
      setTemplates((templatesResponse.data ?? []) as NamedItem[]);
      setMembers((membersResponse.data ?? []) as NamedItem[]);
      setLoading(false);
    };
    void load();
  }, [gymId]);

  const data = useMemo(() => {
    const starts = periodStart ? new Date(periodStart.getFullYear(), periodStart.getMonth(), 1).getTime() : -Infinity;
    const ends = periodEnd ? new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 1).getTime() : Infinity;
    const withinPeriod = (stat: MonthlyStat) => {
      const month = new Date(`${stat.month}T00:00:00`).getTime();
      return month >= starts && month < ends;
    };
    const sumBy = (rows: MonthlyStat[], idKey: "template_id" | "member_id") => rows.filter(withinPeriod).reduce<Record<string, number>>((totals, row) => {
      const id = row[idKey];
      if (id) totals[id] = (totals[id] ?? 0) + Number(row.reservations_count ?? 0);
      return totals;
    }, {});
    const templateTotals = sumBy(templateStats, "template_id");
    const memberTotals = sumBy(memberStats, "member_id");
    const templateNames = new Map(templates.map((item) => [item.id, item.title ?? "Clase sin nombre"]));
    const memberNames = new Map(members.map((item) => [item.id, item.name ?? "Socio sin nombre"]));
    const ranking = (totals: Record<string, number>, names: Map<string, string>) => Object.entries(totals).map(([id, count]) => ({ id, name: names.get(id) ?? "Registro eliminado", count })).sort((a, b) => b.count - a.count);
    const monthlyTotals = templateStats.filter(withinPeriod).reduce<Record<string, number>>((totals, row) => ({ ...totals, [row.month]: (totals[row.month] ?? 0) + Number(row.reservations_count ?? 0) }), {});
    return { total: Object.values(templateTotals).reduce((sum, count) => sum + count, 0), classes: ranking(templateTotals, templateNames), members: ranking(memberTotals, memberNames), months: Object.entries(monthlyTotals).sort(([a], [b]) => a.localeCompare(b)) };
  }, [memberStats, members, periodEnd, periodStart, templateStats, templates]);

  return <Card className="border-slate-800 bg-slate-950 text-white"><CardHeader><CardTitle className="flex items-center gap-2 text-2xl"><CalendarCheck2 className="h-6 w-6 text-blue-400" />Clases y reservas</CardTitle><p className="text-sm font-normal text-slate-400">Las reservas se incorporan al reporte dos horas después de terminar cada clase.</p></CardHeader><CardContent>{loading ? <p className="py-8 text-center text-sm text-slate-400">Cargando reportes de clases...</p> : data.total === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-7 text-center text-sm text-slate-400">Todavía no hay clases finalizadas en este período. Cuando termine una clase, sus reservas aparecerán aquí.</p> : <div className="space-y-6"><div className="grid gap-3 sm:grid-cols-3"><Metric icon={<CalendarCheck2 />} label="Reservas registradas" value={data.total} /><Metric icon={<Trophy />} label="Clase más elegida" value={data.classes[0]?.name ?? "-"} detail={data.classes[0] ? `${data.classes[0].count} reservas` : undefined} /><Metric icon={<Users />} label="Socio más activo" value={data.members[0]?.name ?? "-"} detail={data.members[0] ? `${data.members[0].count} reservas` : undefined} /></div><div className="grid gap-5 lg:grid-cols-3"><Ranking title="Clases más elegidas" entries={data.classes} /><Ranking title="Socios con más reservas" entries={data.members} /><div className="rounded-xl border border-slate-800 p-4"><p className="flex items-center gap-2 font-bold"><BarChart3 className="h-4 w-4 text-blue-400" />Evolución mensual</p><div className="mt-4 space-y-3">{data.months.map(([month, count]) => <div key={month} className="flex items-center justify-between gap-3 text-sm"><span className="capitalize text-slate-300">{monthFormatter.format(new Date(`${month}T00:00:00`))}</span><span className="font-bold text-white">{count}</span></div>)}</div></div></div></div>}</CardContent></Card>;
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string | number; detail?: string }) { return <div className="rounded-xl bg-white/5 p-4"><span className="text-blue-400">{icon}</span><p className="mt-2 text-sm text-slate-400">{label}</p><p className="mt-1 truncate text-xl font-black">{value}</p>{detail ? <p className="text-xs text-slate-400">{detail}</p> : null}</div>; }
function Ranking({ title, entries }: { title: string; entries: { id: string; name: string; count: number }[] }) { return <div className="rounded-xl border border-slate-800 p-4"><p className="font-bold">{title}</p><div className="mt-3 space-y-2">{entries.slice(0, 5).map((entry, index) => <div key={entry.id} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate text-slate-300">{index + 1}. {entry.name}</span><span className="font-bold text-white">{entry.count}</span></div>)}</div></div>; }
