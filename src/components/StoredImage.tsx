import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/storage";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImgRef = {
  id?: string;
  storage_path?: string | null;
  external_url?: string | null;
  label?: string;
};

export function useImgSrc(ref?: ImgRef | null | undefined) {
  const [src, setSrc] = useState<string | null>(ref?.external_url ?? null);
  useEffect(() => {
    let alive = true;
    if (ref?.external_url) {
      setSrc(ref.external_url);
      return;
    }
    if (!ref?.storage_path) {
      setSrc(null);
      return;
    }
    signedUrl(ref.storage_path).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [ref?.storage_path, ref?.external_url]);
  return src;
}

export function StoredImage({
  image,
  className,
  alt = "Imagen",
}: {
  image?: ImgRef | null | undefined;
  className?: string | undefined;
  alt?: string | undefined;
}) {

  const src = useImgSrc(image);
  if (!src)
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-secondary text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="h-5 w-5" aria-hidden />
      </div>
    );
  return <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}
