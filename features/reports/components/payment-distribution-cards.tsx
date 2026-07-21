import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CardBrandDistribution = {
  brand: string;
  count: number;
  amount: number;
  percentage: number;
};

type PlanDistribution = { plan: string; count: number };

type PaymentDistributionCardsProps = {
  periodLabel: string;
  paymentMethodDistribution: Record<string, number>;
  totalPaymentCount: number;
  debitCardDistribution: CardBrandDistribution[];
  creditCardDistribution: CardBrandDistribution[];
  planDistributionEntries: PlanDistribution[];
  totalPlanMembers: number;
};

/** Presentational distribution cards. The container owns all calculations. */
export function PaymentDistributionCards({
  periodLabel,
  paymentMethodDistribution,
  totalPaymentCount,
  debitCardDistribution,
  creditCardDistribution,
  planDistributionEntries,
  totalPlanMembers,
}: PaymentDistributionCardsProps) {
  return (
    <>
      <Card>
        <CardHeader><CardTitle>Métodos de Pago - {periodLabel}</CardTitle></CardHeader>
        <CardContent><div className="space-y-3">
          {Object.entries(paymentMethodDistribution).map(([method, count]) => (
            <div key={method} className="flex items-center justify-between">
              <span className="font-medium">{method}</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">{count} pagos</span>
                <Badge variant="outline">{totalPaymentCount > 0 ? Math.round((count / totalPaymentCount) * 100) : 0}%</Badge>
              </div>
            </div>
          ))}
        </div></CardContent>
      </Card>
      <BrandDistributionCard title={`Pagos con Débito - ${periodLabel}`} items={debitCardDistribution} />
      <BrandDistributionCard title={`Pagos con Crédito - ${periodLabel}`} items={creditCardDistribution} />
      <Card>
        <CardHeader><CardTitle>Distribución por Planes</CardTitle></CardHeader>
        <CardContent><div className="space-y-3">
          {planDistributionEntries.length > 0 ? planDistributionEntries.map(({ plan, count }) => (
            <div key={plan} className="flex items-center justify-between">
              <span className="font-medium">{plan}</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">{count} socios</span>
                <Badge variant="outline">{totalPlanMembers > 0 ? Math.round((count / totalPlanMembers) * 100) : 0}%</Badge>
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">No hay pagos de planes en el período seleccionado.</p>}
        </div></CardContent>
      </Card>
    </>
  );
}

function BrandDistributionCard({ title, items }: { title: string; items: CardBrandDistribution[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent><div className="space-y-3">
        {items.map((item) => (
          <div key={item.brand} className="flex items-center justify-between">
            <span className="font-medium">{item.brand}</span>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">{item.count} pagos</span>
              <span className="text-sm text-muted-foreground">${item.amount.toLocaleString()}</span>
              <Badge variant="outline">{item.percentage}%</Badge>
            </div>
          </div>
        ))}
      </div></CardContent>
    </Card>
  );
}
