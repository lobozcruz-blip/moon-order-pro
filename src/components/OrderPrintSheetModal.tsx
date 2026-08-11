import { useState, useRef } from "react";
import {
  Printer,
  Download,
  FileText,
  Loader2,
  Calendar,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Truck,
  Flame,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { useBrandName } from "@/lib/brand";
import {
  money,
  dateFmt,
  dateTimeFmt,
  fullName,
  type Modality,
  MODALITIES,
  CATEGORY_META,
  STATUS_META,
  PRIORITIES,
  type Category,
} from "@/lib/cm";
import { cn } from "@/lib/utils";

export type OrderPrintSheetData = {
  id: string;
  folio: string;
  created_at: string | Date;
  due_date?: string | Date | null;
  priority: string;
  status: string;
  client_notes?: string | null;
  customer: {
    first_name: string;
    last_name?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  delivery: {
    type: "envio" | "entrega_personal" | string;
    street?: string | null;
    ext_number?: string | null;
    int_number?: string | null;
    neighborhood?: string | null;
    postal_code?: string | null;
    city?: string | null;
    municipality?: string | null;
    state?: string | null;
    references_text?: string | null;
    carrier?: string | null;
    tracking_number?: string | null;
    shipping_cost?: number;
    special_instructions?: string | null;
    place?: string | null;
    delivery_date?: string | null;
    delivery_time?: string | null;
    instructions?: string | null;
  };
  items: Array<{
    id: string;
    name: string;
    sku?: string | null;
    category?: Category | string;
    quantity: number;
    cutter_modality?: Modality | null;
    cutter_size_cm?: number | null;
    unit_price: number;
    subtotal: number;
    notes?: string | null;
    is_done?: boolean;
  }>;
  subtotal: number;
  discount: number;
  shipping_cost: number;
  total: number;
  paid_amount: number;
  balance: number;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    paid_at: string | Date;
    reference?: string | null;
  }>;
};

export type OrderPrintSheetModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderPrintSheetData | null;
};

