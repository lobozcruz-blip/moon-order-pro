import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Search, ShoppingBag, CreditCard, X, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUS_META, PAYMENT_META, money, dateFmt } from "@/lib/cm";
import { type FinancialOrder, type FinancialPayment } from "@/lib/sales-queries";
import { cn } from "@/lib/utils";

export function SalesDrilldownModal({
  open,
  onOpenChange,
  type,
  title,
  periodLabel,
  orders = [],
  payments = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "orders" | "payments";
  title: string;
  periodLabel: string;
  orders?: FinancialOrder[];
  payments?: FinancialPayment[];
}) {
  const [q, setQ] = useState("");

  const filteredOrders = useMemo(() => {
    if (type !== "orders") return [];
    const t = q.trim().toLowerCase();
    if (!t) return orders;
    return orders.filter(
      (o) =>
        o.folio.toLowerCase().includes(t) ||
        o.customer_name.toLowerCase().includes(t) ||
        (o.customer_phone ?? "").includes(t),
    );
  }, [type, q, orders]);

  const filteredPayments = useMemo(() => {
    if (type !== "payments") return [];
    const t = q.trim().toLowerCase();
    if (!t) return payments;
    return payments.filter(
      (p) =>
        p.order_folio.toLowerCase().includes(t) ||
        p.customer_name.toLowerCase().includes(t) ||
        p.method.toLowerCase().includes(t) ||
        (p.reference ?? "").toLowerCase().includes(t),
    );
  }, [type, q, payments]);

  const totalAmount = useMemo(() => {
    if (type === "orders") {
      return filteredOrders.filter((o) => o.status !== "cancelado").reduce((s, o) => s + o.total, 0);
    }
    return filteredPayments.reduce((s, p) => s + p.amount, 0);
  }, [type, filteredOrders, filteredPayments]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {type === "orders" ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShoppingBag className="h-5 w-5" />
              </span>
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <CreditCard className="h-5 w-5" />
              </span>
            )}
            <div>
              <DialogTitle className="font-display text-lg">{title}</DialogTitle>
              <p className="text-xs text-muted-foreground">
                {periodLabel} · Total: <strong className="text-foreground">{money(totalAmount)}</strong>
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Buscador */}
        <div className="relative my-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="tap h-9 pl-9 text-xs"
            placeholder={type === "orders" ? "Buscar por folio o cliente…" : "Buscar por folio, cliente o método…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* Lista de registros */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-border/60">
          {type === "orders" && (
            <>
              {filteredOrders.map((o) => {
                const stMeta = STATUS_META[o.status] ?? STATUS_META.en_espera;
                const payMeta = (o.payment_status && PAYMENT_META[o.payment_status]) ? PAYMENT_META[o.payment_status] : PAYMENT_META.sin_pago;
                const isCanceled = o.status === "cancelado";

                return (
                  <div
                    key={o.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 pt-2 pb-2 text-xs",
                      isCanceled && "opacity-60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/pedidos/$orderId"
                          params={{ orderId: o.id }}
                          className="font-mono font-bold text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {o.folio} <ArrowUpRight className="h-3 w-3" />
                        </Link>
                        <span className="truncate font-semibold text-foreground">{o.customer_name}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {dateFmt(o.created_date_mx)} · {o.items_count} artículos
                        {o.assignee_name ? ` · Resp: ${o.assignee_name}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="chip text-[10px] py-0 px-1.5"
                        style={{
                          color: `var(--${stMeta.token})`,
                          background: `color-mix(in oklab, var(--${stMeta.token}) 16%, transparent)`,
                        }}
                      >
                        {stMeta.label}
                      </span>
                      <span className="chip text-[10px] py-0 px-1.5" style={{ color: `var(--${payMeta.token})` }}>
                        {payMeta.label}
                      </span>
                      <span className="w-20 text-right font-display text-sm font-bold text-foreground">
                        {money(o.total)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredOrders.length === 0 && (
                <p className="py-12 text-center text-xs text-muted-foreground">No se encontraron pedidos en este periodo.</p>
              )}
            </>
          )}

          {type === "payments" && (
            <>
              {filteredPayments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/pedidos/$orderId"
                        params={{ orderId: p.order_id }}
                        className="font-mono font-bold text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {p.order_folio} <ArrowUpRight className="h-3 w-3" />
                      </Link>
                      <span className="truncate font-semibold text-foreground">{p.customer_name}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Fecha de pago: <strong>{dateFmt(p.paid_at)}</strong>
                      {p.reference ? ` · Ref: ${p.reference}` : ""}
                      {p.created_by_name ? ` · Registrado por: ${p.created_by_name}` : ""}
                    </p>
                    {p.notes && <p className="mt-0.5 text-[11px] text-muted-foreground italic">Nota: {p.notes}</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="chip text-[10px] py-0 px-2 bg-secondary text-muted-foreground font-semibold">
                      {p.method}
                    </span>
                    <span className="w-20 text-right font-display text-sm font-bold text-emerald-400">
                      +{money(p.amount)}
                    </span>
                  </div>
                </div>
              ))}
              {filteredPayments.length === 0 && (
                <p className="py-12 text-center text-xs text-muted-foreground">No se encontraron cobros en este periodo.</p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
