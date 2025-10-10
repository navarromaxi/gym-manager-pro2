"use client";

import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCcw, FileText } from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { Invoice, Payment } from "@/lib/supabase";

interface InvoiceManagementProps {
  invoices: Invoice[];
  setInvoices: Dispatch<SetStateAction<Invoice[]>>;
  payments: Payment[];
  gymId: string;
}

const parseISODate = (value?: string | null) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDisplayDate = (value?: string | null) => {
  const parsed = parseISODate(value);
  return parsed ? parsed.toLocaleDateString() : value ?? "-";
};

const statusBadgeVariant = (status?: string | null) => {
  if (!status) return "secondary" as const;
  const normalized = status.toLowerCase();
  if (normalized.includes("rechaz")) return "destructive" as const;
  if (normalized.includes("pend")) return "outline" as const;
  if (normalized.includes("error")) return "destructive" as const;
  if (normalized.includes("proces") || normalized.includes("aprob")) {
    return "default" as const;
  }
  return "secondary" as const;
};

export function InvoiceManagement({
  invoices,
  setInvoices,
  payments,
  gymId,
}: InvoiceManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const fromDate = startDate ? parseISODate(startDate) : null;
    const toDate = endDate ? parseISODate(endDate) : null;

    return invoices.filter((invoice) => {
      if (normalizedSearch.length > 0) {
        const haystack = [
          invoice.member_name,
          invoice.invoice_number ?? "",
          invoice.invoice_series ?? "",
          invoice.status ?? "",
          invoice.external_invoice_id ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      if (fromDate || toDate) {
        const issued = parseISODate(invoice.issued_at);
        if (!issued) return false;

        if (fromDate && issued < fromDate) {
          return false;
        }
        if (toDate && issued > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, searchTerm, startDate, endDate]);

  const handleOpenDetails = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailOpen(true);
  };

  const handleRefresh = async () => {
    if (!gymId) return;

    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, gym_id, payment_id, member_id, member_name, total, currency, status, invoice_number, invoice_series, external_invoice_id, environment, typecfe, issued_at, due_date, request_payload, response_payload, created_at, updated_at"
        )
        .eq("gym_id", gymId)
        .order("issued_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });

      if (error) {
        throw error;
      }

      setInvoices((data ?? []) as Invoice[]);
    } catch (error) {
      console.error("Error refreshing invoices", error);
      setRefreshError(
        "No pudimos actualizar las facturas. Intenta nuevamente en unos segundos."
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const relatedPayment = useMemo(() => {
    if (!selectedInvoice) return null;
    return payments.find((payment) => payment.id === selectedInvoice.payment_id);
  }, [selectedInvoice, payments]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Facturas</h2>
        <p className="text-muted-foreground">
          Administra y consulta todas las facturas emitidas desde el sistema.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4 w-full">
              <div className="grid gap-1">
                <Label htmlFor="invoice-search">Buscar</Label>
                <Input
                  id="invoice-search"
                  placeholder="Socio, número o estado"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="invoice-start-date">Desde</Label>
                <Input
                  id="invoice-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="invoice-end-date">Hasta</Label>
                <Input
                  id="invoice-end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex items-center gap-2"
                onClick={handleRefresh}
                disabled={isRefreshing || !gymId}
              >
                <RefreshCcw className="h-4 w-4" />
                {isRefreshing ? "Actualizando…" : "Actualizar"}
              </Button>
            </div>
          </div>
          {refreshError && (
            <p className="text-sm text-red-600">{refreshError}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Emisión</TableHead>
                  <TableHead>Socio / Cliente</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Serie</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">
                      No hay facturas para mostrar con los filtros actuales.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{formatDisplayDate(invoice.issued_at)}</TableCell>
                      <TableCell className="font-medium">
                        {invoice.member_name}
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        ${invoice.total.toLocaleString()}
                      </TableCell>
                      <TableCell>{invoice.currency || "UYU"}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(invoice.status)}>
                          {invoice.status || "Sin estado"}
                        </Badge>
                      </TableCell>
                      <TableCell>{invoice.invoice_number ?? "-"}</TableCell>
                      <TableCell>{invoice.invoice_series ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {invoice.environment || "TEST"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="inline-flex items-center gap-2"
                          onClick={() => handleOpenDetails(invoice)}
                        >
                          <FileText className="h-4 w-4" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filteredInvoices.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Mostrando {filteredInvoices.length} factura
              {filteredInvoices.length === 1 ? "" : "s"} de {invoices.length} cargadas.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open);
          if (!open) {
            setSelectedInvoice(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detalle de factura</DialogTitle>
            <DialogDescription>
              Información completa de la factura seleccionada.
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 py-2">
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estado</span>
                  <Badge variant={statusBadgeVariant(selectedInvoice.status)}>
                    {selectedInvoice.status || "Sin estado"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Socio / Cliente</span>
                  <span className="font-medium text-right">
                    {selectedInvoice.member_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Monto</span>
                  <span className="font-semibold text-green-600">
                    ${selectedInvoice.total.toLocaleString()} {selectedInvoice.currency || "UYU"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Fecha de emisión</span>
                  <span>{formatDisplayDate(selectedInvoice.issued_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Vencimiento</span>
                  <span>{formatDisplayDate(selectedInvoice.due_date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Número</span>
                  <span>{selectedInvoice.invoice_number ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Serie</span>
                  <span>{selectedInvoice.invoice_series ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Identificador externo</span>
                  <span className="truncate max-w-[250px] text-right" title={selectedInvoice.external_invoice_id ?? undefined}>
                    {selectedInvoice.external_invoice_id ?? "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ambiente</span>
                  <Badge variant="outline">
                    {selectedInvoice.environment || "TEST"}
                  </Badge>
                </div>
                {relatedPayment && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pago asociado</span>
                    <span className="text-right">
                      {relatedPayment.plan || relatedPayment.description || "Pago registrado"}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Detalle técnico</h4>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    Datos enviados
                  </span>
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(selectedInvoice.request_payload ?? {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">
                    Respuesta del proveedor
                  </span>
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(selectedInvoice.response_payload ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDetailOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}