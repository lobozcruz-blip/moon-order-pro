import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Hammer,
  Search,
  Check,
  Package,
  Layers,
  Sparkles,
  Printer,
  Calendar,
  ExternalLink,
  Plus,
  Minus,
  Scissors,
  Box,
  SlidersHorizontal,
  Flame,
  Clock,
  PrinterIcon,
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
  ordersCount: number;
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
  const [viewMode, setViewMode] = useState<"batches" | "orders">("batches");

  // Filtrado de artículos
  const filteredItems = useMemo(() => {
    const s = search.trim().toLowerCase();

    return (queueItems as ProductionItem[]).filter((it) => {
      // 1. Filtro solo pendientes
      if (onlyPending && it.is_done) return false;

      // 2. Filtro categoría
      if (categoryFilter !== "TODAS" && it.category !== categoryFilter) return false;

      // 3. Filtro tamaño
      if (sizeFilter !== "TODOS" && String(it.cutter_size_cm) !== sizeFilter) return false;

      // 4. Filtro modalidad
      if (modalityFilter !== "TODAS" && it.cutter_modality !== modalityFilter) return false;

      // 5. Filtro temática
      if (themeFilter !== "TODAS") {
        const prodThemes = (it.products as any)?.product_theme_links ?? [];
        const hasTheme = prodThemes.some((t: any) => t.theme_id === themeFilter);
        if (!hasTheme) return false;
      }

      // 6. Filtro texto (nombre, sku, folio, cliente)
      if (s) {
        const nameMatch = (it.product_name || "").toLowerCase().includes(s);
        const skuMatch = (it.product_sku || (it.products as any)?.sku || "").toLowerCase().includes(s);
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

  // Agrupación en lotes de fabricación
  const groupedBatches = useMemo(() => {
    const map = new Map<string, GroupedBatch>();

    for (const it of filteredItems) {
      const prodIdOrName = (it.product_id || it.product_name || "").trim().toLowerCase();
      const modality = it.cutter_modality || "none";
      const size = it.cutter_size_cm || 0;
      const key = `${it.category}__${prodIdOrName}__${modality}__${size}`;

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
          ordersCount: 1,
          items: [it],
        });
      } else {
        const existing = map.get(key)!;
        existing.totalUnits += it.quantity;
        existing.doneUnits += done;
        existing.pendingUnits += pending;
        existing.items.push(it);
        existing.ordersCount = new Set(existing.items.map((i) => i.order_id)).size;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.pendingUnits - a.pendingUnits);
  }, [filteredItems]);

  // Estadísticas globales
  const totalQueueUnits = queueItems.reduce((acc, it) => acc + it.quantity, 0);
  const totalDoneUnits = queueItems.reduce(
    (acc, it) => acc + (it.is_done ? it.quantity : it.done_quantity || 0),
    0,
  );
  const totalPendingUnits = Math.max(0, totalQueueUnits - totalDoneUnits);
  const globalProgress = totalQueueUnits ? Math.round((totalDoneUnits / totalQueueUnits) * 100) : 0;

  // Actualizar avance de piezas de un artículo en un pedido específico
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

    if (isDone) {
      toast.success(`Listo: "${item.product_name}" en ${(item.orders as any)?.folio}`);
    } else {
      toast.info(`Avance: ${val}/${totalQty} pzas`);
    }

    invalidate("production-queue", "orders", "order");
  };

  // Completar lote completo
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

  // Imprimir hoja de trabajo del taller
  const handlePrintSheet = () => {
    window.print();
  };

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Taller 3D & Producción"
          subtitle="Cola de fabricación e impresión por lotes optimizada para taller."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="tap text-xs font-semibold"
                onClick={handlePrintSheet}
              >
                <PrinterIcon className="mr-1.5 h-3.5 w-3.5 text-primary" /> Imprimir hoja de taller
              </Button>

              <div className="flex rounded-lg border border-border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("batches")}
                  className={cn(
                    "tap flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                    viewMode === "batches"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Layers className="h-3.5 w-3.5" /> Vista por lotes
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("orders")}
                  className={cn(
                    "tap flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                    viewMode === "orders"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Calendar className="h-3.5 w-3.5" /> Vista por pedidos
                </button>
              </div>
            </div>
          }
        />

        {/* TARJETAS DE ESTADÍSTICAS DEL TALLER */}
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

        {/* ACCESOS RÁPIDOS POR MÁQUINA / PROCESO */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1">
            Proceso:
          </span>
          <button
            type="button"
            onClick={() => setCategoryFilter("TODAS")}
            className={cn(
              "chip tap text-xs transition-all",
              categoryFilter === "TODAS"
                ? "bg-primary text-primary-foreground font-bold shadow-sm"
                : "border border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            Todos los procesos
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("CORTADORES")}
            className={cn(
              "chip tap text-xs transition-all",
              categoryFilter === "CORTADORES"
                ? "bg-primary text-primary-foreground font-bold shadow-sm"
                : "border border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            🖨️ Impresión 3D (Cortadores)
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("STENCILS")}
            className={cn(
              "chip tap text-xs transition-all",
              categoryFilter === "STENCILS"
                ? "bg-primary text-primary-foreground font-bold shadow-sm"
                : "border border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            ✂️ Corte & Stencils
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("CAJAS")}
            className={cn(
              "chip tap text-xs transition-all",
              categoryFilter === "CAJAS"
                ? "bg-primary text-primary-foreground font-bold shadow-sm"
                : "border border-border text-muted-foreground hover:bg-secondary",
            )}
          >
            📦 Armado de Cajas
          </button>
        </div>

        {/* BARRA DE FILTROS */}
        <div className="panel p-4 mb-6 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Buscador de texto */}
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="tap pl-9 text-xs h-9"
                placeholder="Buscar por cortador, SKU, folio (CM-...) o clienta..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-xs">
            <div className="flex items-center gap-2">
              <Switch
                id="pending-switch"
                checked={onlyPending}
                onCheckedChange={setOnlyPending}
              />
              <Label htmlFor="pending-switch" className="cursor-pointer text-xs font-medium">
                Mostrar solo artículos pendientes de terminar
              </Label>
            </div>
            <span className="text-muted-foreground font-semibold">
              {groupedBatches.length} modelos requeridos en producción
            </span>
          </div>
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
        /* VISTA 1: LOTES DE FABRICACIÓN AGRUPADOS */
        <div className="space-y-4">
          {groupedBatches.map((batch) => {
            const isFullyDone = batch.pendingUnits === 0;
            const modalityLabel = batch.cutterModality
              ? MODALITIES.find((m) => m.value === batch.cutterModality)?.label ?? "Cortador"
              : null;

            return (
              <div
                key={batch.key}
                className={cn(
                  "panel p-4 sm:p-5 transition-all shadow-sm",
                  isFullyDone
                    ? "opacity-60 bg-card/40 border-border/40"
                    : "border-primary/30 hover:border-primary/60 bg-card",
                )}
              >
                {/* Cabecera del modelo */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary">
                      {batch.image ? (
                        <StoredImage image={batch.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground opacity-50" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
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

                      <h3 className="text-base font-bold text-foreground mt-0.5 leading-snug">
                        {batch.productName}
                      </h3>

                      <p className="text-xs text-muted-foreground mt-0.5">
                        En <strong className="text-foreground">{batch.ordersCount} pedido{batch.ordersCount > 1 ? "s" : ""}</strong> · Total requerido:{" "}
                        <strong className="text-foreground">{batch.totalUnits} piezas</strong> (
                        {batch.doneUnits} listas, <span className="text-primary font-bold">{batch.pendingUnits} pendientes</span>)
                      </p>
                    </div>
                  </div>

                  {/* Botón para completar todo el lote */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isFullyDone && (
                      <Button
                        size="sm"
                        className="tap font-bold h-9 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                        onClick={() => handleCompleteBatch(batch)}
                      >
                        <Check className="mr-1.5 h-4 w-4 stroke-[3]" /> Completar lote ({batch.pendingUnits} pzas)
                      </Button>
                    )}
                  </div>
                </div>

                {/* Desglose claro de pedidos vinculados directamente visible */}
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Desglose por pedidos:
                  </p>

                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {batch.items.map((it) => {
                      const orderData = it.orders as any;
                      const clientName = fullName(
                        orderData?.customers?.first_name,
                        orderData?.customers?.last_name,
                      ) || "Cliente";
                      const done = it.is_done ? it.quantity : it.done_quantity || 0;
                      const isItemDone = it.is_done || done >= it.quantity;

                      return (
                        <div
                          key={it.id}
                          className={cn(
                            "rounded-xl border p-3 text-xs transition-all space-y-2",
                            isItemDone
                              ? "bg-emerald-500/5 border-emerald-500/30 text-muted-foreground"
                              : "bg-secondary/40 border-border hover:border-primary/40",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <Link
                              to="/pedidos/$orderId"
                              params={{ orderId: it.order_id }}
                              className="font-mono font-bold text-sm text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {orderData?.folio} <ExternalLink className="h-3 w-3" />
                            </Link>

                            <div className="flex items-center gap-1">
                              {orderData?.priority === "urgente" && (
                                <span className="chip bg-rose-500/15 text-rose-600 text-[10px] py-0 font-bold flex items-center gap-0.5">
                                  <Flame className="h-3 w-3" /> Urgente
                                </span>
                              )}
                              {orderData?.due_date && (
                                <span className="chip bg-secondary text-muted-foreground text-[10px] py-0 flex items-center gap-0.5">
                                  <Clock className="h-3 w-3" /> {dateFmt(orderData.due_date)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="font-semibold text-foreground text-xs truncate">
                              {clientName}
                            </p>
                            {it.notes && (
                              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 p-1 rounded font-medium">
                                📌 Nota: {it.notes}
                              </p>
                            )}
                          </div>

                          {/* Controles rápidos de avance */}
                          <div className="flex items-center justify-between pt-2 border-t border-border/60">
                            <span className="font-bold text-xs">
                              {done} / {it.quantity} pzas
                            </span>

                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 tap"
                                disabled={done <= 0}
                                onClick={() => handleUpdateItemProgress(it, done - 1, it.quantity)}
                                title="Restar 1 pieza"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 tap"
                                disabled={done >= it.quantity}
                                onClick={() => handleUpdateItemProgress(it, done + 1, it.quantity)}
                                title="Sumar 1 pieza lista"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={isItemDone ? "outline" : "default"}
                                className={cn(
                                  "h-7 px-2 text-xs tap font-bold",
                                  !isItemDone && "bg-primary text-primary-foreground hover:bg-primary/90",
                                )}
                                onClick={() =>
                                  handleUpdateItemProgress(it, isItemDone ? 0 : it.quantity, it.quantity)
                                }
                              >
                                {isItemDone ? "Reabrir" : "Listo ✓"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA 2: DESGLOSADA POR PEDIDOS */
        <div className="space-y-4">
          {Array.from(new Set(filteredItems.map((i) => i.order_id))).map((orderId) => {
            const orderItems = filteredItems.filter((i) => i.order_id === orderId);
            const orderData = orderItems[0]?.orders as any;
            const clientName = fullName(
              orderData?.customers?.first_name,
              orderData?.customers?.last_name,
            ) || "Cliente";

            const orderTotalPieces = orderItems.reduce((acc, it) => acc + it.quantity, 0);
            const orderDonePieces = orderItems.reduce(
              (acc, it) => acc + (it.is_done ? it.quantity : it.done_quantity || 0),
              0,
            );

            return (
              <div key={orderId} className="panel p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-3">
                    <Link
                      to="/pedidos/$orderId"
                      params={{ orderId }}
                      className="font-mono text-lg font-bold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {orderData?.folio} <ExternalLink className="h-4 w-4" />
                    </Link>
                    <span className="text-sm font-semibold text-foreground">{clientName}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {orderData?.due_date && (
                      <span className="chip bg-secondary text-muted-foreground font-medium">
                        📅 Entrega: {dateFmt(orderData.due_date)}
                      </span>
                    )}
                    {orderData?.priority === "urgente" && (
                      <span className="chip bg-rose-500/15 text-rose-600 font-bold">🔥 Urgente</span>
                    )}
                    <span className="chip bg-primary/10 text-primary font-bold">
                      {orderDonePieces} / {orderTotalPieces} piezas
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-border/60">
                  {orderItems.map((it) => {
                    const done = it.is_done ? it.quantity : it.done_quantity || 0;
                    const isItemDone = it.is_done || done >= it.quantity;

                    return (
                      <div key={it.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-foreground">{it.product_name}</p>
                          <div className="flex items-center gap-2 text-muted-foreground text-xs mt-0.5">
                            {it.category === "CORTADORES" && it.cutter_size_cm && (
                              <span className="text-primary font-medium">
                                {it.cutter_size_cm} cm · {MODALITIES.find((m) => m.value === it.cutter_modality)?.label ?? "Cortador"}
                              </span>
                            )}
                            {it.notes && (
                              <span className="text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px]">
                                {it.notes}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-xs">
                            {done} / {it.quantity} pzas
                          </span>

                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 tap"
                            disabled={done <= 0}
                            onClick={() => handleUpdateItemProgress(it, done - 1, it.quantity)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 tap"
                            disabled={done >= it.quantity}
                            onClick={() => handleUpdateItemProgress(it, done + 1, it.quantity)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant={isItemDone ? "outline" : "default"}
                            className={cn(
                              "h-7 text-xs font-bold tap",
                              !isItemDone && "bg-primary text-primary-foreground hover:bg-primary/90",
                            )}
                            onClick={() =>
                              handleUpdateItemProgress(it, isItemDone ? 0 : it.quantity, it.quantity)
                            }
                          >
                            {isItemDone ? "Listo ✓" : "Completar"}
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
