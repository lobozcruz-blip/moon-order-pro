import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
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
import {
  useCustomers,
  useProducts,
  usePriceRules,
  priceFor,
  useInvalidate,
  useProfiles,
  useProductThemes,
} from "@/lib/queries";
import { ProductPicker } from "@/components/ProductPicker";
import {
  CATEGORIES,
  CATEGORY_META,
  MODALITIES,
  SIZES,
  PRIORITIES,
  CONTACT_CHANNELS,
  OVERRIDE_REASONS,
  money,
  fullName,
  type Category,
  type Modality,
  type Priority,
  type DeliveryType,
} from "@/lib/cm";
import { logActivity } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/nuevo-pedido")({
  head: () => ({
    meta: [
      { title: "Nuevo pedido — Cookies Moon" },
      { name: "description", content: "Registrar un nuevo pedido con artículos y entrega." },
      { property: "og:title", content: "Nuevo pedido — Cookies Moon" },
      {
        property: "og:description",
        content: "Registrar un nuevo pedido con artículos y entrega.",
      },
    ],
  }),
  component: NuevoPedido,
});

type Item = {
  key: string;
  category: Category;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  description: string;
  quantity: number;
  cutter_modality: Modality | null;
  cutter_size_cm: number | null;
  unit_price: number;
  price_overridden: boolean;
  price_override_reason: string | null;
  notes: string;
};

const newItem = (): Item => ({
  key: crypto.randomUUID(),
  category: "CORTADORES",
  product_id: null,
  product_name: "",
  product_sku: null,
  description: "",
  quantity: 1,
  cutter_modality: "cutter_only",
  cutter_size_cm: 8,
  unit_price: 0,
  price_overridden: false,
  price_override_reason: null,
  notes: "",
});

