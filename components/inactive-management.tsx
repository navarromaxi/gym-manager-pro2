"use client";

import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRealStatus } from "@/lib/utils";
import type { Member, Payment } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
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
import { Search, Users, Phone, Mail, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MEMBERS_PER_BATCH = 10;
interface InactiveManagementProps {
  members: Member[];
  setMembers: (members: Member[]) => void;
  payments: Payment[];
}

export function InactiveManagement({
  members,
  setMembers,
  payments,
}: InactiveManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [colorFilter, setColorFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const { toast } = useToast();
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [editingComment, setEditingComment] = useState<{
    memberId: string;
    comment: string;
  } | null>(null);

  // Filtrar solo socios inactivos y los guardo en constante
  const inactiveMembers = members.filter(
    (m) => getRealStatus(m) === "inactive"
  );

  const filteredInactiveMembers = useMemo(() => {
    return inactiveMembers.filter((member) => {
      const name = member.name?.toLowerCase() ?? "";
      const email = member.email?.toLowerCase() ?? "";
      const normalizedSearch = searchTerm.toLowerCase();

      const matchesSearch =
        name.includes(normalizedSearch) || email.includes(normalizedSearch);

      const matchesColor =
        colorFilter === "all" || member.inactive_level === colorFilter;

      let matchesDate = true;
      if (dateFilter !== "all") {
        const lastPaymentDate = new Date(member.last_payment);
        const monthsAgo = Number.parseInt(dateFilter);
        const filterDate = new Date();
        filterDate.setMonth(filterDate.getMonth() - monthsAgo);
        matchesDate = lastPaymentDate >= filterDate;
      }

      return matchesSearch && matchesColor && matchesDate;
    });
  }, [inactiveMembers, searchTerm, colorFilter, dateFilter]);

  const sortedInactiveMembers = useMemo(() => {
    return [...filteredInactiveMembers].sort(
      (a, b) =>
        new Date(b.last_payment).getTime() - new Date(a.last_payment).getTime()
    );
  }, [filteredInactiveMembers]);

  const [visibleCount, setVisibleCount] = useState(MEMBERS_PER_BATCH);

  useEffect(() => {
    setVisibleCount(MEMBERS_PER_BATCH);
  }, [searchTerm, colorFilter, dateFilter, inactiveMembers.length]);

  const displayedInactiveMembers = sortedInactiveMembers.slice(0, visibleCount);
  const canLoadMore = visibleCount < sortedInactiveMembers.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) =>
      Math.min(prev + MEMBERS_PER_BATCH, sortedInactiveMembers.length)
    );
  };

  // Función para cambiar el color/nivel de un socio inactivo
  const updateInactiveLevel = async (
    memberId: string,
    newLevel: "green" | "yellow" | "red"
  ) => {
    const { error } = await supabase
      .from("members")
      .update({ inactive_level: newLevel })
      .eq("id", memberId);

    if (error) {
      console.error("Error actualizando nivel inactivo:", error);
      toast({
        variant: "destructive",
        title: "Error al actualizar clasificación",
        description: "No se pudo guardar en la base de datos.",
      });
      return;
    }

    setMembers(
      members.map((member) =>
        member.id === memberId
          ? { ...member, inactive_level: newLevel }
          : member
      )
    );

    toast({
      title: "Clasificación actualizada",
      description: `Socio clasificado como ${
        newLevel === "green"
          ? "Recuperable"
          : newLevel === "yellow"
          ? "En Evaluación"
          : "Perdido"
      }.`,
      className: `${
        newLevel === "green"
          ? "bg-green-500 text-white"
          : newLevel === "yellow"
          ? "bg-yellow-400 text-black"
          : "bg-red-600 text-white"
      }`,
    });
  };

  const updateMemberComment = async (memberId: string, comment: string) => {
    // Actualizar en Supabase
    const { error } = await supabase
      .from("members")
      .update({ inactive_comment: comment })
      .eq("id", memberId);

    if (error) {
      console.error("Error actualizando comentario:", error);
      alert("Hubo un error al guardar el comentario.");
      return;
    }

    // Actualizar en estado local
    setMembers(
      members.map((member) =>
        member.id === memberId
          ? { ...member, inactive_comment: comment }
          : member
      )
    );
    setIsCommentDialogOpen(false);
    setEditingComment(null);
  };

  // Calcular días desde el último pago
  const getDaysSinceLastPayment = (lastPayment: string) => {
    const today = new Date();
    const lastPaymentDate = new Date(lastPayment);
    const diffTime = today.getTime() - lastPaymentDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Obtener información de pagos del socio
  const getMemberPaymentInfo = (memberId: string) => {
    const memberPayments = payments.filter((p) => p.member_id === memberId);
    const totalPaid = memberPayments.reduce((sum, p) => sum + p.amount, 0);
    const paymentCount = memberPayments.length;

    return {
      totalPaid,
      paymentCount,
      lastPaymentAmount:
        memberPayments.length > 0
          ? memberPayments[memberPayments.length - 1].amount
          : 0,
    };
  };

  const getColorBadge = (level?: "green" | "yellow" | "red") => {
    switch (level) {
      case "green":
        return <Badge className="bg-green-500 text-white">Recuperable</Badge>;
      case "red":
        return <Badge className="bg-red-500 text-white">Perdido</Badge>;
      case "yellow":
      default:
        return (
          <Badge className="bg-yellow-500 text-white">En Evaluación</Badge>
        );
    }
  };

  const getColorStats = () => {
    const green = inactiveMembers.filter(
      (m) => m.inactive_level === "green"
    ).length;
    const yellow = inactiveMembers.filter(
      (m) => m.inactive_level === "yellow" || !m.inactive_level
    ).length;
    const red = inactiveMembers.filter(
      (m) => m.inactive_level === "red"
    ).length;

    return { green, yellow, red };
  };

  const colorStats = getColorStats();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Gestión de Socios Inactivos
          </h2>
          <p className="text-muted-foreground">
            Administra y clasifica socios inactivos (+30 días sin pagar)
          </p>
        </div>
      </div>

      {/* Estadísticas por Color */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Inactivos
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveMembers.length}</div>
            <p className="text-xs text-muted-foreground">Socios inactivos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recuperables</CardTitle>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {colorStats.green}
            </div>
            <p className="text-xs text-muted-foreground">Posible retorno</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Evaluación</CardTitle>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {colorStats.yellow}
            </div>
            <p className="text-xs text-muted-foreground">Por clasificar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Perdidos</CardTitle>
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {colorStats.red}
            </div>
            <p className="text-xs text-muted-foreground">Difícil retorno</p>
          </CardContent>
        </Card>
      </div>

      {/* Información Adicional */}
      <Card>
        <CardHeader>
          <CardTitle>Información de Clasificación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="font-medium text-green-800">Recuperables</span>
              </div>
              <p className="text-sm text-green-700">
                Socios que probablemente regresen con una buena estrategia de
                retención.
              </p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center mb-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                <span className="font-medium text-yellow-800">
                  En Evaluación
                </span>
              </div>
              <p className="text-sm text-yellow-700">
                Socios que requieren análisis adicional para determinar su
                potencial de retorno.
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="flex items-center mb-2">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span className="font-medium text-red-800">Perdidos</span>
              </div>
              <p className="text-sm text-red-700">
                Socios que probablemente no regresen. Considerar remover de
                campañas activas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
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
                  placeholder="Buscar por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={colorFilter} onValueChange={setColorFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Clasificación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las clasificaciones</SelectItem>
                <SelectItem value="green">Recuperables</SelectItem>
                <SelectItem value="yellow">En Evaluación</SelectItem>
                <SelectItem value="red">Perdidos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Último pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cualquier fecha</SelectItem>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Último año</SelectItem>
                <SelectItem value="24">Últimos 2 años</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Socios Inactivos */}
      <Card>
        <CardHeader>
          <CardTitle>
            Socios Inactivos ({filteredInactiveMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Último Plan</TableHead>
                <TableHead>Último Pago</TableHead>
                <TableHead>Días Inactivo</TableHead>
                <TableHead>Total Pagado</TableHead>
                <TableHead>Clasificación</TableHead>
                <TableHead>Comentarios</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedInactiveMembers.map((member) => {
                const daysSinceLastPayment = getDaysSinceLastPayment(
                  member.last_payment
                );
                const paymentInfo = getMemberPaymentInfo(member.id);

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Socio desde:{" "}
                          {new Date(member.join_date).toLocaleDateString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <Mail className="h-3 w-3 mr-1" />
                          {member.email}
                        </div>
                        <div className="flex items-center text-sm">
                          <Phone className="h-3 w-3 mr-1" />
                          {member.phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{member.plan}</div>
                        <div className="text-sm text-muted-foreground">
                          ${member.plan_price}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {new Date(member.last_payment).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ${paymentInfo.lastPaymentAmount}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1 text-red-500" />
                        <span className="font-medium text-red-600">
                          {daysSinceLastPayment} días
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          ${paymentInfo.totalPaid.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {paymentInfo.paymentCount} pagos
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getColorBadge(member.inactive_level)}
                    </TableCell>
                    <TableCell>
                      <div className="w-[150px] overflow-hidden whitespace-nowrap text-ellipsis text-sm text-gray-300">
                        {member.inactive_comment || (
                          <span className="text-xs text-muted-foreground">
                            Sin comentarios
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-green-50 hover:bg-green-100"
                          onClick={() =>
                            updateInactiveLevel(member.id, "green")
                          }
                        >
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-yellow-50 hover:bg-yellow-100"
                          onClick={() =>
                            updateInactiveLevel(member.id, "yellow")
                          }
                        >
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-red-50 hover:bg-red-100"
                          onClick={() => updateInactiveLevel(member.id, "red")}
                        >
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingComment({
                              memberId: member.id,
                              comment: member.inactive_comment || "",
                            });
                            setIsCommentDialogOpen(true);
                          }}
                        >
                          💬
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              {filteredInactiveMembers.length > 0 && (
                <>
                  Mostrando <strong>{displayedInactiveMembers.length}</strong>{" "}
                  de <strong>{filteredInactiveMembers.length}</strong> socios
                  inactivos
                </>
              )}
            </div>
            {canLoadMore && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleLoadMore}>
                  Cargar más inactivos
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comment Dialog */}
      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Agregar Comentario</DialogTitle>
            <DialogDescription>
              Agrega un comentario sobre el estado del socio inactivo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="comment">Comentario</Label>
              <Textarea
                id="comment"
                value={editingComment?.comment || ""}
                onChange={(e) =>
                  setEditingComment((prev) =>
                    prev ? { ...prev, comment: e.target.value } : null
                  )
                }
                placeholder="Ej: Me contacté y ya no es posible que vuelva, se fue del país."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCommentDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editingComment) {
                  updateMemberComment(
                    editingComment.memberId,
                    editingComment.comment
                  );
                }
              }}
            >
              Guardar Comentario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
