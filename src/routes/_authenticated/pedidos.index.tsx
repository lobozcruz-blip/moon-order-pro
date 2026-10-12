import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { LayoutGrid, List, Search, Plus, GripVertical, Inbox } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrders, useInvalidate, useProfiles } from "@/lib/queries";
import { usePendingOrders } from "@/lib/shop-queries";

import {
  KANBAN_STATUSES,
  ORDER_STATUSES,
  STATUS_META,
  PAYMENT_META,
  PRIORITIES,
  money,
  dateFmt,
  fullName,
  getOrderPaymentCategory,
  compareOrderPriority,
  type OrderStatus,
} from "@/lib/cm";
import { logActivity } from "@/lib/storage";
import { cn } from "@/lib/utils";

export type PaymentFilter = "confirmados" | "todos" | "sin_pago" | "pago_parcial" | "pagado";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  validateSearch: (s: Record<string, unknown>) => ({
    cliente: typeof s['cliente'] === "string" ? (s['cliente'] as string) : undefined,
    pago: typeof s['pago'] === "string" ? (s['pago'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pedidos — Cookies Moon" },
      { name: "description", content: "Tablero Kanban y listado de pedidos en producción." },
      { property: "og:title", content: "Pedidos — Cookies Moon" },
      { property: "og:description", content: "Tablero Kanban y listado de pedidos en producción." },
    ],
  }),
  component: Pedidos,
});

type Order = ReturnType<typeof useOrders>["data"] extends (infer T)[] | undefined ? T : never;

function progressOf(o: Order) {
  const items = o.order_items ?? [];
  const total = items.reduce((a, i) => a + (Number(i.quantity) || 0), 0);
  const done = items.reduce((a, i) => a + (i.is_done ? (Number(i.quantity) || 0) : (Number(i.done_quantity) || 0)), 0);
  return total ? Math.round((done / total) * 100) : 0;
}

