import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCustomers, useOrders, useInvalidate } from "@/lib/queries";
import { CONTACT_CHANNELS, fullName, money, whatsappLink, dateFmt } from "@/lib/cm";
import { logActivity } from "@/lib/storage";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Cookies Moon" },
      { name: "description", content: "Directorio de clientes e historial de pedidos." },
      { property: "og:title", content: "Clientes — Cookies Moon" },
      { property: "og:description", content: "Directorio de clientes e historial de pedidos." },
    ],
  }),
  component: Clientes,
});

type Draft = {
  id?: string;
  first_name: string;
  last_name: string;
  phone: string;
  contact_channel: string;
  notes: string;
};

const empty: Draft = {
  first_name: "",
  last_name: "",
  phone: "",
  contact_channel: "WhatsApp",
  notes: "",
};

function Clientes() {
  const { data: customers, isLoading } = useCustomers();
  const { data: orders } = useOrders();
  const invalidate = useInvalidate();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (customers ?? []).filter(
      (c) =>
        !term ||
        fullName(c.first_name, c.last_name).toLowerCase().includes(term) ||
        (c.phone ?? "").includes(term),
    );
  }, [customers, q]);

  const statsFor = (id: string) => {
    const mine = (orders ?? []).filter((o) => o.customer_id === id);
    return {
      count: mine.length,
      total: mine.reduce((a, o) => a + Number(o.total ?? 0), 0),
      last: mine[0]?.created_at ?? null,
    };
  };

  const save = async () => {
    if (!draft.first_name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        first_name: draft.first_name.trim(),
        last_name: draft.last_name.trim() || null,
        phone: draft.phone.trim() || null,
        contact_channel: draft.contact_channel,
        notes: draft.notes.trim() || null,
      };
      if (draft.id) {
        const { error } = await supabase.from("customers").update(payload).eq("id", draft.id);
        if (error) throw error;
        await logActivity({ action: "Cliente actualizado", entity: "customer", detail: payload.first_name });
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
        await logActivity({ action: "Cliente creado", entity: "customer", detail: payload.first_name });
      }
      toast.success("Cliente guardado");
      setOpen(false);
      setDraft(empty);
      invalidate("customers", "activity");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar a ${name}? Los pedidos existentes se conservarán sin cliente.`)) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity({ action: "Cliente eliminado", entity: "customer", detail: name });
    toast.success("Cliente eliminado");
    invalidate("customers", "orders", "activity");
  };

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${(customers ?? []).length} registrados`}
        action={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setDraft(empty);
            }}
          >
            <DialogTrigger asChild>
              <Button className="tap font-semibold">
                <Plus className="mr-1 h-4 w-4" /> Nuevo cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">
                  {draft.id ? "Editar cliente" : "Nuevo cliente"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nombre *</Label>
                    <Input
                      className="tap"
                      value={draft.first_name}
                      onChange={(e) => setDraft({ ...draft, first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido</Label>
                    <Input
                      className="tap"
                      value={draft.last_name}
                      onChange={(e) => setDraft({ ...draft, last_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      className="tap"
                      inputMode="tel"
                      value={draft.phone}
                      onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Canal de contacto</Label>
                    <Select
                      value={draft.contact_channel}
                      onValueChange={(v) => setDraft({ ...draft, contact_channel: v })}
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
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    rows={3}
                    value={draft.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={save} disabled={saving} className="tap w-full font-semibold">
                  Guardar cliente
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="tap pl-9"
          placeholder="Buscar por nombre o teléfono"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((c) => {
          const s = statsFor(c.id);
          const wa = whatsappLink(c.phone);
          return (
            <div key={c.id} className="panel p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg">
                    {fullName(c.first_name, c.last_name)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.phone ?? "Sin teléfono"} · {c.contact_channel ?? "—"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                      <Button variant="ghost" size="icon" className="tap">
                        <MessageCircle className="h-4 w-4" style={{ color: "var(--st-finalizado)" }} />
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="tap"
                    aria-label="Editar"
                    onClick={() => {
                      setDraft({
                        id: c.id,
                        first_name: c.first_name,
                        last_name: c.last_name ?? "",
                        phone: c.phone ?? "",
                        contact_channel: c.contact_channel ?? "WhatsApp",
                        notes: c.notes ?? "",
                      });
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="tap"
                      aria-label="Eliminar"
                      onClick={() => remove(c.id, fullName(c.first_name, c.last_name))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>

              {c.notes && <p className="mt-2 text-xs text-muted-foreground">{c.notes}</p>}

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-secondary py-2">
                  <p className="font-display text-lg leading-none">{s.count}</p>
                  <p className="text-[10px] text-muted-foreground">Pedidos</p>
                </div>
                <div className="rounded-lg bg-secondary py-2">
                  <p className="font-display text-sm leading-none">{money(s.total)}</p>
                  <p className="text-[10px] text-muted-foreground">Comprado</p>
                </div>
                <div className="rounded-lg bg-secondary py-2">
                  <p className="font-display text-xs leading-none">{dateFmt(s.last)}</p>
                  <p className="text-[10px] text-muted-foreground">Último</p>
                </div>
              </div>

              <Link
                to="/pedidos"
                search={{ cliente: c.id }}
                className="tap mt-3 flex items-center justify-center rounded-lg border border-border text-xs font-medium"
              >
                Ver pedidos del cliente
              </Link>
            </div>
          );
        })}
        {!isLoading && rows.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No hay clientes que coincidan.
          </p>
        )}
      </div>
    </>
  );
}
