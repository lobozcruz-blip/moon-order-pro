import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { ShopShell } from "@/components/shop/ShopShell";
import { Button } from "@/components/ui/button";
import { requireClientSession } from "@/lib/client-gate";
import { useMyCustomer, useMyOrders, useWhatsappNumber } from "@/lib/shop-queries";
import { money, dateFmt, STATUS_META, whatsappLink } from "@/lib/cm";

export const Route = createFileRoute("/tienda/pedidos")({
  ssr: false,
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Mis pedidos — Cookies Moon" },
      { name: "description", content: "Consulta el estado de tus pedidos con Cookies Moon." },
      { property: "og:title", content: "Mis pedidos — Cookies Moon" },
      { property: "og:description", content: "Consulta el estado de tus pedidos con Cookies Moon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MisPedidos,
});

function MisPedidos() {
  const { data: customer } = useMyCustomer();
  const { data: orders, isLoading } = useMyOrders(customer?.id);
  const { data: wa } = useWhatsappNumber();
  const link = whatsappLink(wa);

  return (
    <ShopShell>
      <h1 className="font-display text-2xl lg:text-3xl">Mis pedidos</h1>

      <div className="mt-4 space-y-3">
        {(orders ?? []).map((o) => (
          <article key={o.id} className="panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-primary">{o.folio ?? "—"}</span>
              <span className="chip" style={{ color: `var(--${STATUS_META[o.status].token})` }}>
                {STATUS_META[o.status].label}
              </span>
              {o.review_status === "pendiente" && (
                <span className="chip text-muted-foreground">Por confirmar</span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{dateFmt(o.created_at)}</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {(o.order_items ?? []).map((it) => (
                <li key={it.id} className="flex justify-between gap-3">
                  <span className="truncate text-muted-foreground">
                    {it.quantity} × {it.product_name}
                  </span>
                  <span>{money(it.subtotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">Total: {money(o.total)}</span>
              {link && o.folio && (
                <Button asChild size="sm" variant="secondary" className="tap">
                  <a
                    href={`${link}?text=${encodeURIComponent(`¡Hola! Quiero actualizar mi pedido ${o.folio}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="mr-1 h-4 w-4" /> Pedir cambio
                  </a>
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>

      {isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>}
      {!isLoading && (orders ?? []).length === 0 && (
        <div className="panel mt-4 p-8 text-center">
          <p className="text-sm text-muted-foreground">Todavía no tienes pedidos.</p>
          <Button asChild className="tap mt-4 font-semibold">
            <Link to="/tienda">Ver catálogo</Link>
          </Button>
        </div>
      )}
    </ShopShell>
  );
}
