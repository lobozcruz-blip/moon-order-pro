import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save, Trash2, UserPlus, ShieldCheck, Upload, Image as ImageIcon, Palette, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePriceRules, useInvalidate } from "@/lib/queries";
import { MODALITIES, SIZES, money, dateTimeFmt, type Modality } from "@/lib/cm";
import { useAuth } from "@/lib/auth";
import { logActivity, uploadFile, signedUrl } from "@/lib/storage";
import { listUsers, createUser, updateUser } from "@/lib/users.functions";
import { useActivity, useProfiles } from "@/lib/queries";
import { useWhatsappNumber } from "@/lib/shop-queries";
import { useBrand } from "@/lib/brand";
import { BrandLogo } from "@/components/BrandLogo";


export const Route = createFileRoute("/_authenticated/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración — Cookies Moon" },
      { name: "description", content: "Precios de cortadores, usuarios y bitácora del sistema." },
      { property: "og:title", content: "Configuración — Cookies Moon" },
      {
        property: "og:description",
        content: "Precios de cortadores, usuarios y bitácora del sistema.",
      },
    ],
  }),
  component: Configuracion,
});

function Configuracion() {
  const { isAdmin } = useAuth();

  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle={isAdmin ? "Administrador" : "Colaborador (sólo lectura en precios y usuarios)"}
      />
      <Tabs defaultValue="precios">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="precios" className="flex-1">
            Precios
          </TabsTrigger>
          <TabsTrigger value="tienda" className="flex-1">
            Tienda
          </TabsTrigger>
          <TabsTrigger value="marca" className="flex-1">
            Marca
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="flex-1">
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="bitacora" className="flex-1">
            Bitácora
          </TabsTrigger>
        </TabsList>
        <TabsContent value="precios">
          <Precios />
        </TabsContent>
        <TabsContent value="tienda">
          <TiendaConfig />
        </TabsContent>
        <TabsContent value="marca">
          <MarcaConfig />
        </TabsContent>
        <TabsContent value="usuarios">
          <Usuarios />
        </TabsContent>
        <TabsContent value="bitacora">
          <Bitacora />
        </TabsContent>
      </Tabs>
    </>
  );
}

