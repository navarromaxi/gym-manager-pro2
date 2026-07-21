import { DollarSign, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCountAmount, formatCurrency } from "@/features/reports/report-utils";

type CountAmount = { count: number; amount: number };
type MonthlyOneTimeStat = { month: string; total: CountAmount; TuPase: CountAmount; PaseLibre: CountAmount; Otros: CountAmount };

type AdditionalIncomeCardsProps = {
  periodLabel: string;
  totalVisits: number;
  expectedAmount: number;
  expectedCount: number;
  sourceTotals: { TuPase: CountAmount; PaseLibre: CountAmount; Otros: CountAmount };
  monthlyStats: MonthlyOneTimeStat[];
  last6MonthsIncome: Array<{ month: string; income: number }>;
};

export function AdditionalIncomeCards({ periodLabel, totalVisits, expectedAmount, expectedCount, sourceTotals, monthlyStats, last6MonthsIncome }: AdditionalIncomeCardsProps) {
  return <>
    <Card>
      <CardHeader><CardTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5" />Pagos Únicos por Origen - {periodLabel}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Visitas registradas en el mes (se cobran al mes siguiente)" value={totalVisits} detail="Según fecha de uso dentro del filtro." />
          <Metric label="Cobros hechos" value={formatCurrency(expectedAmount)} detail={`${expectedCount} cobros estimados (según fecha de acreditación).`} valueClassName="text-emerald-600" />
          <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Detalle por origen</p><div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">TuPase: {sourceTotals.TuPase.count}</Badge>
            <Badge variant="secondary">PaseLibre: {sourceTotals.PaseLibre.count} · {formatCurrency(sourceTotals.PaseLibre.amount)}</Badge>
            <Badge variant="secondary">Otros: {sourceTotals.Otros.count} · {formatCurrency(sourceTotals.Otros.amount)}</Badge>
          </div></div>
        </div>
        {monthlyStats.length > 0 ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Mes</TableHead><TableHead>Total (cant. · monto)</TableHead><TableHead>TuPase</TableHead><TableHead>PaseLibre</TableHead><TableHead>Otros</TableHead></TableRow></TableHeader><TableBody>
          {monthlyStats.map((row) => <TableRow key={row.month}><TableCell className="font-medium">{row.month}</TableCell><TableCell>{formatCountAmount(row.total)}</TableCell><TableCell>{formatCountAmount(row.TuPase)}</TableCell><TableCell>{formatCountAmount(row.PaseLibre)}</TableCell><TableCell>{formatCountAmount(row.Otros)}</TableCell></TableRow>)}
        </TableBody></Table></div> : <p className="text-sm text-muted-foreground">No se registran pagos únicos en el período seleccionado.</p>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5" />Tendencia de Ingresos (Últimos 6 Meses)</CardTitle></CardHeader>
      <CardContent><div className="space-y-4">{last6MonthsIncome.map((monthData) => <div key={monthData.month} className="flex items-center justify-between rounded-lg border p-3"><span className="font-medium">{monthData.month}</span><span className="text-lg font-bold text-green-600">${monthData.income.toLocaleString()}</span></div>)}</div></CardContent>
    </Card>
  </>;
}

function Metric({ label, value, detail, valueClassName = "" }: { label: string; value: string | number; detail: string; valueClassName?: string }) {
  return <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">{label}</p><p className={`text-2xl font-bold ${valueClassName}`}>{value}</p><p className="text-xs text-muted-foreground">{detail}</p></div>;
}
