import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Minus, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ShopShell } from "@/components/shop/ShopShell";
import { StoredImage } from "@/components/StoredImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { requireClientSession } from "@/lib/client-gate";
import { useCart, cart } from "@/lib/cart";
import { money, MODALITIES } from "@/lib/cm";

export const Route = createFileRoute("/tienda/carrito")({
  ssr: false,
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Tu carrito — Cookies Moon" },
      { name: "description", content: "Revisa tu carrito y envía tus datos de entrega." },
      { property: "og:title", content: "Tu carrito — Cookies Moon" },
      { property: "og:description", content: "Revisa tu carrito y envía tus datos de entrega." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CarritoPage,
});

function CarritoPage() {
  const { items, total } = useCart();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [tipo, setTipo] = useState<"envio" | "entrega_personal">("envio");
  const [f, setF] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    street: "",
    ext_number: "",
    int_number: "",
    neighborhood: "",
    municipality: "",
    city: "",
    state: "",
    postal_code: "",
    references_text: "",
    special_instructions: "",
    place: "",
    delivery_date: "",
    delivery_time: "",
    notes: "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setSending(true);
    try {
      const payload = {
        delivery_type: tipo,
        notes: f.notes || null,
        items: items.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          modality: l.modality,
          size_cm: l.size_cm,
        })),

        shipping:
          tipo === "envio"
            ? {
                first_name: f.first_name,
                last_name: f.last_name,
                phone: f.phone,
                street: f.street,
                ext_number: f.ext_number,
                int_number: f.int_number,
                neighborhood: f.neighborhood,
                municipality: f.municipality,
                city: f.city,
                state: f.state,
                postal_code: f.postal_code,
                references_text: f.references_text,
                special_instructions: f.special_instructions,
              }
            : null,
        personal:
          tipo === "entrega_personal"
            ? {
                first_name: f.first_name,
                last_name: f.last_name,
                phone: f.phone,
                place: f.place,
                delivery_date: f.delivery_date || null,
                delivery_time: f.delivery_time,
                instructions: f.special_instructions,
              }
            : null,
      };

      const { data, error } = await supabase.rpc("place_client_order", {
        payload: payload as never,
      });
      if (error) throw error;
      const folio = typeof data === "string" ? data : "";
      if (!folio) throw new Error("No se pudo generar tu número de pedido.");

      cart.clear();
      navigate({ to: "/tienda/listo/$folio", params: { folio }, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar tu pedido");
    } finally {
      setSending(false);
    }
  };

  if (items.length === 0)
    return (
      <ShopShell>
        <div className="panel p-8 text-center">
          <h1 className="font-display text-xl">Tu carrito está vacío</h1>
          <Button asChild className="tap mt-4 font-semibold">
            <Link to="/tienda">Ver catálogo</Link>
          </Button>
        </div>
      </ShopShell>
    );

  return (
    <ShopShell>
      <h1 className="font-display text-2xl lg:text-3xl">Tu carrito</h1>

      <div className="mt-4 space-y-2">
        {items.map((l) => (
          <div key={l.key} className="panel flex items-center gap-3 p-3">
            <StoredImage
              image={{ storage_path: l.storage_path, external_url: l.external_url }}
              className="h-14 w-14 shrink-0 rounded-lg"
              alt={l.name}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{l.name}</p>
              <p className="text-xs text-muted-foreground">
                {l.size_cm
                  ? `${MODALITIES.find((m) => m.value === l.modality)?.label} · ${l.size_cm} cm · `
                  : ""}
                {money(l.unit_price)} c/u
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="tap h-8 w-8"
                onClick={() => cart.setQuantity(l.key, l.quantity - 1)}
                aria-label="Quitar uno"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-6 text-center text-sm font-semibold">{l.quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="tap h-8 w-8"
                onClick={() => cart.setQuantity(l.key, l.quantity + 1)}
                aria-label="Agregar uno"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="tap h-8 w-8 text-destructive"
                onClick={() => cart.remove(l.key)}
                aria-label="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-right text-lg font-semibold">Total estimado: {money(total)}</p>

      <form onSubmit={submit} className="panel mt-5 space-y-4 p-5">
        <h2 className="font-display text-lg">Datos de entrega</h2>

        <div className="space-y-2">
          <Label>¿Cómo lo quieres recibir?</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
            <SelectTrigger className="tap">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="envio">Envío a domicilio</SelectItem>
              <SelectItem value="entrega_personal">Entrega personal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="fn">Nombre de quien recibe</Label>
            <Input id="fn" className="tap" value={f.first_name} onChange={set("first_name")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ln">Apellido</Label>
            <Input id="ln" className="tap" value={f.last_name} onChange={set("last_name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ph">Celular de contacto</Label>
            <Input id="ph" className="tap" type="tel" value={f.phone} onChange={set("phone")} required />
          </div>
        </div>

        {tipo === "envio" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="st">Calle</Label>
              <Input id="st" className="tap" value={f.street} onChange={set("street")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext">Número exterior</Label>
              <Input id="ext" className="tap" value={f.ext_number} onChange={set("ext_number")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="int">Número interior</Label>
              <Input id="int" className="tap" value={f.int_number} onChange={set("int_number")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="col">Colonia</Label>
              <Input id="col" className="tap" value={f.neighborhood} onChange={set("neighborhood")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mun">Municipio / Alcaldía</Label>
              <Input id="mun" className="tap" value={f.municipality} onChange={set("municipality")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ciu">Ciudad</Label>
              <Input id="ciu" className="tap" value={f.city} onChange={set("city")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edo">Estado</Label>
              <Input id="edo" className="tap" value={f.state} onChange={set("state")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp">Código postal</Label>
              <Input id="cp" className="tap" inputMode="numeric" value={f.postal_code} onChange={set("postal_code")} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ref">Referencias</Label>
              <Input id="ref" className="tap" value={f.references_text} onChange={set("references_text")} />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor="lugar">Lugar de entrega</Label>
              <Input id="lugar" className="tap" value={f.place} onChange={set("place")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha deseada</Label>
              <Input id="fecha" className="tap" type="date" value={f.delivery_date} onChange={set("delivery_date")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora">Horario</Label>
              <Input id="hora" className="tap" placeholder="Ej. 4–6 pm" value={f.delivery_time} onChange={set("delivery_time")} />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="ins">Instrucciones especiales</Label>
          <Input id="ins" className="tap" value={f.special_instructions} onChange={set("special_instructions")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notas">¿Algo más que debamos saber de tu pedido?</Label>
          <Textarea id="notas" rows={3} value={f.notes} onChange={set("notes")} />
        </div>

        <Button type="submit" className="tap w-full font-semibold" disabled={sending}>
          {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Finalizar carrito
        </Button>
      </form>
    </ShopShell>
  );
}
