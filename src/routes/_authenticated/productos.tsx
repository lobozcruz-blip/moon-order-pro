import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, ImagePlus, Star, X, Tag, Sparkles, Check, Settings2, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  useProducts,
  useProductPendingOrders,
  usePriceRules,
  priceFor,
  useInvalidate,
  nextSku,
  useProductSalesCounts,
  useProductOrderMetrics,
  useProductThemes,
  saveProductThemeLinks,
  createProductTheme,
  updateProductTheme,
  deleteProductTheme,
  type ProductTheme,
} from "@/lib/queries";
import {
  CATEGORIES,
  CATEGORY_META,
  MODALITIES,
  SIZES,
  money,
  fullName,
  dateFmt,
  getOrderPaymentCategory,
  STATUS_META,
  PRIORITIES,
  type Category,
  type Modality,
} from "@/lib/cm";
import { uploadFile, removeFile, logActivity } from "@/lib/storage";
import { StoredImage, type ImgRef } from "@/components/StoredImage";
import { ImageViewer } from "@/components/ImageViewer";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/productos")({
  head: () => ({
    meta: [
      { title: "Catálogo de productos — Cookies Moon" },
      { name: "description", content: "Catálogo interno de cortadores, stencils, cajas y otros." },
      { property: "og:title", content: "Catálogo de productos — Cookies Moon" },
      {
        property: "og:description",
        content: "Catálogo interno de cortadores, stencils, cajas y otros.",
      },
    ],
  }),
  component: Productos,
});

type Draft = {
  id?: string;
  sku: string;
  name: string;
  category: Category;
  description: string;
  manufacturing_notes: string;
  base_price: string;
  active: boolean;
  cutter_modality: Modality;
  cutter_size_cm: number;
  theme_ids: string[];
};

const empty: Draft = {
  sku: "",
  name: "",
  category: "CORTADORES",
  description: "",
  manufacturing_notes: "",
  base_price: "",
  active: true,
  cutter_modality: "cutter_only",
  cutter_size_cm: 8,
  theme_ids: [],
};

