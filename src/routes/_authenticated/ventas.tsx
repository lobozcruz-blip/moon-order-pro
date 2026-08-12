import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  TrendingUp,
  CreditCard,
  ShoppingBag,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Package,
  Layers,
  Users,
  Truck,
  RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfiles } from "@/lib/queries";
import {
  useSalesAnalytics,
  getMexicoDate,
  type PeriodKey,
  type SalesFilters,
  type FinancialOrder,
  type FinancialPayment,
} from "@/lib/sales-queries";
import { SalesPeriodSelector } from "@/components/sales/SalesPeriodSelector";
import { SalesChart } from "@/components/sales/SalesChart";
import { SalesDrilldownModal } from "@/components/sales/SalesDrilldownModal";
import {
  ORDER_STATUSES,
  STATUS_META,
  PAYMENT_META,
  CATEGORIES,
  CATEGORY_META,
  PAYMENT_METHODS,
  money,
  dateFmt,
  type OrderStatus,
  type Category,
  type DeliveryType,
} from "@/lib/cm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ventas")({
  head: () => ({
    meta: [
      { title: "Ventas y Cobros — Cookies Moon" },
      { name: "description", content: "Estadísticas de ventas, cobranza, abonos y flujo de efectivo." },
      { property: "og:title", content: "Ventas y Cobros — Cookies Moon" },
      { property: "og:description", content: "Estadísticas de ventas, cobranza, abonos y flujo de efectivo." },
    ],
  }),
  component: VentasPage,
});

