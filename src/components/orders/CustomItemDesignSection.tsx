import { useState, useRef } from "react";
import {
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Star,
  Eye,
  Plus,
  Sparkles,
  AlertCircle,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type CustomImageDraft = {
  id: string;
  file?: File;
  previewUrl: string;
  storage_path?: string;
  is_primary: boolean;
};

export function CustomItemDesignSection({
  isCustom,
  onIsCustomChange,
  images,
  onImagesChange,
  customNotes,
  onCustomNotesChange,
  showToggle = true,
}: {
  isCustom: boolean;
  onIsCustomChange: (val: boolean) => void;
  images: CustomImageDraft[];
  onImagesChange: (imgs: CustomImageDraft[]) => void;
  customNotes: string;
  onCustomNotesChange: (notes: string) => void;
  showToggle?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImgs: CustomImageDraft[] = [];
    const hadImages = images.length > 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;

      const url = URL.createObjectURL(file);
      newImgs.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: url,
        is_primary: !hadImages && i === 0, // La primera imagen se marca automáticamente como principal si no había ninguna
      });
    }

    if (newImgs.length > 0) {
      onImagesChange([...images, ...newImgs]);
    }
  };

  const removeImage = (id: string) => {
    const remaining = images.filter((img) => img.id !== id);
    // Si eliminamos la principal y quedan imágenes, asignar la primera como principal
    if (remaining.length > 0 && !remaining.some((img) => img.is_primary)) {
      remaining[0].is_primary = true;
    }
    onImagesChange(remaining);
  };

  const setPrimary = (id: string) => {
    onImagesChange(
      images.map((img) => ({
        ...img,
        is_primary: img.id === id,
      })),
    );
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/80 bg-secondary/30 p-3.5 sm:p-4">
      {/* 1. Switch de Personalizado */}
      {showToggle && (
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label
              htmlFor="custom-switch"
              className="flex items-center gap-1.5 text-xs font-bold text-foreground cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Este artículo es personalizado
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Para diseños específicos enviados por la clienta (logotipos, nombres, personajes).
            </p>
          </div>
          <Switch
            id="custom-switch"
            checked={isCustom}
            onCheckedChange={onIsCustomChange}
            className="tap"
          />
        </div>
      )}

      {/* 2. Sección de Carga de Imágenes */}
      {(isCustom || images.length > 0) && (
        <div className="space-y-3 pt-1 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-primary" />
              {isCustom ? "Diseño personalizado (Obligatorio)" : "Imágenes de referencia (Opcional)"}
            </h4>
            {isCustom && images.length === 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                <AlertCircle className="h-3 w-3" /> Requiere mín. 1 imagen
              </span>
            )}
            {images.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {images.length} {images.length === 1 ? "imagen" : "imágenes"}
              </span>
            )}
          </div>

          {/* Zona de Drop & Carga */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "tap flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all",
              isDragging
                ? "border-primary bg-primary/10"
                : isCustom && images.length === 0
                ? "border-amber-500/50 bg-amber-500/5 hover:border-amber-400"
                : "border-border bg-card/60 hover:border-primary/60 hover:bg-card",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = ""; // Permite seleccionar el mismo archivo de nuevo
              }}
            />
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
              <UploadCloud className="h-5 w-5" />
            </div>
            <p className="mt-2 text-xs font-semibold text-foreground">
              Arrastra imágenes aquí o pulsa para seleccionar
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Acepta JPG, PNG, WEBP · Puedes subir varias vistas, logos o capturas
            </p>
          </div>

          {/* Miniaturas de imágenes cargadas */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all",
                    img.is_primary ? "border-primary ring-1 ring-primary" : "border-border",
                  )}
                >
                  <div className="relative aspect-square w-full bg-secondary">
                    <img
                      src={img.previewUrl}
                      alt="Referencia personalizada"
                      className="h-full w-full object-contain p-1"
                    />

                    {/* Badge Principal */}
                    {img.is_primary ? (
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm">
                        Principal
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrimary(img.id);
                        }}
                        title="Marcar como principal"
                        className="tap absolute left-1.5 top-1.5 rounded-md bg-background/80 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground opacity-90 transition-opacity hover:bg-background hover:text-foreground"
                      >
                        Hacer principal
                      </button>
                    )}

                    {/* Botones de acción rápida */}
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewModalImg(img.previewUrl);
                        }}
                        title="Ver imagen ampliada"
                        className="tap flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(img.id);
                        }}
                        title="Eliminar imagen"
                        className="tap flex h-6 w-6 items-center justify-center rounded-md bg-destructive/90 text-destructive-foreground shadow-sm hover:bg-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Indicaciones del Personalizado */}
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="custom-notes" className="text-xs font-semibold text-foreground">
              Indicaciones del personalizado
            </Label>
            <Textarea
              id="custom-notes"
              className="tap min-h-[64px] text-xs resize-none"
              placeholder="Ej. usar exactamente este diseño, cambiar nombre por María, hacerlo sin fondo, conservar proporciones…"
              value={customNotes}
              onChange={(e) => onCustomNotesChange(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Botón discreto para artículos no personalizados si aún no tienen imágenes */}
      {!isCustom && images.length === 0 && (
        <button
          type="button"
          onClick={() => onIsCustomChange(true)}
          className="tap inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir imagen de referencia o marcar como personalizado
        </button>
      )}

      {/* Modal Lightbox para ver imagen ampliada */}
      <Dialog open={!!previewModalImg} onOpenChange={(open) => !open && setPreviewModalImg(null)}>
        <DialogContent className="max-w-2xl p-2 bg-card/95 backdrop-blur-md">
          <div className="relative flex max-h-[80vh] items-center justify-center overflow-hidden rounded-lg">
            {previewModalImg && (
              <img
                src={previewModalImg}
                alt="Vista previa ampliada"
                className="max-h-[75vh] w-auto object-contain rounded"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
