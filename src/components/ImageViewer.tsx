import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { StoredImage, useImgSrc, type ImgRef } from "./StoredImage";

export function ImageViewer({
  open,
  onOpenChange,
  images,
  title = "Imágenes",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  images: ImgRef[];
  title?: string;
}) {
  const [i, setI] = useState(0);
  const current = images[Math.min(i, images.length - 1)];
  const src = useImgSrc(current);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        {images.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">Sin imágenes</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline">{current?.label ?? "Imagen"}</Badge>
              <span className="text-sm text-muted-foreground">
                {Math.min(i + 1, images.length)} / {images.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="tap shrink-0"
                aria-label="Anterior"
                onClick={() => setI((v) => (v - 1 + images.length) % images.length)}
              >
                <ChevronLeft />
              </Button>
              <div className="flex max-h-[60vh] flex-1 items-center justify-center overflow-hidden rounded-lg bg-secondary">
                <StoredImage
                  image={current}
                  className="max-h-[60vh] w-full !object-contain"
                  alt={current?.label ?? "Imagen"}
                />
              </div>
              <Button
                size="icon"
                variant="secondary"
                className="tap shrink-0"
                aria-label="Siguiente"
                onClick={() => setI((v) => (v + 1) % images.length)}
              >
                <ChevronRight />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {images.map((im, idx) => (
                <button
                  key={idx}
                  onClick={() => setI(idx)}
                  className={`h-14 w-14 overflow-hidden rounded-md border-2 ${idx === i ? "border-primary" : "border-border"}`}
                  aria-label={`Ver imagen ${idx + 1}`}
                >
                  <StoredImage image={im} className="h-full w-full" />
                </button>
              ))}
            </div>
            {src && (
              <Button asChild variant="secondary" className="tap w-full">
                <a href={src} target="_blank" rel="noreferrer" download>
                  <Download className="mr-2 h-4 w-4" /> Ver / descargar en tamaño completo
                </a>
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
