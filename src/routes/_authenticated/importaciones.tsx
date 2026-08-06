import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { FileSpreadsheet, Images, Download, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, dateTimeFmt, type Category } from "@/lib/cm";
import { uploadBlob, logActivity } from "@/lib/storage";
import { useInvalidate, nextSku } from "@/lib/queries";
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
        descripcion: "Estrella de 5 picos",
        precio_base: "",
        notas_fabricacion: "Imprimir al 100%",
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

          if (existing) {
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
            created++;
            if (imp)
              await supabase.from("product_import_rows").insert({
                import_id: imp.id,
                row_number: i + 2,
                status: "creado",
                product_id: data.id,
              });
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
        detail: `${created} creados, ${updated} actualizados, ${skipped} omitidos, ${errors} errores`,
      });
      lines.unshift(`${created} creados · ${updated} actualizados · ${skipped} omitidos · ${errors} errores`);
      setLog(lines);
      toast.success("Importación finalizada");
      invalidate("products", "activity");
      history.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const importImages = async (file: File) => {
    setBusy(true);
    setProgress(0);
    const lines: string[] = [];
    let matched = 0;
    let unmatched = 0;
    try {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter(
        (f) => !f.dir && /\.(png|jpe?g|webp|gif)$/i.test(f.name),
      );
      const { data: products } = await supabase.from("products").select("id, sku, name");
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        setProgress(Math.round(((i + 1) / entries.length) * 100));
        const base = entry.name.split("/").pop()!.replace(/\.[^.]+$/, "");
        const key = norm(base);
        const match = (products ?? []).find(
          (p) => norm(p.sku) === key || norm(p.name) === key || key.startsWith(norm(p.sku)),
        );
        if (!match) {
          unmatched++;
          lines.push(`Sin coincidencia: ${entry.name}`);
          continue;
        }
        const blob = await entry.async("blob");
        const storage_path = await uploadBlob("catalogo", entry.name, blob, match.id);
        const { count } = await supabase
          .from("product_images")
          .select("id", { count: "exact", head: true })
          .eq("product_id", match.id);
        await supabase.from("product_images").insert({
          product_id: match.id,
          storage_path,
          is_primary: (count ?? 0) === 0,
        });
        matched++;
      }
      lines.unshift(`${matched} imágenes asignadas · ${unmatched} sin coincidencia`);
      setLog(lines);
      await logActivity({
        action: "Importación de imágenes",
        entity: "product_image",
        detail: `${matched} asignadas, ${unmatched} sin coincidencia`,
      });
      toast.success("Imágenes procesadas");
      invalidate("products", "activity");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo procesar el ZIP");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  if (!isAdmin)
    return (
      <>
        <PageHeader title="Importaciones" />
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          Sólo los administradores pueden hacer cargas masivas.
        </div>
      </>
    );

  return (
    <>
      <PageHeader title="Importaciones" subtitle="Carga masiva de catálogo e imágenes" />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <FileSpreadsheet className="mb-3 h-6 w-6 text-primary" />
          <h2 className="font-display text-lg">Productos (Excel / CSV)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Columnas: sku, nombre, categoria, descripcion, precio_base, notas_fabricacion, activo.
            Los cortadores ignoran precio_base (usan la tabla por tamaño).
          </p>
          <Button variant="secondary" className="tap mt-3 w-full" onClick={template}>
            <Download className="mr-2 h-4 w-4" /> Descargar plantilla
          </Button>
          <label className="mt-3 flex items-center justify-between rounded-lg bg-secondary p-3 text-xs">
            Actualizar si ya existe
            <Switch checked={update} onCheckedChange={setUpdate} />
          </label>
          <label className="tap mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border text-sm font-medium">
            Seleccionar archivo
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && importProducts(e.target.files[0])}
            />
          </label>
        </div>

        <div className="panel p-5">
          <Images className="mb-3 h-6 w-6 text-primary" />
          <h2 className="font-display text-lg">Imágenes (ZIP)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Nombra cada archivo con el SKU o el nombre exacto del producto (ej.{" "}
            <code>COR-0012.png</code>). Se asignan automáticamente.
          </p>
          <label className="tap mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border text-sm font-medium">
            Seleccionar ZIP
            <input
              type="file"
              accept=".zip"
              className="hidden"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && importImages(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      {busy && (
        <div className="panel mt-4 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Procesando… {progress}%
          </p>
          <Progress value={progress} />
        </div>
      )}

      {log.length > 0 && (
        <div className="panel mt-4 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-display">
            <CheckCircle2 className="h-4 w-4" style={{ color: "var(--st-finalizado)" }} /> Resultado
          </h3>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {log.map((l, i) => (
              <li key={i} className={i === 0 ? "font-semibold text-foreground" : ""}>
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel mt-4 p-4">
        <h3 className="mb-3 font-display text-lg">Historial de importaciones</h3>
        <div className="space-y-2">
          {(history.data ?? []).map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary p-3 text-xs">
              <span className="flex-1 truncate font-medium">{h.file_name ?? "Archivo"}</span>
              <span className="text-muted-foreground">{dateTimeFmt(h.created_at)}</span>
              <span className="chip" style={{ color: "var(--st-finalizado)" }}>
                {h.created_count} nuevos
              </span>
              <span className="chip" style={{ color: "var(--st-enviado)" }}>
                {h.updated_count} act.
              </span>
              {h.error_count > 0 && (
                <span className="chip" style={{ color: "var(--st-cancelado)" }}>
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  {h.error_count}
                </span>
              )}
            </div>
          ))}
          {(history.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin importaciones aún.</p>
          )}
        </div>
      </div>
    </>
  );
}
