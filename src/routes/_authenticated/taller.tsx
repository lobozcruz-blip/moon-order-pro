import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Hammer,
  Search,
  Check,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Printer,
  Calendar,
  AlertCircle,
  ExternalLink,
  Plus,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useProductionQueue, useProductThemes, useInvalidate } from "@/lib/queries";
import { StoredImage } from "@/components/StoredImage";
import {
  CATEGORIES,
  CATEGORY_META,
  MODALITIES,
  SIZES,
  PRIORITIES,
  dateFmt,
  fullName,
  type Category,
  type Modality,
} from "@/lib/cm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/taller")({
  head: () => ({
    meta: [
      { title: "Taller 3D & Cola de Producción — Cookies Moon" },
      {
        name: "description",
        content: "Cola de fabricación e impresión por lotes de cortadores, stencils y cajas.",
      },
      { property: "og:title", content: "Taller 3D & Cola de Producción — Cookies Moon" },
      {
        property: "og:description",
        content: "Cola de fabricación e impresión por lotes de cortadores, stencils y cajas.",
      },
    ],
  }),
  component: TallerProduccion,
});

type ProductionItem = NonNullable<ReturnType<typeof useProductionQueue>["data"]>[number];

type GroupedBatch = {
  key: string;
  category: Category;
  productId: string | null;
  productName: string;
  productSku: string | null;
  cutterModality: Modality | null;
  cutterSizeCm: number | null;
  image: any;
  totalUnits: number;
  doneUnits: number;
  pendingUnits: number;
  items: ProductionItem[];
};

