"use client";

import { useEffect } from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Search,
  DollarSign,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Expense {
  id: string;
  gymId: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  isRecurring: boolean;
}

interface ExpenseManagementProps {
  expenses: Expense[];
  setExpenses: (expenses: Expense[]) => void;
  gymId: string;
}

export function ExpenseManagement({
  expenses,
  setExpenses,
  gymId,
}: ExpenseManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: 0,
    category: "",
    date: new Date().toISOString().split("T")[0],
    isRecurring: false,
  });
  const [monthFilter, setMonthFilter] = useState("all");
  const [selectedRecurringExpense, setSelectedRecurringExpense] = useState("");
  const [yearFilter, setYearFilter] = useState("all");

  const categories = [
    "Fijos",
    "Equipos",
    "Mantenimiento",
    "Servicios",
    "Marketing",
    "Personal",
    "Otros",
  ];

  // ACA DENTRO VA EL useEffect
  useEffect(() => {
    const fetchExpenses = async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("gymId", gymId)
        .order("date", { ascending: false });

      if (error) {
        console.error("Error al cargar gastos desde Supabase:", error);
        return;
      }

      if (data) {
        setExpenses(data as Expense[]);
      }
    };

    fetchExpenses();
  }, [gymId, setExpenses]);

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch = expense.description
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || expense.category === categoryFilter;
    let matchesMonth = true;
    let matchesYear = true;

    if (monthFilter === "current") {
      const currentDate = new Date();
      const expenseDate = new Date(expense.date);
      matchesMonth =
        expenseDate.getMonth() === currentDate.getMonth() &&
        expenseDate.getFullYear() === currentDate.getFullYear();
    } else if (monthFilter === "previous") {
      const currentDate = new Date();
      const previousMonth =
        currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1;
      const previousYear =
        currentDate.getMonth() === 0
          ? currentDate.getFullYear() - 1
          : currentDate.getFullYear();
      const expenseDate = new Date(expense.date);
      matchesMonth =
        expenseDate.getMonth() === previousMonth &&
        expenseDate.getFullYear() === previousYear;
    }

    if (yearFilter === "current") {
      const currentYear = new Date().getFullYear();
      const expenseDate = new Date(expense.date);
      matchesYear = expenseDate.getFullYear() === currentYear;
    } else if (yearFilter === "previous") {
      const previousYear = new Date().getFullYear() - 1;
      const expenseDate = new Date(expense.date);
      matchesYear = expenseDate.getFullYear() === previousYear;
    }

    return matchesSearch && matchesCategory && matchesMonth && matchesYear;
  });

  //ACA ES QUE HAY QUE MODIFICAR PARA GUARDAR EL DATO EN SUPABASE:  versión async que lo guarde en Supabase:
  const handleAddExpense = async () => {
    const expense: Expense = {
      id: Date.now().toString(),
      gymId: gymId,
      ...newExpense,
    };

    const { error } = await supabase.from("expenses").insert([expense]);

    if (error) {
      console.error("Error al guardar gasto:", error);
      alert("Hubo un error al guardar el gasto en Supabase");
      return;
    }

    setExpenses([...expenses, expense]);
    setNewExpense({
      description: "",
      amount: 0,
      category: "",
      date: new Date().toISOString().split("T")[0],
      isRecurring: false,
    });
    setIsAddDialogOpen(false);
  };

  //BOTON PARA ELIMINAR GASTO : Hacemos que el mismo no solo elimine de la pantalla, sino de supabase!
  const handleDeleteExpense = async (id: string) => {
    // 1. Eliminamos en Supabase
    const { error } = await supabase.from("expenses").delete().eq("id", id);

    // 2. Validamos errores
    if (error) {
      console.error("Error al eliminar gasto en Supabase:", error);
      alert("No se pudo eliminar el gasto.");
      return;
    }

    // 3. Si se eliminó bien, actualizamos el estado con un array limpio
    const updatedExpenses = expenses.filter((e) => e.id !== id);
    setExpenses(updatedExpenses);
  };
  
  // FUNCIÓN PARA GENERAR UN GASTO FIJO ESPECÍFICO
  const generateSpecificRecurringExpense = async () => {
    if (!selectedRecurringExpense) return;

    const recurringExpense = expenses.find(
      (e) => e.id === selectedRecurringExpense
    );
    if (!recurringExpense) return;

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Verificar si ya existe este gasto específico este mes
    const alreadyExists = expenses.some(
      (expense) =>
        expense.description.includes(recurringExpense.description) &&
        expense.category === recurringExpense.category &&
        expense.amount === recurringExpense.amount &&
        !expense.isRecurring &&
        new Date(expense.date).getMonth() === currentMonth &&
        new Date(expense.date).getFullYear() === currentYear
    );

    if (!alreadyExists) {
      const generatedExpense: Expense = {
        id: Date.now().toString(),
        gymId: gymId,
        description: `${recurringExpense.description} (${
          today.getMonth() + 1
        }/${today.getFullYear()})`,
        amount: recurringExpense.amount,
        date: today.toISOString().split("T")[0],
        category: recurringExpense.category,
        isRecurring: false,
      };

      const { error } = await supabase
        .from("expenses")
        .insert([generatedExpense]);
      if (error) {
        console.error("Error insertando gasto fijo generado:", error);
        alert("No se pudo guardar el gasto fijo generado.");
        return;
      }

      setExpenses([...expenses, generatedExpense]);
      setSelectedRecurringExpense("");
      setIsGenerateDialogOpen(false);
    } else {
      alert("Este gasto fijo ya fue generado este mes");
    }
  };

  const totalExpenses = filteredExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );
  const currentMonthExpenses = filteredExpenses.filter((expense) => {
    const expenseDate = new Date(expense.date);
    const currentDate = new Date();
    return (
      expenseDate.getMonth() === currentDate.getMonth() &&
      expenseDate.getFullYear() === currentDate.getFullYear()
    );
  });
  const monthlyTotal = currentMonthExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );

  const expensesByCategory = categories
    .map((category) => ({
      category,
      total: expenses
        .filter((e) => e.category === category)
        .reduce((sum, e) => sum + e.amount, 0),
      count: expenses.filter((e) => e.category === category).length,
    }))
    .filter((item) => item.total > 0);

  const recurringExpenses = expenses.filter((e) => e.isRecurring);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Gestión de Gastos
          </h2>
          <p className="text-muted-foreground">
            Registra y controla los egresos del gimnasio
          </p>
        </div>
        <div className="flex gap-2">
          {/* BOTÓN PARA GENERAR GASTO FIJO ESPECÍFICO */}
          <Dialog
            open={isGenerateDialogOpen}
            onOpenChange={setIsGenerateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Generar Gasto Fijo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Generar Gasto Fijo</DialogTitle>
                <DialogDescription>
                  Selecciona qué gasto fijo quieres generar para este mes.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="recurring-expense">
                    Gasto Fijo a Generar
                  </Label>
                  <Select
                    value={selectedRecurringExpense}
                    onValueChange={setSelectedRecurringExpense}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un gasto fijo" />
                    </SelectTrigger>
                    <SelectContent>
                      {recurringExpenses.map((expense) => (
                        <SelectItem key={expense.id} value={expense.id}>
                          {expense.description} - $
                          {expense.amount.toLocaleString()} ({expense.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {recurringExpenses.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No hay gastos fijos configurados. Crea uno marcando "Gasto
                      fijo mensual" al agregar un gasto.
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={generateSpecificRecurringExpense}
                  disabled={!selectedRecurringExpense}
                >
                  Generar Gasto
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Gasto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
                <DialogDescription>
                  Registra un egreso del gimnasio.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Input
                    id="description"
                    value={newExpense.description}
                    onChange={(e) =>
                      setNewExpense({
                        ...newExpense,
                        description: e.target.value,
                      })
                    }
                    placeholder="Alquiler del local"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount">Monto</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) =>
                      setNewExpense({
                        ...newExpense,
                        amount: Number(e.target.value),
                      })
                    }
                    placeholder="25000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Select
                    value={newExpense.category}
                    onValueChange={(value) =>
                      setNewExpense({ ...newExpense, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">Fecha</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newExpense.date}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, date: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newExpense.isRecurring}
                      onChange={(e) =>
                        setNewExpense({
                          ...newExpense,
                          isRecurring: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm">
                      Gasto fijo mensual (podrás generarlo manualmente cada mes
                      cuando lo pagues)
                    </span>
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleAddExpense}>
                  Registrar Gasto
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards - SIN TOTAL HISTÓRICO */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Gastos del Mes
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${monthlyTotal.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentMonthExpenses.length} gastos este mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Promedio Mensual
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {expenses.length > 0
                ? Math.round(totalExpenses / 12).toLocaleString()
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">Estimado mensual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Fijos</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {recurringExpenses.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Se generan manualmente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Gastos por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {expensesByCategory.map((item) => (
              <div
                key={item.category}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{item.category}</span>
                  <span className="text-sm text-muted-foreground">
                    ({item.count} gastos)
                  </span>
                </div>
                <span className="font-bold text-red-600">
                  ${item.total.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                <SelectItem value="current">Mes actual</SelectItem>
                <SelectItem value="previous">Mes anterior</SelectItem>
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los años</SelectItem>
                <SelectItem value="current">Año actual</SelectItem>
                <SelectItem value="previous">Año anterior</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Gastos ({filteredExpenses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                )
                .map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      {new Date(expense.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {expense.description}
                    </TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>
                      {expense.isRecurring ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Fijo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                          Único
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-red-600">
                      ${expense.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteExpense(expense.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
