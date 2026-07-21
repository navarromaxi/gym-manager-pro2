"use client";

import { useState } from "react";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type AverageActiveMembersEntry = {
  month: string;
  roundedAverage: number;
  averageAsInteger: number;
};

type AverageActiveMembersCardProps = {
  entries: AverageActiveMembersEntry[];
};

const MONTHS_PER_PAGE = 6;

/** Visual component only: calculations stay outside so this can be tested and reused. */
export function AverageActiveMembersCard({
  entries,
}: AverageActiveMembersCardProps) {
  const [visibleMonths, setVisibleMonths] = useState(MONTHS_PER_PAGE);
  const visibleEntries = entries.slice(0, visibleMonths);
  const hasMore = visibleMonths < entries.length;
  const hasData = entries.some((entry) => entry.roundedAverage > 0);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Promedio de socios por mes
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Promedio de socios activos por mes. Se muestra primero el mes más reciente.
          </p>
        </div>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {Math.min(visibleMonths, entries.length)} de {entries.length} meses
        </span>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead className="text-right">
                      Promedio de socios activos
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEntries.map((entry) => (
                    <TableRow key={entry.month}>
                      <TableCell className="font-medium">{entry.month}</TableCell>
                      <TableCell className="text-right">
                        {entry.averageAsInteger} socios
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({entry.roundedAverage.toLocaleString("es-ES", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })})
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {hasMore ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() =>
                  setVisibleMonths((current) => current + MONTHS_PER_PAGE)
                }
              >
                Ver 6 meses más
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay datos suficientes para calcular el promedio de socios activos por mes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
