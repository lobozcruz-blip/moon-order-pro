import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signedUrl } from "@/lib/storage";

export type BrandSettings = {
  logoPath: string | null;
  logoAltPath: string | null;
  faviconPath: string | null;
  name: string;
  slogan: string | null;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
};

const DEFAULTS: BrandSettings = {
  logoPath: null,
  logoAltPath: null,
  faviconPath: null,
  name: "Cookies Moon",
  slogan: null,
  colorPrimary: "#5CC6D0",
  colorSecondary: "#7D421F",
  colorAccent: "#EFCE8B",
};

const KEY_MAP: Record<string, keyof BrandSettings> = {
  brand_logo: "logoPath",
  brand_logo_alt: "logoAltPath",
  brand_favicon: "faviconPath",
  brand_name: "name",
  brand_slogan: "slogan",
  brand_color_primary: "colorPrimary",
  brand_color_secondary: "colorSecondary",
  brand_color_accent: "colorAccent",
};

/** Fetches all brand_* keys from app_settings and returns BrandSettings. */
export function useBrand() {
  return useQuery({
    queryKey: ["brand-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .like("key", "brand_%");
      if (error) throw error;
      const settings = { ...DEFAULTS };
      for (const row of data ?? []) {
        const prop = KEY_MAP[row.key];
        if (prop && row.value) (settings as any)[prop] = row.value;
      }
      return settings;
    },
    staleTime: 600_000,
  });
}

/** Lightweight hook that only returns the logo signed URL. */
export function useBrandLogo() {
  const { data: brand } = useBrand();
  return useQuery({
    queryKey: ["brand-logo-url", brand?.logoPath],
    queryFn: () => signedUrl(brand?.logoPath),
    enabled: !!brand?.logoPath,
    staleTime: 600_000,
  });
}

/** Returns the brand name, with fallback. */
export function useBrandName() {
  const { data } = useBrand();
  return data?.name ?? DEFAULTS.name;
}

/** Updates dynamic favicon link tag in the document head when configured. */
export function useBrandFavicon() {
  const { data: brand } = useBrand();
  const { data: faviconUrl } = useQuery({
    queryKey: ["brand-favicon-url", brand?.faviconPath],
    queryFn: () => signedUrl(brand?.faviconPath),
    enabled: !!brand?.faviconPath,
    staleTime: 600_000,
  });

  useEffect(() => {
    if (!faviconUrl) return;
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }, [faviconUrl]);
}

