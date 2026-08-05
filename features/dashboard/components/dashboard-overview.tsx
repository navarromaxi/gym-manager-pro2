import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  DollarSign,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardOverviewProps = {
  gymName?: string;
  loading: boolean;
  activeMembers: number;
  expiredMembers: number;
  inactiveMembers: number;
  totalMembers: number;
  upcomingExpirations: number;
  followUpCount: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  newProspectsCount: number;
  nextContactTodayCount: number;
  onMembersFilter: (filter: string) => void;
  onProspectsFilter: (status?: "averiguador" | "all") => void;
};

/** Presentation only: all data and navigation continue to live in app/page.tsx. */
export function DashboardOverview({
  gymName,
  loading,
  activeMembers,
  expiredMembers,
  inactiveMembers,
  totalMembers,
  upcomingExpirations,
  followUpCount,
  monthlyIncome,
  monthlyExpenses,
  monthlyProfit,
  newProspectsCount,
  nextContactTodayCount,
  onMembersFilter,
  onProspectsFilter,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-6 pb-4">
      <section
        className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-[0_18px_45px_-25px_rgba(15,23,42,0.8)] sm:px-8 sm:py-8"
        style={{ backgroundColor: "#071426" }}
      >
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-[28%] h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-100">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" /> Vista general
            </div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Todo en un vistazo</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-200 sm:text-base">
              El pulso diario de <span className="font-semibold text-white">{gymName || "tu club"}</span>: socios, cobros y alertas importantes.
            </p>
          </div>
          <div
            className="rounded-2xl border px-4 py-3 shadow-sm"
            style={{ backgroundColor: "#12335d", borderColor: "#4f8edb" }}
          >
            <p
              className="text-xs font-extrabold uppercase tracking-[0.1em]"
              style={{ color: "#ffffff" }}
            >
              Socios actuales
            </p>
            <p className="mt-0.5 text-3xl font-black" style={{ color: "#ffffff" }}>
              {activeMembers + expiredMembers}
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-center text-sm font-medium text-blue-900">
          Actualizando información del club...
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Socios activos" value={activeMembers} detail="Ver detalle de socios" icon={<Users className="h-5 w-5" />} tone="emerald" onClick={() => onMembersFilter("active")} />
        <MetricCard label="Ingresos del mes" value={`$${monthlyIncome.toLocaleString()}`} detail={`Gastos: $${monthlyExpenses.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} tone="blue" />
        <MetricCard label="Ganancia mensual" value={`$${monthlyProfit.toLocaleString()}`} detail="Ingresos - gastos" icon={<TrendingUp className="h-5 w-5" />} tone={monthlyProfit >= 0 ? "emerald" : "rose"} />
        <MetricCard label="Vencimientos próximos" value={upcomingExpirations} detail="Ver socios por vencer" icon={<AlertTriangle className="h-5 w-5" />} tone="amber" onClick={() => onMembersFilter("expiring_soon")} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/80 pb-4">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-slate-950"><Users className="h-5 w-5 text-blue-600" /> Estado de socios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            <MemberStatus label="Activos" value={activeMembers} badge="default" onClick={() => onMembersFilter("active")} />
            <MemberStatus label="Vencidos" value={expiredMembers} badge="destructive" onClick={() => onMembersFilter("expired")} />
            <MemberStatus label="Inactivos" value={inactiveMembers} badge="secondary" onClick={() => onMembersFilter("inactive")} />
            <MemberStatus label="Total" value={totalMembers} badge="outline" onClick={() => onMembersFilter("all")} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/80 pb-4">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-slate-950"><WalletCards className="h-5 w-5 text-blue-600" /> Alertas importantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {followUpCount > 0 ? <AlertRow className="bg-blue-50 text-blue-700 hover:bg-blue-100" onClick={() => onMembersFilter("follow_up")}>Seguimiento pendiente: {followUpCount} socio{followUpCount === 1 ? "" : "s"} (5 a 12 días)</AlertRow> : null}
            {upcomingExpirations > 0 ? <AlertRow className="bg-amber-50 text-amber-800 hover:bg-amber-100" onClick={() => onMembersFilter("expiring_soon")} icon={<AlertTriangle className="h-4 w-4" />}>{upcomingExpirations} socios con vencimiento próximo</AlertRow> : null}
            {expiredMembers > 0 ? <AlertRow className="bg-rose-50 text-rose-700 hover:bg-rose-100" onClick={() => onMembersFilter("expired")} icon={<Calendar className="h-4 w-4" />}>{expiredMembers} socios con plan vencido</AlertRow> : null}
            {newProspectsCount > 0 ? <AlertRow className="bg-blue-50 text-blue-700 hover:bg-blue-100" onClick={() => onProspectsFilter("averiguador")} icon={<UserPlus className="h-4 w-4" />}>{newProspectsCount} nuevos interesados por contactar</AlertRow> : null}
            {nextContactTodayCount > 0 ? <AlertRow className="bg-violet-50 text-violet-700 hover:bg-violet-100" onClick={() => onProspectsFilter("averiguador")} icon={<Calendar className="h-4 w-4" />}>{nextContactTodayCount} interesado{nextContactTodayCount === 1 ? "" : "s"} para contactar hoy</AlertRow> : null}
            {upcomingExpirations === 0 && expiredMembers === 0 && newProspectsCount === 0 && nextContactTodayCount === 0 ? <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Todo en orden</div> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, icon, tone, onClick }: { label: string; value: string | number; detail: string; icon: React.ReactNode; tone: "emerald" | "blue" | "amber" | "rose"; onClick?: () => void }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
  };
  const valueTones = { emerald: "text-emerald-600", blue: "text-blue-600", amber: "text-amber-600", rose: "text-rose-600" };
  return <Card className={`group overflow-hidden border-slate-200 bg-white shadow-sm transition-all duration-200 ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg" : ""}`} onClick={onClick}>
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-semibold text-slate-600">{label}</p><div className={`mt-3 text-3xl font-black tracking-tight ${valueTones[tone]}`}>{value}</div></div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}>{icon}</span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 text-xs font-medium text-slate-500"><span>{detail}</span>{onClick ? <ArrowUpRight className="h-4 w-4 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /> : null}</div>
    </CardContent>
  </Card>;
}

function MemberStatus({ label, value, badge, onClick }: { label: string; value: number; badge: "default" | "destructive" | "secondary" | "outline"; onClick: () => void }) {
  const badgeContent = badge === "default" ? (
    <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
      {label}
    </span>
  ) : badge === "outline" ? (
    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-800">
      {label}
    </span>
  ) : (
    <Badge variant={badge}>{label}</Badge>
  );

  return <button type="button" onClick={onClick} className="group flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-3 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"><span className="flex items-center gap-3">{badgeContent}<span className="font-semibold text-slate-800">{value} socios</span></span><span className="flex items-center gap-1 text-xs font-semibold text-slate-500">Ver <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span></button>;
}

function AlertRow({ children, className, icon, onClick }: { children: React.ReactNode; className: string; icon?: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors ${className}`}>{icon}{children}</button>;
}