function TallerProduccion() {
  const { data: queueItems = [], isLoading } = useProductionQueue();
  const { data: themes = [] } = useProductThemes();
  const invalidate = useInvalidate();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "TODAS">("TODAS");
  const [sizeFilter, setSizeFilter] = useState<string>("TODOS");
  const [modalityFilter, setModalityFilter] = useState<string>("TODAS");
  const [themeFilter, setThemeFilter] = useState<string>("TODAS");
  const [onlyPending, setOnlyPending] = useState(true);
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"batches" | "orders">("batches");

  // Filtrado inicial de ítems
  const filteredItems = useMemo(() => {
    const s = search.trim().toLowerCase();

    return (queueItems as ProductionItem[]).filter((it) => {
      // Filtro pendiente
      if (onlyPending && it.is_done) return false;

      // Filtro categoría
      if (categoryFilter !== "TODAS" && it.category !== categoryFilter) return false;

      // Filtro tamaño
      if (sizeFilter !== "TODOS" && String(it.cutter_size_cm) !== sizeFilter) return false;

      // Filtro modalidad
      if (modalityFilter !== "TODAS" && it.cutter_modality !== modalityFilter) return false;

      // Filtro temática
      if (themeFilter !== "TODAS") {
        const prodThemes = (it.products as any)?.product_theme_links ?? [];
        const hasTheme = prodThemes.some((t: any) => t.theme_id === themeFilter);
        if (!hasTheme) return false;
      }

      // Filtro texto (nombre, sku, folio, cliente)
      if (s) {
        const nameMatch = it.product_name.toLowerCase().includes(s);
        const skuMatch = (it.product_sku || "").toLowerCase().includes(s);
        const folioMatch = ((it.orders as any)?.folio || "").toLowerCase().includes(s);
        const clientMatch = fullName(
          (it.orders as any)?.customers?.first_name,
          (it.orders as any)?.customers?.last_name,
        )
          .toLowerCase()
          .includes(s);

        if (!nameMatch && !skuMatch && !folioMatch && !clientMatch) return false;
      }

      return true;
    });
  }, [queueItems, search, categoryFilter, sizeFilter, modalityFilter, themeFilter, onlyPending]);

  // Agrupación de lotes para producción en masa en 3D
  const groupedBatches = useMemo(() => {
    const map = new Map<string, GroupedBatch>();

    for (const it of filteredItems) {
      const key = `${it.category}_${it.product_id || it.product_name.trim().toLowerCase()}_${it.cutter_modality || "none"}_${it.cutter_size_cm || 0}`;

      const prodImg = (it.products as any)?.product_images?.[0];
      const customImg = (it.order_item_images as any)?.[0];
      const img = customImg || prodImg;

      const done = it.is_done ? it.quantity : it.done_quantity || 0;
      const pending = Math.max(0, it.quantity - done);

      if (!map.has(key)) {
        map.set(key, {
          key,
          category: it.category as Category,
          productId: it.product_id,
          productName: it.product_name,
          productSku: it.product_sku || (it.products as any)?.sku || null,
          cutterModality: it.cutter_modality as Modality | null,
          cutterSizeCm: it.cutter_size_cm,
          image: img,
          totalUnits: it.quantity,
          doneUnits: done,
          pendingUnits: pending,
          items: [it],
        });
      } else {
        const existing = map.get(key)!;
        existing.totalUnits += it.quantity;
        existing.doneUnits += done;
        existing.pendingUnits += pending;
        existing.items.push(it);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.pendingUnits - a.pendingUnits);
  }, [filteredItems]);

  // Totales globales
  const totalQueueUnits = queueItems.reduce((acc, it) => acc + it.quantity, 0);
  const totalDoneUnits = queueItems.reduce(
    (acc, it) => acc + (it.is_done ? it.quantity : it.done_quantity || 0),
    0,
  );
  const totalPendingUnits = Math.max(0, totalQueueUnits - totalDoneUnits);
  const globalProgress = totalQueueUnits ? Math.round((totalDoneUnits / totalQueueUnits) * 100) : 0;

  // Manejador para avanzar piezas en un ítem específico
  const handleUpdateItemProgress = async (
    item: ProductionItem,
    newDoneQty: number,
    totalQty: number,
  ) => {
    const val = Math.max(0, Math.min(totalQty, newDoneQty));
    const isDone = val >= totalQty;

    const { data: u } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("order_items")
      .update({
        done_quantity: val,
        is_done: isDone,
        done_at: isDone ? new Date().toISOString() : null,
        done_by: isDone ? (u.user?.id ?? null) : null,
      })
      .eq("id", item.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      isDone
        ? `Listo: ${item.product_name} en pedido ${(item.orders as any)?.folio}`
        : `Avance: ${val}/${totalQty} piezas`,
    );

    invalidate("production-queue", "orders", "order");
  };

  // Manejador para completar un lote entero
  const handleCompleteBatch = async (batch: GroupedBatch) => {
    const { data: u } = await supabase.auth.getUser();
    const now = new Date().toISOString();

    for (const it of batch.items) {
      if (it.is_done) continue;
      await supabase
        .from("order_items")
        .update({
          done_quantity: it.quantity,
          is_done: true,
          done_at: now,
          done_by: u.user?.id ?? null,
        })
        .eq("id", it.id);
    }

    toast.success(`¡Lote completado: ${batch.pendingUnits} piezas de "${batch.productName}"!`);
    invalidate("production-queue", "orders", "order");
  };

  const toggleExpand = (key: string) => {
    setExpandedBatches((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <PageHeader
        title="Taller 3D & Producción"
        subtitle="Cola de fabricación e impresión por lotes optimizada para taller."
        action={
          <div className="flex gap-2">
            <Button
              variant={viewMode === "batches" ? "default" : "outline"}
              size="sm"
              className="tap text-xs font-semibold"
              onClick={() => setViewMode("batches")}
            >
              <Layers className="mr-1.5 h-3.5 w-3.5" /> Vista por lotes
            </Button>
            <Button
              variant={viewMode === "orders" ? "default" : "outline"}
              size="sm"
              className="tap text-xs font-semibold"
              onClick={() => setViewMode("orders")}
            >
              <Calendar className="mr-1.5 h-3.5 w-3.5" /> Vista por pedidos
            </Button>
          </div>
        }
      />

      {/* TARJETA DE ESTADÍSTICAS GLOBALES DEL TALLER */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 font-bold">
            <Printer className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Piezas por fabricar</p>
            <p className="font-display text-2xl font-bold text-foreground">
              {totalPendingUnits}{" "}
              <span className="text-xs font-normal text-muted-foreground">pzas</span>
            </p>
          </div>
        </div>

        <div className="panel p-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">
            <Check className="h-5 w-5 stroke-[2.5]" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Piezas terminadas</p>
            <p className="font-display text-2xl font-bold text-foreground">
              {totalDoneUnits}{" "}
              <span className="text-xs font-normal text-muted-foreground">/ {totalQueueUnits}</span>
            </p>
          </div>
        </div>

        <div className="panel p-4 flex items-center gap-3 sm:col-span-2">
          <div className="flex-1 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-foreground">Avance global del taller</span>
              <span className="font-bold text-primary">{globalProgress}%</span>
            </div>
            <Progress value={globalProgress} className="h-2" />
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="panel p-4 mb-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Buscador de texto */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="tap pl-9 text-xs h-9"
              placeholder="Buscar por cortador, SKU o folio de pedido..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filtro Categoría */}
          <div>
            <Select
              value={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v as Category | "TODAS")}
            >
              <SelectTrigger className="tap h-9 text-xs">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas las categorías</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_META[c].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Tamaño */}
          <div>
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger className="tap h-9 text-xs">
                <SelectValue placeholder="Tamaño de cortador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los tamaños</SelectItem>
                {SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s} cm
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Temática */}
          <div>
            <Select value={themeFilter} onValueChange={setThemeFilter}>
              <SelectTrigger className="tap h-9 text-xs">
                <SelectValue placeholder="Temática" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas las temáticas</SelectItem>
                {themes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Toggle Solo Pendientes */}
        <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
          <div className="flex items-center gap-2">
            <Switch
              id="pending-switch"
              checked={onlyPending}
              onCheckedChange={setOnlyPending}
            />
            <Label htmlFor="pending-switch" className="cursor-pointer text-xs font-medium">
              Mostrar solo artículos pendientes por fabricar
            </Label>
          </div>
          <span className="text-muted-foreground">
            {groupedBatches.length} lotes de fabricación activos
          </span>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Cargando cola del taller…</p>
      ) : groupedBatches.length === 0 ? (
        <div className="panel p-12 text-center text-muted-foreground space-y-2">
          <Sparkles className="mx-auto h-8 w-8 text-primary/50" />
          <p className="font-semibold text-foreground">¡Todo al día en el taller!</p>
          <p className="text-xs">No hay piezas pendientes con los filtros seleccionados.</p>
        </div>
      ) : viewMode === "batches" ? (
        /* VISTA 1: LOTES DE FABRICACIÓN (Agrupados por producto y tamaño) */
        <div className="space-y-3">
          {groupedBatches.map((batch) => {
            const isExpanded = expandedBatches[batch.key] ?? false;
            const isFullyDone = batch.pendingUnits === 0;
            const modalityLabel = batch.cutterModality
              ? MODALITIES.find((m) => m.value === batch.cutterModality)?.label ?? "Cortador"
              : null;

            return (
              <div
                key={batch.key}
                className={cn(
                  "panel p-4 transition-all",
                  isFullyDone ? "opacity-60 bg-card/40" : "hover:border-primary/40",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Imagen & Nombre del producto */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary">
                      {batch.image ? (
                        <StoredImage image={batch.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground opacity-50" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {batch.productSku && (
                          <span className="font-mono text-xs font-bold text-primary">
                            {batch.productSku}
                          </span>
                        )}
                        <span
                          className="chip text-[10px] py-0 px-1.5"
                          style={{
                            color: `var(--${CATEGORY_META[batch.category].token})`,
                            background: `color-mix(in oklab, var(--${CATEGORY_META[batch.category].token}) 16%, transparent)`,
                          }}
                        >
                          {CATEGORY_META[batch.category].label}
                        </span>

                        {batch.category === "CORTADORES" && (
                          <span className="chip bg-primary/10 text-primary font-bold text-[10px] py-0">
                            {batch.cutterSizeCm ?? 8} cm · {modalityLabel}
                          </span>
                        )}
                      </div>

                      <h3 className="truncate text-base font-semibold text-foreground mt-0.5">
                        {batch.productName}
                      </h3>

                      <p className="text-xs text-muted-foreground">
                        En {batch.items.length} pedido{batch.items.length > 1 ? "s" : ""} · Total:{" "}
                        <strong className="text-foreground">{batch.totalUnits} piezas</strong> (
                        {batch.doneUnits} listas, {batch.pendingUnits} pendientes)
                      </p>
                    </div>
                  </div>

                  {/* Acciones de Lote */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="font-display text-xl font-bold text-primary">
                        {batch.pendingUnits}{" "}
                        <span className="text-xs font-normal text-muted-foreground">pendientes</span>
                      </span>
                    </div>

                    {!isFullyDone && (
                      <Button
                        size="sm"
                        className="tap font-bold h-9 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                        onClick={() => handleCompleteBatch(batch)}
                      >
                        <Check className="mr-1.5 h-4 w-4 stroke-[3]" /> Completar lote ({batch.pendingUnits})
                      </Button>
                    )}

                    <Button
                      size="icon"
                      variant="ghost"
                      className="tap h-8 w-8 text-muted-foreground"
                      onClick={() => toggleExpand(batch.key)}
                      title="Ver pedidos asociados"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Desglose de pedidos expandible */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-border/80 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Pedidos donde se requiere este producto:
                    </p>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {batch.items.map((it) => {
                        const orderData = it.orders as any;
                        const clientName = fullName(
                          orderData?.customers?.first_name,
                          orderData?.customers?.last_name,
                        );
                        const done = it.is_done ? it.quantity : it.done_quantity || 0;
                        const pending = it.quantity - done;

                        return (
                          <div
                            key={it.id}
                            className={cn(
                              "rounded-lg border p-2.5 text-xs transition-all space-y-1.5",
                              it.is_done
                                ? "bg-emerald-500/5 border-emerald-500/20 text-muted-foreground"
                                : "bg-secondary/40 border-border",
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <Link
                                to="/pedidos/$orderId"
                                params={{ orderId: it.order_id }}
                                className="font-mono font-bold text-primary hover:underline inline-flex items-center gap-1"
                              >
                                {orderData?.folio} <ExternalLink className="h-3 w-3" />
                              </Link>
                              {orderData?.priority === "urgente" && (
                                <span className="chip bg-rose-500/15 text-rose-500 text-[10px] py-0 font-bold">
                                  Urgente
                                </span>
                              )}
                            </div>

                            <p className="truncate text-foreground font-medium">{clientName}</p>

                            {orderData?.due_date && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Entrega: {dateFmt(orderData.due_date)}
                              </p>
                            )}

                            {it.notes && (
                              <p className="text-[10px] text-amber-500 bg-amber-500/10 p-1 rounded">
                                Nota: {it.notes}
                              </p>
                            )}

                            {/* Controles de avance por pedido */}
                            <div className="flex items-center justify-between pt-1 border-t border-border/50">
                              <span className="font-semibold">
                                {done}/{it.quantity} pzas
                              </span>

                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 tap"
                                  disabled={done <= 0}
                                  onClick={() => handleUpdateItemProgress(it, done - 1, it.quantity)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 tap"
                                  disabled={done >= it.quantity}
                                  onClick={() => handleUpdateItemProgress(it, done + 1, it.quantity)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={it.is_done ? "outline" : "secondary"}
                                  className="h-6 px-2 text-[11px] tap font-semibold"
                                  onClick={() =>
                                    handleUpdateItemProgress(it, it.is_done ? 0 : it.quantity, it.quantity)
                                  }
                                >
                                  {it.is_done ? "Reabrir" : "Listo"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA 2: DESGLOSADO POR PEDIDO Y FECHA DE ENTREGA */
        <div className="space-y-4">
          {Array.from(new Set(filteredItems.map((i) => i.order_id))).map((orderId) => {
            const orderItems = filteredItems.filter((i) => i.order_id === orderId);
            const orderData = orderItems[0]?.orders as any;
            const clientName = fullName(
              orderData?.customers?.first_name,
              orderData?.customers?.last_name,
            );

            return (
              <div key={orderId} className="panel p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <Link
                      to="/pedidos/$orderId"
                      params={{ orderId }}
                      className="font-mono text-base font-bold text-primary hover:underline"
                    >
                      {orderData?.folio}
                    </Link>
                    <span className="text-sm font-semibold">{clientName}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {orderData?.due_date && (
                      <span className="chip bg-secondary text-muted-foreground">
                        📅 Entrega: {dateFmt(orderData.due_date)}
                      </span>
                    )}
                    {orderData?.priority === "urgente" && (
                      <span className="chip bg-rose-500/15 text-rose-500 font-bold">Urgente</span>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-border/60">
                  {orderItems.map((it) => {
                    const done = it.is_done ? it.quantity : it.done_quantity || 0;
                    return (
                      <div key={it.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">{it.product_name}</p>
                          <p className="text-muted-foreground text-[11px]">
                            {it.category === "CORTADORES" && it.cutter_size_cm
                              ? `${it.cutter_size_cm} cm · ${
                                  MODALITIES.find((m) => m.value === it.cutter_modality)?.label ?? ""
                                } · `
                              : ""}
                            {it.quantity} pzas requeridas
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-bold">
                            {done}/{it.quantity}
                          </span>
                          <Button
                            size="sm"
                            variant={it.is_done ? "outline" : "default"}
                            className="tap h-7 text-xs font-semibold"
                            onClick={() =>
                              handleUpdateItemProgress(it, it.is_done ? 0 : it.quantity, it.quantity)
                            }
                          >
                            {it.is_done ? "Listo ✓" : "Completar"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
