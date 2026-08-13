import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  MessageCircle,
  Plus,
  Trash2,
  Check,
  ImagePlus,
  Paperclip,
  Truck,
  MapPin,
  Sparkles,
  Pencil,
  Package,
  FileText,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  useOrder,
  useInvalidate,
  useProfiles,
  useActivity,
  useProducts,
  usePriceRules,
  useProductThemes,
  priceFor,
} from "@/lib/queries";
import { ProductPicker } from "@/components/ProductPicker";
import {
  ORDER_STATUSES,
  STATUS_META,
  PAYMENT_META,
  PRIORITIES,
  PAYMENT_METHODS,
  CATEGORY_META,
  CATEGORIES,
  MODALITIES,
  SIZES,
  money,
  dateFmt,
  dateTimeFmt,
  fullName,
  whatsappLink,
  type OrderStatus,
  type Priority,
  type Modality,
  type Category,
} from "@/lib/cm";
import { uploadFile, logActivity } from "@/lib/storage";
import { StoredImage, type ImgRef } from "@/components/StoredImage";
import { ImageViewer } from "@/components/ImageViewer";
import { CustomerOrderSummaryModal, type SummaryOrderData } from "@/components/CustomerOrderSummaryModal";
import { OrderPrintSheetModal, type OrderPrintSheetData } from "@/components/OrderPrintSheetModal";
import { CustomDesignViewerModal } from "@/components/orders/CustomDesignViewerModal";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/pedidos/$orderId")({
  head: () => ({
    meta: [
      { title: "Detalle del pedido — Cookies Moon" },
      { name: "description", content: "Producción, pagos, notas y entrega del pedido." },
      { property: "og:title", content: "Detalle del pedido — Cookies Moon" },
      { property: "og:description", content: "Producción, pagos, notas y entrega del pedido." },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-display text-lg font-bold text-destructive">No se pudo cargar el pedido</p>
      <p className="mt-2 text-xs text-muted-foreground">{error?.message || "Ocurrió un error al consultar los datos."}</p>
      <div className="mt-4 flex justify-center gap-2">
        <Button size="sm" onClick={() => reset()} className="tap">
          Reintentar
        </Button>
        <Button size="sm" variant="outline" asChild className="tap">
          <Link to="/pedidos" search={{ cliente: undefined }}>Volver al tablero</Link>
        </Button>
      </div>
    </div>
  ),
  component: DetallePedido,
});