function TiendaConfig() {
  const { isAdmin } = useAuth();
  const invalidate = useInvalidate();
  const { data: current } = useWhatsappNumber();
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setPhone(current ?? ""), [current]);

  const shopUrl = typeof window !== "undefined" ? `${window.location.origin}/tienda/acceso` : "";

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "whatsapp_number", value: phone.trim() }, { onConflict: "key" });
      if (error) throw error;
      invalidate("setting");
      toast.success("Número de WhatsApp guardado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-5">
        <h2 className="font-display text-lg">Enlace para tus clientas</h2>
        <p className="text-sm text-muted-foreground">
          Compárteles esta liga: se registran con su nombre y celular, arman su carrito y te mandan
          su número de pedido por WhatsApp.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={shopUrl} className="tap font-mono text-xs" />
          <Button
            variant="secondary"
            className="tap"
            onClick={() => {
              navigator.clipboard.writeText(shopUrl);
              toast.success("Enlace copiado");
            }}
          >
            Copiar
          </Button>
        </div>
      </div>

      <div className="panel space-y-3 p-5">
        <h2 className="font-display text-lg">WhatsApp del negocio</h2>
        <div className="space-y-2">
          <Label htmlFor="wa">Número (10 dígitos o con lada país)</Label>
          <Input
            id="wa"
            className="tap"
            inputMode="numeric"
            placeholder="55 1234 5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={!isAdmin}
          />
        </div>
        <Button className="tap font-semibold" onClick={save} disabled={!isAdmin || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}

function MarcaConfig() {
  const { isAdmin } = useAuth();
  const invalidate = useInvalidate();
  const { data: brand, isLoading } = useBrand();

  const [name, setName] = useState("Cookies Moon");
  const [slogan, setSlogan] = useState("");
  const [colorPrimary, setColorPrimary] = useState("#5CC6D0");
  const [colorSecondary, setColorSecondary] = useState("#7D421F");
  const [colorAccent, setColorAccent] = useState("#EFCE8B");

  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoAltPath, setLogoAltPath] = useState<string | null>(null);
  const [faviconPath, setFaviconPath] = useState<string | null>(null);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoAltPreview, setLogoAltPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLogoAlt, setUploadingLogoAlt] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (brand) {
      setName(brand.name || "Cookies Moon");
      setSlogan(brand.slogan || "");
      setColorPrimary(brand.colorPrimary || "#5CC6D0");
      setColorSecondary(brand.colorSecondary || "#7D421F");
      setColorAccent(brand.colorAccent || "#EFCE8B");
      setLogoPath(brand.logoPath || null);
      setLogoAltPath(brand.logoAltPath || null);
      setFaviconPath(brand.faviconPath || null);
    }
  }, [brand]);

  useEffect(() => {
    if (logoPath) signedUrl(logoPath).then(setLogoPreview);
    else setLogoPreview(null);
  }, [logoPath]);

  useEffect(() => {
    if (logoAltPath) signedUrl(logoAltPath).then(setLogoAltPreview);
    else setLogoAltPreview(null);
  }, [logoAltPath]);

  useEffect(() => {
    if (faviconPath) signedUrl(faviconPath).then(setFaviconPreview);
    else setFaviconPreview(null);
  }, [faviconPath]);

  const handleUpload = async (
    type: "logo" | "logoAlt" | "favicon",
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato no válido. Usa PNG, JPG, WEBP o SVG.");
      return;
    }

    if (type === "logo") setUploadingLogo(true);
    else if (type === "logoAlt") setUploadingLogoAlt(true);
    else setUploadingFavicon(true);

    try {
      const path = await uploadFile("marca", file);
      if (type === "logo") {
        setLogoPath(path);
        const url = await signedUrl(path);
        setLogoPreview(url);
      } else if (type === "logoAlt") {
        setLogoAltPath(path);
        const url = await signedUrl(path);
        setLogoAltPreview(url);
      } else {
        setFaviconPath(path);
        const url = await signedUrl(path);
        setFaviconPreview(url);
      }
      toast.success("Archivo subido. Haz clic en Guardar para aplicar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir la imagen");
    } finally {
      if (type === "logo") setUploadingLogo(false);
      else if (type === "logoAlt") setUploadingLogoAlt(false);
      else setUploadingFavicon(false);
    }
  };

  const handleRestoreDefaults = () => {
    setColorPrimary("#5CC6D0");
    setColorSecondary("#7D421F");
    setColorAccent("#EFCE8B");
    toast.info("Paleta oficial de Cookies Moon restaurada. Guarda para aplicar.");
  };

  const save = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: "brand_name", value: name.trim() || "Cookies Moon" },
        { key: "brand_slogan", value: slogan.trim() },
        { key: "brand_color_primary", value: colorPrimary },
        { key: "brand_color_secondary", value: colorSecondary },
        { key: "brand_color_accent", value: colorAccent },
        { key: "brand_logo", value: logoPath ?? "" },
        { key: "brand_logo_alt", value: logoAltPath ?? "" },
        { key: "brand_favicon", value: faviconPath ?? "" },
      ];

      for (const u of updates) {
        const { error } = await supabase
          .from("app_settings")
          .upsert({ key: u.key, value: u.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
      }

      await logActivity({
        action: "Identidad de marca actualizada",
        entity: "app_settings",
        detail: `Nombre: ${name}, Logo: ${logoPath ? "Configurado" : "Sin logo"}`,
      });

      invalidate("brand-settings", "brand-logo-url", "activity");
      toast.success("Identidad de marca guardada con éxito");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="panel p-8 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">Cargando identidad de marca…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Datos Principales */}
      <div className="panel space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg">Información de marca</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brand-name">Nombre comercial</Label>
            <Input
              id="brand-name"
              className="tap"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
              placeholder="Cookies Moon"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-slogan">Slogan o texto secundario (opcional)</Label>
            <Input
              id="brand-slogan"
              className="tap"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              disabled={!isAdmin}
              placeholder="Cortadores y repostería creativa"
            />
          </div>
        </div>
      </div>

      {/* 2. Logo y Archivos */}
      <div className="panel space-y-4 p-5">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg">Logos e imagen gráfica</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Formatos aceptados: PNG, JPG, WEBP, SVG. Se recomienda PNG o SVG con fondo transparente. El logo conservará siempre su proporción original.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Logo principal */}
          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-semibold">Logo principal</p>
            <p className="mb-3 text-xs text-muted-foreground">Usado en toda la app y catálogo.</p>
            <div className="flex h-32 items-center justify-center rounded-lg bg-secondary/60 p-2">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo principal"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 opacity-40" />
                  <span className="mt-1 text-xs">Sin logo cargado</span>
                </div>
              )}
            </div>
            {isAdmin && (
              <div className="mt-3 flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => handleUpload("logo", e)}
                    disabled={uploadingLogo}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="tap w-full"
                    disabled={uploadingLogo}
                    asChild
                  >
                    <span>
                      {uploadingLogo ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="mr-1 h-3.5 w-3.5" />
                      )}
                      {logoPreview ? "Reemplazar" : "Subir logo"}
                    </span>
                  </Button>
                </label>
                {logoPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="tap text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setLogoPath(null);
                      setLogoPreview(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Logo alternativo */}
          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-semibold">Logo alternativo</p>
            <p className="mb-3 text-xs text-muted-foreground">Versión secundaria (opcional).</p>
            <div className="flex h-32 items-center justify-center rounded-lg bg-secondary/60 p-2">
              {logoAltPreview ? (
                <img
                  src={logoAltPreview}
                  alt="Logo alternativo"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 opacity-40" />
                  <span className="mt-1 text-xs">Sin logo alternativo</span>
                </div>
              )}
            </div>
            {isAdmin && (
              <div className="mt-3 flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => handleUpload("logoAlt", e)}
                    disabled={uploadingLogoAlt}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="tap w-full"
                    disabled={uploadingLogoAlt}
                    asChild
                  >
                    <span>
                      {uploadingLogoAlt ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="mr-1 h-3.5 w-3.5" />
                      )}
                      {logoAltPreview ? "Reemplazar" : "Subir logo alt"}
                    </span>
                  </Button>
                </label>
                {logoAltPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="tap text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setLogoAltPath(null);
                      setLogoAltPreview(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Favicon */}
          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-semibold">Favicon</p>
            <p className="mb-3 text-xs text-muted-foreground">Icono de pestaña de navegador.</p>
            <div className="flex h-32 items-center justify-center rounded-lg bg-secondary/60 p-2">
              {faviconPreview ? (
                <img
                  src={faviconPreview}
                  alt="Favicon"
                  className="h-12 w-12 object-contain"
                />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 opacity-40" />
                  <span className="mt-1 text-xs">Sin favicon personalizado</span>
                </div>
              )}
            </div>
            {isAdmin && (
              <div className="mt-3 flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                    className="hidden"
                    onChange={(e) => handleUpload("favicon", e)}
                    disabled={uploadingFavicon}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="tap w-full"
                    disabled={uploadingFavicon}
                    asChild
                  >
                    <span>
                      {uploadingFavicon ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="mr-1 h-3.5 w-3.5" />
                      )}
                      {faviconPreview ? "Reemplazar" : "Subir favicon"}
                    </span>
                  </Button>
                </label>
                {faviconPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="tap text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setFaviconPath(null);
                      setFaviconPreview(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Paleta oficial de colores */}
      <div className="panel space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg">Paleta oficial Cookies Moon</h2>
          </div>
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="tap text-xs"
              onClick={handleRestoreDefaults}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Restaurar colores oficiales
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Principal */}
          <div className="space-y-2 rounded-xl border border-border p-3">
            <Label htmlFor="color-primary" className="text-xs font-semibold">
              Turquesa principal
            </Label>
            <div className="flex items-center gap-2">
              <input
                id="color-primary"
                type="color"
                value={colorPrimary}
                onChange={(e) => setColorPrimary(e.target.value)}
                disabled={!isAdmin}
                className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
              />
              <Input
                value={colorPrimary}
                onChange={(e) => setColorPrimary(e.target.value)}
                disabled={!isAdmin}
                className="tap font-mono text-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Color principal de interacción y botones.</p>
          </div>

          {/* Secundario */}
          <div className="space-y-2 rounded-xl border border-border p-3">
            <Label htmlFor="color-secondary" className="text-xs font-semibold">
              Café chocolate
            </Label>
            <div className="flex items-center gap-2">
              <input
                id="color-secondary"
                type="color"
                value={colorSecondary}
                onChange={(e) => setColorSecondary(e.target.value)}
                disabled={!isAdmin}
                className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
              />
              <Input
                value={colorSecondary}
                onChange={(e) => setColorSecondary(e.target.value)}
                disabled={!isAdmin}
                className="tap font-mono text-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Detalles de marca y contrastes cálidos.</p>
          </div>

          {/* Acento */}
          <div className="space-y-2 rounded-xl border border-border p-3">
            <Label htmlFor="color-accent" className="text-xs font-semibold">
              Beige galleta
            </Label>
            <div className="flex items-center gap-2">
              <input
                id="color-accent"
                type="color"
                value={colorAccent}
                onChange={(e) => setColorAccent(e.target.value)}
                disabled={!isAdmin}
                className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
              />
              <Input
                value={colorAccent}
                onChange={(e) => setColorAccent(e.target.value)}
                disabled={!isAdmin}
                className="tap font-mono text-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Acentos, fondos suaves y detalles.</p>
          </div>
        </div>
      </div>

      {/* 4. Vista previa en vivo */}
      <div className="panel space-y-4 p-5">
        <h2 className="font-display text-lg">Vista previa en vivo</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* App interna (Dark) */}
          <div className="space-y-2 rounded-xl border border-border bg-background p-4">
            <span className="chip bg-primary/20 text-xs font-bold text-primary">
              App interna (Tema oscuro)
            </span>
            <div className="flex items-center justify-between border-b border-border py-3">
              <BrandLogo size="sm" showName />
              <span className="text-xs text-muted-foreground">Panel de taller</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Fondo oscuro #0F1117 con tarjetas #181C25 y botones turquesa.
            </p>
          </div>

          {/* Catálogo de clientas (Light) */}
          <div className="theme-shop space-y-2 rounded-xl border border-border bg-background p-4 text-foreground">
            <span className="chip bg-primary/20 text-xs font-bold text-primary">
              Catálogo clientas (Tema claro)
            </span>
            <div className="flex items-center justify-between border-b border-border py-3">
              <BrandLogo size="sm" showName />
              <span className="text-xs text-muted-foreground">Tienda en línea</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Fondo blanco limpio con acentos turquesa y café para las clientas.
            </p>
          </div>
        </div>
      </div>

      {/* Botón Guardar */}
      {isAdmin && (
        <Button className="tap font-semibold" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar identidad de marca
        </Button>
      )}
    </div>
  );
}


function Precios() {
  const { data: rules } = usePriceRules();
  const invalidate = useInvalidate();
  const { isAdmin } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!rules) return;
    const v: Record<string, string> = {};
    for (const r of rules) v[`${r.modality}-${r.size_cm}`] = String(r.price);
    setValues(v);
  }, [rules]);

  const save = async () => {
    setSaving(true);
    try {
      for (const r of rules ?? []) {
        const key = `${r.modality}-${r.size_cm}`;
        const next = Number(values[key] ?? r.price);
        if (next !== Number(r.price)) {
          const { error } = await supabase
            .from("cutter_price_rules")
            .update({ price: next })
            .eq("id", r.id);
          if (error) throw error;
          await logActivity({
            action: "Precio actualizado",
            entity: "cutter_price_rule",
            old_value: String(r.price),
            new_value: String(next),
            detail: `${r.modality} ${r.size_cm} cm`,
          });
        }
      }
      toast.success("Precios guardados. Los pedidos existentes conservan su precio original.");
      invalidate("cutter-prices", "activity");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel p-4">
      <h2 className="font-display text-lg">Tabla de precios de cortadores</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        De 5 a 20 cm. Cambiar un precio no modifica pedidos ya registrados.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2">Tamaño</th>
              {MODALITIES.map((m) => (
                <th key={m.value} className="py-2">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZES.map((size) => (
              <tr key={size} className="border-t border-border">
                <td className="py-2 font-medium">{size} cm</td>
                {MODALITIES.map((m) => {
                  const key = `${m.value}-${size}`;
                  return (
                    <td key={m.value} className="py-2 pr-3">
                      {isAdmin ? (
                        <Input
                          className="tap h-10 w-28"
                          inputMode="decimal"
                          value={values[key] ?? ""}
                          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                        />
                      ) : (
                        money(Number(values[key] ?? 0))
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isAdmin && (
        <Button onClick={save} disabled={saving} className="tap mt-4 font-semibold">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar precios
        </Button>
      )}
      <DemoData />
    </div>
  );
}

function DemoData() {
  const { isAdmin } = useAuth();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  if (!isAdmin) return null;
  return (
    <div className="mt-6 rounded-xl border border-destructive/40 p-4">
      <h3 className="font-display">Datos de demostración</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Elimina todos los clientes, productos y pedidos marcados como demo. No afecta la
        información real.
      </p>
      <Button
        variant="destructive"
        className="tap mt-3"
        disabled={busy}
        onClick={async () => {
          if (!confirm("¿Eliminar todos los datos de demostración?")) return;
          setBusy(true);
          const { error } = await supabase.rpc("purge_demo_data");
          setBusy(false);
          if (error) {
            toast.error(error.message);
            return;
          }
          toast.success("Datos de demostración eliminados");
          invalidate("orders", "products", "customers", "activity");
        }}
      >
        <Trash2 className="mr-2 h-4 w-4" /> Borrar datos demo
      </Button>
    </div>
  );
}

function Usuarios() {
  const { isAdmin } = useAuth();
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => listUsers(), enabled: isAdmin });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "colaborador">("colaborador");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"trabajadores" | "admin" | "colaborador" | "clientes" | "todos">("trabajadores");
  const [search, setSearch] = useState("");

  if (!isAdmin)
    return (
      <div className="panel p-6 text-center text-sm text-muted-foreground">
        Sólo los administradores pueden gestionar usuarios y trabajadores.
      </div>
    );

  const add = async () => {
    setBusy(true);
    try {
      await createUser({ data: { email, password, fullName: name, role } });
      toast.success("Trabajador creado exitosamente");
      setEmail("");
      setName("");
      setPassword("");
      usersQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setBusy(false);
    }
  };

  const data = usersQuery.data;
  const workers = data?.workers ?? [];
  const clients = data?.clients ?? [];

  const filteredList = (() => {
    let list = data?.all ?? [];
    if (filter === "trabajadores") list = workers;
    else if (filter === "admin") list = workers.filter((w) => w.role === "admin");
    else if (filter === "colaborador") list = workers.filter((w) => w.role === "colaborador");
    else if (filter === "clientes") list = clients;

    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.phone ?? "").includes(term),
    );
  })();

  return (
    <div className="space-y-6">
      {/* 1. Nuevo Trabajador */}
      <div className="panel p-5">
        <h2 className="mb-1 font-display text-lg">Nuevo trabajador autorizado</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Los trabajadores tienen acceso a la app interna del taller según su rol asignado.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre completo *</Label>
            <Input className="tap" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Correo electrónico *</Label>
            <Input className="tap" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Contraseña temporal (8+ caracteres) *</Label>
            <Input className="tap" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Rol del trabajador</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "colaborador")}>
              <SelectTrigger className="tap">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="colaborador">Colaborador (producción y pedidos)</SelectItem>
                <SelectItem value="admin">Administrador (acceso total)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={add} disabled={busy} className="tap mt-4 font-semibold">
          <UserPlus className="mr-2 h-4 w-4" /> Crear trabajador
        </Button>
      </div>

      {/* 2. Directorio de Usuarios */}
      <div className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">Directorio de usuarios</h2>
            <p className="text-xs text-muted-foreground">
              {workers.length} trabajadores registrados · {clients.length} clientes en base de datos
            </p>
          </div>
          <Input
            placeholder="Buscar por nombre, correo o celular..."
            className="tap w-full sm:w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filtros de grupo */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("trabajadores")}
            className={`chip border border-border ${
              filter === "trabajadores"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground"
            }`}
          >
            Trabajadores ({workers.length})
          </button>
          <button
            onClick={() => setFilter("admin")}
            className={`chip border border-border ${
              filter === "admin"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground"
            }`}
          >
            Admins ({workers.filter((w) => w.role === "admin").length})
          </button>
          <button
            onClick={() => setFilter("colaborador")}
            className={`chip border border-border ${
              filter === "colaborador"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground"
            }`}
          >
            Colaboradores ({workers.filter((w) => w.role === "colaborador").length})
          </button>
          <button
            onClick={() => setFilter("clientes")}
            className={`chip border border-border ${
              filter === "clientes"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground"
            }`}
          >
            Clientes ({clients.length})
          </button>
          <button
            onClick={() => setFilter("todos")}
            className={`chip border border-border ${
              filter === "todos"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground"
            }`}
          >
            Todos ({data?.all?.length ?? 0})
          </button>
        </div>

        <div className="space-y-2">
          {filteredList.map((u) => (
            <div
              key={`${u.user_type}-${u.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary p-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{u.full_name || u.email}</p>
                  {u.user_type === "trabajador" ? (
                    <span
                      className={`chip text-[10px] ${
                        u.role === "admin"
                          ? "bg-primary/20 text-primary font-bold"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {u.role === "admin" ? "ADMIN" : "COLABORADOR"}
                    </span>
                  ) : (
                    <span
                      className={`chip text-[10px] ${
                        u.has_account
                          ? "bg-emerald-500/20 text-emerald-400 font-semibold"
                          : "bg-amber-500/20 text-amber-400 font-semibold"
                      }`}
                    >
                      {u.has_account ? "CLIENTE CON CUENTA" : "CLIENTE SIN CUENTA"}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {u.user_type === "trabajador" ? u.email : `Celular: ${u.phone ?? "—"}`}
                </p>
              </div>

              {u.user_type === "trabajador" ? (
                <div className="flex items-center gap-3">
                  <Select
                    value={u.role}
                    onValueChange={async (v) => {
                      await updateUser({ data: { userId: u.id, role: v as "admin" | "colaborador" } });
                      toast.success("Rol de trabajador actualizado");
                      usersQuery.refetch();
                    }}
                  >
                    <SelectTrigger className="tap w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="colaborador">Colaborador</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Activo
                    <Switch
                      checked={u.active}
                      onCheckedChange={async (v) => {
                        await updateUser({ data: { userId: u.id, active: v } });
                        usersQuery.refetch();
                      }}
                    />
                  </label>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {u.has_account ? "Acceso al catálogo activado" : "Pendiente de crear contraseña"}
                </span>
              )}
            </div>
          ))}

          {filteredList.length === 0 && !usersQuery.isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron usuarios en esta categoría.
            </p>
          )}
          {usersQuery.isLoading && <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-primary" />}
        </div>
      </div>
    </div>
  );
}

function Bitacora() {
  const { data: activity } = useActivity();
  const { data: profiles } = useProfiles();
  return (
    <div className="panel p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg">
        <ShieldCheck className="h-4 w-4 text-primary" /> Bitácora del sistema
      </h2>
      <div className="space-y-2">
        {(activity ?? []).map((a) => (
          <div key={a.id} className="rounded-lg bg-secondary p-3 text-xs">
            <p className="font-medium">{a.action}</p>
            <p className="text-muted-foreground">
              {profiles?.find((p) => p.id === a.user_id)?.full_name ?? "Sistema"} ·{" "}
              {dateTimeFmt(a.created_at)}
              {a.detail ? ` · ${a.detail}` : ""}
              {a.old_value || a.new_value ? ` · ${a.old_value ?? "—"} → ${a.new_value ?? "—"}` : ""}
            </p>
          </div>
        ))}
        {(activity ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin movimientos.</p>
        )}
      </div>
    </div>
  );
}

export type { Modality };
