import { useState } from "react";
import {
  Sparkles,
  Image as ImageIcon,
  BookOpen,
  Info,
  Maximize2,
  X,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StoredImage } from "@/components/StoredImage";
import { cn } from "@/lib/utils";

export type CustomViewerImage = {
  id?: string;
  previewUrl?: string;
  storage_path?: string;
  external_url?: string;
  is_primary?: boolean;
};

export function CustomDesignViewerModal({
  open,
  onOpenChange,
  title,
  productSku,
  isCustom,
  customNotes,
  customImages = [],
  catalogImages = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  productSku?: string | null;
  isCustom?: boolean;
  customNotes?: string | null;
  customImages?: CustomViewerImage[];
  catalogImages?: any[];
}) {
  const [selectedZoomImg, setSelectedZoomImg] = useState<{
    url?: string;
    imageObj?: any;
    label: string;
  } | null>(null);

  const hasCustomImages = customImages.length > 0;
  const hasCatalogImages = catalogImages.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  isCustom ? "bg-amber-500/10 text-amber-400" : "bg-primary/10 text-primary",
                )}
              >
                {isCustom ? <Sparkles className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              </span>
              <div>
                <DialogTitle className="font-display text-base">
                  {title} {productSku && <span className="font-mono text-xs text-muted-foreground">({productSku})</span>}
                </DialogTitle>
                {isCustom && (
                  <span className="chip mt-0.5 text-[10px] py-0 px-2 bg-amber-500/15 text-amber-400 font-bold">
                    Artículo Personalizado
                  </span>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-1">
            {/* 1. SECCIÓN: DISEÑO PERSONALIZADO DEL PEDIDO */}
            <div className="space-y-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  1. Diseño personalizado del pedido
                </h4>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {customImages.length} {customImages.length === 1 ? "imagen" : "imágenes"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Esta es la referencia exacta solicitada por la clienta para fabricación.
              </p>

              {hasCustomImages ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {customImages.map((img, idx) => (
                    <div
                      key={img.id ?? idx}
                      onClick={() =>
                        setSelectedZoomImg({
                          url: img.previewUrl,
                          imageObj: img.storage_path ? img : undefined,
                          label: `Diseño personalizado #${idx + 1}`,
                        })
                      }
                      className={cn(
                        "group relative aspect-square cursor-pointer overflow-hidden rounded-xl border bg-card p-1 shadow-sm transition-all hover:scale-[1.02] hover:border-amber-400",
                        img.is_primary ? "border-amber-400/80 ring-1 ring-amber-400/40" : "border-border",
                      )}
                    >
                      {img.previewUrl ? (
                        <img
                          src={img.previewUrl}
                          alt="Diseño personalizado"
                          className="h-full w-full object-contain rounded-lg"
                        />
                      ) : (
                        <StoredImage
                          image={img}
                          className="h-full w-full object-contain rounded-lg"
                          alt="Diseño personalizado"
                        />
                      )}

                      {img.is_primary && (
                        <span className="absolute left-2 top-2 rounded-md bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-black shadow-sm">
                          Principal
                        </span>
                      )}

                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm">
                          <Maximize2 className="h-3 w-3" /> Ampliar
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
                  No se adjuntaron imágenes personalizadas para este artículo.
                </div>
              )}

              {/* Indicaciones del personalizado */}
              {customNotes && (
                <div className="mt-3 rounded-lg bg-card/80 p-3 border border-border">
                  <div className="flex items-center gap-1 text-xs font-semibold text-foreground mb-1">
                    <Info className="h-3.5 w-3.5 text-amber-400" />
                    Indicaciones de fabricación:
                  </div>
                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                    {customNotes}
                  </p>
                </div>
              )}
            </div>

            {/* 2. SECCIÓN: REFERENCIA DEL CATÁLOGO (Si existe) */}
            {hasCatalogImages && (
              <div className="space-y-2.5 rounded-xl border border-border bg-secondary/30 p-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    2. Referencia del catálogo
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    {catalogImages.length} {catalogImages.length === 1 ? "imagen" : "imágenes"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Imagen genérica base del producto en el catálogo.
                </p>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {catalogImages.map((img, idx) => (
                    <div
                      key={img.id ?? idx}
                      onClick={() =>
                        setSelectedZoomImg({
                          imageObj: img,
                          label: `Catálogo: ${title}`,
                        })
                      }
                      className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-1 shadow-sm transition-all hover:scale-[1.02] hover:border-primary"
                    >
                      <StoredImage
                        image={img}
                        className="h-full w-full object-contain rounded-lg"
                        alt={title}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm">
                          <Maximize2 className="h-3 w-3" /> Ampliar
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox / Zoom Dialog */}
      <Dialog open={!!selectedZoomImg} onOpenChange={(open) => !open && setSelectedZoomImg(null)}>
        <DialogContent className="max-w-3xl p-3 bg-card/95 backdrop-blur-md">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xs text-muted-foreground">
              {selectedZoomImg?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[80vh] items-center justify-center overflow-hidden rounded-lg bg-secondary/50 p-2">
            {selectedZoomImg?.url ? (
              <img
                src={selectedZoomImg.url}
                alt={selectedZoomImg.label}
                className="max-h-[75vh] w-auto object-contain rounded"
              />
            ) : selectedZoomImg?.imageObj ? (
              <StoredImage
                image={selectedZoomImg.imageObj}
                className="max-h-[75vh] w-auto object-contain rounded"
                alt={selectedZoomImg.label}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
