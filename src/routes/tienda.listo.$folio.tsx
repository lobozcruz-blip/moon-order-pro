import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { ShopShell } from "@/components/shop/ShopShell";
import { Button } from "@/components/ui/button";
import { requireClientSession } from "@/lib/client-gate";
import { useWhatsappNumber } from "@/lib/shop-queries";
import { whatsappLink } from "@/lib/cm";

export const Route = createFileRoute("/tienda/listo/$folio")({
  ssr: false,
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Pedido enviado — Cookies Moon" },
      { name: "description", content: "Tu número de pedido de Cookies Moon está listo." },
      { property: "og:title", content: "Pedido enviado — Cookies Moon" },
      { property: "og:description", content: "Tu número de pedido de Cookies Moon está listo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ListoPage,
});

function ListoPage() {
  const { folio } = Route.useParams();
  const { data: wa } = useWhatsappNumber();
  const link = whatsappLink(wa);
  const url = link
    ? `${link}?text=${encodeURIComponent(`¡Hola! Quiero confirmar mi pedido ${folio}`)}`
    : null;

  return (
    <ShopShell>
      <div className="panel mx-auto max-w-md p-8 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h1 className="font-display text-2xl">¡Carrito finalizado!</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tu número de pedido es</p>
        <p className="my-3 font-mono text-2xl font-bold text-primary">{folio}</p>

        <p className="text-sm">
          Por favor envía tu número de pedido a nuestro WhatsApp para confirmarlo.
        </p>

        <div className="mt-5 space-y-2">
          {url && (
            <Button asChild className="tap w-full font-semibold">
              <a href={url} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> Enviar por WhatsApp
              </a>
            </Button>
          )}
          <Button
            variant="secondary"
            className="tap w-full"
            onClick={() => {
              navigator.clipboard.writeText(folio);
              toast.success("Número copiado");
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> Copiar número
          </Button>
          <Button asChild variant="ghost" className="tap w-full">
            <Link to="/tienda/pedidos">Ver mis pedidos</Link>
          </Button>
        </div>
      </div>
    </ShopShell>
  );
}
