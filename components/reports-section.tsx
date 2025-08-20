"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Filter,
  RefreshCw,
} from "lucide-react";
//import type { Member, Payment, Expense } from "@/lib/supabase";

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  plan: string;
  planPrice: number;
  lastPayment: string;
  nextPayment: string;
  status: "active" | "expired" | "inactive";
  inactiveLevel?: "green" | "yellow" | "red";
}

interface Payment {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  date: string;
  plan: string;
  method: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
}

interface ReportsSectionProps {
  members: Member[];
  payments: Payment[];
  expenses: Expense[];
  gymName: string;
}

export function ReportsSection({
  members,
  payments,
  expenses,
  gymName,
}: ReportsSectionProps) {
  // FILTROS AGREGADOS
  const [timeFilter, setTimeFilter] = useState("current_month");

  const currentDate = new Date();

  // Función para filtrar por tiempo
  const getFilteredData = () => {
    let filteredPayments = payments;
    let filteredExpenses = expenses;

    switch (timeFilter) {
      case "current_month":
        filteredPayments = payments.filter((p) => {
          const paymentDate = new Date(p.date);
          return (
            paymentDate.getMonth() === currentDate.getMonth() &&
            paymentDate.getFullYear() === currentDate.getFullYear()
          );
        });
        filteredExpenses = expenses.filter((e) => {
          const expenseDate = new Date(e.date);
          return (
            expenseDate.getMonth() === currentDate.getMonth() &&
            expenseDate.getFullYear() === currentDate.getFullYear()
          );
        });
        break;

      case "previous_month":
        const previousMonth =
          currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1;
        const previousYear =
          currentDate.getMonth() === 0
            ? currentDate.getFullYear() - 1
            : currentDate.getFullYear();
        filteredPayments = payments.filter((p) => {
          const paymentDate = new Date(p.date);
          return (
            paymentDate.getMonth() === previousMonth &&
            paymentDate.getFullYear() === previousYear
          );
        });
        filteredExpenses = expenses.filter((e) => {
          const expenseDate = new Date(e.date);
          return (
            expenseDate.getMonth() === previousMonth &&
            expenseDate.getFullYear() === previousYear
          );
        });
        break;

      case "last_6_months":
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        filteredPayments = payments.filter(
          (p) => new Date(p.date) >= sixMonthsAgo
        );
        filteredExpenses = expenses.filter(
          (e) => new Date(e.date) >= sixMonthsAgo
        );
        break;

      case "current_year":
        filteredPayments = payments.filter(
          (p) => new Date(p.date).getFullYear() === currentDate.getFullYear()
        );
        filteredExpenses = expenses.filter(
          (e) => new Date(e.date).getFullYear() === currentDate.getFullYear()
        );
        break;

      case "last_year":
        const lastYear = currentDate.getFullYear() - 1;
        filteredPayments = payments.filter(
          (p) => new Date(p.date).getFullYear() === lastYear
        );
        filteredExpenses = expenses.filter(
          (e) => new Date(e.date).getFullYear() === lastYear
        );
        break;

      default:
        break;
    }

    return { filteredPayments, filteredExpenses };
  };

  const { filteredPayments, filteredExpenses } = getFilteredData();

  // Cálculos con datos filtrados
  const totalIncome = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenseAmount = filteredExpenses.reduce(
    (sum, e) => sum + e.amount,
    0
  );
  const totalProfit = totalIncome - totalExpenseAmount;

  // Member statistics
  const activeMembers = members.filter((m) => m.status === "active").length;
  const expiredMembers = members.filter((m) => m.status === "expired").length;
  const inactiveMembers = members.filter((m) => m.status === "inactive").length;

  // NUEVAS MÉTRICAS DE RENOVACIONES
  const getRenewalStats = () => {
    // Obtener todos los miembros que tienen más de un pago (renovaron)
    const memberPaymentCounts = payments.reduce((acc, payment) => {
      acc[payment.memberId] = (acc[payment.memberId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Socios que renovaron (tienen más de 1 pago)
    const renewedMembers = Object.entries(memberPaymentCounts).filter(
      ([_, count]) => count > 1
    );
    const renewedCount = renewedMembers.length;

    // Socios que no renovaron (solo tienen 1 pago y están inactivos/vencidos)
    const notRenewedMembers = members.filter((member) => {
      const paymentCount = memberPaymentCounts[member.id] || 0;
      return (
        paymentCount <= 1 &&
        (member.status === "inactive" || member.status === "expired")
      );
    });
    const notRenewedCount = notRenewedMembers.length;

    // Tasa de renovación
    const totalEligibleForRenewal = renewedCount + notRenewedCount;
    const renewalRate =
      totalEligibleForRenewal > 0
        ? (renewedCount / totalEligibleForRenewal) * 100
        : 0;

    return {
      renewedCount,
      notRenewedCount,
      renewalRate: Math.round(renewalRate),
      totalEligible: totalEligibleForRenewal,
    };
  };

  const renewalStats = getRenewalStats();

  // Upcoming expirations (next 7 days)
  const upcomingExpirations = members.filter((m) => {
    const nextPayment = new Date(m.nextPayment);
    const today = new Date();
    const diffTime = nextPayment.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  });

  // Overdue members
  const overdueMembers = members.filter((m) => {
    const nextPayment = new Date(m.nextPayment);
    const today = new Date();
    return nextPayment < today && m.status !== "inactive";
  });

  // Plan distribution
  const planDistribution = members.reduce((acc, member) => {
    acc[member.plan] = (acc[member.plan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Payment methods distribution (filtrado)
  const paymentMethodDistribution = filteredPayments.reduce((acc, payment) => {
    acc[payment.method] = (acc[payment.method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Last 6 months income
  const last6MonthsIncome = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = date.getMonth();
    const year = date.getFullYear();

    const monthPayments = payments.filter((p) => {
      const paymentDate = new Date(p.date);
      return (
        paymentDate.getMonth() === month && paymentDate.getFullYear() === year
      );
    });

    return {
      month: date.toLocaleDateString("es-ES", {
        month: "short",
        year: "numeric",
      }),
      income: monthPayments.reduce((sum, p) => sum + p.amount, 0),
    };
  }).reverse();

  const getTimeFilterLabel = () => {
    switch (timeFilter) {
      case "current_month":
        return "Mes Actual";
      case "previous_month":
        return "Mes Anterior";
      case "last_6_months":
        return "Últimos 6 Meses";
      case "current_year":
        return "Año Actual";
      case "last_year":
        return "Año Anterior";
      default:
        return "Período Seleccionado";
    }
  };

  const handleExportReport = () => {
    const reportData = {
      gimnasio: gymName,
      periodo: getTimeFilterLabel(),
      fecha: new Date().toLocaleDateString(),
      resumenFinanciero: {
        ingresos: totalIncome,
        gastos: totalExpenseAmount,
        ganancia: totalProfit,
      },
      socios: {
        activos: activeMembers,
        vencidos: expiredMembers,
        inactivos: inactiveMembers,
        total: members.length,
      },
      renovaciones: {
        renovaron: renewalStats.renewedCount,
        noRenovaron: renewalStats.notRenewedCount,
        tasaRenovacion: renewalStats.renewalRate,
      },
      alertas: {
        proximosVencimientos: upcomingExpirations.length,
        morosos: overdueMembers.length,
      },
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte-${gymName.toLowerCase().replace(/\s+/g, "-")}-${
      new Date().toISOString().split("T")[0]
    }.json`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Reportes y Estadísticas
          </h2>
          <p className="text-muted-foreground">
            Análisis completo del rendimiento de {gymName}
          </p>
        </div>
        <Button onClick={handleExportReport}>
          <Download className="mr-2 h-4 w-4" />
          Exportar Reporte
        </Button>
      </div>

      {/* FILTRO DE TIEMPO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Filtros de Tiempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_month">Mes Actual</SelectItem>
                <SelectItem value="previous_month">Mes Anterior</SelectItem>
                <SelectItem value="last_6_months">Últimos 6 Meses</SelectItem>
                <SelectItem value="current_year">Año Actual</SelectItem>
                <SelectItem value="last_year">Año Anterior</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              Mostrando datos de: <strong>{getTimeFilterLabel()}</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="mr-2 h-5 w-5" />
            Resumen Financiero - {getTimeFilterLabel()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                ${totalIncome.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Ingresos</div>
              <div className="text-xs text-muted-foreground">
                {filteredPayments.length} pagos
              </div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                ${totalExpenseAmount.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Gastos</div>
              <div className="text-xs text-muted-foreground">
                {filteredExpenses.length} gastos
              </div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div
                className={`text-2xl font-bold ${
                  totalProfit >= 0 ? "text-blue-600" : "text-red-600"
                }`}
              >
                ${totalProfit.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Ganancia</div>
              <div className="text-xs text-muted-foreground">
                {totalProfit >= 0 ? "Positiva" : "Negativa"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NUEVA SECCIÓN: ANÁLISIS DE RENOVACIONES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <RefreshCw className="mr-2 h-5 w-5" />
            Análisis de Renovaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {renewalStats.renewedCount}
              </div>
              <div className="text-sm text-muted-foreground">
                Socios que Renovaron
              </div>
              <div className="text-xs text-muted-foreground">
                Tienen más de 1 pago
              </div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {renewalStats.notRenewedCount}
              </div>
              <div className="text-sm text-muted-foreground">No Renovaron</div>
              <div className="text-xs text-muted-foreground">
                Vencidos/Inactivos
              </div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {renewalStats.renewalRate}%
              </div>
              <div className="text-sm text-muted-foreground">
                Tasa de Renovación
              </div>
              <div className="text-xs text-muted-foreground">
                % que renovaron
              </div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {renewalStats.totalEligible}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Elegibles
              </div>
              <div className="text-xs text-muted-foreground">
                Para renovación
              </div>
            </div>
          </div>

          {/* Comparativo Visual */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-3">Comparativo de Renovaciones</h4>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span>Renovaron</span>
                  <span>{renewalStats.renewedCount}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${
                        renewalStats.totalEligible > 0
                          ? (renewalStats.renewedCount /
                              renewalStats.totalEligible) *
                            100
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span>No Renovaron</span>
                  <span>{renewalStats.notRenewedCount}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{
                      width: `${
                        renewalStats.totalEligible > 0
                          ? (renewalStats.notRenewedCount /
                              renewalStats.totalEligible) *
                            100
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Estadísticas de Socios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {activeMembers}
              </div>
              <div className="text-sm text-muted-foreground">Activos</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {expiredMembers}
              </div>
              <div className="text-sm text-muted-foreground">Vencidos</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {inactiveMembers}
              </div>
              <div className="text-sm text-muted-foreground">Inactivos</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{members.length}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts and Warnings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Alertas Importantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {upcomingExpirations.length > 0 && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-orange-800">
                      Vencimientos Próximos
                    </h4>
                    <p className="text-sm text-orange-600">
                      {upcomingExpirations.length} socios con plan por vencer en
                      los próximos 7 días
                    </p>
                  </div>
                  <Badge className="bg-orange-500 text-white">
                    {upcomingExpirations.length}
                  </Badge>
                </div>
              </div>
            )}

            {overdueMembers.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-red-800">Socios Morosos</h4>
                    <p className="text-sm text-red-600">
                      {overdueMembers.length} socios con pagos vencidos
                    </p>
                  </div>
                  <Badge className="bg-red-500 text-white">
                    {overdueMembers.length}
                  </Badge>
                </div>
              </div>
            )}

            {renewalStats.renewalRate < 50 &&
              renewalStats.totalEligible > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-yellow-800">
                        Baja Tasa de Renovación
                      </h4>
                      <p className="text-sm text-yellow-600">
                        Solo el {renewalStats.renewalRate}% de los socios
                        elegibles renovaron su plan
                      </p>
                    </div>
                    <Badge className="bg-yellow-500 text-white">
                      {renewalStats.renewalRate}%
                    </Badge>
                  </div>
                </div>
              )}

            {upcomingExpirations.length === 0 &&
              overdueMembers.length === 0 &&
              renewalStats.renewalRate >= 50 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <div>
                      <h4 className="font-medium text-green-800">
                        Todo en Orden
                      </h4>
                      <p className="text-sm text-green-600">
                        No hay alertas importantes en este momento
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Planes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(planDistribution).map(([plan, count]) => (
                <div key={plan} className="flex items-center justify-between">
                  <span className="font-medium">{plan}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      {count} socios
                    </span>
                    <Badge variant="outline">
                      {Math.round((count / members.length) * 100)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Métodos de Pago - {getTimeFilterLabel()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(paymentMethodDistribution).map(
                ([method, count]) => (
                  <div
                    key={method}
                    className="flex items-center justify-between"
                  >
                    <span className="font-medium">{method}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">
                        {count} pagos
                      </span>
                      <Badge variant="outline">
                        {Math.round((count / filteredPayments.length) * 100)}%
                      </Badge>
                    </div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="mr-2 h-5 w-5" />
            Tendencia de Ingresos (Últimos 6 Meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {last6MonthsIncome.map((monthData, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <span className="font-medium">{monthData.month}</span>
                <span className="text-lg font-bold text-green-600">
                  ${monthData.income.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Expirations Detail */}
      {upcomingExpirations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Próximos Vencimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Socio</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Días Restantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingExpirations.map((member) => {
                  const daysUntilExpiration = Math.ceil(
                    (new Date(member.nextPayment).getTime() -
                      new Date().getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.name}
                      </TableCell>
                      <TableCell>{member.plan}</TableCell>
                      <TableCell>
                        {new Date(member.nextPayment).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            daysUntilExpiration <= 3
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {daysUntilExpiration === 0
                            ? "Hoy"
                            : `${daysUntilExpiration} días`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
