import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, ImagePlus, Star, X } from "lucide-react";
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
import { useProducts, usePriceRules, priceFor, useInvalidate, nextSku, useProductSalesCounts } from "@/lib/queries";
import {
  CATEGORIES,
  CATEGORY_META,
  MODALITIES,
  SIZES,
  money,
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
};

function Productos() {
  const { data: products, isLoading } = useProducts();
  const { data: rules } = usePriceRules();
  const { data: sales } = useProductSalesCounts();
  const invalidate = useInvalidate();
  const { isAdmin } = useAuth();

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "TODAS">("TODAS");
  const [onlyActive, setOnlyActive] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [viewer, setViewer] = useState<{ images: ImgRef[]; title: string } | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (products ?? []).filter(
      (p) =>
        (cat === "TODAS" || p.category === cat) &&
        (!onlyActive || p.active) &&
        (!term ||
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          (p.description ?? "").toLowerCase().includes(term)),
    );
  }, [products, q, cat, onlyActive]);

  const openNew = async () => {
    const sku = await nextSku("CORTADORES");
    setDraft({ ...empty, sku });
    setFiles([]);
    setOpen(true);
  };

  const onCategoryChange = async (c: Category) => {
    const sku = draft.id ? draft.sku : await nextSku(c);
    setDraft({ ...draft, category: c, sku });
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
        base_price: draft.category === "CORTADORES" ? null : Number(draft.base_price || 0),
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

  const autoPrice = priceFor(rules, draft.cutter_modality, draft.cutter_size_cm);

  return (
    <>
      <PageHeader
        title="Catálogo"
        subtitle={`${(products ?? []).length} productos`}
        action={
          <Button className="tap font-semibold" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo producto
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="tap pl-9"
            placeholder="Buscar por nombre, SKU o descripción"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["TODAS", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "chip border border-border transition-colors",
                cat === c ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {c === "TODAS" ? "Todas" : CATEGORY_META[c].label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={onlyActive} onCheckedChange={setOnlyActive} /> Sólo activos
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {rows.map((p) => {
          const imgs = (p.product_images ?? []).slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
          return (
            <div key={p.id} className="panel overflow-hidden">
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
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <span
                    className="chip"
                    style={{
                      color: `var(--${CATEGORY_META[p.category].token})`,
                      background: `color-mix(in oklab, var(--${CATEGORY_META[p.category].token}) 16%, transparent)`,
                    }}
                  >
                    {CATEGORY_META[p.category].label}
                  </span>
                  {!p.active && <span className="chip bg-secondary text-muted-foreground">Inactivo</span>}
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.sku}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.category === "CORTADORES"
                    ? "Precio por tamaño"
                    : money(p.base_price)}{" "}
                  · {sales?.[p.id] ?? 0} vendidos
                </p>
                <div className="mt-2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="tap"
                    aria-label="Editar"
                    onClick={() => {
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
                      });
                      setFiles([]);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="tap"
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
                          className="block h-8 w-8 overflow-hidden rounded border border-border"
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
            No hay productos que coincidan.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
              <Label>Nombre *</Label>
              <Input className="tap" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
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
                <Label>Precio base</Label>
                <Input
                  className="tap"
                  inputMode="decimal"
                  value={draft.base_price}
                  onChange={(e) => setDraft({ ...draft, base_price: e.target.value })}
                />
              </div>
            )}

            <label className="tap flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground">
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
              Guardar producto
            </Button>
          </DialogFooter>
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
