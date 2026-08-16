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
import { supabase } from "@/integrations/supabase/client";
import { money, dateFmt, fullName, type Modality, MODALITIES } from "@/lib/cm";
import { cn } from "@/lib/utils";
import type { SummaryOrderData, SummaryItem } from "@/lib/order-summary";

export type { SummaryOrderData, SummaryItem };

export type CustomerOrderSummaryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SummaryOrderData | null;
};

const ITEMS_PER_PAGE = 7;

/**
 * Espera de forma robusta a que todas las imágenes dentro de un contenedor HTML hayan cargado y decodificado
 * antes de generar la captura PNG. Cuenta con timeout de seguridad para no bloquearse nunca.
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
        // Ignorar fallo de decodificación individual
      }
    }),
  );
}

export function CustomerOrderSummaryModal({
  open,
  onOpenChange,
  order,
}: CustomerOrderSummaryModalProps) {
  const brandName = useBrandName();
  const { data: brand } = useBrand();

  // Opciones de configuración de la imagen
  // Los personalizados siempre muestran su imagen; este switch permite mostrar también las de catálogo
  const [showCatalogImages, setShowCatalogImages] = useState(true);
  const [showDeliveryType, setShowDeliveryType] = useState(false);
  const [paymentDisplay, setPaymentDisplay] = useState<"total" | "payments">("total");
  const [includeCustomMessage, setIncludeCustomMessage] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [activePreviewPage, setActivePreviewPage] = useState(0);

  // URLs firmadas o base64 para imágenes de productos keyed por item.id
  const [itemImageUrls, setItemImageUrls] = useState<Record<string, string>>({});

  const pagesContainerRef = useRef<HTMLDivElement>(null);

  // Soporte Web Share API
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Cargar imágenes de los artículos (convirtiendo a Data URL base64 para máxima compatibilidad con html-to-image)
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
        const shouldResolve = item.is_custom || showCatalogImages;

        if (!shouldResolve) continue;

        if (item.image_path) {
          try {
            // Intentar descarga directa de blob para base64 libre de CORS y sin expiración de query params
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
            console.warn("Descarga de blob omitida, usando signedUrl:", e);
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
  }, [order, showCatalogImages]);

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

  // Descargar todas las páginas
  const handleDownload = async () => {
    if (!pagesContainerRef.current) return;
    setIsGenerating(true);
    try {
      // 1. Esperar decodificación y carga de imágenes
      await waitForImages(pagesContainerRef.current);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const pageElements = pagesContainerRef.current.querySelectorAll<HTMLElement>(".summary-export-canvas");
      if (pageElements.length === 0) throw new Error("No se encontró el lienzo para generar la imagen");

      for (let i = 0; i < pageElements.length; i++) {
        const el = pageElements[i];
        if (!el) continue;

        const dataUrl = await toPng(el, {
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: "#FFFFFF",
          cacheBust: false,
        });

        const link = document.createElement("a");
        const filename =
          pageElements.length > 1
            ? `CookiesMoon-${order.folio}-p${i + 1}.png`
            : `CookiesMoon-${order.folio}.png`;
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast.success(
        pageElements.length > 1
          ? `Se descargaron ${pageElements.length} imágenes del resumen exitosamente`
          : "Resumen descargado correctamente en PNG",
      );
    } catch (err) {
      console.error("Error al exportar imagen PNG:", err);
      toast.error(err instanceof Error ? err.message : "Error al generar la imagen");
    } finally {
      setIsGenerating(false);
    }
  };

  // Compartir mediante Web Share API
  const handleShare = async () => {
    if (!pagesContainerRef.current) return;
    setIsGenerating(true);
    try {
      await waitForImages(pagesContainerRef.current);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const pageElements = pagesContainerRef.current.querySelectorAll<HTMLElement>(".summary-export-canvas");
      if (pageElements.length === 0) throw new Error("No se encontró el lienzo");

      const files: File[] = [];
      for (let i = 0; i < pageElements.length; i++) {
        const el = pageElements[i];
        if (!el) continue;

        const dataUrl = await toPng(el, {
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: "#FFFFFF",
          cacheBust: false,
        });

        const res = await fetch(dataUrl);
        const blob = await res.blob();
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
      } else if (navigator.clipboard && window.ClipboardItem && files[0]) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": files[0] }),
          ]);
          toast.success("¡Imagen copiada al portapapeles! Puedes pegarla directamente en WhatsApp (Ctrl+V)");
        } catch {
          await handleDownload();
        }
      } else {
        await handleDownload();
      }
    } catch (err: any) {
      console.error("Error al compartir:", err);
      if (err.name !== "AbortError") {
        toast.error("No se pudo compartir directamente. Descargando imagen...");
        await handleDownload();
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
            Genera una tarjeta comercial con diseño claro y fotos para enviar por WhatsApp.
          </p>
        </DialogHeader>

        {/* Contenido: Controles a la izquierda + Preview a la derecha */}
        <div className="grid lg:grid-cols-[300px_1fr] flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Panel de Opciones */}
          <div className="p-4 space-y-4 overflow-y-auto max-h-[40vh] lg:max-h-[70vh] bg-card/40 text-xs">
            <h3 className="font-semibold uppercase tracking-wider text-muted-foreground text-[11px]">
              Opciones de la imagen
            </h3>

            {/* Switch Mostrar Imágenes del Catálogo */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-2.5">
              <div className="space-y-0.5 pr-2">
                <Label className="text-xs font-medium cursor-pointer">Imágenes del catálogo</Label>
                <p className="text-[11px] text-muted-foreground">
                  Los personalizados siempre muestran su diseño
                </p>
              </div>
              <Switch checked={showCatalogImages} onCheckedChange={setShowCatalogImages} />
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
                    Solo total a pagar
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="payments" id="pay-details" />
                  <Label htmlFor="pay-details" className="text-xs cursor-pointer">
                    Desglose de anticipo y saldo
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Mensaje Personalizado Opcional */}
            <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium cursor-pointer">
                  Mensaje al pie (opcional)
                </Label>
                <Switch
                  checked={includeCustomMessage}
                  onCheckedChange={setIncludeCustomMessage}
                />
              </div>
              {includeCustomMessage && (
                <Input
                  className="tap text-xs h-8 mt-1.5"
                  placeholder="Ej. ¡Muchas gracias por tu compra! 💕"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              )}
            </div>

            {/* Estado de carga de imágenes */}
            {imagesLoading && (
              <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Preparando imágenes de alta resolución...</span>
              </div>
            )}
          </div>

          {/* Panel de Vista Previa */}
          <div className="p-4 flex flex-col items-center justify-between bg-muted/20 overflow-y-auto max-h-[50vh] lg:max-h-[70vh]">
            <div className="w-full max-w-[420px] shadow-2xl rounded-2xl overflow-hidden border border-border">
              {pages[activePreviewPage] && (
                <SummaryCard
                  pageItems={pages[activePreviewPage]}
                  pageIdx={activePreviewPage}
                  totalPages={totalPages}
                  order={order}
                  showCatalogImages={showCatalogImages}
                  showDeliveryType={showDeliveryType}
                  paymentDisplay={paymentDisplay}
                  includeCustomMessage={includeCustomMessage}
                  customMessage={customMessage}
                  brandName={brandName}
                  itemImageUrls={itemImageUrls}
                  isLastPage={activePreviewPage === totalPages - 1}
                  totalPaid={totalPaid}
                  balance={balance}
                />
              )}
            </div>

            {/* Navegación entre páginas si hay más de 1 */}
            {totalPages > 1 && (
              <div className="flex items-center gap-3 mt-4 text-xs">
                <Button
                  variant="outline"
                  size="sm"
                  className="tap h-7 w-7 p-0"
                  disabled={activePreviewPage === 0}
                  onClick={() => setActivePreviewPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold text-muted-foreground">
                  Página {activePreviewPage + 1} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="tap h-7 w-7 p-0"
                  disabled={activePreviewPage === totalPages - 1}
                  onClick={() => setActivePreviewPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Lienzo oculto de renderizado para exportación de alta resolución */}
        <div
          ref={pagesContainerRef}
          style={{
            position: "fixed",
            left: "-9999px",
            top: "0px",
            width: "560px",
            pointerEvents: "none",
            opacity: 1,
          }}
        >
          {pages.map((pItems, pIdx) => (
            <SummaryCard
              key={pIdx}
              className="summary-export-canvas mb-8"
              pageItems={pItems}
              pageIdx={pIdx}
              totalPages={totalPages}
              order={order}
              showCatalogImages={showCatalogImages}
              showDeliveryType={showDeliveryType}
              paymentDisplay={paymentDisplay}
              includeCustomMessage={includeCustomMessage}
              customMessage={customMessage}
              brandName={brandName}
              itemImageUrls={itemImageUrls}
              isLastPage={pIdx === totalPages - 1}
              totalPaid={totalPaid}
              balance={balance}
            />
          ))}
        </div>

        {/* Footer con Botones de Acción */}
        <DialogFooter className="p-4 sm:p-5 border-t border-border bg-card/60 flex items-center justify-between gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="tap"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>

          <div className="flex items-center gap-2">
            {canShare && (
              <Button
                type="button"
                variant="outline"
                className="tap font-semibold"
                disabled={isGenerating || imagesLoading}
                onClick={handleShare}
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
              className="tap font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
              disabled={isGenerating || imagesLoading}
              onClick={handleDownload}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Descargar imagen PNG
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tarjeta visual para el cliente con estética clara y comercial de Cookies Moon
 */
function SummaryCard({
  className,
  pageItems,
  pageIdx,
  totalPages,
  order,
  showCatalogImages,
  showDeliveryType,
  paymentDisplay,
  includeCustomMessage,
  customMessage,
  brandName,
  itemImageUrls,
  isLastPage,
  totalPaid,
  balance,
}: {
  className?: string;
  pageItems: SummaryItem[];
  pageIdx: number;
  totalPages: number;
  order: SummaryOrderData;
  showCatalogImages: boolean;
  showDeliveryType: boolean;
  paymentDisplay: "total" | "payments";
  includeCustomMessage: boolean;
  customMessage: string;
  brandName: string;
  itemImageUrls: Record<string, string>;
  isLastPage: boolean;
  totalPaid: number;
  balance: number;
}) {
  return (
    <div
      className={cn("p-6 sm:p-7 space-y-4", className)}
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
              {dateFmt(
                typeof order.created_at === "string"
                  ? order.created_at
                  : order.created_at.toISOString(),
              )}
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
                  {order.delivery_type === "envio" ? "📦 Envío" : "🤝 Entrega personal"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. LISTA DE PRODUCTOS DE LA PÁGINA */}
      <div className="py-2 space-y-3">
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
            const imgUrl = itemImageUrls[item.id] || item.image_url;
            const isCutter = item.category === "CORTADORES";
            const modalityLabel = isCutter
              ? MODALITIES.find((m) => m.value === item.cutter_modality)?.label ?? "Cortador"
              : null;

            // Mostrar miniatura si es personalizado O si está activo el switch de catálogo
            const shouldShowThumbnail = Boolean(item.is_custom || showCatalogImages);

            return (
              <div key={item.id || itIdx} className="py-2.5 flex items-start gap-3 text-xs">
                {shouldShowThumbnail && (
                  <div className="h-14 w-14 shrink-0 rounded-xl border border-[#EFCE8B]/40 overflow-hidden bg-white flex items-center justify-center p-0.5 shadow-sm">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={item.name}
                        className="h-full w-full object-contain"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Package className="h-6 w-6 text-gray-300" />
                    )}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="font-bold text-[#7D421F] text-sm">
                      {item.quantity} ×
                    </span>
                    <span className="font-semibold text-gray-900 text-sm leading-tight">
                      {item.name}
                    </span>
                    {item.is_custom && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#EFCE8B]/40 text-[#7D421F] border border-[#7D421F]/20">
                        <Sparkles className="h-2.5 w-2.5" /> PERSONALIZADO
                      </span>
                    )}
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

      {/* 3. TOTALES (Solo en la última página) */}
      {isLastPage && (
        <div className="border-t border-dashed border-[#EFCE8B] pt-4 space-y-2 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal:</span>
            <span className="font-medium text-gray-800">{money(order.subtotal)}</span>
          </div>

          {order.discount > 0 && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Descuento:</span>
              <span>-{money(order.discount)}</span>
            </div>
          )}

          {order.shipping_cost > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Costo de envío:</span>
              <span className="font-medium text-gray-800">{money(order.shipping_cost)}</span>
            </div>
          )}

          {/* Gran Total */}
          <div className="flex items-baseline justify-between border-t border-gray-200 pt-2 text-sm">
            <span className="font-bold text-gray-900">Total del pedido:</span>
            <span
              className="font-display text-xl font-bold"
              style={{ color: "#7D421F" }}
            >
              {money(order.total)}
            </span>
          </div>

          {/* Desglose de Pagos / Anticipos si se activó */}
          {paymentDisplay === "payments" && (
            <div className="mt-3 rounded-xl bg-[#FCFBF8] p-3 border border-[#EFCE8B]/40 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Anticipo / Pagado:</span>
                <span className="font-semibold text-emerald-600">
                  {money(totalPaid)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-1">
                <span>Saldo pendiente:</span>
                <span style={{ color: balance > 0 ? "#7D421F" : "#10B981" }}>
                  {balance > 0 ? money(balance) : "¡Liquidado! ✓"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. MENSAJE FINAL COMERCIAL */}
      {isLastPage && (
        <div className="text-center pt-3 border-t border-gray-100 space-y-1">
          <p className="text-xs text-gray-600 font-medium italic">
            {includeCustomMessage && customMessage.trim()
              ? customMessage.trim()
              : "¡Gracias por crear momentos especiales con Cookies Moon! ✨"}
          </p>
          <p className="text-[10px] text-gray-400">
            Cortadores, stencils y herramientas de repostería con amor
          </p>
        </div>
      )}
    </div>
  );
}
