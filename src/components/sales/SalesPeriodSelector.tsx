import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type PeriodKey, getPeriodRange } from "@/lib/sales-queries";
import { cn } from "@/lib/utils";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "esta_semana", label: "Esta semana" },
  { key: "semana_pasada", label: "Semana pasada" },
  { key: "este_mes", label: "Este mes" },
  { key: "mes_pasado", label: "Mes pasado" },
  { key: "personalizado", label: "Personalizado" },
];

export function SalesPeriodSelector({
  period,
  onPeriodChange,
  customStart,
  customEnd,
  onCustomDateChange,
}: {
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  customStart: string;
  customEnd: string;
  onCustomDateChange: (start: string, end: string) => void;
}) {
  const { current, previous } = getPeriodRange(period, { start: customStart, end: customEnd });

  return (
    <div className="space-y-3">
      {/* Selector de botones rápidos con scroll horizontal en móvil */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onPeriodChange(p.key)}
              className={cn(
                "tap inline-flex shrink-0 items-center rounded-xl px-3.5 py-2 text-xs font-semibold transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "bg-secondary text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Rango de fechas personalizado si aplica */}
      {period === "personalizado" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-semibold">Desde:</span>
          </div>
          <Input
            type="date"
            className="tap h-8 w-36 text-xs"
            value={customStart}
            onChange={(e) => onCustomDateChange(e.target.value, customEnd)}
          />
          <span className="text-xs text-muted-foreground">hasta</span>
          <Input
            type="date"
            className="tap h-8 w-36 text-xs"
            value={customEnd}
            onChange={(e) => onCustomDateChange(customStart, e.target.value)}
          />
        </div>
      )}

      {/* Rango informativo */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Periodo consultado: <strong className="text-foreground">{current.start}</strong> al <strong className="text-foreground">{current.end}</strong>
        </span>
        <span className="text-[11px]">
          Comparado contra: {previous.start} al {previous.end}
        </span>
      </div>
    </div>
  );
}
