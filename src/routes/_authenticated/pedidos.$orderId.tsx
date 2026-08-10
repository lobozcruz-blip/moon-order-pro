import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  MessageCircle,
  Plus,
  Trash2,
  Check,
  ImagePlus,
  Paperclip,
  Truck,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useOrder, useInvalidate, useProfiles, useActivity } from "@/lib/queries";
import {
  ORDER_STATUSES,
  STATUS_META,
  PAYMENT_META,
  PRIORITIES,
  PAYMENT_METHODS,
  CATEGORY_META,
  MODALITIES,
  money,
  dateFmt,
  dateTimeFmt,
  fullName,
  whatsappLink,
  type OrderStatus,
  type Priority,
} from "@/lib/cm";
import { uploadFile, logActivity } from "@/lib/storage";
import { StoredImage, type ImgRef } from "@/components/StoredImage";
import { ImageViewer } from "@/components/ImageViewer";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/pedidos/$orderId")({
  head: () => ({
    meta: [
      { title: "Detalle del pedido — Cookies Moon" },
      { name: "description", content: "Producción, pagos, notas y entrega del pedido." },
      { property: "og:title", content: "Detalle del pedido — Cookies Moon" },
      { property: "og:description", content: "Producción, pagos, notas y entrega del pedido." },
    ],
  }),
  component: DetallePedido,
});

