import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardList,
  Clock,
  Hammer,
  Truck,
  CheckCircle2,
  Wallet,
  AlertTriangle,
  TrendingUp,
  ShoppingBag,
  CreditCard,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useOrders, useActivity, useProfiles } from "@/lib/queries";
import { useDashboardSalesSummary } from "@/lib/sales-queries";
import { STATUS_META, PAYMENT_META, money, dateFmt, dateTimeFmt, fullName } from "@/lib/cm";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Panel general — Cookies Moon" },
      { name: "description", content: "Resumen de pedidos, producción y cobranza de Cookies Moon." },
      { property: "og:title", content: "Panel general — Cookies Moon" },
      {
        property: "og:description",
        content: "Resumen de pedidos, producción y cobranza de Cookies Moon.",
      },
    ],
  }),
  component: Panel,
});

function Panel() {
  const { data: orders, isLoading } = useOrders();
  const { data: activity } = useActivity();
  const { data: profiles } = useProfiles();
  const { data: sales, isLoading: isLoadingSales } = useDashboardSalesSummary();

  const list = orders ?? [];
  const open = list.filter((o) => !["finalizado", "cancelado"].includes(o.status));
  const today = new Date().toISOString().slice(0, 10);
  const late = open.filter((o) => o.due_date && o.due_date < today);
  const byStatus = (s: string) => list.filter((o) => o.status === s).length;
  const pending = sales?.saldoPendiente ?? list
    .filter((o) => o.status !== "cancelado")
    .reduce((a, o) => a + Number(o.balance ?? 0), 0);

  const cards = [
    { label: "Pedidos activos", value: open.length, icon: ClipboardList, token: "primary" },
    { label: "En espera", value: byStatus("en_espera"), icon: Clock, token: "st-espera" },
    { label: "En preparación", value: byStatus("en_preparacion"), icon: Hammer, token: "st-preparacion" },
    { label: "Enviados", value: byStatus("enviado"), icon: Truck, token: "st-enviado" },
    { label: "Finalizados", value: byStatus("finalizado"), icon: CheckCircle2, token: "st-finalizado" },
  ];

  return (
    <>
      <PageHeader
        title="Panel general"
        subtitle="Cómo va el taller hoy"
        action={
          <Button asChild variant="outline" size="sm" className="tap font-semibold">
            <Link to="/ventas">
              <TrendingUp className="mr-1.5 h-4 w-4 text-primary" /> Ventas y Cobros
            </Link>
          </Button>
        }
      />

      {/* SECCIÓN PRINCIPAL: VENTAS Y COBROS */}
      <section className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </span>
            <h2 className="font-display text-lg font-bold">Ventas y Cobros</h2>
          </div>
          <Button asChild variant="ghost" size="sm" className="tap text-xs text-primary hover:text-primary/90">
            <Link to="/ventas">
              Ver analítica completa <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {isLoadingSales ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* HOY */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hoy</span>
                <span className="text-[10px] text-muted-foreground">00:00 - 23:59</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-medium text-primary">
                      <ShoppingBag className="h-3.5 w-3.5" /> Vendido
                    </span>
                    {sales?.hoy.diffVentas !== null && sales?.hoy.diffVentas !== undefined && (
                      <span className={cn("text-[10px] font-bold", sales.hoy.diffVentas >= 0 ? "text-primary" : "text-amber-400")}>
                        {sales.hoy.diffVentas >= 0 ? "+" : ""}{sales.hoy.diffVentas}%
                      </span>
                    )}
                  </div>
                  <p className="font-display text-xl font-bold text-foreground">{money(sales?.hoy.vendido)}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-medium text-emerald-400">
                      <CreditCard className="h-3.5 w-3.5" /> Cobrado
                    </span>
                    {sales?.hoy.diffCobros !== null && sales?.hoy.diffCobros !== undefined && (
                      <span className={cn("text-[10px] font-bold", sales.hoy.diffCobros >= 0 ? "text-emerald-400" : "text-amber-400")}>
                        {sales.hoy.diffCobros >= 0 ? "+" : ""}{sales.hoy.diffCobros}%
                      </span>
                    )}
                  </div>
                  <p className="font-display text-xl font-bold text-emerald-400">{money(sales?.hoy.cobrado)}</p>
                </div>
              </div>
            </div>

            {/* ESTA SEMANA */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Esta semana</span>
                <span className="text-[10px] text-muted-foreground">Lun - Dom</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-medium text-primary">
                      <ShoppingBag className="h-3.5 w-3.5" /> Vendido
                    </span>
                    {sales?.semana.diffVentas !== null && sales?.semana.diffVentas !== undefined && (
                      <span className={cn("text-[10px] font-bold", sales.semana.diffVentas >= 0 ? "text-primary" : "text-amber-400")}>
                        {sales.semana.diffVentas >= 0 ? "+" : ""}{sales.semana.diffVentas}%
                      </span>
                    )}
                  </div>
                  <p className="font-display text-xl font-bold text-foreground">{money(sales?.semana.vendido)}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-medium text-emerald-400">
                      <CreditCard className="h-3.5 w-3.5" /> Cobrado
                    </span>
                    {sales?.semana.diffCobros !== null && sales?.semana.diffCobros !== undefined && (
                      <span className={cn("text-[10px] font-bold", sales.semana.diffCobros >= 0 ? "text-emerald-400" : "text-amber-400")}>
                        {sales.semana.diffCobros >= 0 ? "+" : ""}{sales.semana.diffCobros}%
                      </span>
                    )}
                  </div>
                  <p className="font-display text-xl font-bold text-emerald-400">{money(sales?.semana.cobrado)}</p>
                </div>
              </div>
            </div>

            {/* ESTE MES */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Este mes</span>
                <span className="text-[10px] text-muted-foreground">Día 1 al fin de mes</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-medium text-primary">
                      <ShoppingBag className="h-3.5 w-3.5" /> Vendido
                    </span>
                    {sales?.mes.diffVentas !== null && sales?.mes.diffVentas !== undefined && (
                      <span className={cn("text-[10px] font-bold", sales.mes.diffVentas >= 0 ? "text-primary" : "text-amber-400")}>
                        {sales.mes.diffVentas >= 0 ? "+" : ""}{sales.mes.diffVentas}%
                      </span>
                    )}
                  </div>
                  <p className="font-display text-xl font-bold text-foreground">{money(sales?.mes.vendido)}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-medium text-emerald-400">
                      <CreditCard className="h-3.5 w-3.5" /> Cobrado
                    </span>
                    {sales?.mes.diffCobros !== null && sales?.mes.diffCobros !== undefined && (
                      <span className={cn("text-[10px] font-bold", sales.mes.diffCobros >= 0 ? "text-emerald-400" : "text-amber-400")}>
                        {sales.mes.diffCobros >= 0 ? "+" : ""}{sales.mes.diffCobros}%
                      </span>
                    )}
                  </div>
                  <p className="font-display text-xl font-bold text-emerald-400">{money(sales?.mes.cobrado)}</p>
                </div>
              </div>
            </div>

            {/* SALDO PENDIENTE */}
            <div className="rounded-2xl border border-border bg-card p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Saldo Pendiente</span>
                <span className="text-[10px] text-amber-400 font-semibold">Total activo</span>
              </div>
              <div className="py-2">
                <p className="font-display text-3xl font-bold text-foreground">{money(sales?.saldoPendiente)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Dinero pendiente por cobrar</p>
              </div>
              <Button asChild variant="outline" size="sm" className="tap w-full text-xs">
                <Link to="/pedidos" search={{ cliente: undefined }}>
                  Ver pedidos con saldo
                </Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ESTADOS DE PRODUCCIÓN */}
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Estado del Taller
      </h3>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="panel p-4">
              <c.icon className="mb-2 h-5 w-5" style={{ color: `var(--${c.token})` }} />
              <p className="font-display text-3xl leading-none">{c.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="panel flex items-center gap-4 p-4">
          <Wallet className="h-6 w-6 text-primary" />
          <div>
            <p className="font-display text-2xl leading-none">{money(pending)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Saldo por cobrar</p>
          </div>
        </div>
        <div className="panel flex items-center gap-4 p-4">
          <AlertTriangle className="h-6 w-6" style={{ color: "var(--st-cancelado)" }} />
          <div>
            <p className="font-display text-2xl leading-none">{late.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Pedidos con fecha vencida</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2">
          <h2 className="mb-3 font-display text-lg">Pedidos recientes</h2>
          <div className="space-y-2">
            {list.slice(0, 8).map((o) => (
              <Link
                key={o.id}
                to="/pedidos/$orderId"
                params={{ orderId: o.id }}
                className="tap flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 transition-colors hover:bg-sidebar-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {o.folio ?? "Borrador"} ·{" "}
                    {fullName(o.customers?.first_name, o.customers?.last_name)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.order_items?.length ?? 0} artículos · entrega {dateFmt(o.due_date)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className="chip"
                    style={{
                      color: `var(--${STATUS_META[o.status].token})`,
                      background: `color-mix(in oklab, var(--${STATUS_META[o.status].token}) 16%, transparent)`,
                    }}
                  >
                    {STATUS_META[o.status].label}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">{money(o.total)}</p>
                </div>
              </Link>
            ))}
            {!isLoading && list.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aún no hay pedidos registrados.
              </p>
            )}
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="mb-3 font-display text-lg">Actividad reciente</h2>
          <div className="space-y-3">
            {(activity ?? []).slice(0, 12).map((a) => (
              <div key={a.id} className="text-xs">
                <p className="font-medium text-foreground">{a.action}</p>
                <p className="text-muted-foreground">
                  {profiles?.find((p) => p.id === a.user_id)?.full_name ?? "Sistema"} ·{" "}
                  {dateTimeFmt(a.created_at)}
                </p>
                {a.detail && <p className="text-muted-foreground">{a.detail}</p>}
              </div>
            ))}
            {(activity ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin movimientos aún.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 panel p-4">
        <h2 className="mb-3 font-display text-lg">Cobranza pendiente</h2>
        <div className="space-y-2">
          {list
            .filter((o) => Number(o.balance) > 0 && o.status !== "cancelado")
            .slice(0, 6)
            .map((o) => (
              <Link
                key={o.id}
                to="/pedidos/$orderId"
                params={{ orderId: o.id }}
                className="tap flex items-center justify-between rounded-lg bg-secondary px-3 text-sm"
              >
                <span className="truncate">
                  {o.folio} · {fullName(o.customers?.first_name, o.customers?.last_name)}
                </span>
                <span className="shrink-0 pl-3">
                  <span className="chip mr-2" style={{ color: `var(--${PAYMENT_META[o.payment_status].token})` }}>
                    {PAYMENT_META[o.payment_status].label}
                  </span>
                  {money(o.balance)}
                </span>
              </Link>
            ))}
          {list.filter((o) => Number(o.balance) > 0).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Todo cobrado. 🎉</p>
          )}
        </div>
      </div>
    </>
  );
}
