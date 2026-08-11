import { useState, useRef } from "react";
import {
  Printer,
  Download,
  X,
  Package,
  Truck,
  MapPin,
  FileText,
  CheckSquare,
  QrCode,
  Tag,
  Loader2,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BrandLogo } from "@/components/BrandLogo";
import { useBrandName } from "@/lib/brand";
import { dateFmt, fullName, type Modality, MODALITIES } from "@/lib/cm";
import { cn } from "@/lib/utils";

export type ShippingLabelData = {
  folio: string;
  created_at: string | Date;
  delivery_type: "envio" | "entrega_personal" | string;
  recipient: {
    first_name: string;
    last_name?: string | null;
    phone?: string | null;
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
    special_instructions?: string | null;
    // Para entrega personal:
    place?: string | null;
    delivery_date?: string | null;
    delivery_time?: string | null;
    instructions?: string | null;
  };
  items: Array<{
    name: string;
    category?: string;
    quantity: number;
    cutter_modality?: Modality | null;
    cutter_size_cm?: number | null;
    notes?: string | null;
  }>;
};

export type ShippingLabelModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ShippingLabelData | null;
};

export function ShippingLabelModal({ open, onOpenChange, data }: ShippingLabelModalProps) {
  const brandName = useBrandName();
  const labelRef = useRef<HTMLDivElement>(null);

  const [includeItemsChecklist, setIncludeItemsChecklist] = useState(true);
  const [includePhone, setIncludePhone] = useState(true);
  const [includeReferences, setIncludeReferences] = useState(true);
  const [labelFormat, setLabelFormat] = useState<"thermal" | "half_letter">("thermal");
  const [isGenerating, setIsGenerating] = useState(false);

  if (!data) return null;

  const totalPieces = data.items.reduce((acc, it) => acc + it.quantity, 0);
  const r = data.recipient;
  const isShipping = data.delivery_type === "envio";

  // Manejador de descarga de imagen PNG
  const handleDownloadImage = async () => {
    if (!labelRef.current) return;
    setIsGenerating(true);
    try {
      const dataUrl = await toPng(labelRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: "#FFFFFF",
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `Etiqueta-${data.folio}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Etiqueta de envío descargada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar imagen");
    } finally {
      setIsGenerating(false);
    }
  };

  // Manejador de impresión nativa directa
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] sm:max-w-3xl overflow-hidden flex flex-col p-0 gap-0 bg-background border-border">
        {/* Cabecera del Modal */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-card/60 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <Tag className="h-5 w-5 text-primary" /> Etiqueta de Envío & Remisión
            </DialogTitle>
            <span className="chip bg-primary/10 text-primary font-bold text-xs">
              {data.folio}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Genera la etiqueta de paquetería o remisión lista para imprimir en impresora térmica 4x6" o en papel normal.
          </p>
        </DialogHeader>

        <div className="grid lg:grid-cols-[280px_1fr] flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Panel de Opciones */}
          <div className="p-4 space-y-4 overflow-y-auto max-h-[35vh] lg:max-h-[70vh] bg-card/40 text-xs">
            <h3 className="font-semibold uppercase tracking-wider text-muted-foreground text-[11px]">
              Configuración de etiqueta
            </h3>

            {/* Formato de etiqueta */}
            <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-2.5">
              <Label className="text-xs font-medium">Formato de impresión</Label>
              <RadioGroup
                value={labelFormat}
                onValueChange={(v) => setLabelFormat(v as "thermal" | "half_letter")}
                className="gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="thermal" id="fmt-thermal" />
                  <Label htmlFor="fmt-thermal" className="text-xs cursor-pointer">
                    Térmica 4x6" (100×150 mm)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="half_letter" id="fmt-letter" />
                  <Label htmlFor="fmt-letter" className="text-xs cursor-pointer">
                    Media Carta / Carta
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Checklist de productos */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-2.5">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer">Checklist de empaque</Label>
                <p className="text-[11px] text-muted-foreground">Lista de artículos en la caja</p>
              </div>
              <Switch
                checked={includeItemsChecklist}
                onCheckedChange={setIncludeItemsChecklist}
              />
            </div>

            {/* Teléfono */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-2.5">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer">Teléfono de clienta</Label>
                <p className="text-[11px] text-muted-foreground">Visible para el repartidor</p>
              </div>
              <Switch checked={includePhone} onCheckedChange={setIncludePhone} />
            </div>

            {/* Referencias */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-2.5">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer">Referencias de entrega</Label>
                <p className="text-[11px] text-muted-foreground">Instrucciones del domicilio</p>
              </div>
              <Switch checked={includeReferences} onCheckedChange={setIncludeReferences} />
            </div>
          </div>

          {/* Área de Vista Previa de la Etiqueta */}
          <div className="flex-1 overflow-y-auto p-4 flex items-start justify-center bg-muted/40">
            {/* Contenedor de la Etiqueta Imprimible */}
            <div
              ref={labelRef}
              className={cn(
                "rounded-xl border-2 border-black bg-white text-black p-6 shadow-xl transition-all",
                labelFormat === "thermal"
                  ? "w-[380px] sm:w-[420px] text-xs leading-relaxed"
                  : "w-[460px] sm:w-[500px] text-xs leading-relaxed",
              )}
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                color: "#000000",
                backgroundColor: "#FFFFFF",
              }}
            >
              {/* 1. CABECERA CON REMITENTE Y FOLIO */}
              <div className="border-b-2 border-black pb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-base tracking-tight">
                    <BrandLogo size="sm" />
                    <span>{brandName}</span>
                  </div>
                  <p className="text-[10px] text-gray-700 mt-0.5 uppercase tracking-wider font-semibold">
                    Cortadores de Galletas & Repostería Creativa
                  </p>
                </div>

                <div className="text-right">
                  <div className="inline-block border-2 border-black bg-black text-white font-mono font-bold text-sm px-2 py-0.5 rounded">
                    {data.folio}
                  </div>
                  {isShipping && r.carrier && (
                    <p className="text-[11px] font-bold text-black uppercase mt-1">
                      {r.carrier}
                    </p>
                  )}
                </div>
              </div>

              {/* 2. DATOS DEL DESTINATARIO (SHIP TO) */}
              <div className="py-3 border-b-2 border-black space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-gray-200 px-1.5 py-0.5 rounded text-gray-800">
                    {isShipping ? "DESTINATARIO / SHIP TO" : "ENTREGA PERSONAL"}
                  </span>
                  <span className="text-[10px] text-gray-600 font-mono">
                    Fecha: {dateFmt(data.created_at)}
                  </span>
                </div>

                <h2 className="text-base font-bold uppercase tracking-tight text-black pt-1">
                  {fullName(r.first_name, r.last_name)}
                </h2>

                {includePhone && r.phone && (
                  <p className="font-mono text-xs font-bold">
                    📞 Tel: {r.phone}
                  </p>
                )}

                {isShipping ? (
                  <div className="space-y-0.5 pt-1 text-xs">
                    <p className="font-semibold text-black">
                      {[r.street, r.ext_number && `#${r.ext_number}`, r.int_number && `Int. ${r.int_number}`]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                    {r.neighborhood && <p>Col. {r.neighborhood}</p>}
                    <div className="flex items-center gap-2 pt-0.5 font-bold">
                      {r.postal_code && (
                        <span className="border-2 border-black bg-black text-white px-1.5 py-0.5 rounded font-mono text-xs">
                          C.P. {r.postal_code}
                        </span>
                      )}
                      <span>
                        {[r.city, r.municipality, r.state].filter(Boolean).join(", ")}
                      </span>
                    </div>

                    {includeReferences && r.references_text && (
                      <div className="mt-2 p-1.5 rounded bg-gray-100 border border-gray-300 text-[11px]">
                        <strong>Ref:</strong> {r.references_text}
                      </div>
                    )}

                    {r.tracking_number && (
                      <p className="font-mono font-bold text-xs pt-1">
                        GUÍA: {r.tracking_number}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1 pt-1 text-xs">
                    <p className="font-bold">📍 Lugar: {r.place || "Punto acordado"}</p>
                    <p>
                      📅 Fecha: {dateFmt(r.delivery_date)} {r.delivery_time ? `· ⏰ ${r.delivery_time}` : ""}
                    </p>
                    {r.instructions && <p className="text-[11px] text-gray-700">Nota: {r.instructions}</p>}
                  </div>
                )}
              </div>

              {/* 3. CHECKLIST DE EMPAQUE / PACKING SLIP */}
              {includeItemsChecklist && (
                <div className="py-3 border-b-2 border-black space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-700">
                    <span>Contenido del paquete</span>
                    <span>Total: {totalPieces} pzas</span>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {data.items.map((item, idx) => {
                      const isCutter = item.category === "CORTADORES";
                      const modalityLabel = isCutter
                        ? MODALITIES.find((m) => m.value === item.cutter_modality)?.label ?? "Cortador"
                        : null;

                      return (
                        <div key={idx} className="py-1 flex items-start gap-2 text-xs">
                          <span className="font-mono text-gray-400 select-none">[ ]</span>
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-black mr-1">{item.quantity} ×</span>
                            <span className="font-medium">{item.name}</span>
                            {isCutter && (
                              <span className="text-[10px] text-gray-600 block">
                                {modalityLabel} · {item.cutter_size_cm ?? 8} cm
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. PIE DE REMITENTE Y MENSAJE DE FRÁGIL */}
              <div className="pt-3 flex items-center justify-between text-[10px] text-gray-600">
                <div>
                  <p className="font-bold text-black uppercase">REMITENTE / FROM:</p>
                  <p>{brandName} · Taller Creativo</p>
                  <p>México</p>
                </div>

                <div className="border border-black px-2 py-1 text-center font-bold text-black rounded uppercase text-[10px]">
                  ⚠️ FRÁGIL / MANÉJESE CON CUIDADO
                </div>
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
              Descargar PNG
            </Button>

            <Button
              type="button"
              onClick={handlePrint}
              className="tap font-bold bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
            >
              <Printer className="mr-1.5 h-4 w-4 stroke-[2.5]" /> Imprimir Etiqueta
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
