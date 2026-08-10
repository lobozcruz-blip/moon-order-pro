import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { FileSpreadsheet, Images, Download, Loader2, CheckCircle2, AlertTriangle, Tag } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, dateTimeFmt, type Category } from "@/lib/cm";
import { uploadBlob, logActivity } from "@/lib/storage";
import { useInvalidate, nextSku, saveProductThemeLinks, type ProductTheme } from "@/lib/queries";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/importaciones")({
  head: () => ({
    meta: [
      { title: "Importaciones — Cookies Moon" },
      { name: "description", content: "Carga masiva de productos e imágenes del catálogo." },
      { property: "og:title", content: "Importaciones — Cookies Moon" },
      { property: "og:description", content: "Carga masiva de productos e imágenes del catálogo." },
    ],
  }),
  component: Importaciones,
});

type Row = {
  sku?: string;
  nombre?: string;
  categoria?: string;
  tematicas?: string;
  descripcion?: string;
  precio_base?: string | number | undefined;
  notas_fabricacion?: string;
  activo?: string | boolean | undefined;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

function Importaciones() {
  const invalidate = useInvalidate();
  const { isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [update, setUpdate] = useState(true);
  const [log, setLog] = useState<string[]>([]);

  const history = useQuery({
    queryKey: ["imports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_imports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });

  const template = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        sku: "",
        nombre: "Cortador estrella",
        categoria: "CORTADORES",
        tematicas: "Navidad|Invierno",
        descripcion: "Estrella de 5 picos",
        precio_base: "",
        notas_fabricacion: "Imprimir al 100%",
        activo: "si",
      },
      {
        sku: "",
        nombre: "Stencil Corazón Floral",
        categoria: "STENCILS",
        tematicas: "San Valentín|Día de la Madre|Flores",
        descripcion: "Diseño para galletas de 8cm",
        precio_base: "45",
        notas_fabricacion: "Lámina 7 mil",
        activo: "si",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "productos");
    XLSX.writeFile(wb, "plantilla-productos-cookies-moon.xlsx");
  };

  const importProducts = async (file: File) => {
    setBusy(true);
    setProgress(0);
    setLog([]);
    const lines: string[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    try {
      // 1. Obtener temáticas existentes para evitar duplicados case-insensitive
      const { data: existingThemes } = await supabase.from("product_themes").select("*");
      const themeMap = new Map<string, string>(); // lowerName -> id
      for (const t of existingThemes ?? []) {
        themeMap.set(t.name.trim().toLowerCase(), t.id);
      }

      const getOrCreateThemeId = async (rawName: string): Promise<string | null> => {
        const clean = rawName.trim();
        if (!clean) return null;
        const lower = clean.toLowerCase();
        if (themeMap.has(lower)) return themeMap.get(lower)!;

        // Crear temática nueva
        const { data: createdTheme } = await supabase
          .from("product_themes")
          .insert({ name: clean, active: true })
          .select("id")
          .single();
        if (createdTheme) {
          themeMap.set(lower, createdTheme.id);
          return createdTheme.id;
        }
        return null;
      };

      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = wb.SheetNames[0]!;
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]!);
      const rows: Row[] = raw.map((r) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) out[norm(k)] = v;
        return {
          sku: String(out["sku"] ?? "").trim(),
          nombre: String(out["nombre"] ?? out["producto"] ?? "").trim(),
          categoria: String(out["categoria"] ?? "").trim().toUpperCase(),
          tematicas: String(out["tematicas"] ?? out["tematica"] ?? out["temas"] ?? "").trim(),
          descripcion: String(out["descripcion"] ?? "").trim(),
          precio_base: out["preciobase"] as string | number | undefined,
          notas_fabricacion: String(out["notasfabricacion"] ?? "").trim(),
          activo: out["activo"] as string | undefined,
        };
      });

      const { data: imp } = await supabase
        .from("product_imports")
        .insert({ file_name: file.name, total_rows: rows.length, status: "procesando" })
        .select("id")
        .single();

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]!;
        setProgress(Math.round(((i + 1) / rows.length) * 100));
        try {
          if (!r.nombre) {
            skipped++;
            lines.push(`Fila ${i + 2}: sin nombre, omitida`);
            continue;
          }
          const category = (CATEGORIES.includes(r.categoria as Category)
            ? r.categoria
            : "OTROS") as Category;
          const payload = {
            name: r.nombre,
            category,
            description: r.descripcion || null,
            manufacturing_notes: r.notas_fabricacion || null,
            base_price:
              category === "CORTADORES" ? null : Number(r.precio_base ?? 0) || 0,
            active: !["no", "false", "0", "inactivo"].includes(String(r.activo ?? "si").toLowerCase()),
          };

          const existing = r.sku
            ? (await supabase.from("products").select("id").eq("sku", r.sku).maybeSingle()).data
            : (await supabase.from("products").select("id").eq("name", r.nombre).maybeSingle()).data;

          let productId: string;

          if (existing) {
            productId = existing.id;
            if (!update) {
              skipped++;
              lines.push(`Fila ${i + 2}: "${r.nombre}" ya existe, omitida`);
            } else {
              const { error } = await supabase.from("products").update(payload).eq("id", existing.id);
              if (error) throw error;
              updated++;
              if (imp)
                await supabase.from("product_import_rows").insert({
                  import_id: imp.id,
                  row_number: i + 2,
                  status: "actualizado",
                  product_id: existing.id,
                });
            }
          } else {
            const sku = r.sku || (await nextSku(category));
            const { data, error } = await supabase
              .from("products")
              .insert({ ...payload, sku })
              .select("id")
              .single();
            if (error) throw error;
            productId = data.id;
            created++;
            if (imp)
              await supabase.from("product_import_rows").insert({
                import_id: imp.id,
                row_number: i + 2,
                status: "creado",
                product_id: data.id,
              });
          }

          // Procesar temáticas si vienen especificadas
          if (r.tematicas && productId) {
            const themeNames = r.tematicas.split(/[|,]/).map((s) => s.trim()).filter(Boolean);
            const themeIds: string[] = [];
            for (const tName of themeNames) {
              const tid = await getOrCreateThemeId(tName);
              if (tid) themeIds.push(tid);
            }
            if (themeIds.length > 0) {
              await saveProductThemeLinks(productId, themeIds);
            }
          }
        } catch (e) {
          errors++;
          const msg = e instanceof Error ? e.message : "error";
          lines.push(`Fila ${i + 2}: ${msg}`);
          if (imp)
            await supabase.from("product_import_rows").insert({
              import_id: imp.id,
              row_number: i + 2,
              status: "error",
              error_message: msg,
            });
        }
      }

      if (imp)
        await supabase
          .from("product_imports")
          .update({
            status: "completado",
            created_count: created,
            updated_count: updated,
            skipped_count: skipped,
            error_count: errors,
          })
          .eq("id", imp.id);

      await logActivity({
        action: "Importación de productos",
        entity: "product_import",
        detail: `Creados: ${created}, actualizados: ${updated}, errores: ${errors}`,
      });

      toast.success(`Importación terminada: ${created} creados, ${updated} actualizados.`);
      invalidate("products", "imports", "activity", "product-themes");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo procesar el archivo");
    } finally {
      setBusy(false);
      setLog(lines);
    }
  };

  const importImagesZip = async (file: File) => {
    setBusy(true);
    setProgress(0);
    setLog([]);
    const lines: string[] = [];
    let linked = 0;
    let skipped = 0;
    try {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entries = Object.values(zip.files).filter((f) => !f.dir && !f.name.startsWith("__MACOSX"));
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        setProgress(Math.round(((i + 1) / entries.length) * 100));
        const filename = entry.name.split("/").pop() ?? entry.name;
        const skuOrName = filename.replace(/\.[^.]+$/, "").trim();
        const blob = await entry.async("blob");

        const { data: prod } = await supabase
          .from("products")
          .select("id")
          .or(`sku.ilike.${skuOrName},name.ilike.${skuOrName}`)
          .maybeSingle();

        if (!prod) {
          skipped++;
          lines.push(`"${filename}": no se encontró producto con SKU o nombre "${skuOrName}"`);
          continue;
        }

        const path = await uploadBlob("catalogo", filename, blob, prod.id);
        const { error } = await supabase
          .from("product_images")
          .insert({ product_id: prod.id, storage_path: path });
        if (error) {
          lines.push(`"${filename}": ${error.message}`);
        } else {
          linked++;
        }
      }
      toast.success(`Imágenes procesadas: ${linked} vinculadas, ${skipped} omitidas.`);
      invalidate("products");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al procesar ZIP");
    } finally {
      setBusy(false);
      setLog(lines);
    }
  };

  if (!isAdmin) {
    return (
      <div className="panel p-8 text-center text-sm text-muted-foreground">
        Sólo los administradores pueden importar productos.
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Importaciones" subtitle="Carga masiva de catálogo e imágenes" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Importar catálogo */}
        <div className="panel space-y-4 p-5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg">Catálogo (Excel / CSV)</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Sube un archivo .xlsx o .csv con columnas: <code>SKU</code>, <code>Nombre</code>, <code>Categoría</code>, <code>Temáticas</code> (separadas por <code>|</code>), <code>Precio Base</code>, <code>Descripción</code>.
          </p>
          <div className="flex items-center justify-between rounded-lg bg-secondary p-3">
            <span className="text-xs">Actualizar productos si ya existen</span>
            <Switch checked={update} onCheckedChange={setUpdate} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="tap" onClick={template}>
              <Download className="mr-1 h-4 w-4" /> Descargar plantilla con temáticas
            </Button>
            <label className="flex-1">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importProducts(f);
                }}
              />
              <Button asChild className="tap w-full font-semibold" disabled={busy}>
                <span>
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  Subir archivo
                </span>
              </Button>
            </label>
          </div>
        </div>

        {/* Importar imágenes en ZIP */}
        <div className="panel space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Images className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg">Imágenes en lote (.ZIP)</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Nombra cada imagen con el <strong>SKU</strong> o nombre exacto del producto (ejemplo: <code>COR-0001.jpg</code> o <code>COR-0001_1.jpg</code>).
          </p>
          <label className="block">
            <input
              type="file"
              accept=".zip"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importImagesZip(f);
              }}
            />
            <Button asChild variant="secondary" className="tap w-full font-semibold" disabled={busy}>
              <span>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Subir ZIP de imágenes
              </span>
            </Button>
          </label>
        </div>
      </div>

      {busy && (
        <div className="panel mt-4 space-y-2 p-4">
          <div className="flex justify-between text-xs">
            <span>Procesando…</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {log.length > 0 && (
        <div className="panel mt-4 space-y-2 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Registro de incidencias
          </h3>
          <div className="max-h-40 overflow-y-auto font-mono text-xs text-muted-foreground">
            {log.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="panel mt-4 p-4">
        <h3 className="mb-3 font-display text-lg">Historial de importaciones</h3>
        <div className="space-y-2">
          {(history.data ?? []).map((h) => (
            <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary p-3 text-xs">
              <div>
                <p className="font-semibold">{h.file_name}</p>
                <p className="text-muted-foreground">{dateTimeFmt(h.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-emerald-500">+{h.created_count ?? 0}</span>
                <span className="text-blue-500">~{h.updated_count ?? 0}</span>
                {(h.error_count ?? 0) > 0 && <span className="text-destructive">!{h.error_count}</span>}
                <span className="chip bg-background uppercase">{h.status}</span>
              </div>
            </div>
          ))}
          {(history.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin importaciones previas.</p>
          )}
        </div>
      </div>
    </>
  );
}