function DetallePedido() {
  const { orderId } = Route.useParams();
  const { data: order, isLoading } = useOrder(orderId);
  const { data: profiles } = useProfiles();
  const { data: activity } = useActivity();
  const invalidate = useInvalidate();
  const { isAdmin } = useAuth();
  const [viewer, setViewer] = useState<{ images: ImgRef[]; title: string } | null>(null);

  const refresh = async () => {
    invalidate("order", "orders", "activity");
  };

  if (isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>;
  if (!order) return <p className="py-16 text-center text-sm text-muted-foreground">Pedido no encontrado.</p>;

  const items = order.order_items ?? [];
  const totalUnits = items.reduce((a, i) => a + i.quantity, 0);
  const doneUnits = items.reduce((a, i) => a + (i.is_done ? i.quantity : i.done_quantity), 0);
  const pct = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 0;
  const wa = whatsappLink(order.customers?.phone);

  type OrderPatch = Database["public"]["Tables"]["orders"]["Update"];

  const patchOrder = async (patch: OrderPatch, label: string) => {
    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity({ action: label, entity: "order", order_id: orderId });
    toast.success(label);
    refresh();
  };

  const setItemDone = async (id: string, done: boolean, qty: number) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("order_items")
      .update({
        is_done: done,
        done_quantity: done ? qty : 0,
        done_at: done ? new Date().toISOString() : null,
        done_by: done ? (u.user?.id ?? null) : null,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity({
      action: done ? "Artículo marcado como listo" : "Artículo reabierto",
      entity: "order_item",
      order_id: orderId,
    });
    refresh();
  };

  const setItemQty = async (id: string, doneQty: number, qty: number) => {
    const value = Math.max(0, Math.min(qty, doneQty));
    await supabase
      .from("order_items")
      .update({ done_quantity: value, is_done: value >= qty })
      .eq("id", id);
    refresh();
  };

  const uploadItemImage = async (itemId: string, file: File) => {
    const storage_path = await uploadFile("pedidos", file, orderId);
    const { data: u } = await supabase.auth.getUser();
    await supabase
      .from("order_item_images")
      .insert({ order_item_id: itemId, storage_path, created_by: u.user?.id ?? null });
    toast.success("Imagen agregada");
    invalidate("order");
  };

  return (
    <>
      <Link to="/pedidos" search={{ cliente: undefined }} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a pedidos
      </Link>

      <PageHeader
        title={order.folio ?? "Pedido"}
        subtitle={`${fullName(order.customers?.first_name, order.customers?.last_name)} · ${dateTimeFmt(order.created_at)}`}
        action={
          wa ? (
            <Button asChild variant="secondary" className="tap">
              <a href={wa} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Producción</span>
              <span className="text-muted-foreground">
                {doneUnits} / {totalUnits} piezas ({pct}%)
              </span>
            </div>
            <Progress value={pct} />
          </section>

          <Tabs defaultValue="articulos">
            <TabsList className="w-full">
              <TabsTrigger value="articulos" className="flex-1">
                Artículos
              </TabsTrigger>
              <TabsTrigger value="pagos" className="flex-1">
                Pagos
              </TabsTrigger>
              <TabsTrigger value="notas" className="flex-1">
                Notas
              </TabsTrigger>
              <TabsTrigger value="entrega" className="flex-1">
                Entrega
              </TabsTrigger>
            </TabsList>

            <TabsContent value="articulos" className="mt-4 space-y-3">
              {items.map((it) => {
                const imgs: ImgRef[] = [
                  ...(it.order_item_images ?? []),
                  ...(((it as { products?: { product_images?: ImgRef[] } }).products?.product_images ?? []) as ImgRef[]),
                ];
                return (
                  <div key={it.id} className="panel p-3">
                    <div className="flex gap-3">
                      <button
                        className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-secondary"
                        onClick={() => imgs.length && setViewer({ images: imgs, title: it.product_name })}
                        aria-label="Ver imágenes"
                      >
                        <StoredImage image={imgs[0]} className="h-full w-full" alt={it.product_name} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <span
                          className="chip"
                          style={{
                            color: `var(--${CATEGORY_META[it.category].token})`,
                            background: `color-mix(in oklab, var(--${CATEGORY_META[it.category].token}) 16%, transparent)`,
                          }}
                        >
                          {CATEGORY_META[it.category].label}
                        </span>
                        <p className="mt-1 text-sm font-semibold">{it.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {it.product_sku ? `${it.product_sku} · ` : ""}
                          {it.category === "CORTADORES" && it.cutter_size_cm
                            ? `${it.cutter_size_cm} cm · ${
                                MODALITIES.find((m) => m.value === it.cutter_modality)?.label ?? ""
                              } · `
                            : ""}
                          {it.quantity} × {money(it.unit_price)} = {money(it.subtotal)}
                        </p>
                        {it.price_overridden && (
                          <p className="text-xs" style={{ color: "var(--st-pausado)" }}>
                            Precio manual: {it.price_override_reason ?? "sin motivo"}
                          </p>
                        )}
                        {it.notes && <p className="mt-1 text-xs text-muted-foreground">{it.notes}</p>}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={it.is_done}
                          onCheckedChange={(v) => setItemDone(it.id, !!v, it.quantity)}
                        />
                        Listo
                      </label>
                      {it.quantity > 1 && !it.is_done && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Avance</span>
                          <Input
                            className="tap h-9 w-20"
                            inputMode="numeric"
                            value={it.done_quantity}
                            onChange={(e) => setItemQty(it.id, Number(e.target.value) || 0, it.quantity)}
                          />
                          <span className="text-muted-foreground">/ {it.quantity}</span>
                        </div>
                      )}
                      {it.done_at && (
                        <span className="text-xs text-muted-foreground">
                          <Check className="mr-1 inline h-3 w-3" />
                          {dateTimeFmt(it.done_at)}
                        </span>
                      )}
                      <label className="tap ml-auto flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                        <ImagePlus className="h-4 w-4" /> Foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            e.target.files?.[0] && uploadItemImage(it.id, e.target.files[0])
                          }
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="pagos" className="mt-4">
              <Pagos order={order} onChange={refresh} />
            </TabsContent>

            <TabsContent value="notas" className="mt-4">
              <Notas orderId={orderId} notes={order.order_notes ?? []} onChange={() => invalidate("order")} />
            </TabsContent>

            <TabsContent value="entrega" className="mt-4">
              <Entrega order={order} />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="panel p-4">
            <h2 className="mb-3 font-display text-lg">Resumen</h2>
            <div className="space-y-1 text-sm">
              <Row label="Subtotal" value={money(order.subtotal)} />
              <Row label="Descuento" value={`-${money(order.discount)}`} />
              <Row label="Envío" value={money(order.shipping_cost)} />
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-semibold">Total</span>
                <span className="font-display text-2xl">{money(order.total)}</span>
              </div>
              <Row label="Pagado" value={money(order.paid_amount)} />
              <Row label="Saldo" value={money(order.balance)} />
              <div className="pt-2">
                <span
                  className="chip"
                  style={{ color: `var(--${PAYMENT_META[order.payment_status].token})` }}
                >
                  {PAYMENT_META[order.payment_status].label}
                </span>
              </div>
            </div>
          </section>

          <section className="panel space-y-3 p-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={order.status}
                onValueChange={(v) =>
                  patchOrder({ status: v as OrderStatus }, `Estado: ${STATUS_META[v as OrderStatus].label}`)
                }
              >
                <SelectTrigger className="tap">
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
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select
                value={order.priority}
                onValueChange={(v) => patchOrder({ priority: v as Priority }, "Prioridad actualizada")}
              >
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
              <Label>Responsable</Label>
              <Select
                value={order.assignee_id ?? "none"}
                onValueChange={(v) =>
                  patchOrder({ assignee_id: v === "none" ? null : v }, "Responsable actualizado")
                }
              >
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
              <Label>Fecha de entrega</Label>
              <Input
                className="tap"
                type="date"
                value={order.due_date ?? ""}
                onChange={(e) => patchOrder({ due_date: e.target.value || null }, "Fecha actualizada")}
              />
            </div>
            {isAdmin && (
              <Button
                variant="destructive"
                className="tap w-full"
                onClick={async () => {
                  if (!confirm("¿Eliminar este pedido definitivamente?")) return;
                  await supabase.from("orders").delete().eq("id", orderId);
                  await logActivity({ action: "Pedido eliminado", entity: "order" });
                  invalidate("orders");
                  window.location.href = "/pedidos";
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar pedido
              </Button>
            )}
          </section>

          <section className="panel p-4">
            <h2 className="mb-3 font-display text-lg">Historial</h2>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {(activity ?? []).map((a) => (
                <div key={a.id} className="text-xs">
                  <p className="font-medium">{a.action}</p>
                  <p className="text-muted-foreground">
                    {profiles?.find((p) => p.id === a.user_id)?.full_name ?? "Sistema"} ·{" "}
                    {dateTimeFmt(a.created_at)}
                  </p>
                </div>
              ))}
              {(activity ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Sin movimientos.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <ImageViewer
        open={!!viewer}
        onOpenChange={(v) => !v && setViewer(null)}
        images={viewer?.images ?? []}
        title={viewer?.title ?? "Imágenes"}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

type OrderData = NonNullable<ReturnType<typeof useOrder>["data"]>;

function Pagos({ order, onChange }: { order: OrderData; onChange: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0]!);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<ImgRef[] | null>(null);

  const add = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("payments")
        .insert({
          order_id: order.id,
          amount: value,
          method,
          reference: reference || null,
          notes: notes || null,
          created_by: u.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (file) {
        const storage_path = await uploadFile("comprobantes", file, order.id);
        await supabase.from("payment_attachments").insert({ payment_id: data.id, storage_path });
      }
      await logActivity({
        action: "Pago registrado",
        entity: "payment",
        order_id: order.id,
        detail: `${money(value)} · ${method}`,
      });
      toast.success("Pago registrado");
      setAmount("");
      setReference("");
      setNotes("");
      setFile(null);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h3 className="mb-3 font-display text-lg">Registrar pago</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Monto</Label>
            <Input className="tap" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Método</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="tap">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Referencia</Label>
            <Input className="tap" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Comprobante</Label>
            <label className="tap flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border text-xs text-muted-foreground">
              <Paperclip className="h-4 w-4" />
              {file ? file.name : "Adjuntar imagen"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Notas</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <Button onClick={add} disabled={busy} className="tap mt-3 w-full font-semibold">
          <Plus className="mr-1 h-4 w-4" /> Agregar pago
        </Button>
      </div>

      <div className="panel divide-y divide-border">
        {(order.payments ?? []).map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <span className="font-semibold">{money(p.amount)}</span>
            <span className="chip bg-secondary text-muted-foreground">{p.method}</span>
            <span className="text-xs text-muted-foreground">{dateTimeFmt(p.paid_at)}</span>
            {p.reference && <span className="text-xs text-muted-foreground">Ref. {p.reference}</span>}
            {(p.payment_attachments ?? []).length > 0 && (
              <button
                className="chip bg-secondary text-xs"
                onClick={() => setViewer(p.payment_attachments as ImgRef[])}
              >
                Ver comprobante
              </button>
            )}
            <button
              className="ml-auto text-destructive"
              aria-label="Eliminar pago"
              onClick={async () => {
                if (!confirm("¿Eliminar este pago?")) return;
                await supabase.from("payments").delete().eq("id", p.id);
                await logActivity({ action: "Pago eliminado", entity: "payment", order_id: order.id });
                onChange();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {(order.payments ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin pagos registrados.</p>
        )}
      </div>

      <ImageViewer
        open={!!viewer}
        onOpenChange={(v) => !v && setViewer(null)}
        images={viewer ?? []}
        title="Comprobante"
      />
    </div>
  );
}

function Notas({
  orderId,
  notes,
  onChange,
}: {
  orderId: string;
  notes: OrderData["order_notes"];
  onChange: () => void;
}) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<ImgRef[] | null>(null);

  const add = async () => {
    if (!body.trim() && !file) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("order_notes")
        .insert({ order_id: orderId, body: body.trim() || null, created_by: u.user?.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      if (file) {
        const storage_path = await uploadFile("notas", file, orderId);
        await supabase
          .from("note_attachments")
          .insert({ note_id: data.id, storage_path, file_name: file.name });
      }
      await logActivity({ action: "Nota agregada", entity: "order_note", order_id: orderId });
      setBody("");
      setFile(null);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la nota");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <Textarea
          rows={3}
          placeholder="Escribe una nota del pedido…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <label className="tap flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border text-xs text-muted-foreground">
            <Paperclip className="h-4 w-4" />
            {file ? file.name : "Adjuntar imagen"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button onClick={add} disabled={busy} className="tap font-semibold">
            Agregar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {(notes ?? []).map((n) => (
          <div key={n.id} className="panel p-3">
            <p className="text-sm">{n.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">{dateTimeFmt(n.created_at)}</p>
            {(n.note_attachments ?? []).length > 0 && (
              <button
                className="chip mt-2 bg-secondary text-xs"
                onClick={() => setViewer(n.note_attachments as ImgRef[])}
              >
                Ver {n.note_attachments.length} adjunto(s)
              </button>
            )}
          </div>
        ))}
        {(notes ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin notas.</p>
        )}
      </div>

      <ImageViewer
        open={!!viewer}
        onOpenChange={(v) => !v && setViewer(null)}
        images={viewer ?? []}
        title="Adjuntos"
      />
    </div>
  );
}

function Entrega({ order }: { order: OrderData }) {
  const s = order.shipping_details;
  const d = order.personal_delivery_details;

  if (order.delivery_type === "envio" && s)
    return (
      <div className="panel space-y-2 p-4 text-sm">
        <h3 className="flex items-center gap-2 font-display text-lg">
          <Truck className="h-4 w-4 text-primary" /> Envío
        </h3>
        <p>{fullName(s.first_name, s.last_name)}</p>
        <p className="text-muted-foreground">{s.phone ?? "Sin teléfono"}</p>
        <p className="text-muted-foreground">
          {[s.street, s.ext_number, s.int_number && `Int. ${s.int_number}`, s.neighborhood]
            .filter(Boolean)
            .join(" ")}
        </p>
        <p className="text-muted-foreground">
          {[s.postal_code, s.city, s.municipality, s.state].filter(Boolean).join(", ")}
        </p>
        {s.references_text && <p className="text-muted-foreground">Ref: {s.references_text}</p>}
        <p>
          Paquetería: <strong>{s.carrier ?? "—"}</strong> · Guía:{" "}
          <strong>{s.tracking_number ?? "pendiente"}</strong>
        </p>
        <p className="text-muted-foreground">Costo de envío: {money(s.shipping_cost)}</p>
        {s.special_instructions && (
          <p className="text-muted-foreground">Instrucciones: {s.special_instructions}</p>
        )}
        <p className="text-muted-foreground">Fecha estimada: {dateFmt(s.estimated_ship_date)}</p>
      </div>
    );

  if (d)
    return (
      <div className="panel space-y-2 p-4 text-sm">
        <h3 className="flex items-center gap-2 font-display text-lg">
          <MapPin className="h-4 w-4 text-primary" /> Entrega personal
        </h3>
        <p>{fullName(d.first_name, d.last_name)}</p>
        <p className="text-muted-foreground">{d.phone ?? "Sin teléfono"}</p>
        <p className="text-muted-foreground">Lugar: {d.place ?? "—"}</p>
        <p className="text-muted-foreground">
          {dateFmt(d.delivery_date)} {d.delivery_time ?? ""}
        </p>
        {d.instructions && <p className="text-muted-foreground">{d.instructions}</p>}
      </div>
    );

  return (
    <div className="panel p-8 text-center text-sm text-muted-foreground">
      Este pedido no tiene datos de entrega.
    </div>
  );
}
