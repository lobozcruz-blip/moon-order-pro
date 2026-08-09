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
import { LayoutGrid, List, Search, Plus, GripVertical } from "lucide-react";
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
import {
  KANBAN_STATUSES,
  ORDER_STATUSES,
  STATUS_META,
  PAYMENT_META,
  PRIORITIES,
  money,
  dateFmt,
  fullName,
  type OrderStatus,
} from "@/lib/cm";
import { logActivity } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  validateSearch: (s: Record<string, unknown>) => ({
    cliente: typeof s['cliente'] === "string" ? (s['cliente'] as string) : undefined,
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
  const total = items.reduce((a, i) => a + i.quantity, 0);
  const done = items.reduce((a, i) => a + (i.is_done ? i.quantity : i.done_quantity), 0);
  return total ? Math.round((done / total) * 100) : 0;
}

function Pedidos() {
  const { cliente } = Route.useSearch();
  const { data: orders, isLoading } = useOrders();
  const { data: profiles } = useProfiles();
  const invalidate = useInvalidate();
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrderStatus | "todos">("todos");
  const [assignee, setAssignee] = useState<string>("todos");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (orders ?? []).filter(
      (o) =>
        (!cliente || o.customer_id === cliente) &&
        (status === "todos" || o.status === status) &&
        (assignee === "todos" || o.assignee_id === assignee) &&
        (!t ||
          (o.folio ?? "").toLowerCase().includes(t) ||
          fullName(o.customers?.first_name, o.customers?.last_name).toLowerCase().includes(t)),
    );
  }, [orders, q, status, assignee, cliente]);

  const move = async (id: string, next: OrderStatus, prev: OrderStatus) => {
    if (next === prev) return;
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity({
      action: "Estado de pedido actualizado",
      entity: "order",
      order_id: id,
      old_value: STATUS_META[prev].label,
      new_value: STATUS_META[next].label,
    });
    toast.success(`Pedido movido a ${STATUS_META[next].label}`);
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

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="tap pl-9"
            placeholder="Folio o cliente"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus | "todos")}>
          <SelectTrigger className="tap">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          {rows.map((o) => (
            <Link
              key={o.id}
              to="/pedidos/$orderId"
              params={{ orderId: o.id }}
              className="flex flex-wrap items-center gap-3 p-3 transition-colors hover:bg-secondary"
            >
              <span className="font-mono text-xs text-muted-foreground">{o.folio ?? "—"}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {fullName(o.customers?.first_name, o.customers?.last_name)}
              </span>
              <span
                className="chip"
                style={{
                  color: `var(--${STATUS_META[o.status].token})`,
                  background: `color-mix(in oklab, var(--${STATUS_META[o.status].token}) 16%, transparent)`,
                }}
              >
                {STATUS_META[o.status].label}
              </span>
              <span className="chip" style={{ color: `var(--${PAYMENT_META[o.payment_status].token})` }}>
                {PAYMENT_META[o.payment_status].label}
              </span>
              <span className="text-xs text-muted-foreground">{dateFmt(o.due_date)}</span>
              <span className="w-24 text-right text-sm font-semibold">{money(o.total)}</span>
            </Link>
          ))}
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
  const meta = STATUS_META[status];
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
        <h3 className="text-sm font-semibold">{meta.label}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{orders.length}</span>
      </div>
      <div className="space-y-2">
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} onMove={onMove} draggable />
        ))}
        {orders.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">Vacío</p>
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
            {order.order_items?.length ?? 0} artículos · {money(order.total)}
          </p>
        </Link>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="chip" style={{ color: `var(--${PAYMENT_META[order.payment_status].token})` }}>
          {PAYMENT_META[order.payment_status].label}
        </span>
        {priority && order.priority !== "normal" && (
          <span className="chip bg-background text-muted-foreground">{priority}</span>
        )}
        <span className={cn("chip bg-background", late ? "text-destructive" : "text-muted-foreground")}>
          {dateFmt(order.due_date)}
        </span>
      </div>

      <Select
        value={order.status}
        onValueChange={(v) => onMove(order.id, v as OrderStatus, order.status)}
      >
        <SelectTrigger className="tap mt-2 h-9 text-xs lg:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ORDER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_META[s].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
