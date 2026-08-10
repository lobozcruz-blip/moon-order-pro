import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X, Inbox, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePendingOrders } from "@/lib/shop-queries";
import { useInvalidate } from "@/lib/queries";
import { money, dateTimeFmt, fullName, whatsappLink } from "@/lib/cm";
import { logActivity } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/pedidos/pendientes")({
  head: () => ({
    meta: [
      { title: "Pedidos de la tienda — Cookies Moon" },
      {
        name: "description",
        content: "Revisa y confirma los pedidos que llegan desde la tienda de clientas.",
      },
      { property: "og:title", content: "Pedidos de la tienda — Cookies Moon" },
      {
        property: "og:description",
        content: "Revisa y confirma los pedidos que llegan desde la tienda de clientas.",
      },
    ],
  }),
  component: Pendientes,
});

function Pendientes() {
  const { data: orders, isLoading } = usePendingOrders();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (id: string, folio: string | null, aprobar: boolean) => {
    setBusy(id);
    try {
      const { error } = await supabase
        .from("orders")
        .update(
          aprobar
            ? { review_status: "aprobado" }
            : { review_status: "rechazado", status: "cancelado" as const },
        )
        .eq("id", id);
      if (error) throw error;
      await logActivity({
        action: aprobar ? "pedido_confirmado" : "pedido_rechazado",
        entity: "orders",
        order_id: id,
        detail: `${folio ?? ""} desde la tienda`,
      });
      toast.success(aprobar ? "Pedido confirmado" : "Pedido rechazado");
      invalidate("orders-pending", "orders", "activity");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Pedidos de la tienda"
        subtitle="Pedidos que enviaron tus clientas y esperan confirmación."
        action={
          <Button asChild variant="secondary" className="tap">
            <Link to="/pedidos" search={{}}>Ir al tablero</Link>
          </Button>
        }
      />

      <div className="space-y-3">
        {(orders ?? []).map((o) => {
          const ship = Array.isArray(o.shipping_details) ? o.shipping_details[0] : o.shipping_details;
          const pers = Array.isArray(o.personal_delivery_details)
            ? o.personal_delivery_details[0]
            : o.personal_delivery_details;
          const wa = whatsappLink(o.customers?.phone);
          return (
            <article key={o.id} className="panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-primary">{o.folio ?? "—"}</span>
                <span className="text-sm">
                  {fullName(o.customers?.first_name, o.customers?.last_name)}
                </span>
                {wa && (
                  <a href={wa} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                    {o.customers?.phone}
                  </a>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {dateTimeFmt(o.created_at)}
                </span>
              </div>

              <ul className="mt-2 space-y-1 text-sm">
                {(o.order_items ?? []).map((it) => (
                  <li key={it.id} className="flex justify-between gap-3">
                    <span className="truncate text-muted-foreground">
                      {it.quantity} × {it.product_name}
                      {it.cutter_size_cm ? ` (${it.cutter_size_cm} cm)` : ""}
                    </span>
                    <span>{money(it.subtotal)}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-2 text-xs text-muted-foreground">
                {o.delivery_type === "envio"
                  ? `Envío: ${[ship?.street, ship?.ext_number, ship?.neighborhood, ship?.city, ship?.state, ship?.postal_code].filter(Boolean).join(", ")}`
                  : `Entrega personal: ${[pers?.place, pers?.delivery_date, pers?.delivery_time].filter(Boolean).join(" · ")}`}
              </p>
              {o.client_notes && (
                <p className="mt-1 text-xs text-muted-foreground">Nota: {o.client_notes}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">Total: {money(o.total)}</span>
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="tap"
                    disabled={busy === o.id}
                    onClick={() => decide(o.id, o.folio, false)}
                  >
                    <X className="mr-1 h-4 w-4" /> Rechazar
                  </Button>
                  <Button
                    size="sm"
                    className="tap font-semibold"
                    disabled={busy === o.id}
                    onClick={() => decide(o.id, o.folio, true)}
                  >
                    {busy === o.id ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-4 w-4" />
                    )}
                    Confirmar
                  </Button>
                </div>
              </div>
              <div className="mt-2 text-right">
                <Link
                  to="/pedidos/$orderId"
                  params={{ orderId: o.id }}
                  className="text-xs text-primary underline"
                >
                  Abrir detalle
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>}
      {!isLoading && (orders ?? []).length === 0 && (
        <div className="panel flex flex-col items-center gap-2 p-10 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No hay pedidos pendientes por confirmar.</p>
        </div>
      )}
    </>
  );
}
