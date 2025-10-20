"use client";

import { useEffect, useMemo, useState } from "react";
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
import { RefreshCcw, Download } from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { Invoice } from "@/lib/supabase";
import { buildInvoicePdfFileName } from "@/lib/invoice-pdf";

interface InvoiceManagementProps {
  invoices: Invoice[];
  setInvoices: Dispatch<SetStateAction<Invoice[]>>;
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
  gymId,
}: InvoiceManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(
    null
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  const handleDownloadPdf = async (invoice: Invoice) => {
    if (!invoice?.id) return;

  setDownloadingInvoiceId(invoice.id);
  setDownloadError(null);

    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`, {
        method: "GET",
      });

      if (!response.ok) {
        let errorMessage =
          "No pudimos descargar el PDF de la factura. Intenta nuevamente.";
        try {
          const payload = await response.json();
          if (payload?.error) {
            errorMessage = payload.error;
          }
        } catch (parseError) {
          console.error("Error parsing PDF download response", parseError);
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const fallbackFileName = buildInvoicePdfFileName(
        invoice.invoice_number,
        invoice.invoice_series,
        invoice.id
      );
      const resolvedFileName =
        response.headers.get("X-Invoice-Filename") || fallbackFileName;

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = resolvedFileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading invoice PDF", error);
      setDownloadError(
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado al descargar la factura."
      );
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

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
                          variant="default"
                          size="sm"
                          className="inline-flex items-center gap-2"
                          onClick={() => handleDownloadPdf(invoice)}
                          disabled={
                            downloadingInvoiceId === invoice.id ||
                            !invoice.response_payload
                          }
                        >
                          <Download className="h-4 w-4" />
                          {downloadingInvoiceId === invoice.id
                            ? "Descargando…"
                            : "Descargar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {downloadError && (
            <p className="mt-4 text-sm text-red-600">{downloadError}</p>
          )}
          {filteredInvoices.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Mostrando {filteredInvoices.length} factura
              {filteredInvoices.length === 1 ? "" : "s"} de {invoices.length} cargadas.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}