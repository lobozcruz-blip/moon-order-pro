import { useState, useRef, useEffect } from "react";
import {
  Printer,
  Download,
  FileText,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Truck,
  Sparkles,
  Package,
  Check,
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
import { signedUrl } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import {
  money,
  dateFmt,
  dateTimeFmt,
  fullName,
  type Modality,
  MODALITIES,
  CATEGORY_META,
  STATUS_META,
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
    image_path?: string | null;
    image_url?: string | null;
    is_custom?: boolean;
    image_source?: "custom" | "catalog" | null;
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

/**
 * Espera de forma robusta a que todas las imágenes del contenedor carguen y se decodifiquen.
 */
async function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  if (images.length === 0) return;

  await Promise.all(
    images.map(async (img) => {
      if (!img.complete) {
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 1500);
        });
      }
      try {
        await img.decode();
      } catch {
        // Ignorar fallo individual
      }
    }),
  );
}

export function OrderPrintSheetModal({ open, onOpenChange, order }: OrderPrintSheetModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const [showSignatures, setShowSignatures] = useState(true);
  const [showPaymentsHistory, setShowPaymentsHistory] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);

  // Mapa de URLs en memoria (Data URLs base64 o firmadas)
  const [itemImageUrls, setItemImageUrls] = useState<Record<string, string>>({});

  // Carga de imágenes de productos y personalizados convertidas a base64 Data URL
  useEffect(() => {
    if (!order?.items || order.items.length === 0) {
      setItemImageUrls({});
      return;
    }

    let isMounted = true;
    setImagesLoading(true);

    (async () => {
      const urls: Record<string, string> = {};

      for (const item of order.items) {
        const key = item.id || item.name;

        if (item.image_path) {
          try {
            const { data: blobData } = await supabase.storage.from("cookies-moon").download(item.image_path);
            if (blobData) {
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve("");
                reader.readAsDataURL(blobData);
              });
              if (base64 && isMounted) {
                urls[key] = base64;
                continue;
              }
            }
          } catch (e) {
            console.warn("Descarga directa omitida para hoja de impresión, usando signedUrl:", e);
          }

          try {
            const url = await signedUrl(item.image_path);
            if (url && isMounted) {
              urls[key] = url;
            }
          } catch (e) {
            console.error(`Error resolviendo URL para ${item.name}:`, e);
          }
        } else if (item.image_url) {
          urls[key] = item.image_url;
        }
      }

      if (isMounted) {
        setItemImageUrls(urls);
        setImagesLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [order]);

  if (!order) return null;

  const totalPieces = order.items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
  const isShipping = order.delivery.type === "envio";
  const statusInfo = STATUS_META[order.status as keyof typeof STATUS_META];

  // Descarga de imagen en alta resolución
  const handleDownloadImage = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);
    try {
      await waitForImages(printRef.current);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dataUrl = await toPng(printRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: "#FFFFFF",
        cacheBust: false,
      });

      const link = document.createElement("a");
      link.download = `Pedido-${order.folio}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Respaldo del pedido descargado en PNG");
    } catch (err) {
      console.error("Error al generar imagen de pedido:", err);
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
        {/* Estilos específicos de impresión */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * {
                visibility: hidden;
              }
              .order-print-sheet-root, .order-print-sheet-root * {
                visibility: visible;
              }
              .order-print-sheet-root {
                position: absolute;
                left: 0;
                top: 0;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
              }
              @page {
                size: letter portrait;
                margin: 10mm 12mm;
              }
            }
          `
        }} />

        {/* Cabecera del Modal (No se imprime) */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-card/60 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <FileText className="h-5 w-5 text-primary" /> Imprimir Hoja de Pedido (Tamaño Carta)
            </DialogTitle>
            <span className="chip bg-primary/10 text-primary font-bold text-xs">
              {order.folio}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Formato optimizado de máximo aprovechamiento con fotos de artículos, datos de entrega y resumen compacto.
          </p>
        </DialogHeader>

        <div className="grid lg:grid-cols-[230px_1fr] flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Panel de Configuración Lateral */}
          <div className="p-4 space-y-4 overflow-y-auto max-h-[30vh] lg:max-h-[70vh] bg-card/40 text-xs">
            <h3 className="font-semibold uppercase tracking-wider text-muted-foreground text-[11px]">
              Opciones de formato
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

            {imagesLoading && (
              <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Cargando imágenes de productos...</span>
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground">💡 Sugerencia de impresión:</p>
              <p>El encabezado y totales fueron compactados para que más artículos quepan en una sola hoja Carta.</p>
            </div>
          </div>

          {/* Área de Visualización de la Hoja Tamaño Carta */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 flex items-start justify-center bg-muted/30">
            {/* HOJA TAMAÑO CARTA IMPRIMIBLE */}
            <div
              ref={printRef}
              className="order-print-sheet-root w-full max-w-[740px] bg-white text-black p-5 sm:p-6 rounded-lg border border-neutral-300 shadow-xl space-y-3 text-xs"
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                color: "#111827",
                backgroundColor: "#FFFFFF",
              }}
            >
              {/* 1. ENCABEZADO OPTIMIZADO (Sin logo ni títulos gigantes de Cookies Moon) */}
              <div className="border-b-2 border-neutral-900 pb-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-neutral-900 text-white font-mono font-bold text-base px-2.5 py-0.5 rounded tracking-wide">
                      {order.folio}
                    </span>
                    {order.priority === "urgente" && (
                      <span className="border border-red-600 bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold text-[10px] uppercase">
                        🔥 Urgente
                      </span>
                    )}
                    <span className="border border-neutral-400 bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded font-semibold text-[10px]">
                      {statusInfo?.label ?? order.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-neutral-600 mt-1 font-medium flex-wrap">
                    <span><strong>Registro:</strong> {dateTimeFmt(String(order.created_at))}</span>
                    {order.due_date && (
                      <span className="text-neutral-900 font-bold">
                        📅 <strong>Entrega:</strong> {dateFmt(String(order.due_date))}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right text-[11px] text-neutral-700 shrink-0">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-neutral-500 block">
                    Total Piezas
                  </span>
                  <span className="font-mono font-bold text-sm text-neutral-900">
                    {totalPieces} pzas
                  </span>
                </div>
              </div>

              {/* 2. DATOS DE LA CLIENTA Y MODALIDAD DE ENTREGA */}
              <div className="grid sm:grid-cols-2 gap-2.5 p-2.5 rounded-lg border border-neutral-300 bg-neutral-50/90 text-xs">
                {/* Columna Cliente */}
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                    DATOS DE LA CLIENTA
                  </span>
                  <p className="text-sm font-bold text-neutral-900 truncate">
                    {fullName(order.customer.first_name, order.customer.last_name)}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-700 font-mono">
                    {order.customer.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-neutral-500 shrink-0" /> {order.customer.phone}
                      </span>
                    )}
                    {order.customer.email && (
                      <span className="flex items-center gap-1 font-sans truncate">
                        <Mail className="h-3 w-3 text-neutral-500 shrink-0" /> {order.customer.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Columna Entrega */}
                <div className="space-y-0.5 sm:border-l sm:border-neutral-300 sm:pl-3 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                    MODALIDAD DE ENTREGA
                  </span>
                  {isShipping ? (
                    <div className="space-y-0.5 text-[11px] text-neutral-800 leading-tight">
                      <p className="font-bold flex items-center gap-1 text-neutral-900 text-xs">
                        <Truck className="h-3.5 w-3.5 text-neutral-700 shrink-0" /> Envío por Paquetería
                        {order.delivery.carrier ? ` (${order.delivery.carrier})` : ""}
                      </p>
                      <p className="truncate">
                        {[order.delivery.street, order.delivery.ext_number && `#${order.delivery.ext_number}`, order.delivery.int_number && `Int. ${order.delivery.int_number}`]
                          .filter(Boolean)
                          .join(" ")}
                        {order.delivery.neighborhood ? `, Col. ${order.delivery.neighborhood}` : ""}
                      </p>
                      <p className="font-medium">
                        {[order.delivery.city, order.delivery.state].filter(Boolean).join(", ")}
                        {order.delivery.postal_code ? ` (C.P. ${order.delivery.postal_code})` : ""}
                      </p>
                      {order.delivery.tracking_number && (
                        <p className="font-mono font-bold text-[10px] text-neutral-900">
                          Guía: {order.delivery.tracking_number}
                        </p>
                      )}
                      {order.delivery.references_text && (
                        <p className="text-[10px] text-neutral-600 italic truncate">
                          Ref: {order.delivery.references_text}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-0.5 text-[11px] text-neutral-800 leading-tight">
                      <p className="font-bold flex items-center gap-1 text-neutral-900 text-xs">
                        <MapPin className="h-3.5 w-3.5 text-neutral-700 shrink-0" /> Entrega Personal
                      </p>
                      <p>📍 <strong>Lugar:</strong> {order.delivery.place || "Punto acordado"}</p>
                      <p>
                        📅 <strong>Cita:</strong> {dateFmt(order.delivery.delivery_date)} {order.delivery.delivery_time ? `· ⏰ ${order.delivery.delivery_time}` : ""}
                      </p>
                      {order.delivery.instructions && (
                        <p className="text-[10px] text-neutral-600 italic truncate">
                          Nota: {order.delivery.instructions}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. TABLA DE ARTÍCULOS CON FOTO (Sin columna SKU para máximo aprovechamiento) */}
              <div className="space-y-1">
                <table className="w-full border-collapse border border-neutral-300 text-left text-xs">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-neutral-300 text-[10px] font-bold uppercase text-neutral-700">
                      <th className="p-1.5 border-r border-neutral-300 w-7 text-center">#</th>
                      <th className="p-1.5 border-r border-neutral-300 w-14 text-center">Foto</th>
                      <th className="p-1.5 border-r border-neutral-300">Artículo / Modelo</th>
                      <th className="p-1.5 border-r border-neutral-300 w-28">Especificaciones</th>
                      <th className="p-1.5 border-r border-neutral-300 w-12 text-center">Cant.</th>
                      <th className="p-1.5 border-r border-neutral-300 w-16 text-right">P. Unit</th>
                      <th className="p-1.5 border-r border-neutral-300 w-18 text-right">Subtotal</th>
                      <th className="p-1.5 w-8 text-center select-none">✓</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {order.items.map((it, idx) => {
                      const isCutter = it.category === "CORTADORES";
                      const modalityLabel = isCutter && it.cutter_modality
                        ? MODALITIES.find((m) => m.value === it.cutter_modality)?.label ?? ""
                        : "";
                      const imgUrl = itemImageUrls[it.id] || it.image_url;

                      return (
                        <tr key={it.id || idx} className="hover:bg-neutral-50">
                          <td className="p-1.5 border-r border-neutral-200 text-center font-mono text-neutral-500 text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="p-1 border-r border-neutral-200 text-center align-middle">
                            <div className="h-11 w-11 mx-auto rounded border border-neutral-200 overflow-hidden bg-white flex items-center justify-center p-0.5">
                              {imgUrl ? (
                                <img
                                  src={imgUrl}
                                  alt={it.name}
                                  crossOrigin="anonymous"
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <Package className="h-5 w-5 text-neutral-300" />
                              )}
                            </div>
                          </td>
                          <td className="p-1.5 border-r border-neutral-200">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="font-bold text-neutral-900 text-xs">{it.name}</span>
                              {it.is_custom && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <Sparkles className="h-2 w-2 text-amber-700" /> Personalizado
                                </span>
                              )}
                            </div>
                            {it.notes && (
                              <p className="text-[10px] text-amber-800 italic mt-0.5 leading-tight">
                                Nota: {it.notes}
                              </p>
                            )}
                          </td>
                          <td className="p-1.5 border-r border-neutral-200 text-[11px] text-neutral-700">
                            {isCutter && it.cutter_size_cm ? (
                              <span className="font-medium">
                                {it.cutter_size_cm} cm {modalityLabel ? `· ${modalityLabel}` : ""}
                              </span>
                            ) : (
                              CATEGORY_META[it.category as Category]?.label || "—"
                            )}
                          </td>
                          <td className="p-1.5 border-r border-neutral-200 text-center font-bold text-neutral-900 text-xs">
                            {it.quantity}
                          </td>
                          <td className="p-1.5 border-r border-neutral-200 text-right font-mono text-[11px]">
                            {money(it.unit_price)}
                          </td>
                          <td className="p-1.5 border-r border-neutral-200 text-right font-mono font-bold text-neutral-900 text-xs">
                            {money(it.subtotal)}
                          </td>
                          <td className="p-1.5 text-center text-neutral-400 font-mono select-none text-[11px]">
                            [ ]
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 4. TOTALES FINANCIEROS Y SALDOS COMPACTOS */}
              <div className="grid sm:grid-cols-[1fr_250px] gap-2.5 pt-1">
                {/* Izquierda: Historial de pagos o notas del pedido */}
                <div className="space-y-1.5">
                  {showPaymentsHistory && order.payments.length > 0 && (
                    <div className="rounded-lg border border-neutral-300 p-2 bg-neutral-50/80 text-[10px]">
                      <span className="font-bold uppercase tracking-wider text-neutral-700 block mb-0.5">
                        Abonos y Pagos Registrados:
                      </span>
                      <div className="divide-y divide-neutral-200">
                        {order.payments.map((p) => (
                          <div key={p.id} className="py-0.5 flex items-center justify-between">
                            <span>
                              <strong>{money(p.amount)}</strong> · {p.method}{" "}
                              {p.reference ? `(Ref. ${p.reference})` : ""}
                            </span>
                            <span className="text-neutral-500 font-mono text-[9px]">
                              {dateTimeFmt(String(p.paid_at))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {order.client_notes && (
                    <div className="rounded-lg border border-neutral-300 p-2 bg-neutral-50/80 text-[10px]">
                      <span className="font-bold uppercase tracking-wider text-neutral-700 block mb-0.5">
                        Instrucciones del Pedido:
                      </span>
                      <p className="italic text-neutral-800 leading-tight">{order.client_notes}</p>
                    </div>
                  )}
                </div>

                {/* Derecha: Desglose Compacto de Totales y Saldo */}
                <div className="rounded-lg border border-neutral-900 p-2.5 bg-neutral-50/90 text-xs space-y-1">
                  <div className="flex justify-between text-neutral-700 text-[11px]">
                    <span>Subtotal artículos:</span>
                    <span className="font-mono">{money(order.subtotal)}</span>
                  </div>

                  {order.discount > 0 && (
                    <div className="flex justify-between text-red-600 text-[11px]">
                      <span>Descuento:</span>
                      <span className="font-mono">-{money(order.discount)}</span>
                    </div>
                  )}

                  {order.shipping_cost > 0 && (
                    <div className="flex justify-between text-neutral-700 text-[11px]">
                      <span>Costo de envío:</span>
                      <span className="font-mono">{money(order.shipping_cost)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-neutral-900 border-t border-neutral-300 pt-1 text-xs">
                    <span>TOTAL PEDIDO:</span>
                    <span className="font-mono text-sm">{money(order.total)}</span>
                  </div>

                  <div className="flex justify-between text-neutral-700 border-t border-neutral-200 pt-0.5 text-[11px]">
                    <span>Total pagado:</span>
                    <span className="font-mono font-semibold">{money(order.paid_amount)}</span>
                  </div>

                  <div className="flex justify-between font-bold pt-0.5 border-t border-neutral-300 text-xs">
                    <span className={order.balance > 0 ? "text-amber-900" : "text-emerald-700"}>
                      {order.balance > 0 ? "SALDO PENDIENTE:" : "ESTADO:"}
                    </span>
                    <span className="font-mono text-xs">
                      {order.balance > 0 ? money(order.balance) : "✓ LIQUIDADO"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. SECCIÓN DE FIRMAS COMPACTA (Opcional) */}
              {showSignatures && (
                <div className="pt-2 border-t border-neutral-400 grid grid-cols-3 gap-2 text-center text-[9px] text-neutral-600">
                  <div className="space-y-4">
                    <div className="border-b border-neutral-300 h-4"></div>
                    <p className="font-semibold uppercase text-neutral-700">Taller / Fabricación</p>
                  </div>
                  <div className="space-y-4">
                    <div className="border-b border-neutral-300 h-4"></div>
                    <p className="font-semibold uppercase text-neutral-700">Empaque y Control</p>
                  </div>
                  <div className="space-y-4">
                    <div className="border-b border-neutral-300 h-4"></div>
                    <p className="font-semibold uppercase text-neutral-700">Entrega / Recepción</p>
                  </div>
                </div>
              )}

              {/* Pie de página discreto */}
              <div className="pt-1 text-center text-[8px] text-neutral-400">
                Respaldo de pedido · Folio {order.folio}
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
              disabled={isGenerating || imagesLoading}
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
