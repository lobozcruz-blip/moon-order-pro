import { useState, useRef, useMemo, useEffect } from "react";
import {
  Download,
  Share2,
  X,
  Eye,
  Check,
  Package,
  Sparkles,
  ShoppingBag,
  Loader2,
  Image as ImageIcon,
  MessageSquare,
  CreditCard,
  Truck,
  ChevronLeft,
  ChevronRight,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BrandLogo } from "@/components/BrandLogo";
import { useBrand, useBrandName } from "@/lib/brand";
import { signedUrl } from "@/lib/storage";
import { money, dateFmt, fullName, type Modality, MODALITIES } from "@/lib/cm";
import { cn } from "@/lib/utils";

export type SummaryItem = {
  id?: string;
  name: string;
  sku?: string | null;
  category?: string;
  quantity: number;
  cutter_modality?: Modality | null;
  cutter_size_cm?: number | null;
  unit_price: number;
  subtotal: number;
  image_path?: string | null;
  image_url?: string | null;
};

export type SummaryOrderData = {
  id?: string;
  folio: string;
  created_at: string | Date;
  customer_name: string;
  delivery_type?: "envio" | "entrega_personal" | null;
  items: SummaryItem[];
  subtotal: number;
  discount: number;
  shipping_cost: number;
  total: number;
  total_paid?: number;
  balance?: number;
  is_paid?: boolean;
};

export type CustomerOrderSummaryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SummaryOrderData | null;
};

const ITEMS_PER_PAGE = 8;

