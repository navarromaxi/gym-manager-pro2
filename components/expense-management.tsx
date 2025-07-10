"use client"
import type React from "react"
import { useState } from "react"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, Search, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import type { Expense } from "@/lib/supabase"

interface ExpenseManagementProps {
  expenses: Expense[]
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>
  gymId: string
}

export function ExpenseManagement({ expenses, setExpenses, gymId }: ExpenseManagementProps) {
  const [isAddExpenseDialogOpen, setIsAddExpenseDialogOpen] = useState(false)
  const [isEditExpenseDialogOpen, setIsEditExpenseDialogOpen] = useState(false)
  const [currentExpense, setCurrentExpense] = useState<Expense | null>(null)
  const [newExpense, setNewExpense] = useState<Omit<Expense, "id" | "gym_id">>({
    description: "",
    amount: 0,
    date: format(new Date(), "yyyy-MM-dd"),
    category: "Otros",
    is_recurring: false,
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterRecurring, setFilterRecurring] = useState("all")

  const expenseCategories = ["Alquiler", "Servicios", "Sueldos", "Mantenimiento", "Marketing", "Insumos", "Otros"]

  const handleAddExpense = async () => {
    if (!newExpense.description || newExpense.amount <= 0 || !newExpense.date) {
      alert("Por favor, completa todos los campos obligatorios y asegúrate que el monto sea mayor a 0.")
      return
    }

    const expenseToAdd: Omit<Expense, "id"> = {
      ...newExpense,
      gym_id: gymId,
    }

    try {
      const { data, error } = await supabase.from("expenses").insert(expenseToAdd).select().single()
      if (error) throw error
      setExpenses((prev) => [...prev, data])
      setIsAddExpenseDialogOpen(false)
      setNewExpense({
        description: "",
        amount: 0,
        date: format(new Date(), "yyyy-MM-dd"),
        category: "Otros",
        is_recurring: false,
      })
    } catch (error) {
      console.error("Error adding expense:", error)
      alert("Error al agregar gasto. Inténtalo de nuevo.")
    }
  }

  const handleEditExpense = async () => {
    if (!currentExpense || !currentExpense.description || currentExpense.amount <= 0 || !currentExpense.date) {
      alert("Por favor, completa todos los campos obligatorios y asegúrate que el monto sea mayor a 0.")
      return
    }

    try {
      const { data, error } = await supabase
        .from("expenses")
        .update(currentExpense)
        .eq("id", currentExpense.id)
        .select()
        .single()
      if (error) throw error
      setExpenses((prev) => prev.map((e) => (e.id === data.id ? data : e)))
      setIsEditExpenseDialogOpen(false)
      setCurrentExpense(null)
    } catch (error) {
      console.error("Error editing expense:", error)
      alert("Error al editar gasto. Inténtalo de nuevo.")
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este gasto?")) return
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id)
      if (error) throw error
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    } catch (error) {
      console.error("Error deleting expense:", error)
      alert("Error al eliminar gasto. Inténtalo de nuevo.")
    }
  }

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch = searchTerm ? expense.description.toLowerCase().includes(searchTerm.toLowerCase()) : true
    const matchesCategory = filterCategory === "all" ? true : expense.category === filterCategory
    const matchesRecurring =
      filterRecurring === "all" ? true : filterRecurring === "true" ? expense.is_recurring : !expense.is_recurring

    return matchesSearch && matchesCategory && matchesRecurring
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Gastos</h2>
        <Button onClick={() => setIsAddExpenseDialogOpen(true)}>Agregar Gasto</Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar gasto por descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px] sm:w-[160px]">
            <SelectValue placeholder="Filtrar por categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las Categorías</SelectItem>
            {expenseCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRecurring} onValueChange={setFilterRecurring}>
          <SelectTrigger className="w-[180px] sm:w-[160px]">
            <SelectValue placeholder="Filtrar por recurrencia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Recurrentes</SelectItem>
            <SelectItem value="false">No Recurrentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Expenses Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Recurrente</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No se encontraron gastos.
                </TableCell>
              </TableRow>
            ) : (
              filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.description}</TableCell>
                  <TableCell>${expense.amount.toLocaleString()}</TableCell>
                  <TableCell>{format(parseISO(expense.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell>{expense.is_recurring ? "Sí" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentExpense(expense)
                          setIsEditExpenseDialogOpen(true)
                        }}
                      >
                        Editar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteExpense(expense.id)}>
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={isAddExpenseDialogOpen} onOpenChange={setIsAddExpenseDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Gasto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Descripción
              </Label>
              <Input
                id="description"
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Monto
              </Label>
              <Input
                id="amount"
                type="number"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: Number.parseFloat(e.target.value) || 0 })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Fecha
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "col-span-3 justify-start text-left font-normal",
                      !newExpense.date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newExpense.date ? (
                      format(parseISO(newExpense.date), "dd/MM/yyyy", { locale: es })
                    ) : (
                      <span>Selecciona una fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={parseISO(newExpense.date)}
                    onSelect={(date) => date && setNewExpense({ ...newExpense, date: format(date, "yyyy-MM-dd") })}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">
                Categoría
              </Label>
              <Select
                value={newExpense.category}
                onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="is_recurring" className="text-right">
                Recurrente
              </Label>
              <Checkbox
                id="is_recurring"
                checked={newExpense.is_recurring}
                onCheckedChange={(checked) => setNewExpense({ ...newExpense, is_recurring: !!checked })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddExpense}>
              Guardar Gasto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={isEditExpenseDialogOpen} onOpenChange={setIsEditExpenseDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Gasto</DialogTitle>
          </DialogHeader>
          {currentExpense && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">
                  Descripción
                </Label>
                <Input
                  id="edit-description"
                  value={currentExpense.description}
                  onChange={(e) => setCurrentExpense({ ...currentExpense, description: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-amount" className="text-right">
                  Monto
                </Label>
                <Input
                  id="edit-amount"
                  type="number"
                  value={currentExpense.amount}
                  onChange={(e) =>
                    setCurrentExpense({ ...currentExpense, amount: Number.parseFloat(e.target.value) || 0 })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-date" className="text-right">
                  Fecha
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "col-span-3 justify-start text-left font-normal",
                        !currentExpense.date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {currentExpense.date ? (
                        format(parseISO(currentExpense.date), "dd/MM/yyyy", { locale: es })
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={parseISO(currentExpense.date)}
                      onSelect={(date) =>
                        date && setCurrentExpense({ ...currentExpense, date: format(date, "yyyy-MM-dd") })
                      }
                      initialFocus
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-category" className="text-right">
                  Categoría
                </Label>
                <Select
                  value={currentExpense.category}
                  onValueChange={(value) => setCurrentExpense({ ...currentExpense, category: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-is_recurring" className="text-right">
                  Recurrente
                </Label>
                <Checkbox
                  id="edit-is_recurring"
                  checked={currentExpense.is_recurring}
                  onCheckedChange={(checked) => setCurrentExpense({ ...currentExpense, is_recurring: !!checked })}
                  className="col-span-3"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" onClick={handleEditExpense}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