export function OrderPrintSheetModal({ open, onOpenChange, order }: OrderPrintSheetModalProps) {
  const brandName = useBrandName();
  const printRef = useRef<HTMLDivElement>(null);

  const [showSignatures, setShowSignatures] = useState(true);
  const [showPaymentsHistory, setShowPaymentsHistory] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!order) return null;

  const totalPieces = order.items.reduce((acc, it) => acc + it.quantity, 0);
  const isShipping = order.delivery.type === "envio";
  const statusInfo = STATUS_META[order.status as keyof typeof STATUS_META];

  // Descarga de imagen en alta resolución
  const handleDownloadImage = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);
    try {
      const dataUrl = await toPng(printRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: "#FFFFFF",
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `Respaldo-${order.folio}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Respaldo del pedido descargado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar imagen");
    } finally {
      setIsGenerating(false);
    }
  };

  // Impresión nativa de hoja tamaño carta
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] sm:max-w-4xl overflow-hidden flex flex-col p-0 gap-0 bg-background border-border">
        {/* Cabecera del Modal */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-card/60 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <FileText className="h-5 w-5 text-primary" /> Hoja de Pedido & Respaldo Físico (Tamaño Carta)
            </DialogTitle>
            <span className="chip bg-primary/10 text-primary font-bold text-xs">
              {order.folio}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Formato oficial tamaño carta para imprimir, archivar en carpeta de pedidos o tener respaldo físico en taller.
          </p>
        </DialogHeader>

        <div className="grid lg:grid-cols-[240px_1fr] flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Panel de Configuración Lateral */}
          <div className="p-4 space-y-4 overflow-y-auto max-h-[30vh] lg:max-h-[70vh] bg-card/40 text-xs">
            <h3 className="font-semibold uppercase tracking-wider text-muted-foreground text-[11px]">
              Opciones de respaldo
            </h3>

            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-2.5">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer">Historial de pagos</Label>
                <p className="text-[11px] text-muted-foreground">Abonos registrados</p>
              </div>
              <Switch checked={showPaymentsHistory} onCheckedChange={setShowPaymentsHistory} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-2.5">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer">Sección de firmas</Label>
                <p className="text-[11px] text-muted-foreground">Control de entrega/taller</p>
              </div>
              <Switch checked={showSignatures} onCheckedChange={setShowSignatures} />
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground">💡 Sugerencia de impresión:</p>
              <p>Al imprimir, selecciona tamaño <strong>Carta (Letter)</strong> y márgenes estándar o mínimos para un ajuste perfecto.</p>
            </div>
          </div>

          {/* Área de Visualización de la Hoja Tamaño Carta */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-start justify-center bg-muted/30">
            {/* HOJA TAMAÑO CARTA IMPRIMIBLE (8.5 x 11 in / 216 x 279 mm) */}
            <div
              ref={printRef}
              className="w-full max-w-[760px] bg-white text-black p-6 sm:p-8 rounded-xl border-2 border-neutral-300 shadow-2xl space-y-4 text-xs"
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                color: "#111827",
                backgroundColor: "#FFFFFF",
              }}
            >
              {/* 1. ENCABEZADO OFICIAL */}
              <div className="border-b-2 border-neutral-900 pb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 text-white font-bold">
                    <BrandLogo size="md" />
                  </span>
                  <div>
                    <h1 className="font-bold text-xl tracking-tight text-neutral-900 leading-tight uppercase">
                      {brandName}
                    </h1>
                    <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">
                      ORDEN DE PRODUCCIÓN Y RESPALDO DE PEDIDO
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      Cortadores de Galletas · Stencils · Cajas · Repostería Creativa
                    </p>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="inline-block border-2 border-neutral-900 bg-neutral-900 text-white font-mono font-bold text-base px-3 py-1 rounded">
                    {order.folio}
                  </div>
                  <div className="text-[11px] text-neutral-700 space-y-0.5 pt-0.5">
                    <p><strong>Fecha Registro:</strong> {dateTimeFmt(order.created_at)}</p>
                    {order.due_date && (
                      <p className="text-neutral-900 font-bold">
                        📅 <strong>Fecha Entrega:</strong> {dateFmt(order.due_date)}
                      </p>
                    )}
                    <div className="flex items-center justify-end gap-1.5 pt-0.5">
                      {order.priority === "urgente" && (
                        <span className="border border-red-600 bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-bold text-[10px]">
                          🔥 URGENTE
                        </span>
                      )}
                      <span className="border border-neutral-400 bg-neutral-100 text-neutral-800 px-1.5 py-0.2 rounded font-semibold text-[10px]">
                        {statusInfo?.label ?? order.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. DATOS DE CLIENTA Y ENTREGA */}
              <div className="grid sm:grid-cols-2 gap-3 p-3 rounded-lg border border-neutral-300 bg-neutral-50/80">
                {/* Columna Cliente */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                    DATOS DE LA CLIENTA
                  </span>
                  <p className="text-sm font-bold text-neutral-900">
                    {fullName(order.customer.first_name, order.customer.last_name)}
                  </p>
                  {order.customer.phone && (
                    <p className="text-neutral-700 font-mono flex items-center gap-1">
                      <Phone className="h-3 w-3 text-neutral-500" /> {order.customer.phone}
                    </p>
                  )}
                  {order.customer.email && (
                    <p className="text-neutral-700 flex items-center gap-1">
                      <Mail className="h-3 w-3 text-neutral-500" /> {order.customer.email}
                    </p>
                  )}
                </div>

                {/* Columna Entrega */}
                <div className="space-y-1 sm:border-l sm:border-neutral-300 sm:pl-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                    MODALIDAD DE ENTREGA
                  </span>
                  {isShipping ? (
                    <div className="space-y-0.5 text-neutral-800">
                      <p className="font-bold flex items-center gap-1 text-neutral-900">
                        <Truck className="h-3.5 w-3.5" /> Envío por Paquetería
                        {order.delivery.carrier ? ` (${order.delivery.carrier})` : ""}
                      </p>
                      <p>
                        {[order.delivery.street, order.delivery.ext_number && `#${order.delivery.ext_number}`, order.delivery.int_number && `Int. ${order.delivery.int_number}`]
                          .filter(Boolean)
                          .join(" ")}
                      </p>
                      <p>
                        {[order.delivery.neighborhood && `Col. ${order.delivery.neighborhood}`, order.delivery.postal_code && `C.P. ${order.delivery.postal_code}`]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <p className="font-semibold">
                        {[order.delivery.city, order.delivery.state].filter(Boolean).join(", ")}
                      </p>
                      {order.delivery.references_text && (
                        <p className="text-[10px] text-neutral-600 bg-neutral-200/70 p-1 rounded">
                          <strong>Ref:</strong> {order.delivery.references_text}
                        </p>
                      )}
                      {order.delivery.tracking_number && (
                        <p className="font-mono font-bold text-[11px] text-neutral-900">
                          Guía: {order.delivery.tracking_number}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-0.5 text-neutral-800">
                      <p className="font-bold flex items-center gap-1 text-neutral-900">
                        <MapPin className="h-3.5 w-3.5" /> Entrega Personal
                      </p>
                      <p>📍 <strong>Lugar:</strong> {order.delivery.place || "Punto acordado"}</p>
                      <p>
                        📅 <strong>Cita:</strong> {dateFmt(order.delivery.delivery_date)} {order.delivery.delivery_time ? `· ⏰ ${order.delivery.delivery_time}` : ""}
                      </p>
                      {order.delivery.instructions && (
                        <p className="text-[10px] text-neutral-600 bg-neutral-200/70 p-1 rounded">
                          <strong>Nota:</strong> {order.delivery.instructions}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. TABLA DETALLADA DE ARTÍCULOS */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-800">
                  <span>Detalle de Artículos y Producción</span>
                  <span>Total Piezas: {totalPieces} pzas</span>
                </div>

                <table className="w-full border-collapse border border-neutral-300 text-left text-xs">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-neutral-300 text-[10px] font-bold uppercase text-neutral-700">
                      <th className="p-2 border-r border-neutral-300 w-8 text-center">#</th>
                      <th className="p-2 border-r border-neutral-300 w-20">SKU</th>
                      <th className="p-2 border-r border-neutral-300">Artículo / Modelo</th>
                      <th className="p-2 border-r border-neutral-300 w-28">Especificaciones</th>
                      <th className="p-2 border-r border-neutral-300 w-12 text-center">Cant.</th>
                      <th className="p-2 border-r border-neutral-300 w-16 text-right">P. Unit</th>
                      <th className="p-2 border-r border-neutral-300 w-20 text-right">Subtotal</th>
                      <th className="p-2 w-10 text-center select-none">✓</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {order.items.map((it, idx) => {
                      const isCutter = it.category === "CORTADORES";
                      const modalityLabel = isCutter && it.cutter_modality
                        ? MODALITIES.find((m) => m.value === it.cutter_modality)?.label ?? ""
                        : "";

                      return (
                        <tr key={it.id} className="hover:bg-neutral-50">
                          <td className="p-2 border-r border-neutral-200 text-center font-mono text-neutral-500">
                            {idx + 1}
                          </td>
                          <td className="p-2 border-r border-neutral-200 font-mono font-bold text-neutral-800 text-[11px]">
                            {it.sku || "—"}
                          </td>
                          <td className="p-2 border-r border-neutral-200">
                            <p className="font-bold text-neutral-900">{it.name}</p>
                            {it.notes && (
                              <p className="text-[10px] text-amber-700 italic mt-0.5">
                                Nota: {it.notes}
                              </p>
                            )}
                          </td>
                          <td className="p-2 border-r border-neutral-200 text-[11px] text-neutral-700">
                            {isCutter && it.cutter_size_cm ? (
                              <span>
                                {it.cutter_size_cm} cm {modalityLabel ? `· ${modalityLabel}` : ""}
                              </span>
                            ) : (
                              CATEGORY_META[it.category as Category]?.label || "—"
                            )}
                          </td>
                          <td className="p-2 border-r border-neutral-200 text-center font-bold text-neutral-900">
                            {it.quantity}
                          </td>
                          <td className="p-2 border-r border-neutral-200 text-right font-mono">
                            {money(it.unit_price)}
                          </td>
                          <td className="p-2 border-r border-neutral-200 text-right font-mono font-bold text-neutral-900">
                            {money(it.subtotal)}
                          </td>
                          <td className="p-2 text-center text-neutral-400 font-mono select-none">
                            [ ]
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 4. TOTALES FINANCIEROS Y PAGOS */}
              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                {/* Historial de pagos o notas del pedido */}
                <div className="space-y-2">
                  {showPaymentsHistory && order.payments.length > 0 ? (
                    <div className="rounded-lg border border-neutral-300 p-2.5 bg-neutral-50 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block">
                        Abonos y Pagos Registrados:
                      </span>
                      <div className="divide-y divide-neutral-200 text-[11px]">
                        {order.payments.map((p) => (
                          <div key={p.id} className="py-1 flex items-center justify-between">
                            <span>
                              <strong>{money(p.amount)}</strong> · {p.method}{" "}
                              {p.reference ? `(Ref. ${p.reference})` : ""}
                            </span>
                            <span className="text-neutral-500 font-mono text-[10px]">
                              {dateTimeFmt(p.paid_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {order.client_notes && (
                    <div className="rounded-lg border border-neutral-300 p-2.5 bg-neutral-50 text-[11px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block mb-0.5">
                        Instrucciones del Pedido:
                      </span>
                      <p className="italic text-neutral-800">{order.client_notes}</p>
                    </div>
                  )}
                </div>

                {/* Desglose de Totales */}
                <div className="rounded-lg border-2 border-neutral-900 p-3 space-y-1.5 bg-neutral-50">
                  <div className="flex justify-between text-neutral-700">
                    <span>Subtotal de artículos:</span>
                    <span className="font-mono">{money(order.subtotal)}</span>
                  </div>

                  {order.discount > 0 && (
                    <div className="flex justify-between text-neutral-700">
                      <span>Descuento:</span>
                      <span className="font-mono text-red-600">-{money(order.discount)}</span>
                    </div>
                  )}

                  {order.shipping_cost > 0 && (
                    <div className="flex justify-between text-neutral-700">
                      <span>Costo de envío:</span>
                      <span className="font-mono">{money(order.shipping_cost)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-sm text-neutral-900 border-t-2 border-neutral-300 pt-1.5">
                    <span>TOTAL DEL PEDIDO:</span>
                    <span className="font-mono text-base">{money(order.total)}</span>
                  </div>

                  <div className="flex justify-between text-neutral-800 border-t border-neutral-200 pt-1">
                    <span>Total pagado:</span>
                    <span className="font-mono font-bold">{money(order.paid_amount)}</span>
                  </div>

                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-neutral-300">
                    <span className={order.balance > 0 ? "text-amber-800" : "text-green-700"}>
                      {order.balance > 0 ? "SALDO PENDIENTE:" : "ESTADO DE PAGO:"}
                    </span>
                    <span className="font-mono text-sm">
                      {order.balance > 0 ? money(order.balance) : "✓ LIQUIDADO"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. FIRMAS Y VALIDACIÓN DE TALLER */}
              {showSignatures && (
                <div className="pt-4 border-t-2 border-neutral-900 grid grid-cols-3 gap-3 text-center text-[10px] text-neutral-600">
                  <div className="space-y-8">
                    <div className="border-b border-neutral-400 h-6"></div>
                    <p className="font-semibold uppercase text-neutral-800">Elaborado en Taller</p>
                  </div>
                  <div className="space-y-8">
                    <div className="border-b border-neutral-400 h-6"></div>
                    <p className="font-semibold uppercase text-neutral-800">Empacado y Verificado</p>
                  </div>
                  <div className="space-y-8">
                    <div className="border-b border-neutral-400 h-6"></div>
                    <p className="font-semibold uppercase text-neutral-800">Firma de Recepción / Entrega</p>
                  </div>
                </div>
              )}

              {/* Pie de página */}
              <div className="pt-2 text-center text-[9px] text-neutral-400">
                {brandName} · Documento de respaldo físico y control de producción · Folio {order.folio}
              </div>
            </div>
          </div>
        </div>

        {/* Pie del Modal con Acciones */}
        <DialogFooter className="p-4 border-t border-border bg-card/80 flex items-center justify-between sm:justify-between shrink-0">
          <Button
            type="button"
            variant="outline"
            className="tap"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isGenerating}
              onClick={handleDownloadImage}
              className="tap font-semibold"
            >
              {isGenerating ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4 text-primary" />
              )}
              Descargar Imagen
            </Button>

            <Button
              type="button"
              onClick={handlePrint}
              className="tap font-bold bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
            >
              <Printer className="mr-1.5 h-4 w-4 stroke-[2.5]" /> Imprimir Hoja Tamaño Carta
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