function Pedidos() {
  const { cliente, pago } = Route.useSearch();
  const { data: orders, isLoading } = useOrders();
  const { data: profiles } = useProfiles();
  const { data: pending } = usePendingOrders();
  const pendingCount = pending?.length ?? 0;

  const invalidate = useInvalidate();
  const [view, setView] = useState<"kanban" | "lista">("lista");
  const [onlyPending, setOnlyPending] = useState(true);
  const [sort, setSort] = useState("prioridad");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrderStatus | "todos">("todos");
  const [assignee, setAssignee] = useState<string>("todos");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>(
    (pago as any) && ["sin_pago", "pago_parcial", "pagado"].includes(pago as string)
      ? (pago as PaymentFilter)
      : "confirmados"
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const paymentCounts = useMemo(() => {
    const counts = { todos: 0, sin_pago: 0, pago_parcial: 0, pagado: 0 };
    for (const o of orders ?? []) {
      if (onlyPending && ["finalizado", "cancelado"].includes(o.status)) continue;
      if (cliente && o.customer_id !== cliente) continue;
      if (status !== "todos" && o.status !== status) continue;
      if (assignee !== "todos" && o.assignee_id !== assignee) continue;

      counts.todos++;
      const cat = getOrderPaymentCategory(o);
      if (cat in counts) {
        counts[cat]++;
      }
    }
    return counts;
  }, [orders, cliente, status, assignee, onlyPending]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (orders ?? []).filter(
      (o) =>
        (!cliente || o.customer_id === cliente) &&
        (!onlyPending || !["finalizado", "cancelado"].includes(o.status)) &&
        (status === "todos" || o.status === status) &&
        (assignee === "todos" || o.assignee_id === assignee) &&
        (paymentFilter === "todos" || (paymentFilter === "confirmados" ? getOrderPaymentCategory(o) !== "sin_pago" : getOrderPaymentCategory(o) === paymentFilter)) &&
        (!t ||
          (o.folio ?? "").toLowerCase().includes(t) ||
          fullName(o.customers?.first_name, o.customers?.last_name).toLowerCase().includes(t)),
    ).sort(sort === "prioridad" ? compareOrderPriority : (a, b) => b.created_at.localeCompare(a.created_at));
  }, [orders, q, status, assignee, cliente, paymentFilter, sort, onlyPending]);

  const move = async (id: string, next: OrderStatus, prev: OrderStatus) => {
    if (next === prev) return;
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const prevLabel = STATUS_META[prev]?.label ?? prev;
    const nextLabel = STATUS_META[next]?.label ?? next;
    await logActivity({
      action: "Estado de pedido actualizado",
      entity: "order",
      order_id: id,
      old_value: prevLabel,
      new_value: nextLabel,
    });
    toast.success(`Pedido movido a ${nextLabel}`);
    invalidate("orders", "activity");
  };

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const next = e.over?.id as OrderStatus | undefined;
    const current = (orders ?? []).find((o) => o.id === id);
    if (!next || !current) return;
    move(id, next, current.status);
  };

  return (
    <>
      <PageHeader
        title="Pedidos"
        subtitle={`${rows.length} pedidos`}
        action={
          <div className="flex gap-2">
            <Button asChild variant="secondary" className="tap relative">
              <Link to="/pedidos/pendientes">
                <Inbox className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Tienda</span>
                {pendingCount > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                    {pendingCount}
                  </span>
                )}
              </Link>
            </Button>
            <Button
              variant="secondary"
              className="tap"
              onClick={() => setView(view === "kanban" ? "lista" : "kanban")}
            >
              {view === "kanban" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">
                {view === "kanban" ? "Lista" : "Kanban"}
              </span>
            </Button>
            <Button asChild className="tap font-semibold">
              <Link to="/nuevo-pedido">
                <Plus className="mr-1 h-4 w-4" /> Nuevo
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyPending} onChange={e => setOnlyPending(e.target.checked)} />Sólo pendientes</label>
        <Button variant={paymentFilter === "confirmados" ? "default" : "outline"} onClick={() => setPaymentFilter("confirmados")}>Pedidos con pago o adelanto</Button>
        <Button variant={paymentFilter === "sin_pago" ? "default" : "outline"} onClick={() => setPaymentFilter("sin_pago")}>Cotizaciones sin pago</Button>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="prioridad">Prioridad y fecha de entrega</SelectItem>
            <SelectItem value="recientes">Más recientes</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Urgente → Alta → Normal → Baja. Dentro de cada prioridad, primero la entrega más próxima. Puedes cambiar la prioridad al abrir el pedido.</p>
      {/* Pestañas rápidas de estado de pago */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/60">
        <button
          type="button"
          onClick={() => setPaymentFilter("todos")}
          className={cn(
            "tap px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2",
            paymentFilter === "todos"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50",
          )}
        >
          <span>Pedidos y cotizaciones</span>
          <span className="text-[10px] opacity-75 px-1.5 py-0.2 rounded-full bg-secondary">
            {paymentCounts.todos}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPaymentFilter("sin_pago")}
          className={cn(
            "tap px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2",
            paymentFilter === "sin_pago"
              ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50",
          )}
        >
          <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
          <span>Cotizaciones</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300">
            {paymentCounts.sin_pago}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPaymentFilter("pago_parcial")}
          className={cn(
            "tap px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2",
            paymentFilter === "pago_parcial"
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50",
          )}
        >
          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
          <span>Con adelanto</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
            {paymentCounts.pago_parcial}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPaymentFilter("pagado")}
          className={cn(
            "tap px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2",
            paymentFilter === "pagado"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50",
          )}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <span>Pagados</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            {paymentCounts.pagado}
          </span>
        </button>

        {paymentFilter !== "todos" && (
          <button
            type="button"
            onClick={() => setPaymentFilter("todos")}
            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 underline tap"
          >
            Ver todos
          </button>
        )}
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Buscador */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="tap pl-9"
            placeholder="Folio o cliente..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* 2. Filtro de Estado de Pago */}
        <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as PaymentFilter)}>
          <SelectTrigger className="tap">
            <SelectValue placeholder="Estado de pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confirmados">Pedidos con pago o adelanto</SelectItem>
            <SelectItem value="todos">Pedidos y cotizaciones ({paymentCounts.todos})</SelectItem>
            <SelectItem value="sin_pago">Cotizaciones ({paymentCounts.sin_pago})</SelectItem>
            <SelectItem value="pago_parcial">Con adelanto ({paymentCounts.pago_parcial})</SelectItem>
            <SelectItem value="pagado">Pagados ({paymentCounts.pagado})</SelectItem>
          </SelectContent>
        </Select>

        {/* 3. Filtro de Estado de Producción */}
        <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus | "todos")}>
          <SelectTrigger className="tap">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s]?.label ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 4. Filtro de Responsable */}
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="tap">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los responsables</SelectItem>
            {(profiles ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {view === "kanban" ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
            {KANBAN_STATUSES.map((s) => (
              <Column
                key={s}
                status={s}
                orders={rows.filter((o) => o.status === s)}
                onMove={move}
              />
            ))}
          </div>
          {rows.some((o) => !KANBAN_STATUSES.includes(o.status)) && (
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Pausados y cancelados
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {rows
                  .filter((o) => !KANBAN_STATUSES.includes(o.status))
                  .map((o) => (
                    <OrderCard key={o.id} order={o} onMove={move} />
                  ))}
              </div>
            </div>
          )}
        </DndContext>
      ) : (
        <div className="panel divide-y divide-border">
          {rows.map((o) => {
            const stMeta = STATUS_META[o.status] ?? STATUS_META.en_espera;
            const payCategory = getOrderPaymentCategory(o);
            const payMeta = PAYMENT_META[payCategory];
            const itemSub = Number(o.subtotal || 0);
            const disc = Number(o.discount || 0);
            const ship = Number(o.shipping_cost || 0);
            const displayTotal = itemSub > 0 || ship > 0 ? Math.max(0, itemSub - disc + ship) : Number(o.total || 0);
            return (
              <Link
                key={o.id}
                to="/pedidos/$orderId"
                params={{ orderId: o.id }}
                className="flex flex-wrap items-center gap-3 p-3 transition-colors hover:bg-secondary"
              >
                <span className="chip">{PRIORITIES.find(p => p.value === o.priority)?.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{o.folio ?? "—"}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {fullName(o.customers?.first_name, o.customers?.last_name)}
                </span>
                <span
                  className="chip"
                  style={{
                    color: `var(--${stMeta.token})`,
                    background: `color-mix(in oklab, var(--${stMeta.token}) 16%, transparent)`,
                  }}
                >
                  {stMeta.label}
                </span>
                <span
                  className="chip font-medium"
                  style={{
                    color: `var(--${payMeta.token})`,
                    background: `color-mix(in oklab, var(--${payMeta.token}) 14%, transparent)`,
                  }}
                >
                  {payCategory === "pago_parcial" && o.paid_amount
                    ? `Adelanto: ${money(o.paid_amount)}`
                    : payMeta.label}
                </span>
                <span className="text-xs text-muted-foreground">{dateFmt(o.due_date)}</span>
                <span className="w-24 text-right text-sm font-semibold">{money(displayTotal)}</span>
              </Link>
            );
          })}
          {!isLoading && rows.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">Sin pedidos.</p>
          )}
        </div>
      )}
    </>
  );
}