function VentasPage() {
  const mxNow = getMexicoDate();
  const [period, setPeriod] = useState<PeriodKey>("este_mes");
  const [customStart, setCustomStart] = useState(mxNow.dateStr);
  const [customEnd, setCustomEnd] = useState(mxNow.dateStr);
  const [filters, setFilters] = useState<SalesFilters>({
    assigneeId: "TODOS",
    deliveryType: "TODOS",
    orderStatus: "TODOS",
    paymentMethod: "TODOS",
    category: "TODAS",
  });
  const [showFilterBar, setShowFilterBar] = useState(false);

  const { data: profiles } = useProfiles();
  const { data: stats, isLoading, refetch } = useSalesAnalytics(
    period,
    { start: customStart, end: customEnd },
    filters,
    "dia",
  );

  // Drilldown modal states
  const [drilldown, setDrilldown] = useState<{
    open: boolean;
    type: "orders" | "payments";
    title: string;
  }>({
    open: false,
    type: "orders",
    title: "",
  });

  const handleCustomDateChange = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
  };

  const resetFilters = () => {
    setFilters({
      assigneeId: "TODOS",
      deliveryType: "TODOS",
      orderStatus: "TODOS",
      paymentMethod: "TODOS",
      category: "TODAS",
    });
  };

  const hasActiveFilters =
    filters.assigneeId !== "TODOS" ||
    filters.deliveryType !== "TODOS" ||
    filters.orderStatus !== "TODOS" ||
    filters.paymentMethod !== "TODOS" ||
    filters.category !== "TODAS";

  return (
    <>
      <PageHeader
        title="Ventas y Cobros"
        subtitle="Analítica financiera en tiempo real, histórico de ventas y recaudación."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={showFilterBar ? "secondary" : "outline"}
              size="sm"
              className={cn("tap text-xs", hasActiveFilters && "border-primary text-primary font-bold")}
              onClick={() => setShowFilterBar(!showFilterBar)}
            >
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              Filtros
              {hasActiveFilters && (
                <span className="ml-1.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="tap text-xs"
              onClick={() => refetch()}
            >
              Actualizar
            </Button>
          </div>
        }
      />

      {/* Selector de periodo */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <SalesPeriodSelector
          period={period}
          onPeriodChange={setPeriod}
          customStart={customStart}
          customEnd={customEnd}
          onCustomDateChange={handleCustomDateChange}
        />
      </div>

      {/* Barra de Filtros Desplegable */}
      {showFilterBar && (
        <div className="mb-6 rounded-2xl border border-border bg-card/60 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Filtrar datos del periodo
            </h4>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="tap inline-flex items-center text-xs text-primary hover:underline"
              >
                <RotateCcw className="mr-1 h-3 w-3" /> Limpiar filtros
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Responsable */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Responsable</Label>
              <Select
                value={filters.assigneeId ?? "TODOS"}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, assigneeId: v }))}
              >
                <SelectTrigger className="tap h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los responsables</SelectItem>
                  {(profiles ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de entrega */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Tipo de entrega</Label>
              <Select
                value={filters.deliveryType ?? "TODOS"}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, deliveryType: v as any }))}
              >
                <SelectTrigger className="tap h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todas las entregas</SelectItem>
                  <SelectItem value="envio">Envío por paquetería</SelectItem>
                  <SelectItem value="personal">Entrega personal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Estado del pedido */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Estado del pedido</Label>
              <Select
                value={filters.orderStatus ?? "TODOS"}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, orderStatus: v as any }))}
              >
                <SelectTrigger className="tap h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los estados</SelectItem>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s]?.label ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Método de pago */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Método de pago</Label>
              <Select
                value={filters.paymentMethod ?? "TODOS"}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, paymentMethod: v }))}
              >
                <SelectTrigger className="tap h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los métodos</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categoría */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Categoría de producto</Label>
              <Select
                value={filters.category ?? "TODAS"}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, category: v as any }))}
              >
                <SelectTrigger className="tap h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas las categorías</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_META[c]?.label ?? c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas Principales de KPI */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Total Vendido (Turquesa) */}
          <div
            onClick={() =>
              setDrilldown({
                open: true,
                type: "orders",
                title: `Pedidos Vendidos — ${stats?.periodLabel}`,
              })
            }
            className="tap cursor-pointer rounded-2xl border border-primary/30 bg-card p-4 transition-all hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShoppingBag className="h-5 w-5" />
              </span>
              {stats?.pctVentasDiff !== null && stats?.pctVentasDiff !== undefined && (
                <span
                  className={cn(
                    "inline-flex items-center text-xs font-bold",
                    stats.pctVentasDiff >= 0 ? "text-primary" : "text-amber-400",
                  )}
                >
                  {stats.pctVentasDiff >= 0 ? (
                    <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
                  )}
                  {Math.abs(stats.pctVentasDiff)}% vs ant.
                </span>
              )}
            </div>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight text-primary">
              {money(stats?.totalVendido)}
            </p>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Vendido</span>
              <span className="font-semibold text-foreground underline decoration-dotted">
                {stats?.pedidosCount} pedidos
              </span>
            </div>
          </div>

          {/* 2. Total Cobrado (Verde Esmeralda) */}
          <div
            onClick={() =>
              setDrilldown({
                open: true,
                type: "payments",
                title: `Cobros y Abonos Recibidos — ${stats?.periodLabel}`,
              })
            }
            className="tap cursor-pointer rounded-2xl border border-emerald-500/30 bg-card p-4 transition-all hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/5"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <CreditCard className="h-5 w-5" />
              </span>
              {stats?.pctCobrosDiff !== null && stats?.pctCobrosDiff !== undefined && (
                <span
                  className={cn(
                    "inline-flex items-center text-xs font-bold",
                    stats.pctCobrosDiff >= 0 ? "text-emerald-400" : "text-amber-400",
                  )}
                >
                  {stats.pctCobrosDiff >= 0 ? (
                    <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
                  )}
                  {Math.abs(stats.pctCobrosDiff)}% vs ant.
                </span>
              )}
            </div>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight text-emerald-400">
              {money(stats?.totalCobrado)}
            </p>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Cobrado / Pagado</span>
              <span className="font-semibold text-foreground underline decoration-dotted">
                {stats?.pagosCount} pagos
              </span>
            </div>
          </div>

          {/* 3. Diferencia Periodo */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <Layers className="h-5 w-5" />
              </span>
              <span className="text-[11px] text-muted-foreground">Ventas − Cobros</span>
            </div>
            <p
              className={cn(
                "mt-3 font-display text-3xl font-bold tracking-tight",
                (stats?.diferencia || 0) > 0 ? "text-amber-400" : "text-emerald-400",
              )}
            >
              {money(stats?.diferencia)}
            </p>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Diferencia del periodo</span>
              <span>{(stats?.diferencia || 0) > 0 ? "Por cobrar" : "Cobrado al 100%"}</span>
            </div>
          </div>

          {/* 4. Saldo Pendiente Total Global */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <Wallet className="h-5 w-5" />
              </span>
              <span className="text-[11px] text-amber-400/80 font-bold">Acumulado activo</span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground">
              {money(stats?.saldoPendienteTotal)}
            </p>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Pendiente por cobrar</span>
              <span className="font-semibold">{stats?.pedidosConSaldoCount} pedidos</span>
            </div>
          </div>
        </div>
      )}

      {/* Gráfica y Métodos de Pago */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Gráfica Evolución (2 columnas) */}
        <div className="lg:col-span-2">
          <SalesChart data={stats?.chartData ?? []} granularity="dia" />
        </div>

        {/* Desglose Métodos de Pago (1 columna) */}
        <div className="panel p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold">Cobrado por Método</h3>
            <span className="text-xs font-semibold text-emerald-400">{money(stats?.totalCobrado)}</span>
          </div>

          <div className="space-y-3">
            {(stats?.metodosPago ?? []).map((m) => (
              <div key={m.method} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{m.method}</span>
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">{money(m.amount)}</strong> ({m.percentage}%)
                  </span>
                </div>
                <Progress value={m.percentage} className="h-1.5" />
              </div>
            ))}

            {(stats?.metodosPago ?? []).length === 0 && (
              <p className="py-12 text-center text-xs text-muted-foreground">
                No hay pagos registrados en este periodo.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Pestañas con Listado Detallado */}
      <div className="mt-6">
        <Tabs defaultValue="pedidos">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="pedidos" className="flex-1 sm:flex-initial">
              Pedidos del Periodo ({stats?.orders.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="pagos" className="flex-1 sm:flex-initial">
              Cobros y Abonos ({stats?.payments.length ?? 0})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Pedidos */}
          <TabsContent value="pedidos" className="mt-4">
            <div className="panel divide-y divide-border overflow-hidden">
              <div className="hidden grid-cols-12 gap-2 bg-secondary/50 p-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:grid">
                <div className="col-span-2">Folio</div>
                <div className="col-span-4">Cliente</div>
                <div className="col-span-2 text-center">Estado</div>
                <div className="col-span-2 text-center">Pago</div>
                <div className="col-span-2 text-right">Total</div>
              </div>

              {(stats?.orders ?? []).map((o) => {
                const stMeta = STATUS_META[o.status] ?? STATUS_META.en_espera;
                const payMeta = (o.payment_status && PAYMENT_META[o.payment_status]) ? PAYMENT_META[o.payment_status] : PAYMENT_META.sin_pago;
                const isCanceled = o.status === "cancelado";

                return (
                  <Link
                    key={o.id}
                    to="/pedidos/$orderId"
                    params={{ orderId: o.id }}
                    className={cn(
                      "tap flex flex-wrap items-center justify-between gap-3 p-3 transition-colors hover:bg-secondary/60 sm:grid sm:grid-cols-12",
                      isCanceled && "opacity-60 bg-destructive/5",
                    )}
                  >
                    <div className="col-span-2 font-mono text-xs font-bold text-primary">
                      {o.folio}
                    </div>

                    <div className="col-span-4 min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{o.customer_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {dateFmt(o.created_date_mx)} · {o.items_count} artículos
                        {o.assignee_name ? ` · ${o.assignee_name}` : ""}
                      </p>
                    </div>

                    <div className="col-span-2 sm:text-center">
                      <span
                        className="chip text-[10px] py-0 px-1.5"
                        style={{
                          color: `var(--${stMeta.token})`,
                          background: `color-mix(in oklab, var(--${stMeta.token}) 16%, transparent)`,
                        }}
                      >
                        {stMeta.label}
                      </span>
                    </div>

                    <div className="col-span-2 sm:text-center">
                      <span className="chip text-[10px] py-0 px-1.5" style={{ color: `var(--${payMeta.token})` }}>
                        {payMeta.label}
                      </span>
                    </div>

                    <div className="col-span-2 text-right">
                      <p className="font-display text-sm font-bold text-foreground">{money(o.total)}</p>
                      {o.balance > 0 && !isCanceled && (
                        <p className="text-[10px] text-amber-400">Saldo: {money(o.balance)}</p>
                      )}
                    </div>
                  </Link>
                );
              })}

              {(stats?.orders ?? []).length === 0 && (
                <p className="py-12 text-center text-xs text-muted-foreground">
                  No hay pedidos registrados en este periodo con los filtros seleccionados.
                </p>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: Pagos */}
          <TabsContent value="pagos" className="mt-4">
            <div className="panel divide-y divide-border overflow-hidden">
              <div className="hidden grid-cols-12 gap-2 bg-secondary/50 p-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:grid">
                <div className="col-span-2">Fecha</div>
                <div className="col-span-2">Folio Pedido</div>
                <div className="col-span-4">Cliente / Referencia</div>
                <div className="col-span-2 text-center">Método</div>
                <div className="col-span-2 text-right">Monto Recibido</div>
              </div>

              {(stats?.payments ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 sm:grid sm:grid-cols-12"
                >
                  <div className="col-span-2 text-xs font-semibold text-muted-foreground">
                    {dateFmt(p.paid_at)}
                  </div>

                  <div className="col-span-2">
                    <Link
                      to="/pedidos/$orderId"
                      params={{ orderId: p.order_id }}
                      className="font-mono text-xs font-bold text-primary hover:underline"
                    >
                      {p.order_folio}
                    </Link>
                  </div>

                  <div className="col-span-4 min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{p.customer_name}</p>
                    {p.reference && (
                      <p className="text-[11px] text-muted-foreground">Ref: {p.reference}</p>
                    )}
                    {p.created_by_name && (
                      <p className="text-[10px] text-muted-foreground/80">Reg: {p.created_by_name}</p>
                    )}
                  </div>

                  <div className="col-span-2 sm:text-center">
                    <span className="chip text-[10px] py-0 px-2 bg-secondary font-semibold text-muted-foreground">
                      {p.method}
                    </span>
                  </div>

                  <div className="col-span-2 text-right font-display text-sm font-bold text-emerald-400">
                    +{money(p.amount)}
                  </div>
                </div>
              ))}

              {(stats?.payments ?? []).length === 0 && (
                <p className="py-12 text-center text-xs text-muted-foreground">
                  No hay cobros registrados en este periodo con los filtros seleccionados.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Desglose (Drilldown) */}
      <SalesDrilldownModal
        open={drilldown.open}
        onOpenChange={(open) => setDrilldown((prev) => ({ ...prev, open }))}
        type={drilldown.type}
        title={drilldown.title}
        periodLabel={stats?.periodLabel ?? ""}
        orders={stats?.orders ?? []}
        payments={stats?.payments ?? []}
      />
    </>
  );
}
