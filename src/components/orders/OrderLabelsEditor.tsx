import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { ORDER_LABEL_TITLE, normalizeOrderLabel, orderLabels, type OrderLabelNote } from "@/lib/order-tracking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OrderLabelsEditor({ orderId, notes }: { orderId: string; notes: OrderLabelNote[] }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidate();
  const { user } = useAuth();
  const listId = useId();
  const labels = orderLabels(notes);
  const suggestions = useQuery({
    queryKey: ["order-label-suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_notes").select("body").eq("title", ORDER_LABEL_TITLE);
      if (error) throw error;
      return [...new Set((data ?? []).map(n => n.body?.trim()).filter((s): s is string => !!s))].sort();
    },
    staleTime: 60_000,
  });

  const refresh = () => invalidate("orders", "order", "order-label-suggestions");
  const add = async () => {
    const name = value.trim().replace(/\s+/g, " ");
    if (!name || saving) return;
    if (name.length > 60) { toast.error("La etiqueta puede tener hasta 60 caracteres"); return; }
    if (labels.some(n => normalizeOrderLabel(n.body ?? "") === normalizeOrderLabel(name))) {
      toast.error("El pedido ya tiene esa etiqueta"); return;
    }
    setSaving(true);
    try {
      if (!user) throw new Error("Inicia sesión para añadir etiquetas");
      const { error } = await supabase.from("order_notes").insert({ order_id: orderId, title: ORDER_LABEL_TITLE, body: name, created_by: user.id }).select("id").single();
      if (error) throw error;
      setValue(""); refresh(); toast.success("Etiqueta añadida");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo añadir la etiqueta"); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.from("order_notes").delete().eq("id", id).eq("order_id", orderId).eq("title", ORDER_LABEL_TITLE).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("No se pudo eliminar la etiqueta. Comprueba tus permisos.");
      refresh(); toast.success("Etiqueta eliminada");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo eliminar la etiqueta"); }
    finally { setSaving(false); }
  };
  return <div className="space-y-2">
    <Label htmlFor={listId + "-input"}>Etiquetas personalizadas</Label>
    <div className="flex flex-wrap gap-1.5">{labels.map(n => <span key={n.id} className="chip gap-1 bg-primary/10 text-primary">
      {n.body}<button type="button" disabled={saving} onClick={() => remove(n.id)} aria-label={`Quitar etiqueta ${n.body}`}><X className="h-3.5 w-3.5" /></button>
    </span>)}</div>
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void add(); }}>
      <Input id={listId + "-input"} list={listId} value={value} onChange={e => setValue(e.target.value)} maxLength={60} placeholder="Ej. Falta calendario" disabled={saving} />
      <datalist id={listId}>{(suggestions.data ?? []).map(name => <option key={name} value={name} />)}</datalist>
      <Button type="submit" disabled={saving || !value.trim()}>Añadir</Button>
    </form>
    <p className="text-xs text-muted-foreground">Reutiliza la misma etiqueta en otros pedidos para agruparlos desde la lista.</p>
    {suggestions.isError && <p className="text-xs text-destructive">No se pudieron cargar las sugerencias. Puedes escribir una etiqueta.</p>}
  </div>;
}
