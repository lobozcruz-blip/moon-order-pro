import { useState } from "react";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrderLabelsEditor } from "./OrderLabelsEditor";
import type { OrderLabelNote } from "@/lib/order-tracking";

type LabelOrder = { id: string; folio: string | null; customers: { first_name: string; last_name: string | null } | null; order_notes: OrderLabelNote[] };

export function OrderLabelsManager({ orders, buttonLabel = "Etiquetas" }: { orders: LabelOrder[]; buttonLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const order = orders.find(o => o.id === selected) ?? orders[0];
  return <>
    <Button type="button" variant="outline" size="sm" disabled={!orders.length} onClick={() => setOpen(true)} aria-label={orders.length === 1 ? `Editar etiquetas de ${orders[0]?.folio ?? "pedido"}` : buttonLabel}>
      <Tag className="mr-1.5 h-4 w-4" />{buttonLabel}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear y asignar etiquetas</DialogTitle></DialogHeader>
        {orders.length > 1 && <Select value={order?.id ?? ""} onValueChange={setSelected}>
          <SelectTrigger aria-label="Pedido al que añadir etiquetas"><SelectValue placeholder="Selecciona un pedido" /></SelectTrigger>
          <SelectContent>{orders.map(o => <SelectItem key={o.id} value={o.id}>{o.folio} · {o.customers?.first_name} {o.customers?.last_name}</SelectItem>)}</SelectContent>
        </Select>}
        {order && <><p className="text-sm text-muted-foreground">{order.folio} · {order.customers?.first_name} {order.customers?.last_name}</p><OrderLabelsEditor key={order.id} orderId={order.id} notes={order.order_notes} /></>}
      </DialogContent>
    </Dialog>
  </>;
}