function DetallePedido() {
  const { orderId } = Route.useParams();
  const { data: order, isLoading } = useOrder(orderId);
  const { data: profiles } = useProfiles();
  const { data: activity } = useActivity();
  const { data: products = [] } = useProducts(false);
  const { data: rules } = usePriceRules();
  const { data: themes = [] } = useProductThemes();
  const invalidate = useInvalidate();
  const { isAdmin } = useAuth();
  const [viewer, setViewer] = useState<{ images: ImgRef[]; title: string } | null>(null);
  const [customDesignViewer, setCustomDesignViewer] = useState<{
    title: string;
    productSku?: string | null;
    isCustom?: boolean;
    customNotes?: string | null;
    customImages?: any[];
    catalogImages?: any[];
  } | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showPrintSheetModal, setShowPrintSheetModal] = useState(false);

  // Estados para Costo de Envío y Descuento editables
  const [shippingCostInput, setShippingCostInput] = useState<string>("0");
  const [discountInput, setDiscountInput] = useState<string>("0");

  useEffect(() => {
    if (order) {
      setShippingCostInput(String(order.shipping_cost ?? 0));
      setDiscountInput(String(order.discount ?? 0));
    }
  }, [order?.shipping_cost, order?.discount]);

  // Estados para AÑADIR artículo
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addCategoryFilter, setAddCategoryFilter] = useState<Category | "TODAS">("TODAS");
  const [addThemeFilter, setAddThemeFilter] = useState<string>("TODAS");
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const addSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [addDraftPriceInput, setAddDraftPriceInput] = useState<string>("0");
  const [addDraft, setAddDraft] = useState<{
    category: Category;
    product_id: string | null;
    product_name: string;
    product_sku: string | null;
    quantity: number;
    cutter_modality: Modality | null;
    cutter_size_cm: number | null;
    unit_price: number;
    price_overridden: boolean;
    notes: string;
    image_preview?: any;
  }>({
    category: "CORTADORES",
    product_id: null,
    product_name: "",
    product_sku: null,
    quantity: 1,
    cutter_modality: "cutter_only",
    cutter_size_cm: 8,
    unit_price: 0,
    price_overridden: false,
    notes: "",
  });

  // Estados para EDITAR artículo
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPriceInput, setEditingPriceInput] = useState<string>("0");
  const [editingItem, setEditingItem] = useState<{
    id: string;
    category: Category;
    product_name: string;
    product_sku: string | null;
    quantity: number;
    cutter_modality: Modality | null;
    cutter_size_cm: number | null;
    unit_price: number;
    price_overridden: boolean;
    price_override_reason: string | null;
    notes: string;
  } | null>(null);

  // Estado para ELIMINAR artículo
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  const refresh = async () => {
    await supabase.rpc("recalc_order", { _order_id: orderId });
    invalidate("order", "orders", "activity");
  };

  const computedDraftPrice = (draft: typeof addDraft) => {
    if (draft.price_overridden) return draft.unit_price;
    if (draft.category === "CORTADORES") {
      return priceFor(rules, draft.cutter_modality, draft.cutter_size_cm);
    }
    const p = products.find((x) => x.id === draft.product_id);
    return Number(p?.base_price ?? draft.unit_price ?? 0);
  };

  const handleProductSelect = (p: any | null) => {
    if (!p) {
      setAddDraftPriceInput("0");
      setAddDraft((prev) => ({
        ...prev,
        product_id: null,
        product_sku: null,
        product_name: "",
        unit_price: 0,
        price_overridden: false,
        image_preview: null,
      }));
      return;
    }
    const isCutter = p.category === "CORTADORES";
    const img = (p.product_images ?? []).find((i: any) => i.is_primary) ?? p.product_images?.[0];
    const initialPrice = isCutter
      ? priceFor(rules, addDraft.cutter_modality || "cutter_only", addDraft.cutter_size_cm || 8)
      : Number(p.base_price ?? 0);
    setAddDraftPriceInput(String(initialPrice));
    setAddDraft((prev) => ({
      ...prev,
      product_id: p.id,
      product_name: p.name,
      product_sku: p.sku,
      category: p.category,
      cutter_modality: isCutter ? prev.cutter_modality || "cutter_only" : null,
      cutter_size_cm: isCutter ? prev.cutter_size_cm || 8 : null,
      unit_price: initialPrice,
      price_overridden: false,
      image_preview: img,
    }));
  };

  const handleSaveNewItem = async () => {
    if (!addDraft.product_name.trim()) {
      toast.error("Selecciona un producto o escribe su nombre");
      return;
    }
    if (addDraft.quantity <= 0) {
      toast.error("La cantidad debe ser al menos 1");
      return;
    }
    const unitPrice = computedDraftPrice(addDraft);
    const subtotal = unitPrice * addDraft.quantity;

    const { error } = await supabase.from("order_items").insert({
      order_id: orderId,
      category: addDraft.category,
      product_id: addDraft.product_id,
      product_name: addDraft.product_name.trim(),
      product_sku: addDraft.product_sku,
      quantity: addDraft.quantity,
      cutter_modality: addDraft.category === "CORTADORES" ? addDraft.cutter_modality : null,
      cutter_size_cm: addDraft.category === "CORTADORES" ? addDraft.cutter_size_cm : null,
      unit_price: unitPrice,
      subtotal,
      price_overridden: addDraft.price_overridden,
      notes: addDraft.notes.trim() || null,
      sort_order: (order?.order_items ?? []).length,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await logActivity({
      action: `Artículo añadido: ${addDraft.quantity}x ${addDraft.product_name}`,
      entity: "order_item",
      order_id: orderId,
    });

    toast.success(`"${addDraft.product_name}" añadido al pedido`);
    setIsAddOpen(false);
    setAddDraft({
      category: "CORTADORES",
      product_id: null,
      product_name: "",
      product_sku: null,
      quantity: 1,
      cutter_modality: "cutter_only",
      cutter_size_cm: 8,
      unit_price: 0,
      price_overridden: false,
      notes: "",
    });
    setAddSearchQuery("");
    await refresh();
  };

  const openEditModal = (it: any) => {
    const rawPrice = Number(it.unit_price || 0);
    setEditingPriceInput(String(rawPrice));
    setEditingItem({
      id: it.id,
      category: it.category,
      product_name: it.product_name,
      product_sku: it.product_sku,
      quantity: it.quantity,
      cutter_modality: it.cutter_modality,
      cutter_size_cm: it.cutter_size_cm,
      unit_price: rawPrice,
      price_overridden: !!it.price_overridden,
      price_override_reason: it.price_override_reason,
      notes: it.notes || "",
    });
    setIsEditOpen(true);
  };

  const handleSaveEditedItem = async () => {
    if (!editingItem) return;
    if (!editingItem.product_name.trim()) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    if (editingItem.quantity <= 0) {
      toast.error("La cantidad debe ser al menos 1");
      return;
    }
    const unitPrice = parseFloat(String(editingItem.unit_price).replace(',', '.')) || 0;
    const subtotal = unitPrice * editingItem.quantity;

    const { error } = await supabase
      .from("order_items")
      .update({
        product_name: editingItem.product_name.trim(),
        cutter_modality: editingItem.category === "CORTADORES" ? editingItem.cutter_modality : null,
        cutter_size_cm: editingItem.category === "CORTADORES" ? editingItem.cutter_size_cm : null,
        quantity: editingItem.quantity,
        unit_price: unitPrice,
        subtotal,
        price_overridden: editingItem.price_overridden,
        price_override_reason: editingItem.price_override_reason || null,
        notes: editingItem.notes.trim() || null,
      })
      .eq("id", editingItem.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await logActivity({
      action: `Artículo modificado: ${editingItem.product_name}`,
      entity: "order_item",
      order_id: orderId,
    });

    toast.success("Artículo actualizado");
    setIsEditOpen(false);
    setEditingItem(null);
    await refresh();
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    const { error } = await supabase.from("order_items").delete().eq("id", itemToDelete.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity({
      action: `Artículo eliminado: ${itemToDelete.product_name}`,
      entity: "order_item",
      order_id: orderId,
    });
    toast.success(`"${itemToDelete.product_name}" eliminado del pedido`);
    setItemToDelete(null);
    await refresh();
  };

  if (isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>;
  if (!order) return <p className="py-16 text-center text-sm text-muted-foreground">Pedido no encontrado.</p>;

  const items = order.order_items ?? [];
  const totalUnits = items.reduce((a, i) => a + (Number(i.quantity) || 0), 0);
  const doneUnits = items.reduce((a, i) => a + (i.is_done ? (Number(i.quantity) || 0) : (Number(i.done_quantity) || 0)), 0);
  const pct = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 0;
  const wa = whatsappLink(order.customers?.phone);

  const ship = Array.isArray(order.shipping_details) ? order.shipping_details[0] : order.shipping_details;
  const pers = Array.isArray(order.personal_delivery_details) ? order.personal_delivery_details[0] : order.personal_delivery_details;

  const summaryData: SummaryOrderData = {
    id: order.id,
    folio: order.folio ?? "Pedido",
    created_at: order.created_at ?? new Date().toISOString(),
    customer_name: fullName(order.customers?.first_name, order.customers?.last_name) || "Cliente",
    delivery_type: order.delivery_type as any,
    items: (order.order_items ?? []).map((it: any) => {
      const customImg = it.order_item_images?.[0]?.storage_path;
      const prodImg = it.products?.product_images?.[0]?.storage_path;
      return {
        id: it.id,
        name: it.product_name,
        sku: it.product_sku || it.products?.sku || null,
        category: it.category,
        quantity: Number(it.quantity) || 1,
        cutter_modality: it.cutter_modality as Modality | null,
        cutter_size_cm: it.cutter_size_cm,
        unit_price: Number(it.unit_price || 0),
        subtotal: Number(it.subtotal || (it.unit_price || 0) * (it.quantity || 1)),
        image_path: customImg || prodImg || null,
      };
    }),
    subtotal: Number(order.subtotal || 0),
    discount: Number(order.discount || 0),
    shipping_cost: Number(order.shipping_cost || 0),
    total: Number(order.total || 0),
    total_paid: Number(order.paid_amount || 0),
    balance: Number(order.balance ?? (order.total - (order.paid_amount || 0))),
    is_paid: (order.balance ?? (order.total - (order.paid_amount || 0))) <= 0,
  };

  const printSheetData: OrderPrintSheetData = {
    id: order.id,
    folio: order.folio ?? "Pedido",
    created_at: order.created_at ?? new Date().toISOString(),
    due_date: order.due_date,
    priority: order.priority ?? "normal",
    status: order.status ?? "en_espera",
    client_notes: order.client_notes,
    customer: {
      first_name: order.customers?.first_name || "Cliente",
      last_name: order.customers?.last_name || null,
      phone: order.customers?.phone || null,
      email: null,
    },
    delivery: {
      type: (order.delivery_type as any) ?? "envio",
      street: ship?.street ?? null,
      ext_number: ship?.ext_number ?? null,
      int_number: ship?.int_number ?? null,
      neighborhood: ship?.neighborhood ?? null,
      postal_code: ship?.postal_code ?? null,
      city: ship?.city ?? null,
      municipality: ship?.municipality ?? null,
      state: ship?.state ?? null,
      references_text: ship?.references_text ?? null,
      carrier: ship?.carrier ?? null,
      tracking_number: ship?.tracking_number ?? null,
      shipping_cost: Number(ship?.shipping_cost || order.shipping_cost || 0),
      special_instructions: ship?.special_instructions ?? null,
      place: pers?.place ?? null,
      delivery_date: pers?.delivery_date ?? null,
      delivery_time: pers?.delivery_time ?? null,
      instructions: pers?.instructions ?? null,
    },
    items: (order.order_items ?? []).map((it: any) => ({
      id: it.id,
      name: it.product_name,
      sku: it.product_sku || it.products?.sku || null,
      category: it.category,
      quantity: Number(it.quantity) || 1,
      cutter_modality: it.cutter_modality as Modality,
      cutter_size_cm: it.cutter_size_cm,
      unit_price: Number(it.unit_price || 0),
      subtotal: Number(it.subtotal || (it.unit_price || 0) * (it.quantity || 1)),
      notes: it.notes,
      is_done: it.is_done,
    })),
    subtotal: Number(order.subtotal || 0),
    discount: Number(order.discount || 0),
    shipping_cost: Number(order.shipping_cost || 0),
    total: Number(order.total || 0),
    paid_amount: Number(order.paid_amount || 0),
    balance: Number(order.balance ?? (order.total - (order.paid_amount || 0))),
    payments: (order.payments ?? []).map((p: any) => ({
      id: p.id,
      amount: Number(p.amount || 0),
      method: p.method,
      paid_at: p.paid_at,
      reference: p.reference,
    })),
  };

  type OrderPatch = Database["public"]["Tables"]["orders"]["Update"];

  const patchOrder = async (patch: OrderPatch, label: string) => {
    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (patch.shipping_cost !== undefined && ship) {
      await supabase
        .from("shipping_details")
        .update({ shipping_cost: patch.shipping_cost })
        .eq("order_id", orderId);
    }
    if (patch.shipping_cost !== undefined || patch.discount !== undefined) {
      await supabase.rpc("recalc_order", { _order_id: orderId });
    }
    await logActivity({ action: label, entity: "order", order_id: orderId });
    toast.success(label);
    refresh();
  };

  const updateShippingCost = async (newCost: number) => {
    await patchOrder({ shipping_cost: newCost }, `Costo de envío actualizado a ${money(newCost)}`);
  };

  const setItemDone = async (id: string, done: boolean, qty: number) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("order_items")
      .update({
        is_done: done,
        done_quantity: done ? qty : 0,
        done_at: done ? new Date().toISOString() : null,
        done_by: done ? (u.user?.id ?? null) : null,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity({
      action: done ? "Artículo marcado como listo" : "Artículo reabierto",
      entity: "order_item",
      order_id: orderId,
    });
    refresh();
  };

  const setItemQty = async (id: string, doneQty: number, qty: number) => {
    const value = Math.max(0, Math.min(qty, doneQty));
    await supabase
      .from("order_items")
      .update({ done_quantity: value, is_done: value >= qty })
      .eq("id", id);
    refresh();
  };

  const uploadItemImage = async (itemId: string, file: File) => {
    const storage_path = await uploadFile("pedidos", file, orderId);
    const { data: u } = await supabase.auth.getUser();
    await supabase
      .from("order_item_images")
      .insert({ order_item_id: itemId, storage_path, created_by: u.user?.id ?? null });
    toast.success("Imagen agregada");
    invalidate("order");
  };

  return (
    <>
      <Link to="/pedidos" search={{ cliente: undefined }} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a pedidos
      </Link>

      <PageHeader
        title={order.folio ?? "Pedido"}
        subtitle={`${fullName(order.customers?.first_name, order.customers?.last_name)} · ${dateTimeFmt(order.created_at)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="tap font-medium border-primary/40 hover:bg-primary/10"
              onClick={() => setShowSummaryModal(true)}
            >
              <Sparkles className="mr-1.5 h-4 w-4 text-primary" /> Resumen para clienta
            </Button>
            <Button
              variant="outline"
              className="tap font-medium border-primary/40 hover:bg-primary/10"
              onClick={() => setShowPrintSheetModal(true)}
            >
              <FileText className="mr-1.5 h-4 w-4 text-primary" /> Imprimir pedido (Carta)
            </Button>
            {wa && (
              <Button asChild variant="secondary" className="tap">
                <a href={wa} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
                </a>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Producción</span>
              <span className="text-muted-foreground">
                {doneUnits} / {totalUnits} piezas ({pct}%)
              </span>
            </div>
            <Progress value={pct} />
          </section>

          <Tabs defaultValue="articulos">
            <TabsList className="w-full">
              <TabsTrigger value="articulos" className="flex-1">
                Artículos
              </TabsTrigger>
              <TabsTrigger value="pagos" className="flex-1">
                Pagos
              </TabsTrigger>
              <TabsTrigger value="notas" className="flex-1">
                Notas
              </TabsTrigger>
              <TabsTrigger value="entrega" className="flex-1">
                Entrega
              </TabsTrigger>
            </TabsList>

            <TabsContent value="articulos" className="mt-4 space-y-3">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Artículos del pedido ({items.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">{totalUnits} piezas en total</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                  className="tap font-bold h-8 text-xs bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <Plus className="mr-1 h-3.5 w-3.5 stroke-[3]" /> Añadir artículo
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="font-medium">No hay artículos en este pedido.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddOpen(true)}
                    className="tap mt-3 text-xs"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Añadir el primer artículo
                  </Button>
                </div>
              ) : (
                items.map((it) => {
                  const customImgs = it.order_item_images ?? [];
                  const catalogImgs = ((it as { products?: { product_images?: ImgRef[] } }).products?.product_images ?? []) as ImgRef[];
                  const primaryCustomImg = customImgs.find((img: any) => img.is_primary) ?? customImgs[0];
                  const primaryCatalogImg = catalogImgs.find((img: any) => img.is_primary) ?? catalogImgs[0];
                  const displayThumb = primaryCustomImg ?? primaryCatalogImg;

                  const catMeta = (it.category && CATEGORY_META[it.category as Category]) ?? CATEGORY_META.OTROS;
                  const isCustom = it.is_custom || customImgs.length > 0;

                  return (
                    <div
                      key={it.id}
                      className={cn(
                        "panel p-3 transition-all",
                        isCustom && "border-amber-500/40 bg-amber-500/5",
                      )}
                    >
                      <div className="flex gap-3">
                        <button
                          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary hover:ring-2 hover:ring-primary transition-all"
                          onClick={() =>
                            setCustomDesignViewer({
                              title: it.product_name,
                              productSku: it.product_sku,
                              isCustom,
                              customNotes: it.notes,
                              customImages: customImgs,
                              catalogImages: catalogImgs,
                            })
                          }
                          aria-label="Ver diseño"
                        >
                          {displayThumb ? (
                            <StoredImage image={displayThumb} className="h-full w-full object-contain p-0.5" alt={it.product_name} />
                          ) : (
                            <Package className="h-6 w-6 text-muted-foreground/40 mx-auto mt-7" />
                          )}
                          {customImgs.length > 0 && (
                            <span className="absolute bottom-1 right-1 rounded bg-black/85 px-1 text-[9px] font-bold text-white shadow-sm">
                              📷 {customImgs.length}
                            </span>
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="chip text-[10px] py-0 px-1.5"
                                style={{
                                  color: `var(--${catMeta.token})`,
                                  background: `color-mix(in oklab, var(--${catMeta.token}) 16%, transparent)`,
                                }}
                              >
                                {catMeta.label}
                              </span>
                              {isCustom && (
                                <span className="chip text-[10px] py-0 px-1.5 bg-amber-500/20 text-amber-400 font-bold flex items-center gap-1">
                                  <Sparkles className="h-2.5 w-2.5" /> PERSONALIZADO
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="tap h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => openEditModal(it)}
                                title="Editar artículo"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="tap h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => setItemToDelete(it)}
                                title="Eliminar artículo"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <p className="mt-1 text-sm font-semibold">{it.product_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {it.product_sku ? `${it.product_sku} · ` : ""}
                            {it.category === "CORTADORES" && it.cutter_size_cm
                              ? `${it.cutter_size_cm} cm · ${
                                  MODALITIES.find((m) => m.value === it.cutter_modality)?.label ?? ""
                                } · `
                              : ""}
                            <span className="font-bold text-foreground">{it.quantity}</span> × {money(it.unit_price)} ={" "}
                            <span className="font-semibold text-primary">{money(it.subtotal)}</span>
                          </p>
                          {it.price_overridden && (
                            <p className="text-xs" style={{ color: "var(--st-pausado)" }}>
                              Precio manual: {it.price_override_reason ?? "sin motivo"}
                            </p>
                          )}
                          {it.notes && (
                            <p className="mt-1 text-xs text-amber-400/95 italic bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                              📝 <strong>Indicaciones:</strong> {it.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                          <Checkbox
                            checked={it.is_done}
                            onCheckedChange={(v) => setItemDone(it.id, !!v, it.quantity)}
                          />
                          Listo
                        </label>
                        {it.quantity > 1 && !it.is_done && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Avance</span>
                            <Input
                              className="tap h-9 w-20"
                              inputMode="numeric"
                              value={it.done_quantity}
                              onChange={(e) => setItemQty(it.id, Number(e.target.value) || 0, it.quantity)}
                            />
                            <span className="text-muted-foreground">/ {it.quantity}</span>
                          </div>
                        )}
                        {it.done_at && (
                          <span className="text-xs text-muted-foreground">
                            <Check className="mr-1 inline h-3 w-3" />
                            {dateTimeFmt(it.done_at)}
                          </span>
                        )}

                        {/* Botón rápido para ver diseño con 1 solo toque */}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="tap h-7 px-2.5 text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 ml-auto"
                          onClick={() =>
                            setCustomDesignViewer({
                              title: it.product_name,
                              productSku: it.product_sku,
                              isCustom,
                              customNotes: it.notes,
                              customImages: customImgs,
                              catalogImages: catalogImgs,
                            })
                          }
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" /> Ver diseño
                          {customImgs.length > 0 && (
                            <span className="ml-1 text-[10px] font-bold">({customImgs.length})</span>
                          )}
                        </Button>

                        <label className="tap flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <ImagePlus className="h-4 w-4" /> + Foto
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              e.target.files?.[0] && uploadItemImage(it.id, e.target.files[0])
                            }
                          />
                        </label>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="pagos" className="mt-4">
              <Pagos order={order} onChange={refresh} />
            </TabsContent>

            <TabsContent value="notas" className="mt-4">
              <Notas orderId={orderId} notes={order.order_notes ?? []} onChange={() => invalidate("order")} />
            </TabsContent>

            <TabsContent value="entrega" className="mt-4">
              <Entrega
                order={order}
                onPrintOrder={() => setShowPrintSheetModal(true)}
                onUpdateShippingCost={updateShippingCost}
              />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="panel p-4">
            <h2 className="mb-3 font-display text-lg">Resumen</h2>
            <div className="space-y-1 text-sm">
              <Row label="Artículos" value={money(order.subtotal)} />
              <Row label="Descuento" value={`-${money(order.discount)}`} />
              <Row label="Envío" value={money(order.shipping_cost)} />
              <div className="flex justify-between border-t border-border pt-1 font-semibold">
                <span>Total</span>
                <span>{money(order.total)}</span>
              </div>
              <Row label="Pagado" value={money(order.paid_amount)} />
              <div className="flex justify-between font-bold" style={{ color: "var(--st-espera)" }}>
                <span>Saldo</span>
                <span>{money(order.balance)}</span>
              </div>
            </div>
          </section>

          <section className="panel space-y-3 p-4">
            <h2 className="font-display text-lg">Gestión</h2>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={order.status}
                onValueChange={(v) =>
                  patchOrder({ status: v as OrderStatus }, "Estado actualizado")
                }
              >
                <SelectTrigger className="tap">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select
                value={order.priority}
                onValueChange={(v) => patchOrder({ priority: v as Priority }, "Prioridad actualizada")}
              >
                <SelectTrigger className="tap">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select
                value={order.assignee_id ?? "none"}
                onValueChange={(v) =>
                  patchOrder({ assignee_id: v === "none" ? null : v }, "Responsable actualizado")
                }
              >
                <SelectTrigger className="tap">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {(profiles ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha límite</Label>
              <Input
                type="date"
                className="tap"
                value={order.due_date ?? ""}
                onChange={(e) =>
                  patchOrder({ due_date: e.target.value || null }, "Fecha límite actualizada")
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Descuento ($)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="tap"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                onBlur={() => {
                  const val = parseFloat(discountInput.replace(',', '.')) || 0;
                  if (val !== Number(order.discount || 0)) {
                    patchOrder({ discount: val }, "Descuento actualizado");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Costo de envío ($)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="tap"
                value={shippingCostInput}
                onChange={(e) => setShippingCostInput(e.target.value)}
                onBlur={() => {
                  const val = parseFloat(shippingCostInput.replace(',', '.')) || 0;
                  if (val !== Number(order.shipping_cost || 0)) {
                    patchOrder({ shipping_cost: val }, "Costo de envío actualizado");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
            </div>
            {isAdmin && (
              <Button
                variant="destructive"
                className="tap mt-4 w-full"
                onClick={async () => {
                  if (!confirm("¿Eliminar pedido? Esta acción no se puede deshacer.")) return;
                  await supabase.from("orders").delete().eq("id", orderId);
                  toast.success("Pedido eliminado");
                  history.back();
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar pedido
              </Button>
            )}
          </section>

          <section className="panel p-4">
            <h2 className="mb-3 font-display text-lg">Historial</h2>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {(activity ?? []).map((a) => (
                <div key={a.id} className="text-xs">
                  <p className="font-medium">{a.action}</p>
                  <p className="text-muted-foreground">
                    {profiles?.find((p) => p.id === a.user_id)?.full_name ?? "Sistema"} ·{" "}
                    {dateTimeFmt(a.created_at)}
                  </p>
                </div>
              ))}
              {(activity ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Sin movimientos.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-lg">
              <Plus className="h-5 w-5 text-primary stroke-[3]" /> Añadir artículo a este pedido
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <ProductPicker
              products={products}
              themes={themes}
              categoryFilter={addCategoryFilter}
              onCategoryFilterChange={setAddCategoryFilter}
              themeFilter={addThemeFilter}
              onThemeFilterChange={setAddThemeFilter}
              searchQuery={addSearchQuery}
              onSearchQueryChange={setAddSearchQuery}
              searchInputRef={addSearchInputRef}
              selectedProductId={addDraft.product_id}
              onSelect={handleProductSelect}
            />

            <div className="rounded-xl border border-primary/40 bg-secondary/50 p-4 space-y-4">
              <div className="flex items-center gap-3 border-b border-border/60 pb-3">
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                  {addDraft.image_preview ? (
                    <StoredImage
                      image={addDraft.image_preview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground opacity-60" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {addDraft.product_sku && (
                      <span className="font-mono text-xs font-bold text-primary">
                        {addDraft.product_sku}
                      </span>
                    )}
                    <span
                      className="chip text-[10px] py-0 px-1.5"
                      style={{
                        color: `var(--${CATEGORY_META[addDraft.category].token})`,
                        background: `color-mix(in oklab, var(--${CATEGORY_META[addDraft.category].token}) 16%, transparent)`,
                      }}
                    >
                      {CATEGORY_META[addDraft.category].label}
                    </span>
                  </div>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {addDraft.product_name || "Artículo personalizado"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {!addDraft.product_id && (
                  <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                    <Label className="text-xs">Nombre del artículo *</Label>
                    <Input
                      className="tap h-9 text-sm"
                      placeholder="Escribe el nombre del artículo..."
                      value={addDraft.product_name}
                      onChange={(e) =>
                        setAddDraft((prev) => ({ ...prev, product_name: e.target.value }))
                      }
                      autoFocus
                    />
                  </div>
                )}

                {addDraft.category === "CORTADORES" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Modalidad</Label>
                      <Select
                        value={addDraft.cutter_modality ?? "cutter_only"}
                        onValueChange={(v) => {
                          const newMod = v as Modality;
                          const autoPrice = priceFor(rules, newMod, addDraft.cutter_size_cm || 8);
                          setAddDraftPriceInput(String(autoPrice));
                          setAddDraft((prev) => ({
                            ...prev,
                            cutter_modality: newMod,
                            unit_price: autoPrice,
                            price_overridden: false,
                          }));
                        }}
                      >
                        <SelectTrigger className="tap h-9 text-xs">
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
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Tamaño</Label>
                      <Select
                        value={String(addDraft.cutter_size_cm ?? 8)}
                        onValueChange={(v) => {
                          const newSize = Number(v);
                          const autoPrice = priceFor(rules, addDraft.cutter_modality || "cutter_only", newSize);
                          setAddDraftPriceInput(String(autoPrice));
                          setAddDraft((prev) => ({
                            ...prev,
                            cutter_size_cm: newSize,
                            unit_price: autoPrice,
                            price_overridden: false,
                          }));
                        }}
                      >
                        <SelectTrigger className="tap h-9 text-xs">
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
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Cantidad</Label>
                  <div className="flex items-center rounded-lg border border-border bg-background">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center text-base font-bold text-muted-foreground hover:bg-secondary rounded-l-lg"
                      onClick={() =>
                        setAddDraft((prev) => ({
                          ...prev,
                          quantity: Math.max(1, prev.quantity - 1),
                        }))
                      }
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      className="h-9 w-full border-0 bg-transparent text-center text-sm font-bold focus:outline-none"
                      value={addDraft.quantity}
                      onChange={(e) =>
                        setAddDraft((prev) => ({
                          ...prev,
                          quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center text-base font-bold text-muted-foreground hover:bg-secondary rounded-r-lg"
                      onClick={() =>
                        setAddDraft((prev) => ({
                          ...prev,
                          quantity: prev.quantity + 1,
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                </div>

                {addDraft.category !== "CORTADORES" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Precio unitario ($)</Label>
                    <Input
                      className="tap h-9 text-sm"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={addDraftPriceInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setAddDraftPriceInput(raw);
                        const parsed = parseFloat(raw.replace(',', '.')) || 0;
                        setAddDraft((prev) => ({
                          ...prev,
                          price_overridden: true,
                          unit_price: parsed,
                        }));
                      }}
                    />
                  </div>
                )}

                <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                  <Label className="text-xs">Notas del artículo (opcional)</Label>
                  <Input
                    className="tap h-9 text-sm"
                    placeholder="Ej. Personalización, color, etc."
                    value={addDraft.notes}
                    onChange={(e) => setAddDraft((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-background/80 p-3 border border-border">
                <div className="text-xs">
                  <span className="text-muted-foreground">Subtotal nuevo artículo: </span>
                  <span className="font-display text-base font-bold text-primary">
                    {money(computedDraftPrice(addDraft) * addDraft.quantity)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="tap"
              onClick={() => setIsAddOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="tap font-bold bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSaveNewItem}
            >
              <Plus className="mr-1.5 h-4 w-4 stroke-[3]" /> Añadir al pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-lg">
              <Pencil className="h-4 w-4 text-primary" /> Editar artículo del pedido
            </DialogTitle>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-secondary p-2.5">
                {editingItem.product_sku && (
                  <p className="text-xs font-mono font-bold text-primary">{editingItem.product_sku}</p>
                )}
                <div className="space-y-1 mt-1">
                  <Label className="text-xs">Nombre del artículo</Label>
                  <Input
                    className="tap h-9 text-sm"
                    value={editingItem.product_name}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, product_name: e.target.value })
                    }
                  />
                </div>
              </div>

              {editingItem.category === "CORTADORES" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Modalidad</Label>
                    <Select
                      value={editingItem.cutter_modality ?? "cutter_only"}
                      onValueChange={(v) => {
                        const newMod = v as Modality;
                        const autoPrice = priceFor(rules, newMod, editingItem.cutter_size_cm);
                        setEditingPriceInput(String(autoPrice));
                        setEditingItem({
                          ...editingItem,
                          cutter_modality: newMod,
                          unit_price: autoPrice,
                          price_overridden: false,
                        });
                      }}
                    >
                      <SelectTrigger className="tap text-xs">
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
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Tamaño</Label>
                    <Select
                      value={String(editingItem.cutter_size_cm ?? 8)}
                      onValueChange={(v) => {
                        const newSize = Number(v);
                        const autoPrice = priceFor(rules, editingItem.cutter_modality, newSize);
                        setEditingPriceInput(String(autoPrice));
                        setEditingItem({
                          ...editingItem,
                          cutter_size_cm: newSize,
                          unit_price: autoPrice,
                          price_overridden: false,
                        });
                      }}
                    >
                      <SelectTrigger className="tap text-xs">
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
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Cantidad</Label>
                <div className="flex items-center rounded-lg border border-border bg-background">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center text-base font-bold text-muted-foreground hover:bg-secondary rounded-l-lg"
                    onClick={() =>
                      setEditingItem({
                        ...editingItem,
                        quantity: Math.max(1, editingItem.quantity - 1),
                      })
                    }
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    className="h-9 w-full border-0 bg-transparent text-center text-sm font-bold focus:outline-none"
                    value={editingItem.quantity}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center text-base font-bold text-muted-foreground hover:bg-secondary rounded-r-lg"
                    onClick={() =>
                      setEditingItem({
                        ...editingItem,
                        quantity: editingItem.quantity + 1,
                      })
                    }
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Precio unitario ($)</Label>
                <Input
                  className="tap text-sm"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={editingPriceInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setEditingPriceInput(raw);
                    const parsed = parseFloat(raw.replace(',', '.')) || 0;
                    setEditingItem({
                      ...editingItem,
                      price_overridden: true,
                      unit_price: parsed,
                    });
                  }}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notas del artículo</Label>
                <Textarea
                  rows={2}
                  className="text-sm"
                  value={editingItem.notes}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                />
              </div>

              <div className="rounded-lg bg-secondary/50 p-2.5 text-right text-xs">
                <span className="text-muted-foreground">Nuevo subtotal: </span>
                <span className="font-display text-base font-bold text-primary">
                  {money(editingItem.unit_price * editingItem.quantity)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="tap"
              onClick={() => setIsEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="tap font-bold bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSaveEditedItem}
            >
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-display text-lg">
              <Trash2 className="h-5 w-5" /> ¿Eliminar artículo del pedido?
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground py-2">
            ¿Estás seguro de que deseas eliminar <strong>"{itemToDelete?.product_name}"</strong> ({itemToDelete?.quantity} pzas) de este pedido?
            Los subtotales y saldo se recalcularán automáticamente.
          </p>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="tap"
              onClick={() => setItemToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="tap font-bold"
              onClick={confirmDeleteItem}
            >
              Eliminar artículo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomDesignViewerModal
        open={!!customDesignViewer}
        onOpenChange={(open) => !open && setCustomDesignViewer(null)}
        title={customDesignViewer?.title ?? "Artículo"}
        productSku={customDesignViewer?.productSku}
        isCustom={customDesignViewer?.isCustom}
        customNotes={customDesignViewer?.customNotes}
        customImages={customDesignViewer?.customImages ?? []}
        catalogImages={customDesignViewer?.catalogImages ?? []}
      />

      <ImageViewer
        open={!!viewer}
        onOpenChange={(v) => !v && setViewer(null)}
        images={viewer?.images ?? []}
        title={viewer?.title ?? "Imágenes"}
      />

      <CustomerOrderSummaryModal
        open={showSummaryModal}
        onOpenChange={setShowSummaryModal}
        order={summaryData}
      />

      <OrderPrintSheetModal
        open={showPrintSheetModal}
        onOpenChange={setShowPrintSheetModal}
        order={printSheetData}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

type OrderData = NonNullable<ReturnType<typeof useOrder>["data"]>;

function Pagos({ order, onChange }: { order: OrderData; onChange: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0]!);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<ImgRef[] | null>(null);

  const add = async () => {
    const value = parseFloat(String(amount).replace(',', '.'));
    if (!value || value <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("payments")
        .insert({
          order_id: order.id,
          amount: value,
          method,
          reference: reference || null,
          notes: notes || null,
          created_by: u.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (file) {
        const storage_path = await uploadFile("comprobantes", file, order.id);
        await supabase.from("payment_attachments").insert({ payment_id: data.id, storage_path });
      }
      await logActivity({
        action: "Pago registrado",
        entity: "payment",
        order_id: order.id,
        detail: `${money(value)} · ${method}`,
      });
      toast.success("Pago registrado");
      setAmount("");
      setReference("");
      setNotes("");
      setFile(null);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar");
    } finally {
      setBusy(false);
    }
  };

  const currentBalance = Math.max(0, Number(order.balance ?? (order.total - (order.paid_amount || 0))));
  const halfDeposit = Number((Number(order.total || 0) / 2).toFixed(2));

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg">Registrar pago</h3>
          {currentBalance <= 0 ? (
            <span className="chip bg-emerald-500/15 text-emerald-500 font-bold text-xs">
              ✓ Pedido 100% pagado
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Saldo pendiente: <strong className="text-foreground">{money(currentBalance)}</strong>
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Monto</Label>
              {currentBalance > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAmount(String(currentBalance))}
                    className="chip text-[10px] py-0 px-1.5 bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors"
                  >
                    ⚡ Liquidar ({money(currentBalance)})
                  </button>
                  {Number(order.paid_amount || 0) === 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(String(halfDeposit))}
                      className="chip text-[10px] py-0 px-1.5 bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      50% ({money(halfDeposit)})
                    </button>
                  )}
                </div>
              )}
            </div>
            <Input
              className="tap"
              inputMode="decimal"
              placeholder={`Ej. ${currentBalance > 0 ? currentBalance : "0"}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Método</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="tap">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Referencia</Label>
            <Input className="tap" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Comprobante</Label>
            <label className="tap flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border text-xs text-muted-foreground">
              <Paperclip className="h-4 w-4" />
              {file ? file.name : "Adjuntar imagen"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Notas</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <Button onClick={add} disabled={busy} className="tap mt-3 w-full font-semibold">
          <Plus className="mr-1 h-4 w-4" /> Agregar pago
        </Button>
      </div>

      <div className="panel divide-y divide-border">
        {(order.payments ?? []).map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <span className="font-semibold">{money(p.amount)}</span>
            <span className="chip bg-secondary text-muted-foreground">{p.method}</span>
            <span className="text-xs text-muted-foreground">{dateTimeFmt(p.paid_at)}</span>
            {p.reference && <span className="text-xs text-muted-foreground">Ref. {p.reference}</span>}
            {(p.payment_attachments ?? []).length > 0 && (
              <button
                className="chip bg-secondary text-xs"
                onClick={() => setViewer(p.payment_attachments as ImgRef[])}
              >
                Ver comprobante
              </button>
            )}
            <button
              className="ml-auto text-destructive"
              aria-label="Eliminar pago"
              onClick={async () => {
                if (!confirm("¿Eliminar este pago?")) return;
                await supabase.from("payments").delete().eq("id", p.id);
                await logActivity({ action: "Pago eliminado", entity: "payment", order_id: order.id });
                onChange();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {(order.payments ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin pagos registrados.</p>
        )}
      </div>

      <ImageViewer
        open={!!viewer}
        onOpenChange={(v) => !v && setViewer(null)}
        images={viewer ?? []}
        title="Comprobante"
      />
    </div>
  );
}

function Notas({
  orderId,
  notes,
  onChange,
}: {
  orderId: string;
  notes: OrderData["order_notes"];
  onChange: () => void;
}) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<ImgRef[] | null>(null);

  const add = async () => {
    if (!body.trim() && !file) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("order_notes")
        .insert({ order_id: orderId, body: body.trim() || null, created_by: u.user?.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      if (file) {
        const storage_path = await uploadFile("notas", file, orderId);
        await supabase
          .from("note_attachments")
          .insert({ note_id: data.id, storage_path, file_name: file.name });
      }
      await logActivity({ action: "Nota agregada", entity: "order_note", order_id: orderId });
      setBody("");
      setFile(null);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la nota");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <Textarea
          rows={3}
          placeholder="Escribe una nota del pedido…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <label className="tap flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border text-xs text-muted-foreground">
            <Paperclip className="h-4 w-4" />
            {file ? file.name : "Adjuntar imagen"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button onClick={add} disabled={busy} className="tap font-semibold">
            Agregar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {(notes ?? []).map((n) => (
          <div key={n.id} className="panel p-3">
            <p className="text-sm">{n.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">{dateTimeFmt(n.created_at)}</p>
            {(n.note_attachments ?? []).length > 0 && (
              <button
                className="chip mt-2 bg-secondary text-xs"
                onClick={() => setViewer(n.note_attachments as ImgRef[])}
              >
                Ver {n.note_attachments.length} adjunto(s)
              </button>
            )}
          </div>
        ))}
        {(notes ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin notas.</p>
        )}
      </div>

      <ImageViewer
        open={!!viewer}
        onOpenChange={(v) => !v && setViewer(null)}
        images={viewer ?? []}
        title="Adjuntos"
      />
    </div>
  );
}

function Entrega({
  order,
  onPrintOrder,
  onUpdateShippingCost,
}: {
  order: OrderData;
  onPrintOrder?: () => void;
  onUpdateShippingCost?: (cost: number) => Promise<void>;
}) {
  const s = (Array.isArray(order.shipping_details) ? order.shipping_details[0] : order.shipping_details) as any;
  const d = (Array.isArray(order.personal_delivery_details) ? order.personal_delivery_details[0] : order.personal_delivery_details) as any;
  const [editingCost, setEditingCost] = useState(false);
  const [costInput, setCostInput] = useState(String(order.shipping_cost ?? s?.shipping_cost ?? 0));
  const [savingCost, setSavingCost] = useState(false);

  useEffect(() => {
    setCostInput(String(order.shipping_cost ?? s?.shipping_cost ?? 0));
  }, [order.shipping_cost, s?.shipping_cost]);

  const handleSaveCost = async () => {
    if (!onUpdateShippingCost) return;
    setSavingCost(true);
    try {
      const parsed = parseFloat(costInput.replace(',', '.')) || 0;
      await onUpdateShippingCost(parsed);
      setEditingCost(false);
    } finally {
      setSavingCost(false);
    }
  };

  if (order.delivery_type === "envio" && s)
    return (
      <div className="panel space-y-3 p-4 text-sm">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="flex items-center gap-2 font-display text-lg">
            <Truck className="h-4 w-4 text-primary" /> Envío por Paquetería
          </h3>
          {onPrintOrder && (
            <Button
              size="sm"
              variant="outline"
              className="tap text-xs font-semibold border-primary/40 hover:bg-primary/10"
              onClick={onPrintOrder}
            >
              <FileText className="mr-1.5 h-3.5 w-3.5 text-primary" /> Imprimir Hoja del Pedido
            </Button>
          )}
        </div>

        <div className="grid gap-1">
          <p className="font-semibold text-foreground text-base">
            {fullName(s.first_name, s.last_name)}
          </p>
          <p className="text-muted-foreground font-mono">{s.phone ?? "Sin teléfono"}</p>
          <p className="text-foreground">
            {[s.street, s.ext_number && `#${s.ext_number}`, s.int_number && `Int. ${s.int_number}`, s.neighborhood]
              .filter(Boolean)
              .join(" ")}
          </p>
          <p className="text-muted-foreground font-semibold">
            {[s.postal_code && `C.P. ${s.postal_code}`, s.city, s.municipality, s.state].filter(Boolean).join(", ")}
          </p>
          {s.references_text && (
            <p className="text-xs text-amber-600 dark:text-amber-300 bg-amber-500/10 p-2 rounded mt-1">
              <strong>Ref:</strong> {s.references_text}
            </p>
          )}
        </div>

        <div className="border-t border-border pt-2 grid gap-1.5 text-xs text-muted-foreground">
          <p>
            Paquetería: <strong className="text-foreground">{s.carrier ?? "—"}</strong> · Guía:{" "}
            <strong className="text-foreground font-mono">{s.tracking_number ?? "pendiente"}</strong>
          </p>
          <div className="flex flex-wrap items-center gap-2 py-0.5">
            <span>Costo de envío:</span>
            {editingCost ? (
              <div className="inline-flex items-center gap-1.5">
                <Input
                  className="tap h-7 w-24 text-xs"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveCost();
                    if (e.key === "Escape") setEditingCost(false);
                  }}
                />
                <Button
                  size="sm"
                  className="tap h-7 px-2.5 text-xs bg-primary text-primary-foreground font-semibold"
                  disabled={savingCost}
                  onClick={handleSaveCost}
                >
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="tap h-7 px-2 text-xs"
                  disabled={savingCost}
                  onClick={() => setEditingCost(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5">
                <strong className="text-foreground font-semibold text-sm">
                  {money(order.shipping_cost || s.shipping_cost || 0)}
                </strong>
                {onUpdateShippingCost && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="tap h-6 px-2 text-[11px] font-medium text-primary border-primary/30 hover:bg-primary/10"
                    onClick={() => setEditingCost(true)}
                  >
                    ✏️ Modificar
                  </Button>
                )}
              </div>
            )}
          </div>
          {s.special_instructions && (
            <p>Instrucciones: {s.special_instructions}</p>
          )}
          <p>Fecha estimada de despacho: {dateFmt(s.estimated_ship_date)}</p>
        </div>
      </div>
    );

  if (d)
    return (
      <div className="panel space-y-3 p-4 text-sm">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="flex items-center gap-2 font-display text-lg">
            <MapPin className="h-4 w-4 text-primary" /> Entrega personal
          </h3>
          {onPrintOrder && (
            <Button
              size="sm"
              variant="outline"
              className="tap text-xs font-semibold border-primary/40 hover:bg-primary/10"
              onClick={onPrintOrder}
            >
              <FileText className="mr-1.5 h-3.5 w-3.5 text-primary" /> Imprimir Hoja del Pedido
            </Button>
          )}
        </div>

        <div className="grid gap-1">
          <p className="font-semibold text-foreground text-base">
            {fullName(d.first_name, d.last_name)}
          </p>
          <p className="text-muted-foreground font-mono">{d.phone ?? "Sin teléfono"}</p>
          <p className="text-foreground">📍 Lugar: <strong className="text-foreground">{d.place ?? "—"}</strong></p>
          <p className="text-muted-foreground">
            📅 Fecha: {dateFmt(d.delivery_date)} {d.delivery_time ? `· ⏰ ${d.delivery_time}` : ""}
          </p>
          {d.instructions && (
            <p className="text-xs text-amber-600 dark:text-amber-300 bg-amber-500/10 p-2 rounded mt-1">
              <strong>Nota:</strong> {d.instructions}
            </p>
          )}
        </div>
      </div>
    );

  return (
    <div className="panel p-8 text-center text-sm text-muted-foreground">
      Este pedido no tiene datos de entrega.
    </div>
  );
}
