"use client";

import { Calendar as CalendarIcon, Download, Filter } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ReportsToolbarProps = {
  gymName: string;
  timeFilter: string;
  customRange?: DateRange;
  hasCustomRange: boolean;
  customRangeLabel: string;
  periodLabel: string;
  onTimeFilterChange: (value: string) => void;
  onCustomRangeChange: (range?: DateRange) => void;
  onClearCustomRange: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
};

export function ReportsToolbar({ gymName, timeFilter, customRange, hasCustomRange, customRangeLabel, periodLabel, onTimeFilterChange, onCustomRangeChange, onClearCustomRange, onExportJSON, onExportCSV }: ReportsToolbarProps) {
  return <>
    <div className="flex items-center justify-between">
      <div><h2 className="text-3xl font-bold tracking-tight">Reportes y Estadísticas</h2><p className="text-muted-foreground">Análisis completo del rendimiento de {gymName}</p></div>
      <DropdownMenu><DropdownMenuTrigger asChild><Button><Download className="mr-2 h-4 w-4" />Exportar</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={onExportJSON}>Exportar JSON</DropdownMenuItem><DropdownMenuItem onClick={onExportCSV}>Exportar CSV (Excel)</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </div>
    <Card className="overflow-hidden border-0 bg-slate-950 shadow-xl shadow-purple-950/20">
      <CardHeader className="bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 p-5"><CardTitle className="flex items-center text-base text-white"><span className="mr-3 rounded-xl bg-white/15 p-2.5 ring-1 ring-white/20"><Filter className="h-4 w-4" /></span>Filtros de Tiempo</CardTitle></CardHeader>
      <CardContent className="bg-gradient-to-br from-slate-950 via-slate-950 to-purple-950/70 p-5"><div className="flex flex-wrap items-center gap-3">
        <Select value={timeFilter} onValueChange={onTimeFilterChange}><SelectTrigger className="w-[200px]"><SelectValue placeholder="Seleccionar período" /></SelectTrigger><SelectContent><SelectItem value="current_month">Mes Actual</SelectItem><SelectItem value="previous_month">Mes Anterior</SelectItem><SelectItem value="last_6_months">Últimos 6 Meses</SelectItem><SelectItem value="current_year">Año Actual</SelectItem><SelectItem value="last_year">Año Anterior</SelectItem><SelectItem value="custom">Personalizado</SelectItem></SelectContent></Select>
        <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-[260px] justify-start text-left font-normal", !hasCustomRange && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{hasCustomRange ? customRangeLabel : "Seleccionar rango"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" numberOfMonths={2} selected={customRange} onSelect={onCustomRangeChange} /></PopoverContent></Popover>
        {hasCustomRange ? <Button type="button" size="sm" variant="ghost" onClick={onClearCustomRange}>Limpiar</Button> : null}
        <span className="text-sm text-muted-foreground">Mostrando datos de: <strong>{periodLabel}</strong></span>
      </div></CardContent>
    </Card>
  </>;
}
