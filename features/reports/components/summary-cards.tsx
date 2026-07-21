import { DollarSign, RefreshCw, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RenewalStats = {
  renewedCount: number;
  notRenewedCount: number;
  renewalRate: number;
  totalEligible: number;
};

type ReportsSummaryCardsProps = {
  periodLabel: string;
  totalIncome: number;
  totalExpenseAmount: number;
  totalProfit: number;
  totalPaymentCount: number;
  expenseCount: number;
  renewalStats: RenewalStats;
  activeMembers: number;
  expiredMembers: number;
  inactiveMembers: number;
  totalMembers: number;
};

/** Presentational report summaries. All calculations remain in the container. */
export function ReportsSummaryCards({
  periodLabel,
  totalIncome,
  totalExpenseAmount,
  totalProfit,
  totalPaymentCount,
  expenseCount,
  renewalStats,
  activeMembers,
  expiredMembers,
  inactiveMembers,
  totalMembers,
}: ReportsSummaryCardsProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="mr-2 h-5 w-5" />
            Resumen Financiero - {periodLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-900 dark:bg-blue-950/60">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">${totalIncome.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Ingresos</div>
              <div className="text-xs text-muted-foreground">{totalPaymentCount} pagos</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900 dark:bg-red-950/50">
              <div className="text-2xl font-bold text-red-600 dark:text-red-300">${totalExpenseAmount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Gastos</div>
              <div className="text-xs text-muted-foreground">{expenseCount} gastos</div>
            </div>
            <div className={`rounded-lg border p-4 text-center ${totalProfit >= 0 ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/60" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50"}`}>
              <div className={`text-2xl font-bold ${totalProfit >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>
                ${totalProfit.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Ganancia</div>
              <div className="text-xs text-muted-foreground">{totalProfit >= 0 ? "Positiva" : "Negativa"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <RefreshCw className="mr-2 h-5 w-5" />
            Análisis de Renovaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryMetric value={renewalStats.renewedCount} label="Socios que Renovaron" detail="Tienen más de 1 pago" className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300" />
            <SummaryMetric value={renewalStats.notRenewedCount} label="No Renovaron" detail="Vencidos/Inactivos" className="border border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300" />
            <SummaryMetric value={`${renewalStats.renewalRate}%`} label="Tasa de Renovación" detail="% que renovaron" className="border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300" />
            <SummaryMetric value={renewalStats.totalEligible} label="Total Elegibles" detail="Para renovación" className="border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Estadísticas de Socios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryMetric value={activeMembers} label="Activos" className="border text-green-600" />
            <SummaryMetric value={expiredMembers} label="Vencidos" className="border text-orange-600" />
            <SummaryMetric value={inactiveMembers} label="Inactivos" className="border text-gray-600" />
            <SummaryMetric value={totalMembers} label="Total" className="border" />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function SummaryMetric({
  value,
  label,
  detail,
  className,
}: {
  value: string | number;
  label: string;
  detail?: string;
  className: string;
}) {
  return (
    <div className={`rounded-lg p-4 text-center ${className}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
      {detail ? <div className="text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
}
