import { UserCheck, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReferralEntry = { source: string; count: number; percentage: number };

type LeadConversionCardsProps = {
  periodLabel: string;
  totalNewMembers: number;
  referralEntries: ReferralEntry[];
  totalProspectsInPeriod: number;
  scheduledProspectsCount: number;
  attendedProspectsCount: number;
  convertedProspectsCount: number;
  notConvertedProspectsCount: number;
  conversionRate: number;
  nonConversionRate: number;
};

/** Presentation layer for acquisition and prospect-conversion metrics. */
export function LeadConversionCards({
  periodLabel,
  totalNewMembers,
  referralEntries,
  totalProspectsInPeriod,
  scheduledProspectsCount,
  attendedProspectsCount,
  convertedProspectsCount,
  notConvertedProspectsCount,
  conversionRate,
  nonConversionRate,
}: LeadConversionCardsProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Socios que nos conocieron por</CardTitle>
          <p className="text-sm text-muted-foreground">
            {totalNewMembers > 0
              ? `Período: ${periodLabel} · Nuevos socios: ${totalNewMembers}`
              : `No se registraron nuevos socios en ${periodLabel}.`}
          </p>
        </CardHeader>
        <CardContent>
          {totalNewMembers > 0 ? (
            <div className="space-y-3">
              {referralEntries.map(({ source, count, percentage }) => (
                <div key={source} className="rounded-lg border p-3">
                  <p className="font-medium">{source}</p>
                  <p className="text-sm text-muted-foreground">Cantidad: {count} · Porcentaje sobre el total: {percentage}%</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No se registraron nuevos socios en {periodLabel}.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><UserCheck className="mr-2 h-5 w-5" />Conversión de Interesados</CardTitle>
          <p className="text-sm text-muted-foreground">Seguimiento de interesados con filtro de {periodLabel}</p>
        </CardHeader>
        <CardContent>
          {totalProspectsInPeriod > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Averiguadores cargados" value={totalProspectsInPeriod} />
                <Metric label="Coordinamos clase de prueba" value={scheduledProspectsCount} valueClassName="text-blue-600" />
                <Metric label="Asistieron" value={attendedProspectsCount} valueClassName="text-emerald-600" />
                <Metric label="Convertidos a socios" value={convertedProspectsCount} valueClassName="text-green-600" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Metric label="Tasa de conversión" value={`${conversionRate}%`} detail={`${convertedProspectsCount} de ${totalProspectsInPeriod} interesados`} valueClassName="text-green-600" />
                <Metric label="No convertidos" value={notConvertedProspectsCount} detail={`${nonConversionRate}% del total`} valueClassName="text-red-600" />
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">No se registraron interesados en {periodLabel}.</p>}
        </CardContent>
      </Card>
    </>
  );
}

function Metric({ label, value, detail, valueClassName = "" }: { label: string; value: string | number; detail?: string; valueClassName?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
