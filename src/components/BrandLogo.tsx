import { Cookie } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrandLogo, useBrandName } from "@/lib/brand";

const SIZES = {
  sm: { box: "h-8 w-8", icon: "h-4 w-4", img: "h-8", text: "text-base" },
  md: { box: "h-11 w-11", icon: "h-5 w-5", img: "h-11", text: "text-lg" },
  lg: { box: "h-14 w-14", icon: "h-7 w-7", img: "h-14", text: "text-3xl" },
} as const;

export function BrandLogo({
  size = "sm",
  showName = false,
  className,
}: {
  size?: keyof typeof SIZES;
  showName?: boolean;
  className?: string;
}) {
  const { data: logoUrl } = useBrandLogo();
  const brandName = useBrandName();
  const s = SIZES[size];

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={brandName}
          crossOrigin="anonymous"
          className={cn(s.img, "w-auto object-contain")}
          style={{ maxHeight: "inherit" }}
        />
      ) : (
        <span
          className={cn(
            s.box,
            "flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground",
          )}
        >
          <Cookie className={s.icon} />
        </span>
      )}
      {showName && (
        <span className={cn("font-display leading-tight", s.text)}>
          {brandName}
        </span>
      )}
    </span>
  );
}