function Productos() {
  const { data: products, isLoading } = useProducts();
  const { data: rules } = usePriceRules();
  const { data: sales } = useProductSalesCounts();
  const { data: orderMetrics } = useProductOrderMetrics();
  const { data: themes = [] } = useProductThemes(true);
  const invalidate = useInvalidate();
  const { isAdmin } = useAuth();

  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
  const { data: productOrders, isLoading: loadingOrders, isError: ordersError } = useProductPendingOrders(selectedProduct?.id);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "TODAS">("TODAS");
  const [themeFilter, setThemeFilter] = useState<string>("TODAS");
  const [onlyActive, setOnlyActive] = useState(false);
  const [open, setOpen] = useState(false);
  const [openThemesDialog, setOpenThemesDialog] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [viewer, setViewer] = useState<{ images: ImgRef[]; title: string } | null>(null);

  // Estados para gestión de temáticas
  const [newThemeName, setNewThemeName] = useState("");
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [editingThemeName, setEditingThemeName] = useState("");
  const [savingTheme, setSavingTheme] = useState(false);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      if (cat !== "TODAS" && p.category !== cat) return false;
      if (onlyActive && !p.active) return false;
      if (themeFilter !== "TODAS") {
        const hasTheme = (p.product_theme_links ?? []).some((tl: any) => tl.theme_id === themeFilter);
        if (!hasTheme) return false;
      }
      if (!term) return true;
      const matchSku = p.sku.toLowerCase().includes(term);
      const matchName = p.name.toLowerCase().includes(term);
      const matchDesc = (p.description ?? "").toLowerCase().includes(term);
      const matchTheme = (p.product_theme_links ?? []).some((tl: any) =>
        (tl.product_themes?.name ?? "").toLowerCase().includes(term),
      );
      return matchSku || matchName || matchDesc || matchTheme;
    });
  }, [products, q, cat, themeFilter, onlyActive]);

  const openNew = async () => {
    const sku = await nextSku("CORTADORES");
    setDraft({ ...empty, sku, theme_ids: [] });
    setFiles([]);
    setOpen(true);
  };

  const openEdit = (p: any) => {
    const theme_ids = (p.product_theme_links ?? []).map((tl: any) => tl.theme_id);
    setDraft({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      description: p.description ?? "",
      manufacturing_notes: p.manufacturing_notes ?? "",
      base_price: p.base_price != null ? String(p.base_price) : "",
      active: p.active,
      cutter_modality: "cutter_only",
      cutter_size_cm: 8,
      theme_ids,
    });
    setFiles([]);
    setOpen(true);
  };

  const onCategoryChange = async (c: Category) => {
    const sku = draft.id ? draft.sku : await nextSku(c);
    setDraft({ ...draft, category: c, sku });
  };

  const toggleThemeInDraft = (themeId: string) => {
    setDraft((prev) => ({
      ...prev,
      theme_ids: prev.theme_ids.includes(themeId)
        ? prev.theme_ids.filter((id) => id !== themeId)
        : [...prev.theme_ids, themeId],
    }));
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        sku: draft.sku.trim(),
        name: draft.name.trim(),
        category: draft.category,
        description: draft.description.trim() || null,
        manufacturing_notes: draft.manufacturing_notes.trim() || null,
        base_price:
          draft.category === "CORTADORES"
            ? null
            : parseFloat(String(draft.base_price || 0).replace(',', '.')) || 0,
        active: draft.active,
      };
      let id = draft.id;
      if (id) {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }

      // Guardar vínculos de temáticas
      await saveProductThemeLinks(id!, draft.theme_ids);

      for (const f of files) {
        const storage_path = await uploadFile("catalogo", f, id!);
        await supabase.from("product_images").insert({ product_id: id!, storage_path });
      }

      await logActivity({
        action: draft.id ? "Producto actualizado" : "Producto creado",
        entity: "product",
        product_id: id ?? null,
        detail: `${payload.sku} · ${payload.name}`,
      });
      toast.success("Producto guardado");
      setOpen(false);
      setFiles([]);
      setDraft(empty);
      invalidate("products", "activity");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}" del catálogo?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity({ action: "Producto eliminado", entity: "product", detail: name });
    toast.success("Producto eliminado");
    invalidate("products", "activity");
  };

  const deleteImage = async (imgId: string, path: string | null) => {
    await supabase.from("product_images").delete().eq("id", imgId);
    if (path) await removeFile(path);
    invalidate("products");
  };

  const setPrimary = async (productId: string, imgId: string) => {
    await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
    await supabase.from("product_images").update({ is_primary: true }).eq("id", imgId);
    invalidate("products");
  };

  // Funciones de gestión de temáticas
  const handleCreateTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThemeName.trim()) return;
    setSavingTheme(true);
    try {
      await createProductTheme(newThemeName.trim());
      setNewThemeName("");
      toast.success("Temática creada");
      invalidate("product-themes", "products");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear temática");
    } finally {
      setSavingTheme(false);
    }
  };

  const handleUpdateTheme = async (theme: ProductTheme) => {
    if (!editingThemeName.trim()) return;
    try {
      await updateProductTheme(theme.id, { name: editingThemeName.trim() });
      setEditingThemeId(null);
      toast.success("Temática actualizada");
      invalidate("product-themes", "products");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar temática");
    }
  };

  const handleToggleTheme = async (theme: ProductTheme) => {
    try {
      await updateProductTheme(theme.id, { active: !theme.active });
      invalidate("product-themes", "products");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar estado");
    }
  };

  const handleDeleteTheme = async (theme: ProductTheme) => {
    if (!confirm(`¿Eliminar la temática "${theme.name}"?`)) return;
    try {
      await deleteProductTheme(theme.id);
      toast.success("Temática eliminada");
      invalidate("product-themes", "products");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la temática");
    }
  };

  const autoPrice = priceFor(rules, draft.cutter_modality, draft.cutter_size_cm);
  const activeThemes = themes.filter((t) => t.active);

  return (
    <>
      <PageHeader
        title="Catálogo"
        subtitle={`${(products ?? []).length} productos en total`}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="tap font-medium"
              onClick={() => setOpenThemesDialog(true)}
            >
              <Tag className="mr-1.5 h-4 w-4 text-primary" /> Temáticas
            </Button>
            <Button className="tap font-semibold" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Nuevo producto
            </Button>
          </div>
        }
      />

      <div className="mb-4 space-y-3">
        {/* Buscador */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="tap pl-9"
            placeholder="Buscar por SKU, nombre, descripción o temática (ej. COR-01, Navidad)..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* Filtros: Categoría y Temática */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Categorías */}
          {(["TODAS", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "chip border border-border transition-colors",
                cat === c ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground",
              )}
            >
              {c === "TODAS" ? "Todas" : CATEGORY_META[c].label}
            </button>
          ))}

          {/* Selector de Temática */}
          <Select value={themeFilter} onValueChange={setThemeFilter}>
            <SelectTrigger className="tap h-8 w-48 text-xs">
              <Tag className="mr-1.5 h-3.5 w-3.5 text-primary" />
              <SelectValue placeholder="Temática: Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas las temáticas</SelectItem>
              {activeThemes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(q || cat !== "TODAS" || themeFilter !== "TODAS") && (
            <button
              onClick={() => {
                setQ("");
                setCat("TODAS");
                setThemeFilter("TODAS");
              }}
              className="chip border border-destructive/40 text-destructive text-xs hover:bg-destructive/10"
            >
              <X className="mr-1 h-3 w-3" /> Limpiar filtros
            </button>
          )}

          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={onlyActive} onCheckedChange={setOnlyActive} /> Sólo activos
          </label>
        </div>
      </div>

      <div className="mb-2 text-xs text-muted-foreground">
        {rows.length} producto(s) encontrado(s)
      </div>

      {/* Grid de productos */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {rows.map((p) => {
          const imgs = (p.product_images ?? []).slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
          const prodThemes = (p.product_theme_links ?? [])
            .map((tl: any) => tl.product_themes?.name)
            .filter(Boolean);

          return (
            <div key={p.id} className="panel flex flex-col overflow-hidden">
              <button
                className="block aspect-square w-full bg-secondary"
                onClick={() => imgs.length && setViewer({ images: imgs, title: p.name })}
              >
                {imgs[0] ? (
                  <StoredImage image={imgs[0]} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Sin imagen
                  </span>
                )}
              </button>
              <div className="flex flex-1 flex-col p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="chip text-[11px]"
                    style={{
                      color: `var(--${CATEGORY_META[p.category].token})`,
                      background: `color-mix(in oklab, var(--${CATEGORY_META[p.category].token}) 16%, transparent)`,
                    }}
                  >
                    {CATEGORY_META[p.category].label}
                  </span>
                  {!p.active && <span className="chip bg-secondary text-[11px] text-muted-foreground">Inactivo</span>}
                </div>

                <button className="mt-2 text-left text-sm font-semibold hover:underline" onClick={() => setSelectedProduct(p)}>{p.name}</button>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setSelectedProduct(p)}>Ver pedidos pendientes</Button>
                <p className="text-xs text-muted-foreground">{p.sku}</p>

                {/* Temáticas del producto */}
                {prodThemes.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {prodThemes.map((tName: string) => (
                      <span key={tName} className="chip bg-secondary/80 text-[10px] text-muted-foreground">
                        {tName}
                      </span>
                    ))}
                  </div>
                )}

                {/* Precio base o por tamaño */}
                <div className="mt-auto pt-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    {p.category === "CORTADORES"
                      ? "Precio por tamaño"
                      : money(p.base_price)}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {sales?.[p.id] ?? 0} vendidas
                  </span>
                </div>

                {/* Desglose de piezas en pedidos según estado de pago */}
                {(() => {
                  const m = orderMetrics?.[p.id] || { total: 0, pagados: 0, adelanto: 0, sinPagar: 0 };
                  return (
                    <div className="mt-2 rounded-xl border border-border/70 bg-card/70 p-2 text-[11px] space-y-1.5 shadow-sm">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium flex items-center gap-1">
                          <Package className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>En pedidos:</span>
                        </span>
                        <span className="font-bold text-foreground">{m.total} pzas</span>
                      </div>

                      <div className="grid grid-cols-3 gap-1 pt-1 border-t border-border/50 text-[10px] text-center">
                        <div
                          className="rounded-lg bg-emerald-500/10 px-1 py-1 text-emerald-700 dark:text-emerald-400 font-semibold"
                          title={`${m.pagados} piezas en pedidos 100% liquidados`}
                        >
                          <span className="block text-xs font-bold leading-tight">{m.pagados}</span>
                          <span className="text-[9px] font-medium opacity-85">Pagados</span>
                        </div>
                        <div
                          className="rounded-lg bg-amber-500/10 px-1 py-1 text-amber-700 dark:text-amber-400 font-semibold"
                          title={`${m.adelanto} piezas en pedidos con anticipo o pago parcial`}
                        >
                          <span className="block text-xs font-bold leading-tight">{m.adelanto}</span>
                          <span className="text-[9px] font-medium opacity-85">Adelanto</span>
                        </div>
                        <div
                          className="rounded-lg bg-rose-500/10 px-1 py-1 text-rose-700 dark:text-rose-400 font-semibold"
                          title={`${m.sinPagar} piezas en pedidos aún sin pagar`}
                        >
                          <span className="block text-xs font-bold leading-tight">{m.sinPagar}</span>
                          <span className="text-[9px] font-medium opacity-85">Cotizaciones</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="mt-2 flex items-center gap-1 border-t border-border/50 pt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="tap h-8 w-8"
                    aria-label="Editar"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="tap h-8 w-8"
                      aria-label="Eliminar"
                      onClick={() => remove(p.id, p.name)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                  <div className="ml-auto flex gap-1">
                    {imgs.slice(0, 3).map((im) => (
                      <span key={im.id} className="relative">
                        <button
                          onClick={() => setPrimary(p.id, im.id)}
                          aria-label="Marcar como principal"
                          className="block h-7 w-7 overflow-hidden rounded border border-border"
                        >
                          <StoredImage image={im} alt="" className="h-full w-full object-cover" />
                        </button>
                        {im.is_primary && (
                          <Star className="absolute -right-1 -top-1 h-3 w-3 fill-primary text-primary" />
                        )}
                        <button
                          onClick={() => deleteImage(im.id, im.storage_path)}
                          aria-label="Quitar imagen"
                          className="absolute -left-1 -top-1 rounded-full bg-destructive p-0.5"
                        >
                          <X className="h-2.5 w-2.5 text-destructive-foreground" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!isLoading && rows.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No hay productos que coincidan con la búsqueda y filtros.
          </p>
        )}
      </div>

      {/* Modal Crear / Editar Producto */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {draft.id ? "Editar producto" : "Nuevo producto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input className="tap" value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={draft.category} onValueChange={(v) => onCategoryChange(v as Category)}>
                  <SelectTrigger className="tap">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_META[c].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nombre del producto *</Label>
              <Input className="tap" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>

            {/* Selector múltiple de temáticas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Temáticas (selecciona una o varias)</Label>
                <span className="text-xs text-muted-foreground">{draft.theme_ids.length} seleccionada(s)</span>
              </div>
              <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border p-2.5">
                {activeThemes.map((t) => {
                  const selected = draft.theme_ids.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleThemeInDraft(t.id)}
                      className={cn(
                        "chip border transition-all text-xs",
                        selected
                          ? "border-primary bg-primary text-primary-foreground font-bold shadow-sm"
                          : "border-border text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {selected && <Check className="mr-1 h-3 w-3 inline" />}
                      {t.name}
                    </button>
                  );
                })}
                {activeThemes.length === 0 && (
                  <p className="text-xs text-muted-foreground">No hay temáticas activas registradas.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Notas de fabricación</Label>
              <Textarea rows={2} value={draft.manufacturing_notes} onChange={(e) => setDraft({ ...draft, manufacturing_notes: e.target.value })} />
            </div>

            {draft.category === "CORTADORES" ? (
              <div className="rounded-xl border border-border bg-secondary p-3">
                <p className="text-xs text-muted-foreground">
                  Los cortadores no tienen precio fijo: el precio se calcula al agregarlos a un
                  pedido según tamaño y modalidad. Simulador:
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Select
                    value={draft.cutter_modality}
                    onValueChange={(v) => setDraft({ ...draft, cutter_modality: v as Modality })}
                  >
                    <SelectTrigger className="tap">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODALITIES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(draft.cutter_size_cm)}
                    onValueChange={(v) => setDraft({ ...draft, cutter_size_cm: Number(v) })}
                  >
                    <SelectTrigger className="tap">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZES.map((s) => (
                        <SelectItem key={s} value={String(s)}>
                          {s} cm
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-center rounded-md bg-background font-display text-lg">
                    {money(autoPrice)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Precio base ($)</Label>
                <Input
                  className="tap"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={draft.base_price}
                  onChange={(e) => setDraft({ ...draft, base_price: e.target.value })}
                />
              </div>
            )}

            <label className="tap flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              <ImagePlus className="h-4 w-4" />
              {files.length ? `${files.length} imagen(es) seleccionada(s)` : "Agregar imágenes"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>

            <label className="flex items-center justify-between text-sm">
              Producto activo
              <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
            </label>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving} className="tap w-full font-semibold">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar producto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Administración de Temáticas */}
      <Dialog open={openThemesDialog} onOpenChange={setOpenThemesDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <Tag className="h-5 w-5 text-primary" /> Administración de Temáticas
            </DialogTitle>
          </DialogHeader>

          {/* Formulario crear temática */}
          <form onSubmit={handleCreateTheme} className="flex gap-2">
            <Input
              placeholder="Nueva temática (ej. Graduación)..."
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              className="tap flex-1"
            />
            <Button type="submit" disabled={savingTheme || !newThemeName.trim()} className="tap font-semibold">
              <Plus className="mr-1 h-4 w-4" /> Agregar
            </Button>
          </form>

          {/* Lista de temáticas */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Temáticas registradas ({themes.length})
            </h3>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {themes.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-secondary p-2.5 text-sm"
                >
                  {editingThemeId === t.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        value={editingThemeName}
                        onChange={(e) => setEditingThemeName(e.target.value)}
                        className="tap h-8 text-sm"
                        autoFocus
                      />
                      <Button size="sm" className="tap h-8" onClick={() => handleUpdateTheme(t)}>
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="tap h-8"
                        onClick={() => setEditingThemeId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className={cn("font-medium", !t.active && "text-muted-foreground line-through")}>
                          {t.name}
                        </span>
                        {!t.active && <span className="chip bg-muted text-[10px] text-muted-foreground">Inactiva</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="tap h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingThemeId(t.id);
                            setEditingThemeName(t.name);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Switch checked={t.active} onCheckedChange={() => handleToggleTheme(t)} />
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="tap h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteTheme(t)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedProduct} onOpenChange={v => !v && setSelectedProduct(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{selectedProduct?.name} · Pedidos pendientes</DialogTitle></DialogHeader>
          {loadingOrders && <p>Cargando pedidos…</p>}
          {ordersError && <p role="alert">No se pudieron cargar los pedidos. Cierra y vuelve a abrir para reintentar.</p>}
          {!loadingOrders && !ordersError && !productOrders?.length && <p>No hay pedidos pendientes para este producto.</p>}
          {([false, true] as const).map(quotation => {
            const rows = (productOrders ?? []).filter(o => (getOrderPaymentCategory(o) === "sin_pago") === quotation);
            if (!rows.length) return null;
            return <section key={String(quotation)} className="space-y-2">
              <h3 className="font-semibold">{quotation ? "Cotizaciones · sin pago" : "Pedidos · con pago o adelanto"}</h3>
              {rows.map(o => <Link key={o.id} to="/pedidos/$orderId" params={{ orderId: o.id }} className="block rounded-xl border p-3 hover:bg-secondary">
                <p className="font-semibold">{o.folio} · {fullName(o.customers?.first_name, o.customers?.last_name)}</p>
                <p className="text-sm">{STATUS_META[o.status].label} · {PRIORITIES.find(p => p.value === o.priority)?.label} · Entrega: {dateFmt(o.due_date)}</p>
                <p className="text-sm">{o.order_items.reduce((n, i) => n + i.quantity, 0)} piezas · {o.order_items.reduce((n, i) => n + (i.is_done ? 0 : Math.max(0, i.quantity - i.done_quantity)), 0)} pendientes · Abonado: {money(o.paid_amount)}</p>
              </Link>)}
            </section>;
          })}
        </DialogContent>
      </Dialog>
      <ImageViewer
        open={!!viewer}
        onOpenChange={(v) => !v && setViewer(null)}
        images={viewer?.images ?? []}
        title={viewer?.title ?? "Imágenes"}
      />
    </>
  );
}