export function CustomerOrderSummaryModal({
  open,
  onOpenChange,
  order,
}: CustomerOrderSummaryModalProps) {
  const brandName = useBrandName();
  const { data: brand } = useBrand();

  // Opciones de configuración de la imagen
  const [showImages, setShowImages] = useState(false);
  const [showDeliveryType, setShowDeliveryType] = useState(false);
  const [paymentDisplay, setPaymentDisplay] = useState<"total" | "payments">("total");
  const [includeCustomMessage, setIncludeCustomMessage] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePreviewPage, setActivePreviewPage] = useState(0);

  // URLs firmadas para imágenes de productos si showImages está activo
  const [itemImageUrls, setItemImageUrls] = useState<Record<string, string>>({});

  const pagesContainerRef = useRef<HTMLDivElement>(null);

  // Soporte Web Share API
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Cargar imágenes firmadas si se activan
  useEffect(() => {
    if (!showImages || !order?.items) return;

    let isMounted = true;
    (async () => {
      const urls: Record<string, string> = {};
      for (const item of order.items) {
        const key = item.id || item.name;
        if (item.image_url) {
          urls[key] = item.image_url;
        } else if (item.image_path) {
          const url = await signedUrl(item.image_path);
          if (url && isMounted) urls[key] = url;
        }
      }
      if (isMounted) setItemImageUrls(urls);
    })();

    return () => {
      isMounted = false;
    };
  }, [showImages, order]);

  // División en páginas si hay muchos artículos
  const pages = useMemo(() => {
    if (!order || !order.items || order.items.length === 0) return [];
    if (order.items.length <= ITEMS_PER_PAGE) {
      return [order.items];
    }
    const chunks: SummaryItem[][] = [];
    for (let i = 0; i < order.items.length; i += ITEMS_PER_PAGE) {
      chunks.push(order.items.slice(i, i + ITEMS_PER_PAGE));
    }
    return chunks;
  }, [order]);

  if (!order) return null;

  const totalPages = pages.length || 1;
  const isPaid = (order.balance ?? (order.total - (order.total_paid ?? 0))) <= 0;
  const totalPaid = order.total_paid ?? (isPaid ? order.total : 0);
  const balance = Math.max(0, order.total - totalPaid);

  // Descargar todas las páginas o la página actual
  const handleDownload = async () => {
    if (!pagesContainerRef.current) return;
    setIsGenerating(true);
    try {
      const pageElements = pagesContainerRef.current.querySelectorAll<HTMLElement>(".summary-page-canvas");
      if (pageElements.length === 0) throw new Error("No se encontró el lienzo para generar la imagen");

      for (let i = 0; i < pageElements.length; i++) {
        const el = pageElements[i];
        if (!el) continue;
        const dataUrl = await toPng(el, {
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: "#FFFFFF",
          cacheBust: true,
        });

        const link = document.createElement("a");
        const filename =
          pageElements.length > 1
            ? `CookiesMoon-${order.folio}-p${i + 1}.png`
            : `CookiesMoon-${order.folio}.png`;
        link.download = filename;
        link.href = dataUrl;
        link.click();
      }

      toast.success(
        pageElements.length > 1
          ? `Se descargaron ${pageElements.length} imágenes del resumen`
          : "Resumen descargado correctamente en PNG",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar la imagen");
    } finally {
      setIsGenerating(false);
    }
  };

  // Compartir mediante Web Share API
  const handleShare = async () => {
    if (!pagesContainerRef.current || !canShare) return;
    setIsGenerating(true);
    try {
      const pageElements = pagesContainerRef.current.querySelectorAll<HTMLElement>(".summary-page-canvas");
      if (pageElements.length === 0) throw new Error("No se encontró el lienzo");

      const files: File[] = [];
      for (let i = 0; i < pageElements.length; i++) {
        const el = pageElements[i];
        if (!el) continue;
        const dataUrl = await toPng(el, {
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: "#FFFFFF",
          cacheBust: true,
        });

        const blob = await (await fetch(dataUrl)).blob();
        const filename =
          pageElements.length > 1
            ? `CookiesMoon-${order.folio}-p${i + 1}.png`
            : `CookiesMoon-${order.folio}.png`;
        files.push(new File([blob], filename, { type: "image/png" }));
      }

      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({
          files,
          title: `Resumen de tu pedido ${order.folio} — Cookies Moon`,
          text: `¡Hola ${order.customer_name}! Te compartimos el resumen de tu pedido en Cookies Moon.`,
        });
        toast.success("Resumen compartido");
      } else {
        // Fallback a descarga si no permite compartir archivos
        handleDownload();
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error("No se pudo compartir. Descarga el PNG directamente.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] sm:max-w-4xl overflow-hidden flex flex-col p-0 gap-0 bg-background border-border">
        {/* Cabecera del Modal */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-card/60 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <Sparkles className="h-5 w-5 text-primary" /> Resumen para clienta
            </DialogTitle>
            <span className="chip bg-primary/10 text-primary font-bold text-xs">
              {order.folio}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Genera una tarjeta comercial con diseño claro para enviar por WhatsApp.
          </p>
        </DialogHeader>

        {/* Contenido: Controles a la izquierda + Preview a la derecha */}
        <div className="grid lg:grid-cols-[300px_1fr] flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Panel de Opciones */}
          <div className="p-4 space-y-4 overflow-y-auto max-h-[40vh] lg:max-h-[70vh] bg-card/40 text-xs">
            <h3 className="font-semibold uppercase tracking-wider text-muted-foreground text-[11px]">
              Opciones de la imagen
            </h3>

            {/* Switch Mostrar Imágenes */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-2.5">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer">Mostrar miniaturas</Label>
                <p className="text-[11px] text-muted-foreground">Incluye foto del producto</p>
              </div>
              <Switch checked={showImages} onCheckedChange={setShowImages} />
            </div>

            {/* Switch Mostrar Tipo de Entrega */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-2.5">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer">Tipo de entrega</Label>
                <p className="text-[11px] text-muted-foreground">Envío o entrega personal</p>
              </div>
              <Switch checked={showDeliveryType} onCheckedChange={setShowDeliveryType} />
            </div>

            {/* Selector de Información de Pagos */}
            <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-2.5">
              <Label className="text-xs font-medium">Información de pago</Label>
              <RadioGroup
                value={paymentDisplay}
                onValueChange={(v) => setPaymentDisplay(v as "total" | "payments")}
                className="gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="total" id="pay-total" />
                  <Label htmlFor="pay-total" className="text-xs cursor-pointer">
                    Mostrar solamente total
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="payments" id="pay-detail" />
                  <Label htmlFor="pay-detail" className="text-xs cursor-pointer">
                    Mostrar pagos y saldo
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Switch Mensaje Personalizado */}
            <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium cursor-pointer">Mensaje personalizado</Label>
                <Switch
                  checked={includeCustomMessage}
                  onCheckedChange={setIncludeCustomMessage}
                />
              </div>
              {includeCustomMessage && (
                <Input
                  placeholder="Ej. Tu pedido comenzará a prepararse esta semana."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="tap text-xs h-8 mt-2"
                />
              )}
            </div>

            {/* Indicador de Páginas */}
            {totalPages > 1 && (
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-2.5 text-center">
                <p className="font-bold text-primary text-xs">
                  Pedido grande: {totalPages} páginas
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Se descargarán {totalPages} imágenes limpias y legibles.
                </p>
              </div>
            )}
          </div>

          {/* Área de Vista Previa (Lienzo) */}
          <div className="flex-1 flex flex-col bg-muted/40 overflow-hidden">
            {/* Barra de navegación de páginas si hay varias */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card text-xs">
                <span className="text-muted-foreground font-medium">
                  Viendo página {activePreviewPage + 1} de {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={activePreviewPage === 0}
                    onClick={() => setActivePreviewPage((prev) => Math.max(0, prev - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={activePreviewPage === totalPages - 1}
                    onClick={() => setActivePreviewPage((prev) => Math.min(totalPages - 1, prev + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Visor con scroll del Lienzo (Render real 680px escalado para WhatsApp) */}
            <div className="flex-1 overflow-y-auto p-4 flex items-start justify-center">
              {/* Contenedor que alberga los lienzos para exportación */}
              <div ref={pagesContainerRef} className="space-y-6">
                {pages.map((pageItems, pageIdx) => {
                  const isLastPage = pageIdx === totalPages - 1;
                  // Si estamos en preview, mostramos solo la página activa (o todas si 1 página)
                  const isVisibleInPreview = totalPages === 1 || activePreviewPage === pageIdx;

                  return (
                    <div
                      key={pageIdx}
                      className={cn(
                        "summary-page-canvas w-[480px] sm:w-[540px] rounded-2xl shadow-xl border border-[#EFCE8B]/60 p-6 sm:p-8 transition-all",
                        isVisibleInPreview ? "block" : "hidden lg:block",
                      )}
                      style={{
                        backgroundColor: "#FFFFFF",
                        color: "#181C25",
                        fontFamily:
                          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      }}
                    >
                      {/* 1. ENCABEZADO COMERCIAL COOKIES MOON */}
                      <div className="text-center border-b border-[#EFCE8B]/40 pb-5">
                        <div className="flex justify-center mb-2">
                          <BrandLogo size="md" />
                        </div>
                        <h2
                          className="font-display text-2xl font-bold tracking-tight"
                          style={{ color: "#7D421F" }}
                        >
                          {brandName}
                        </h2>
                        <div className="inline-block mt-1 px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-[#5CC6D0]/15 text-[#00838F]">
                          Resumen de pedido
                        </div>

                        {/* Datos del Pedido */}
                        <div className="mt-4 grid grid-cols-2 gap-2 text-left text-xs bg-[#FCFBF8] rounded-xl p-3 border border-[#EFCE8B]/30">
                          <div>
                            <span className="text-gray-500 text-[11px] block">Pedido</span>
                            <span className="font-bold font-mono text-sm text-[#7D421F]">
                              {order.folio}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[11px] block">Fecha</span>
                            <span className="font-semibold text-gray-800">
                              {dateFmt(typeof order.created_at === "string" ? order.created_at : order.created_at.toISOString())}
                            </span>
                          </div>
                          <div className="col-span-2 pt-1 border-t border-gray-100 flex items-center justify-between">
                            <div>
                              <span className="text-gray-500 text-[11px] block">Cliente</span>
                              <span className="font-bold text-gray-900 text-sm">
                                {order.customer_name}
                              </span>
                            </div>
                            {showDeliveryType && order.delivery_type && (
                              <div className="text-right">
                                <span className="text-gray-500 text-[11px] block">Entrega</span>
                                <span className="font-semibold text-[#00838F] text-xs capitalize">
                                  {order.delivery_type === "envio"
                                    ? "📦 Envío"
                                    : "🤝 Entrega personal"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 2. LISTA DE PRODUCTOS DE LA PÁGINA */}
                      <div className="py-4 space-y-3">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#7D421F] uppercase tracking-wider border-b border-gray-100 pb-1">
                          <span>Tu pedido</span>
                          {totalPages > 1 && (
                            <span className="text-gray-400 font-normal">
                              Página {pageIdx + 1} de {totalPages}
                            </span>
                          )}
                        </div>

                        <div className="divide-y divide-gray-100">
                          {pageItems.map((item, itIdx) => {
                            const imgUrl =
                              itemImageUrls[item.id || item.name] || item.image_url;
                            const isCutter = item.category === "CORTADORES";
                            const modalityLabel = isCutter
                              ? MODALITIES.find((m) => m.value === item.cutter_modality)?.label ??
                                "Cortador"
                              : null;

                            return (
                              <div key={itIdx} className="py-2.5 flex items-start gap-3 text-xs">
                                {showImages && (
                                  <div className="h-11 w-11 shrink-0 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                                    {imgUrl ? (
                                      <img
                                        src={imgUrl}
                                        alt=""
                                        className="h-full w-full object-cover"
                                        crossOrigin="anonymous"
                                      />
                                    ) : (
                                      <Package className="h-5 w-5 text-gray-300" />
                                    )}
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="font-bold text-[#7D421F] text-sm">
                                      {item.quantity} ×
                                    </span>
                                    <span className="font-semibold text-gray-900 text-sm leading-tight">
                                      {item.name}
                                    </span>
                                  </div>

                                  {/* Especificaciones de Cortador */}
                                  {isCutter && (
                                    <p className="text-[11px] text-[#00838F] font-medium mt-0.5">
                                      {modalityLabel} · {item.cutter_size_cm ?? 8} cm
                                    </p>
                                  )}

                                  {/* SKU discreto */}
                                  {item.sku && (
                                    <span className="text-[10px] text-gray-400 font-mono">
                                      {item.sku}
                                    </span>
                                  )}
                                </div>

                                <div className="text-right shrink-0">
                                  <p className="text-[11px] text-gray-400">
                                    {money(item.unit_price)} c/u
                                  </p>
                                  <p className="font-bold text-gray-900 text-sm">
                                    {money(item.subtotal)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. TOTALES Y RESUMEN FINANCIERO (Solo en la última página) */}
                      {isLastPage && (
                        <div className="border-t border-[#EFCE8B]/60 pt-3 space-y-1.5 text-xs">
                          <div className="flex justify-between text-gray-600">
                            <span>Subtotal</span>
                            <span className="font-medium text-gray-900">{money(order.subtotal)}</span>
                          </div>

                          {order.discount > 0 && (
                            <div className="flex justify-between text-rose-600">
                              <span>Descuento</span>
                              <span className="font-medium">-{money(order.discount)}</span>
                            </div>
                          )}

                          {order.shipping_cost > 0 && (
                            <div className="flex justify-between text-gray-600">
                              <span>Envío</span>
                              <span className="font-medium text-gray-900">
                                {money(order.shipping_cost)}
                              </span>
                            </div>
                          )}

                          {/* TOTAL DESTACADO */}
                          <div className="mt-2 pt-2 border-t-2 border-[#5CC6D0] flex items-center justify-between">
                            <span className="font-display text-base font-bold text-[#7D421F]">
                              TOTAL
                            </span>
                            <span className="font-display text-2xl font-bold text-[#00838F]">
                              {money(order.total)}
                            </span>
                          </div>

                          {/* Sección de Pagos y Saldo (Si fue activada) */}
                          {paymentDisplay === "payments" && (
                            <div className="mt-3 p-2.5 rounded-xl bg-[#FCFBF8] border border-[#EFCE8B]/40 text-[11px] space-y-1">
                              <div className="flex justify-between text-gray-600">
                                <span>Total a pagar</span>
                                <span className="font-semibold">{money(order.total)}</span>
                              </div>
                              <div className="flex justify-between text-emerald-700 font-medium">
                                <span>Pagado</span>
                                <span>{money(totalPaid)}</span>
                              </div>
                              <div className="flex justify-between font-bold pt-1 border-t border-gray-200">
                                <span className="text-gray-700">Saldo pendiente</span>
                                <span
                                  className={balance <= 0 ? "text-emerald-600" : "text-amber-700"}
                                >
                                  {balance <= 0 ? "¡PAGADO!" : money(balance)}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Mensaje personalizado si está activo */}
                          {includeCustomMessage && customMessage.trim() && (
                            <div className="mt-3 p-2.5 rounded-xl bg-[#5CC6D0]/10 border border-[#5CC6D0]/30 text-center text-xs text-[#006064] font-medium">
                              "{customMessage.trim()}"
                            </div>
                          )}
                        </div>
                      )}

                      {/* 4. PIE DE PÁGINA */}
                      <div className="mt-6 pt-4 border-t border-gray-100 text-center text-xs text-gray-500">
                        <p className="font-medium text-gray-700">
                          ¡Gracias por tu preferencia y confianza! 💛
                        </p>
                        <p className="text-[11px] font-bold text-[#7D421F] mt-0.5">
                          {brandName}
                        </p>
                        {totalPages > 1 && (
                          <p className="text-[10px] text-gray-400 mt-2">
                            Página {pageIdx + 1} de {totalPages} · Pedido {order.folio}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Pie del Modal con Botones */}
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
            {canShare && (
              <Button
                type="button"
                variant="secondary"
                disabled={isGenerating}
                onClick={handleShare}
                className="tap font-semibold"
              >
                {isGenerating ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="mr-1.5 h-4 w-4 text-primary" />
                )}
                Compartir
              </Button>
            )}

            <Button
              type="button"
              disabled={isGenerating}
              onClick={handleDownload}
              className="tap font-bold shadow-md shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generando PNG...
                </>
              ) : (
                <>
                  <Download className="mr-1.5 h-4 w-4 stroke-[2.5]" /> Descargar PNG
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
