import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardList,
  Clock,
  Hammer,
  Truck,
  CheckCircle2,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { useOrders, useActivity, useProfiles } from "@/lib/queries";
import { STATUS_META, PAYMENT_META, money, dateFmt, dateTimeFmt, fullName } from "@/lib/cm";
import { Skeleton } from "@/components/ui/skeleton";

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

  const list = orders ?? [];
  const open = list.filter((o) => !["finalizado", "cancelado"].includes(o.status));
  const today = new Date().toISOString().slice(0, 10);
  const late = open.filter((o) => o.due_date && o.due_date < today);
  const byStatus = (s: string) => list.filter((o) => o.status === s).length;
  const pending = list
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
      <PageHeader title="Panel general" subtitle="Cómo va el taller hoy" />

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