function NuevoPedido() {
  const navigate = useNavigate();
  const { data: customers } = useCustomers();
  const { data: products } = useProducts(false);
  const { data: rules } = usePriceRules();
  const { data: profiles } = useProfiles();
  const { data: themes } = useProductThemes();
  const invalidate = useInvalidate();

  const [customerId, setCustomerId] = useState<string>("");
  const [newCustomer, setNewCustomer] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    contact_channel: "WhatsApp",
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [discount, setDiscount] = useState("0");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("envio");
  const [shipping, setShipping] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    street: "",
    ext_number: "",
    int_number: "",
    neighborhood: "",
    postal_code: "",
    city: "",
    municipality: "",
    state: "",
    references_text: "",
    carrier: "",
    shipping_cost: "0",
    special_instructions: "",
  });
  const [delivery, setDelivery] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    place: "",
    delivery_date: "",
    delivery_time: "",
    instructions: "",
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredCustomers = useMemo(() => {
    const t = customerSearch.trim().toLowerCase();
    return (customers ?? []).filter(
      (c) => !t || fullName(c.first_name, c.last_name).toLowerCase().includes(t) || (c.phone ?? "").includes(t),
    );
  }, [customers, customerSearch]);

  const setItem = (key: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const computedPrice = (it: Item) => {
    if (it.price_overridden) return it.unit_price;
    if (it.category === "CORTADORES") return priceFor(rules, it.cutter_modality, it.cutter_size_cm);
    const p = (products ?? []).find((x) => x.id === it.product_id);
    return Number(p?.base_price ?? it.unit_price ?? 0);
  };

  const subtotal = items.reduce((a, it) => a + computedPrice(it) * it.quantity, 0);
  const shippingCost = deliveryType === "envio" ? Number(shipping.shipping_cost || 0) : 0;
  const total = Math.max(0, subtotal - Number(discount || 0) + shippingCost);

  const save = async () => {
    if (items.length === 0 || items.some((i) => !i.product_name.trim())) {
      toast.error("Cada artículo necesita un nombre o producto");
      return;
    }
    setSaving(true);
    try {
      let cid = customerId;
      if (!cid) {
        if (!newCustomer.first_name.trim()) throw new Error("Elige un cliente o escribe su nombre");
        const { data, error } = await supabase
          .from("customers")
          .insert({
            first_name: newCustomer.first_name.trim(),
            last_name: newCustomer.last_name.trim() || null,
            phone: newCustomer.phone.trim() || null,
            contact_channel: newCustomer.contact_channel,
          })
          .select("id")
          .single();
        if (error) throw error;
        cid = data.id;
      }

      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({
          customer_id: cid,
          priority,
          due_date: dueDate || null,
          assignee_id: assignee || null,
          delivery_type: deliveryType,
          discount: Number(discount || 0),
          shipping_cost: shippingCost,
          is_draft: false,
          status: "en_espera",
        })
        .select("id")
        .single();
      if (oErr) throw oErr;

      const rows = items.map((it, idx) => ({
        order_id: order.id,
        category: it.category,
        product_id: it.product_id,
        product_name: it.product_name.trim(),
        product_sku: it.product_sku,
        description: it.description || null,
        quantity: it.quantity,
        cutter_modality: it.category === "CORTADORES" ? it.cutter_modality : null,
        cutter_size_cm: it.category === "CORTADORES" ? it.cutter_size_cm : null,
        unit_price: computedPrice(it),
        subtotal: computedPrice(it) * it.quantity,
        price_overridden: it.price_overridden,
        price_override_reason: it.price_override_reason,
        notes: it.notes || null,
        sort_order: idx,
      }));
      const { error: iErr } = await supabase.from("order_items").insert(rows);
      if (iErr) throw iErr;

      if (deliveryType === "envio") {
        await supabase.from("shipping_details").insert({
          order_id: order.id,
          first_name: shipping.first_name || null,
          last_name: shipping.last_name || null,
          phone: shipping.phone || null,
          street: shipping.street || null,
          ext_number: shipping.ext_number || null,
          int_number: shipping.int_number || null,
          neighborhood: shipping.neighborhood || null,
          postal_code: shipping.postal_code || null,
          city: shipping.city || null,
          municipality: shipping.municipality || null,
          state: shipping.state || null,
          references_text: shipping.references_text || null,
          carrier: shipping.carrier || null,
          shipping_cost: shippingCost,
          special_instructions: shipping.special_instructions || null,
        });
      } else {
        await supabase.from("personal_delivery_details").insert({
          order_id: order.id,
          first_name: delivery.first_name || null,
          last_name: delivery.last_name || null,
          phone: delivery.phone || null,
          place: delivery.place || null,
          delivery_date: delivery.delivery_date || null,
          delivery_time: delivery.delivery_time || null,
          instructions: delivery.instructions || null,
        });
      }

      if (note.trim()) {
        const { data: u } = await supabase.auth.getUser();
        await supabase.from("order_notes").insert({
          order_id: order.id,
          body: note.trim(),
          created_by: u.user?.id ?? null,
        });
      }


      await supabase.rpc("assign_folio", { _order_id: order.id });
      await supabase.rpc("recalc_order", { _order_id: order.id });
      await logActivity({ action: "Pedido creado", entity: "order", order_id: order.id });

      toast.success("Pedido registrado");
      invalidate("orders", "customers", "activity");
      navigate({ to: "/pedidos/$orderId", params: { orderId: order.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el pedido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Nuevo pedido" subtitle="Cliente, artículos y entrega" />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Cliente */}
          <section className="panel p-4">
            <h2 className="mb-3 font-display text-lg">Cliente</h2>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="tap pl-9"
                placeholder="Buscar cliente existente"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
            <div className="mb-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {filteredCustomers.slice(0, 12).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCustomerId(customerId === c.id ? "" : c.id)}
                  className={cn(
                    "chip border border-border",
                    customerId === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {fullName(c.first_name, c.last_name)}
                </button>
              ))}
            </div>
            {!customerId && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre nuevo cliente *</Label>
                  <Input
                    className="tap"
                    value={newCustomer.first_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apellido</Label>
                  <Input
                    className="tap"
                    value={newCustomer.last_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    className="tap"
                    inputMode="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Canal</Label>
                  <Select
                    value={newCustomer.contact_channel}
                    onValueChange={(v) => setNewCustomer({ ...newCustomer, contact_channel: v })}
                  >
                    <SelectTrigger className="tap">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_CHANNELS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </section>

          {/* Artículos */}
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg">Artículos</h2>
              <Button variant="secondary" className="tap" onClick={() => setItems([...items, newItem()])}>
                <Plus className="mr-1 h-4 w-4" /> Agregar
              </Button>
            </div>
            <div className="space-y-4">
              {items.map((it, idx) => {
                const price = computedPrice(it);
                const catProducts = (products ?? []).filter((p) => p.category === it.category);
                return (
                  <div key={it.key} className="rounded-xl border border-border p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Artículo {idx + 1}
                      </span>
                      {items.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="tap"
                          aria-label="Quitar artículo"
                          onClick={() => setItems(items.filter((x) => x.key !== it.key))}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    {/* Selector de producto con buscador universal y temáticas */}
                    <div className="mb-3 space-y-2">
                      <Label className="text-xs font-semibold">
                        Buscar y seleccionar producto del catálogo (SKU, nombre, categoría o temática)
                      </Label>
                      <ProductPicker
                        products={products ?? []}
                        themes={themes ?? []}
                        categoryFilter={it.category}
                        onCategoryFilterChange={(c) => {
                          if (c !== "TODAS") {
                            setItem(it.key, { category: c });
                          }
                        }}
                        selectedProductId={it.product_id}
                        onSelect={(p) => {
                          if (!p) {
                            setItem(it.key, { product_id: null, product_sku: null });
                            return;
                          }
                          setItem(it.key, {
                            product_id: p.id,
                            product_name: p.name ?? "",
                            product_sku: p.sku ?? null,
                            category: p.category,
                            unit_price: Number(p.base_price ?? 0),
                            price_overridden: false,
                          });
                        }}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Nombre del artículo *</Label>
                        <Input
                          className="tap"
                          value={it.product_name}
                          onChange={(e) => setItem(it.key, { product_name: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label>Nombre del artículo *</Label>
                        <Input
                          className="tap"
                          value={it.product_name}
                          onChange={(e) => setItem(it.key, { product_name: e.target.value })}
                        />
                      </div>

                      {it.category === "CORTADORES" && (
                        <>
                          <div className="space-y-2">
                            <Label>Modalidad</Label>
                            <Select
                              value={it.cutter_modality ?? "cutter_only"}
                              onValueChange={(v) =>
                                setItem(it.key, { cutter_modality: v as Modality })
                              }
                            >
                              <SelectTrigger className="tap">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MODALITIES.map((m) => (
                                  <SelectItem key={m.value} value={m.value}>
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Tamaño</Label>
                            <Select
                              value={String(it.cutter_size_cm ?? 8)}
                              onValueChange={(v) => setItem(it.key, { cutter_size_cm: Number(v) })}
                            >
                              <SelectTrigger className="tap">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SIZES.map((s) => (
                                  <SelectItem key={s} value={String(s)}>
                                    {s} cm
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <Label>Cantidad</Label>
                        <Input
                          className="tap"
                          inputMode="numeric"
                          value={it.quantity}
                          onChange={(e) =>
                            setItem(it.key, { quantity: Math.max(1, Number(e.target.value) || 1) })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Precio unitario</Label>
                        <Input
                          className="tap"
                          inputMode="decimal"
                          value={it.price_overridden ? it.unit_price : price}
                          onChange={(e) =>
                            setItem(it.key, {
                              price_overridden: true,
                              unit_price: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>

                      {it.price_overridden && (
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Motivo del precio manual</Label>
                          <Select
                            value={it.price_override_reason ?? ""}
                            onValueChange={(v) => setItem(it.key, { price_override_reason: v })}
                          >
                            <SelectTrigger className="tap">
                              <SelectValue placeholder="Selecciona un motivo" />
                            </SelectTrigger>
                            <SelectContent>
                              {OVERRIDE_REASONS.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2 sm:col-span-2">
                        <Label>Notas del artículo</Label>
                        <Textarea
                          rows={2}
                          value={it.notes}
                          onChange={(e) => setItem(it.key, { notes: e.target.value })}
                        />
                      </div>
                    </div>

                    <p className="mt-3 text-right text-sm">
                      Subtotal:{" "}
                      <span className="font-display text-lg">{money(price * it.quantity)}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Entrega */}
          <section className="panel p-4">
            <h2 className="mb-3 font-display text-lg">Entrega</h2>
            <div className="mb-3 flex gap-2">
              {(["envio", "entrega_personal"] as DeliveryType[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDeliveryType(d)}
                  className={cn(
                    "chip flex-1 border border-border",
                    deliveryType === d ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {d === "envio" ? "Envío" : "Entrega personal"}
                </button>
              ))}
            </div>

            {deliveryType === "envio" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["first_name", "Nombre de quien recibe"],
                    ["last_name", "Apellido"],
                    ["phone", "Teléfono"],
                    ["street", "Calle"],
                    ["ext_number", "Número exterior"],
                    ["int_number", "Número interior"],
                    ["neighborhood", "Colonia"],
                    ["postal_code", "Código postal"],
                    ["city", "Ciudad"],
                    ["municipality", "Municipio"],
                    ["state", "Estado"],
                    ["carrier", "Paquetería"],
                    ["shipping_cost", "Costo de envío"],
                  ] as const
                ).map(([k, label]) => (
                  <div key={k} className="space-y-2">
                    <Label>{label}</Label>
                    <Input
                      className="tap"
                      value={shipping[k]}
                      onChange={(e) => setShipping({ ...shipping, [k]: e.target.value })}
                    />
                  </div>
                ))}
                <div className="space-y-2 sm:col-span-2">
                  <Label>Referencias</Label>
                  <Textarea
                    rows={2}
                    value={shipping.references_text}
                    onChange={(e) => setShipping({ ...shipping, references_text: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Instrucciones especiales</Label>
                  <Textarea
                    rows={2}
                    value={shipping.special_instructions}
                    onChange={(e) =>
                      setShipping({ ...shipping, special_instructions: e.target.value })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre de quien recibe</Label>
                  <Input
                    className="tap"
                    value={delivery.first_name}
                    onChange={(e) => setDelivery({ ...delivery, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apellido</Label>
                  <Input
                    className="tap"
                    value={delivery.last_name}
                    onChange={(e) => setDelivery({ ...delivery, last_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    className="tap"
                    value={delivery.phone}
                    onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lugar de entrega</Label>
                  <Input
                    className="tap"
                    value={delivery.place}
                    onChange={(e) => setDelivery({ ...delivery, place: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input
                    className="tap"
                    type="date"
                    value={delivery.delivery_date}
                    onChange={(e) => setDelivery({ ...delivery, delivery_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora</Label>
                  <Input
                    className="tap"
                    type="time"
                    value={delivery.delivery_time}
                    onChange={(e) => setDelivery({ ...delivery, delivery_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Instrucciones</Label>
                  <Textarea
                    rows={2}
                    value={delivery.instructions}
                    onChange={(e) => setDelivery({ ...delivery, instructions: e.target.value })}
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Resumen */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="panel p-4">
            <h2 className="mb-3 font-display text-lg">Detalles</h2>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger className="tap">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha de entrega</Label>
                <Input className="tap" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Responsable</Label>
                <Select value={assignee || "none"} onValueChange={(v) => setAssignee(v === "none" ? "" : v)}>
                  <SelectTrigger className="tap">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {(profiles ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descuento</Label>
                <Input
                  className="tap"
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Nota inicial</Label>
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="panel p-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Descuento</span>
                <span>-{money(Number(discount || 0))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Envío</span>
                <span>{money(shippingCost)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="font-semibold">Total</span>
                <span className="font-display text-2xl">{money(total)}</span>
              </div>
            </div>
            <Button onClick={save} disabled={saving} className="tap mt-4 w-full font-semibold">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar pedido
            </Button>
          </section>
        </aside>
      </div>
    </>
  );
}