function Column({
  status,
  orders,
  onMove,
}: {
  status: OrderStatus;
  orders: Order[];
  onMove: (id: string, next: OrderStatus, prev: OrderStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status] ?? STATUS_META.en_espera;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-[85vw] shrink-0 snap-start rounded-2xl border border-border bg-card p-3 sm:w-72 lg:w-auto",
        isOver && "border-primary",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: `var(--${meta.token})` }}
          aria-hidden
        />
        <h3 className="font-display text-sm font-semibold">{meta.label}</h3>
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-muted-foreground">
          {orders.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} onMove={onMove} draggable />
        ))}
        {orders.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            Sin pedidos
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  onMove,
  draggable = false,
}: {
  order: Order;
  onMove: (id: string, next: OrderStatus, prev: OrderStatus) => void;
  draggable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    disabled: !draggable,
  });
  const pct = progressOf(order);
  const priority = PRIORITIES.find((p) => p.value === order.priority)?.label;
  const today = new Date().toISOString().slice(0, 10);
  const late = order.due_date && order.due_date < today && order.status !== "finalizado";
  const payCategory = getOrderPaymentCategory(order);
  const payMeta = PAYMENT_META[payCategory];

  const itemSub = Number(order.subtotal || 0);
  const disc = Number(order.discount || 0);
  const ship = Number(order.shipping_cost || 0);
  const displayTotal = itemSub > 0 || ship > 0 ? Math.max(0, itemSub - disc + ship) : Number(order.total || 0);

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "rounded-xl border border-border bg-secondary p-3",
        isDragging && "opacity-60 shadow-lg",
      )}
    >
      <div className="flex items-start gap-2">
        {draggable && (
          <button
            {...listeners}
            {...attributes}
            aria-label="Mover pedido"
            className="mt-0.5 cursor-grab touch-none text-muted-foreground"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <Link to="/pedidos/$orderId" params={{ orderId: order.id }} className="min-w-0 flex-1">
          <p className="font-mono text-[10px] text-muted-foreground">{order.folio ?? "—"}</p>
          <p className="truncate text-sm font-semibold">
            {fullName(order.customers?.first_name, order.customers?.last_name)}
          </p>
          <p className="text-xs text-muted-foreground">
            {order.order_items?.length ?? 0} artículos · {money(displayTotal)}
          </p>
        </Link>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className="chip font-medium"
          style={{
            color: `var(--${payMeta.token})`,
            background: `color-mix(in oklab, var(--${payMeta.token}) 14%, transparent)`,
          }}
        >
          {payCategory === "pago_parcial" && order.paid_amount
            ? `Adelanto: ${money(order.paid_amount)}`
            : payMeta.label}
        </span>
        {priority && order.priority !== "normal" && (
          <span className="chip bg-background text-muted-foreground">{priority}</span>
        )}
        <span className={cn("chip bg-background", late ? "text-destructive" : "text-muted-foreground")}>
          {dateFmt(order.due_date)}
        </span>
      </div>

      <Select
        value={order.status ?? "en_espera"}
        onValueChange={(v) => onMove(order.id, v as OrderStatus, order.status)}
      >
        <SelectTrigger className="tap mt-2 h-9 text-xs lg:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ORDER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_META[s]?.label ?? s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
