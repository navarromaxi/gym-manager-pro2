import {
  AlertTriangle,
  Calendar,
  DollarSign,
  TrendingUp,
  UserPlus,
  Users,
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

/** Dashboard presentation only. Data and navigation remain in the main page. */
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
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Resumen general de {gymName}</p>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <p>Cargando datos desde la base de datos...</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Socios activos"
          value={activeMembers}
          detail="Haz clic para ver detalles"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          valueClassName="text-emerald-600"
          onClick={() => onMembersFilter("active")}
        />
        <MetricCard
          label="Ingresos del mes"
          value={`$${monthlyIncome.toLocaleString()}`}
          detail={`Gastos: $${monthlyExpenses.toLocaleString()}`}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          valueClassName="text-blue-600"
        />
        <MetricCard
          label="Ganancia mensual"
          value={`$${monthlyProfit.toLocaleString()}`}
          detail="Ingresos - Gastos"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          valueClassName={monthlyProfit >= 0 ? "text-emerald-600" : "text-red-600"}
        />
        <MetricCard
          label="Vencimientos próximos"
          value={upcomingExpirations}
          detail="Haz clic para ver detalles"
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          valueClassName="text-orange-600"
          onClick={() => onMembersFilter("expiring_soon")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Estado de socios</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <MemberStatus label="Activos" value={activeMembers} badge="default" onClick={() => onMembersFilter("active")} />
            <MemberStatus label="Vencidos" value={expiredMembers} badge="destructive" onClick={() => onMembersFilter("expired")} />
            <MemberStatus label="Inactivos" value={inactiveMembers} badge="secondary" onClick={() => onMembersFilter("inactive")} />
            <MemberStatus label="Total" value={totalMembers} badge="outline" onClick={() => onMembersFilter("all")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Alertas importantes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {followUpCount > 0 ? <AlertRow className="text-blue-600 hover:bg-blue-50" onClick={() => onMembersFilter("follow_up")}>Seguimiento pendiente: {followUpCount} socio{followUpCount === 1 ? "" : "s"} (5 a 12 días)</AlertRow> : null}
            {upcomingExpirations > 0 ? <AlertRow className="text-orange-600 hover:bg-orange-50" onClick={() => onMembersFilter("expiring_soon")} icon={<AlertTriangle className="h-4 w-4" />}>{upcomingExpirations} socios con vencimiento próximo</AlertRow> : null}
            {expiredMembers > 0 ? <AlertRow className="text-red-600 hover:bg-red-50" onClick={() => onMembersFilter("expired")} icon={<Calendar className="h-4 w-4" />}>{expiredMembers} socios con plan vencido</AlertRow> : null}
            {newProspectsCount > 0 ? <AlertRow className="text-blue-600 hover:bg-blue-50" onClick={() => onProspectsFilter("averiguador")} icon={<UserPlus className="h-4 w-4" />}>{newProspectsCount} nuevos interesados por contactar</AlertRow> : null}
            {nextContactTodayCount > 0 ? <AlertRow className="text-purple-600 hover:bg-purple-50" onClick={() => onProspectsFilter("averiguador")} icon={<Calendar className="h-4 w-4" />}>{nextContactTodayCount} interesado{nextContactTodayCount === 1 ? "" : "s"} para contactar hoy</AlertRow> : null}
            {upcomingExpirations === 0 && expiredMembers === 0 && newProspectsCount === 0 && nextContactTodayCount === 0 ? <div className="flex items-center gap-2 text-emerald-600">Todo en orden</div> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, icon, valueClassName, onClick }: { label: string; value: string | number; detail: string; icon: React.ReactNode; valueClassName: string; onClick?: () => void }) {
  return <Card className={onClick ? "cursor-pointer transition-shadow hover:shadow-md" : undefined} onClick={onClick}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle>{icon}</CardHeader>
    <CardContent><div className={`text-2xl font-bold ${valueClassName}`}>{value}</div><p className="text-xs text-muted-foreground">{detail}</p></CardContent>
  </Card>;
}

function MemberStatus({ label, value, badge, onClick }: { label: string; value: number; badge: "default" | "destructive" | "secondary" | "outline"; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-md p-2 text-left transition-colors hover:bg-muted"><span className="flex items-center gap-2"><Badge variant={badge}>{label}</Badge><span>{value} socios</span></span><span className="text-xs text-muted-foreground">Ver →</span></button>;
}

function AlertRow({ children, className, icon, onClick }: { children: React.ReactNode; className: string; icon?: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors ${className}`}>{icon}{children}</button>;
}
