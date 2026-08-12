import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";
import { type ChartDataPoint } from "@/lib/sales-queries";
import { money } from "@/lib/cm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLOR_VENTAS = "#5CC6D0"; // Turquesa Cookies Moon
const COLOR_COBROS = "#10B981"; // Verde Esmeralda para dinero cobrado

export function SalesChart({
  data,
  granularity,
  onGranularityChange,
}: {
  data: ChartDataPoint[];
  granularity: "dia" | "semana" | "mes";
  onGranularityChange?: (g: "dia" | "semana" | "mes") => void;
}) {
  const [chartType, setChartType] = useState<"bar" | "area">("bar");

  const totalVentas = data.reduce((s, d) => s + d.ventas, 0);
  const totalCobros = data.reduce((s, d) => s + d.cobros, 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pData = payload[0].payload as ChartDataPoint;
      const diff = (pData.ventas || 0) - (pData.cobros || 0);

      return (
        <div className="rounded-xl border border-border bg-card p-3 shadow-xl text-xs space-y-1.5">
          <p className="font-bold text-foreground">{pData.label} ({pData.date})</p>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 font-medium" style={{ color: COLOR_VENTAS }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_VENTAS }} />
              Ventas ({pData.pedidosCount} ped):
            </span>
            <span className="font-bold text-foreground">{money(pData.ventas)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 font-medium" style={{ color: COLOR_COBROS }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_COBROS }} />
              Cobros ({pData.pagosCount} pag):
            </span>
            <span className="font-bold text-emerald-400">{money(pData.cobros)}</span>
          </div>
          <div className="border-t border-border pt-1 flex items-center justify-between text-muted-foreground">
            <span>Diferencia:</span>
            <span className={cn("font-semibold", diff > 0 ? "text-amber-400" : "text-emerald-400")}>
              {diff > 0 ? `+${money(diff)} sin cobrar` : `${money(Math.abs(diff))} cobro a favor`}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="panel p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold">Evolución de Ventas vs Cobros</h3>
          <p className="text-xs text-muted-foreground">
            Compara el valor de los pedidos vendidos contra el dinero efectivamente recibido.
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-7 px-2.5 text-xs tap", chartType === "bar" && "bg-secondary text-primary font-bold")}
            onClick={() => setChartType("bar")}
            title="Vista de Barras"
          >
            <BarChart3 className="mr-1 h-3.5 w-3.5" /> Barras
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-7 px-2.5 text-xs tap", chartType === "area" && "bg-secondary text-primary font-bold")}
            onClick={() => setChartType("area")}
            title="Vista de Tendencia (Área)"
          >
            <TrendingUp className="mr-1 h-3.5 w-3.5" /> Tendencia
          </Button>
        </div>
      </div>

      {data.length === 0 || (totalVentas === 0 && totalCobros === 0) ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
          <p className="font-semibold">Sin movimientos registrados en este periodo</p>
          <p className="mt-1 text-[11px]">No hay pedidos ni cobros para graficar.</p>
        </div>
      ) : (
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.02 268 / 0.5)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="oklch(0.7 0.02 265)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "oklch(0.3 0.02 268)" }}
                />
                <YAxis
                  stroke="oklch(0.7 0.02 265)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={32}
                  formatter={(val) => (
                    <span className="text-xs font-semibold text-foreground mr-3">
                      {val === "ventas" ? "Total Vendido" : "Total Cobrado"}
                    </span>
                  )}
                />
                <Bar
                  dataKey="ventas"
                  name="ventas"
                  fill={COLOR_VENTAS}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="cobros"
                  name="cobros"
                  fill={COLOR_COBROS}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            ) : (
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLOR_VENTAS} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLOR_VENTAS} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorCobros" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLOR_COBROS} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLOR_COBROS} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.02 268 / 0.5)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="oklch(0.7 0.02 265)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "oklch(0.3 0.02 268)" }}
                />
                <YAxis
                  stroke="oklch(0.7 0.02 265)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={32}
                  formatter={(val) => (
                    <span className="text-xs font-semibold text-foreground mr-3">
                      {val === "ventas" ? "Total Vendido" : "Total Cobrado"}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="ventas"
                  name="ventas"
                  stroke={COLOR_VENTAS}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorVentas)"
                />
                <Area
                  type="monotone"
                  dataKey="cobros"
                  name="cobros"
                  stroke={COLOR_COBROS}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorCobros)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
