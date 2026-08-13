import { useState, useRef } from "react";
import {
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Eye,
  Plus,
  Sparkles,
  AlertCircle,
  X,
  Camera,
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
    <div className="space-y-4 rounded-2xl border-2 border-border/80 bg-secondary/30 p-4 sm:p-5">
      {/* 1. Switch de Personalizado */}
      {showToggle && (
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label
              htmlFor="custom-switch"
              className="flex items-center gap-2 text-base font-bold text-foreground cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
              Este artículo es personalizado
            </Label>
            <p className="text-sm text-muted-foreground leading-snug">
              Para diseños específicos enviados por la clienta (logotipos, nombres, personajes o bocetos).
            </p>
          </div>
          <Switch
            id="custom-switch"
            checked={isCustom}
            onCheckedChange={onIsCustomChange}
            className="tap scale-110 shrink-0"
          />
        </div>
      )}

      {/* 2. Sección de Carga de Imágenes */}
      {(isCustom || images.length > 0) && (
        <div className="space-y-3.5 pt-2 animate-in fade-in-50 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              {isCustom ? "Diseño personalizado (Obligatorio)" : "Imágenes de referencia (Opcional)"}
            </h4>
            {isCustom && images.length === 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                <AlertCircle className="h-3.5 w-3.5" /> Requiere mín. 1 imagen
              </span>
            )}
            {images.length > 0 && (
              <span className="text-xs font-semibold text-muted-foreground">
                {images.length} {images.length === 1 ? "imagen cargada" : "imágenes cargadas"}
              </span>
            )}
          </div>

          {/* Botón Grande Táctil para Cargar Imagen en Móvil & Desktop */}
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
              "tap flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition-all",
              isDragging
                ? "border-primary bg-primary/10"
                : isCustom && images.length === 0
                ? "border-amber-500/60 bg-amber-500/10 hover:border-amber-400"
                : "border-border bg-card/80 hover:border-primary/60 hover:bg-card",
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
                e.target.value = "";
              }}
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Camera className="h-6 w-6" />
            </div>
            <p className="mt-3 text-base font-bold text-foreground">
              + AGREGAR IMAGEN DEL DISEÑO
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Toca para abrir cámara / galería o arrastra archivos aquí (JPG, PNG, WEBP)
            </p>
          </div>

          {/* Miniaturas Grandes de Imágenes Cargadas */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all",
                    img.is_primary ? "border-primary ring-2 ring-primary" : "border-border",
                  )}
                >
                  <div className="relative aspect-square w-full bg-secondary">
                    <img
                      src={img.previewUrl}
                      alt="Referencia personalizada"
                      className="h-full w-full object-contain p-1.5"
                    />

                    {/* Badge Principal */}
                    {img.is_primary ? (
                      <span className="absolute left-2 top-2 rounded-lg bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow-sm">
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
                        className="tap absolute left-2 top-2 rounded-lg bg-background/85 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-background hover:text-foreground border border-border/60"
                      >
                        Hacer principal
                      </button>
                    )}

                    {/* Botones de acción rápida táctiles */}
                    <div className="absolute right-2 top-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewModalImg(img.previewUrl);
                        }}
                        title="Ver imagen ampliada"
                        className="tap flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 text-foreground shadow-sm hover:bg-primary hover:text-primary-foreground border border-border/60"
                        aria-label="Ver imagen grande"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(img.id);
                        }}
                        title="Eliminar imagen"
                        className="tap flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/90 text-destructive-foreground shadow-sm hover:bg-destructive"
                        aria-label="Eliminar imagen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Indicaciones del Personalizado */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-sm font-semibold text-foreground">
              Indicaciones del personalizado (opcional)
            </Label>
            <Textarea
              className="tap min-h-[84px] text-base placeholder:text-muted-foreground/60 rounded-xl bg-card border-border"
              placeholder="Ej. Realizar exactamente con este diseño, cambiar nombre por Camila, grosor de línea 1.2mm..."
              value={customNotes}
              onChange={(e) => onCustomNotesChange(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Modal de Imagen Ampliada */}
      <Dialog open={!!previewModalImg} onOpenChange={(open) => !open && setPreviewModalImg(null)}>
        <DialogContent className="max-w-3xl border-border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className="font-display text-lg font-bold text-foreground">
              Vista previa del diseño
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="tap h-8 w-8"
              onClick={() => setPreviewModalImg(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex max-h-[75vh] items-center justify-center overflow-hidden rounded-xl bg-black/40 p-2">
            {previewModalImg && (
              <img
                src={previewModalImg}
                alt="Diseño personalizado ampliado"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
