"use client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { es } from "date-fns/locale"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, Legend } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { Member, Payment, Expense } from "@/lib/supabase"

interface ReportsSectionProps {
  members: Member[]
  payments: Payment[]
  expenses: Expense[]
  gymName: string
}

export function ReportsSection({ members, payments, expenses, gymName }: ReportsSectionProps) {
  const currentMonth = new Date()
  const last3Months = Array.from({ length: 3 }).map((_, i) => subMonths(currentMonth, i))

  const monthlySummary = last3Months
    .map((date) => {
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(date)

      const income = payments
        .filter((p) => {
          const paymentDate = parseISO(p.date)
          return paymentDate >= monthStart && paymentDate <= monthEnd
        })
        .reduce((sum, p) => sum + p.amount, 0)

      const expensesTotal = expenses
        .filter((e) => {
          const expenseDate = parseISO(e.date)
          return expenseDate >= monthStart && expenseDate <= monthEnd
        })
        .reduce((sum, e) => sum + e.amount, 0)

      return {
        month: format(date, "MMM yyyy", { locale: es }),
        income,
        expenses: expensesTotal,
        profit: income - expensesTotal,
      }
    })
    .reverse() // To show most recent month last

  const memberStatusData = [
    { name: "Activos", value: members.filter((m) => m.status === "active").length },
    { name: "Vencidos", value: members.filter((m) => m.status === "expired").length },
    { name: "Inactivos", value: members.filter((m) => m.status === "inactive").length },
  ]

  const paymentMethodData = payments.reduce(
    (acc, payment) => {
      acc[payment.method] = (acc[payment.method] || 0) + payment.amount
      return acc
    },
    {} as Record<string, number>,
  )

  const paymentMethodChartData = Object.entries(paymentMethodData).map(([name, value]) => ({
    name,
    value,
  }))

  const expenseCategoryData = expenses.reduce(
    (acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount
      return acc
    },
    {} as Record<string, number>,
  )

  const expenseCategoryChartData = Object.entries(expenseCategoryData).map(([name, value]) => ({
    name,
    value,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reportes y Análisis</h2>
        <p className="text-muted-foreground">Informes detallados para {gymName}</p>
      </div>

      {/* Monthly Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Financiero Mensual</CardTitle>
          <CardDescription>Ingresos, Gastos y Ganancias de los últimos 3 meses.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              income: {
                label: "Ingresos",
                color: "hsl(var(--chart-1))",
              },
              expenses: {
                label: "Gastos",
                color: "hsl(var(--chart-2))",
              },
              profit: {
                label: "Ganancia",
                color: "hsl(var(--chart-3))",
              },
            }}
            className="h-[300px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySummary} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="var(--color-income)" name="Ingresos" />
                <Line type="monotone" dataKey="expenses" stroke="var(--color-expenses)" name="Gastos" />
                <Line type="monotone" dataKey="profit" stroke="var(--color-profit)" name="Ganancia" />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Member Status Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Estado de Socios</CardTitle>
            <CardDescription>Distribución actual de socios por estado.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                Activos: {
                  label: "Activos",
                  color: "hsl(var(--chart-1))",
                },
                Vencidos: {
                  label: "Vencidos",
                  color: "hsl(var(--chart-2))",
                },
                Inactivos: {
                  label: "Inactivos",
                  color: "hsl(var(--chart-3))",
                },
              }}
              className="h-[250px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberStatusData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={80} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={5} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Payment Methods Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Ingresos por Método de Pago</CardTitle>
            <CardDescription>Distribución de ingresos por método de pago.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                Efectivo: {
                  label: "Efectivo",
                  color: "hsl(var(--chart-1))",
                },
                Tarjeta: {
                  label: "Tarjeta",
                  color: "hsl(var(--chart-2))",
                },
                Transferencia: {
                  label: "Transferencia",
                  color: "hsl(var(--chart-3))",
                },
              }}
              className="h-[250px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentMethodChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Expense Categories Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Gastos por Categoría</CardTitle>
            <CardDescription>Distribución de gastos por categoría.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                Alquiler: { label: "Alquiler", color: "hsl(var(--chart-1))" },
                Servicios: { label: "Servicios", color: "hsl(var(--chart-2))" },
                Sueldos: { label: "Sueldos", color: "hsl(var(--chart-3))" },
                Mantenimiento: { label: "Mantenimiento", color: "hsl(var(--chart-4))" },
                Marketing: { label: "Marketing", color: "hsl(var(--chart-5))" },
                Insumos: { label: "Insumos", color: "hsl(var(--chart-6))" },
                Otros: { label: "Otros", color: "hsl(var(--chart-7))" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseCategoryChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
